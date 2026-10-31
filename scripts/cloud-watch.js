// cloud-watch.js: follows films made by a Claude Code agent in the cloud (job status "cloud").
// Every minute it reads the job's GitHub branch (opts.cloud: repo, branch, film): new lines of chmura/POSTEP.md go
// into the job log (contact sheets from chmura/podglad/ are copied into the job folder so the log shows them), and
// when renders-chmura/<film>.mp4 appears the film is filed as a video of the workspace, like a local render.
// Runs as its own process (launchd), so the Studio server keeps rendering without a restart.
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = resolve(process.env.DATA_DIR || join(ROOT, 'data'));
const db = new Database(join(DATA, 'cloud.db'));
db.pragma('busy_timeout = 5000');

const gh = (args, opts = {}) => execFileSync('gh', args, { maxBuffer: 300 * 1024 * 1024, timeout: 120_000, ...opts });
const raw = (repo, branch, path) => gh(['api', `repos/${repo}/contents/${path}?ref=${branch}`, '-H', 'Accept: application/vnd.github.raw']);
const exists = (repo, branch, path) => { try { gh(['api', `repos/${repo}/contents/${path}?ref=${branch}`, '--jq', '.sha'], { stdio: ['ignore', 'pipe', 'ignore'] }); return true; } catch { return false; } };
const stamp = () => new Date().toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour12: false });

function log(id, line) {
  const j = db.prepare('SELECT log FROM gen_jobs WHERE id=?').get(id);
  db.prepare('UPDATE gen_jobs SET log=? WHERE id=?').run((j.log + `${stamp()} ${line}\n`).slice(-60_000), id);
}
function setOpts(id, patch) {
  const o = JSON.parse(db.prepare('SELECT opts FROM gen_jobs WHERE id=?').get(id).opts || '{}');
  db.prepare('UPDATE gen_jobs SET opts=? WHERE id=?').run(JSON.stringify({ ...o, cloud: { ...o.cloud, ...patch } }), id);
}
function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type:format=duration', '-of', 'json', file], { encoding: 'utf8' }));
  const types = (j.streams || []).map(s => s.codec_type);
  return { video: types.includes('video'), audio: types.includes('audio'), duration: Math.round(Number(j.format?.duration || 0) * 10) / 10 };
}

/** The film is back: same filing as the server's finish() for a local render. */
function deliver(job, c, dir) {
  const file = join(dir, 'final.mp4');
  writeFileSync(file, raw(c.repo, c.branch, `renders-chmura/${c.film}.mp4`));
  let meta = {};
  try { meta = JSON.parse(raw(c.repo, c.branch, 'chmura/meta.json').toString('utf8')); writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 1)); } catch {}
  const p = probe(file);
  if (!p.video || !p.audio) {
    db.prepare("UPDATE gen_jobs SET status='error', error=?, finished_at=? WHERE id=?").run('MP4 z chmury nie ma obrazu albo dźwięku', new Date().toISOString(), job.id);
    return log(job.id, 'Chmura: MP4 jest uszkodzony (brak obrazu albo dźwięku)');
  }
  const s = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const mediaDir = join(DATA, 'media', String(job.workspace_id));
  mkdirSync(mediaDir, { recursive: true });
  const media = join(mediaDir, `job-${job.id}.mp4`);
  writeFileSync(media, readFileSync(file));
  const title = s(meta.title, 200) || job.topic;
  const fmt = (() => { try { return JSON.parse(job.opts).format || 'short'; } catch { return 'short'; } })();
  const vid = db.transaction(() => {
    const v = db.prepare(`INSERT INTO videos(workspace_id,channel_id,ref,title,hook,topic,visual,voice,pace,cta,category,pin,caption,duration_sec,source,media_path,format)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'ai', ?, ?)`).run(job.workspace_id, job.channel_id, `gen-${job.id}`, title, s(meta.hook, 300) || job.hook, s(meta.topic, 120) || job.topic.slice(0, 120),
      s(meta.visual, 120), s(meta.voice, 120), s(meta.pace, 60), s(meta.cta, 200), s(meta.category, 60), s(meta.pin, 300), s(meta.caption, 2200), p.duration, media, fmt).lastInsertRowid;
    db.prepare('INSERT INTO stats(video_id) VALUES(?)').run(v);
    return v;
  })();
  db.prepare("UPDATE gen_jobs SET status='done', phase='done', phase_detail='Film gotowy (chmura)', video_id=?, finished_at=? WHERE id=?").run(vid, new Date().toISOString(), job.id);
  log(job.id, `Gotowe w chmurze: "${title}", ${p.duration} s. Film jest w zakładce Filmy.`);
}

function check(job) {
  const c = JSON.parse(job.opts || '{}').cloud;
  if (!c?.repo || !c?.branch || !c?.film) return;
  const sha = gh(['api', `repos/${c.repo}/branches/${c.branch}`, '--jq', '.commit.sha']).toString().trim();
  if (sha === c.sha) return;   // nothing new pushed
  const dir = join(DATA, 'gen', String(job.workspace_id), `job-${job.id}`);
  mkdirSync(join(dir, 'podglad'), { recursive: true });
  let lines = [];
  try { lines = raw(c.repo, c.branch, 'chmura/POSTEP.md').toString('utf8').split('\n').map(l => l.trim()).filter(Boolean); } catch {}
  for (const line of lines.slice(c.lines || 0)) {
    const img = line.match(/\[([\w.-]+\.(?:jpe?g|png))\]/i);
    let path = '';
    if (img) {
      try { writeFileSync(join(dir, 'podglad', img[1]), raw(c.repo, c.branch, `chmura/podglad/${img[1]}`)); path = ' ' + join(dir, 'podglad', img[1]); } catch {}
    }
    log(job.id, `Chmura: ${line.replace(/\s*\[[^\]]+\]\s*/, ' ').trim()}${path}`);
  }
  if (lines.length) db.prepare('UPDATE gen_jobs SET phase_detail=? WHERE id=?').run(`W chmurze: ${lines[lines.length - 1].replace(/\s*\[[^\]]+\]/, '').slice(0, 180)}`, job.id);
  setOpts(job.id, { sha, lines: Math.max(c.lines || 0, lines.length) });
  if (exists(c.repo, c.branch, `renders-chmura/${c.film}.mp4`)) deliver(db.prepare('SELECT * FROM gen_jobs WHERE id=?').get(job.id), c, dir);
}

function tick() {
  for (const job of db.prepare("SELECT * FROM gen_jobs WHERE status='cloud'").all()) {
    try { check(job); } catch (e) { console.error(`[cloud-watch] job ${job.id}:`, String(e.message).slice(0, 300)); }
  }
}
tick();
setInterval(tick, Number(process.env.CLOUD_WATCH_SEC || 60) * 1000);
console.log('cloud-watch: co minutę sprawdzam zadania w chmurze');
