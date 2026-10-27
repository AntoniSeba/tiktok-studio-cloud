// inspire.js: the TikTok library for remixes (ported from the local studio). Search TikToks on a topic
// (Apify), download one, cut it into shots, frames and a transcript, let a vision model (OpenRouter)
// write an ultra breakdown of its psychology, then turn it into a queue topic that rebuilds the same
// mechanics on the user's own subject. The generator copies the breakdown and frames into the job.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, nowIso } from './db.js';
import { findBin, chat, VISION_MODEL, apifyTikTok } from './services.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const LIB_DIR = resolve(process.env.TIKTOK_LIB_DIR || join(__dirname, '../data/tiktoks'));
const KIT = resolve(process.env.GEN_KIT_DIR || join(__dirname, '../kit'));

db.exec(`
CREATE TABLE IF NOT EXISTS tiktok_lib (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tiktok_id     TEXT NOT NULL,
  url           TEXT DEFAULT '',
  author        TEXT DEFAULT '',
  author_fans   INTEGER DEFAULT 0,
  descr         TEXT DEFAULT '',
  cover         TEXT DEFAULT '',
  duration      REAL DEFAULT 0,
  plays         INTEGER DEFAULT 0,
  likes         INTEGER DEFAULT 0,
  comments      INTEGER DEFAULT 0,
  shares        INTEGER DEFAULT 0,
  saves         INTEGER DEFAULT 0,
  music         TEXT DEFAULT '',
  query         TEXT DEFAULT '',
  status        TEXT DEFAULT 'found',       -- found | downloading | analyzing | ready | error
  step          TEXT DEFAULT '',
  error         TEXT DEFAULT '',
  dir           TEXT DEFAULT '',
  transcript    TEXT DEFAULT '',
  shots         TEXT DEFAULT '',
  breakdown     TEXT DEFAULT '',
  model         TEXT DEFAULT '',
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  analyzed_at   TEXT DEFAULT '',
  UNIQUE (workspace_id, tiktok_id)
);`);
// a breakdown interrupted by a restart would stay "analyzing" forever
db.prepare("UPDATE tiktok_lib SET status='error', error='Przerwane przez restart serwera. Kliknij Analizuj ponownie.' WHERE status IN ('downloading','analyzing')").run();

const err = (status, msg) => Object.assign(new Error(msg), { status });
function run(cmd, args, { timeout = 0, ...opts } = {}) {
  return new Promise((res, rej) => {
    const ch = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    ch.stdout.on('data', d => { stdout += d; }); ch.stderr.on('data', d => { stderr += d; if (stderr.length > 2e6) stderr = stderr.slice(-1e6); });
    const timer = timeout ? setTimeout(() => ch.kill('SIGTERM'), timeout) : null;
    ch.on('error', e => { if (timer) clearTimeout(timer); rej(e); });
    ch.on('close', code => {
      if (timer) clearTimeout(timer);
      if (code === 0) return res({ stdout, stderr });
      rej(new Error((String(stderr).split('\n').filter(Boolean).slice(-3).join(' ') || `kod ${code}`).slice(0, 500)));
    });
  });
}

const COLS = 'id,tiktok_id,url,author,author_fans,descr,cover,duration,plays,likes,comments,shares,saves,music,query,status,step,error,model,created_at,analyzed_at';
export function listLibrary(wsId, filter = 'all') {
  const where = filter === 'ready' ? "status='ready'" : filter === 'work' ? "status IN ('downloading','analyzing','error')" : '1=1';
  return db.prepare(`SELECT ${COLS}, length(breakdown) AS breakdown_len FROM tiktok_lib WHERE workspace_id=? AND ${where} ORDER BY (status='ready') DESC, id DESC LIMIT 300`).all(wsId);
}
export const getItem = (wsId, id) => db.prepare('SELECT * FROM tiktok_lib WHERE id=? AND workspace_id=?').get(Number(id), wsId);
const setItem = (id, f) => { const k = Object.keys(f); db.prepare(`UPDATE tiktok_lib SET ${k.map(x => x + '=?').join(',')} WHERE id=?`).run(...k.map(x => f[x]), id); };

/* ---------- search (Apify TikTok scraper) ---------- */
export async function searchTikToks(wsId, { query, sort = 'LIKES', limit = 20, date = 'LAST_6_MONTHS' } = {}) {
  query = String(query || '').trim().slice(0, 120);
  if (!query) throw err(400, 'Wpisz temat.');
  // the actor returns nothing when sorting/date options are sent, so both are applied here on the results
  let rows = await apifyTikTok({ searchQueries: [query], searchSection: '/video', resultsPerPage: Math.max(5, Math.min(40, Number(limit) || 20)) });
  const days = { THIS_WEEK: 7, THIS_MONTH: 31, LAST_3_MONTHS: 92, LAST_6_MONTHS: 183 }[date];
  if (days) rows = rows.filter(v => !v.createTimeISO || Date.now() - Date.parse(v.createTimeISO) <= days * 864e5);
  const up = db.prepare(`INSERT INTO tiktok_lib(workspace_id,tiktok_id,url,author,author_fans,descr,cover,duration,plays,likes,comments,shares,saves,music,query)
    VALUES(@ws,@tiktok_id,@url,@author,@author_fans,@descr,@cover,@duration,@plays,@likes,@comments,@shares,@saves,@music,@query)
    ON CONFLICT(workspace_id,tiktok_id) DO UPDATE SET plays=excluded.plays, likes=excluded.likes, comments=excluded.comments, shares=excluded.shares, saves=excluded.saves,
      cover=excluded.cover, author_fans=excluded.author_fans, query=CASE WHEN tiktok_lib.status='ready' THEN tiktok_lib.query ELSE excluded.query END`);
  const ids = [];
  for (const v of rows) {
    const tid = String(v.id || ''); const url = v.webVideoUrl || v.url || (tid && v.authorMeta?.name ? `https://www.tiktok.com/@${v.authorMeta.name}/video/${tid}` : '');
    if (!url || !tid || !/^\d+$/.test(tid)) continue;
    up.run({ ws: wsId, tiktok_id: tid, url, author: v.authorMeta?.name || '', author_fans: Number(v.authorMeta?.fans || 0), descr: String(v.text || '').slice(0, 600),
      cover: v.videoMeta?.coverUrl || v.videoMeta?.originalCoverUrl || '', duration: Number(v.videoMeta?.duration || 0), plays: Number(v.playCount || 0),
      likes: Number(v.diggCount || 0), comments: Number(v.commentCount || 0), shares: Number(v.shareCount || 0), saves: Number(v.collectCount || 0),
      music: [v.musicMeta?.musicName, v.musicMeta?.musicAuthor].filter(Boolean).join(' - ').slice(0, 200), query });
    ids.push(tid);
  }
  const order = sort === 'RELEVANCE' ? '' : sort === 'PLAYS' ? 'ORDER BY plays DESC' : 'ORDER BY likes DESC';
  return ids.length ? db.prepare(`SELECT ${COLS} FROM tiktok_lib WHERE workspace_id=? AND tiktok_id IN (${ids.map(() => '?').join(',')}) ${order}`).all(wsId, ...ids) : [];
}

/* ---------- transcript: the generator's words.py (whisper.cpp, then faster-whisper) ---------- */
async function transcribe(video, dir) {
  try {
    const out = join(dir, 'words.json');
    await run('python3', [join(KIT, 'tools', 'words.py'), video, out], { timeout: 600_000, cwd: dir });
    const words = JSON.parse(readFileSync(out, 'utf8'));
    rmSync(out, { force: true });
    // group into ~3 s lines with a start time, readable for the model
    const lines = []; let cur = null;
    for (const w of words) {
      const t = Number(w.t ?? w.start ?? 0), word = String(w.w ?? w.word ?? '').trim();
      if (!word) continue;
      if (!cur || t - cur.t > 3) { if (cur) lines.push(cur); cur = { t, s: [] }; }
      cur.s.push(word);
    }
    if (cur) lines.push(cur);
    return lines.map(l => `[${l.t.toFixed(1)} s] ${l.s.join(' ')}`).join('\n') || '(brak mowy)';
  } catch (e) { return `(transkrypcja nieudana: ${String(e.message).slice(0, 200)})`; }
}

/* ---------- ultra breakdown ---------- */
let chain = Promise.resolve();   // one breakdown at a time on the server: download, transcription and a vision call
export function startBreakdown(wsId, id) {
  const it = getItem(wsId, id);
  if (!it) throw err(404, 'Nie ma takiego filmu w bibliotece.');
  if (['downloading', 'analyzing'].includes(it.status)) throw err(409, 'Analiza już trwa.');
  setItem(it.id, { status: 'downloading', step: 'W kolejce do analizy', error: '' });
  chain = chain.then(() => breakdown(it.id).catch(e => setItem(it.id, { status: 'error', error: String(e.message || e).slice(0, 500), step: '' })));
  return true;
}

async function breakdown(id) {
  const it = db.prepare('SELECT * FROM tiktok_lib WHERE id=?').get(id);
  const dir = join(LIB_DIR, String(it.workspace_id), it.tiktok_id); mkdirSync(dir, { recursive: true });
  const video = join(dir, 'video.mp4');
  const ffmpeg = findBin('ffmpeg'), ffprobe = findBin('ffprobe');

  setItem(id, { status: 'downloading', step: 'Pobieram film', dir });
  if (!existsSync(video)) await run(findBin('yt-dlp'), ['-f', 'mp4/best', '--no-playlist', '--max-filesize', '150M', '--ffmpeg-location', dirname(ffmpeg), '-o', video, it.url], { timeout: 300_000 });
  const dur = Number((await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video])).stdout.trim()) || it.duration || 0;

  setItem(id, { status: 'analyzing', step: 'Wykrywam cięcia montażowe' });
  const sc = await run(ffmpeg, ['-hide_banner', '-i', video, '-vf', "select='gt(scene,0.28)',showinfo", '-an', '-f', 'null', '-'], { timeout: 300_000 });
  const cuts = [...sc.stderr.matchAll(/pts_time:([\d.]+)/g)].map(m => +(+m[1]).toFixed(2)).filter(t => t > 0.15);
  const bounds = [0, ...cuts, dur];
  const shots = bounds.slice(0, -1).map((t, i) => ({ n: i + 1, start: t, end: +bounds[i + 1].toFixed(2), len: +(bounds[i + 1] - t).toFixed(2) }));

  setItem(id, { step: 'Wycinam klatki' });
  for (const f of readdirSync(dir)) if (/^(hook|sheet-\d+)\.jpg$/.test(f)) rmSync(join(dir, f));
  // hook: 0-3 s at 4 fps; the whole video: up to 48 frames spread evenly, 12 per sheet
  await run(ffmpeg, ['-y', '-loglevel', 'error', '-t', '3', '-i', video, '-vf', 'fps=4,scale=270:-2,tile=4x3', '-frames:v', '1', join(dir, 'hook.jpg')]);
  const fps = Math.min(2, 48 / Math.max(dur, 1));
  await run(ffmpeg, ['-y', '-loglevel', 'error', '-i', video, '-vf', `fps=${fps.toFixed(4)},scale=270:-2,tile=4x3`, join(dir, 'sheet-%02d.jpg')]);
  const sheets = readdirSync(dir).filter(f => /^sheet-\d+\.jpg$/.test(f)).sort().slice(0, 4);
  const sheetMap = sheets.map((f, i) => `${f}: klatki w czasie ${Array.from({ length: 12 }, (_, k) => ((i * 12 + k) / fps).toFixed(1)).filter(t => +t <= dur).join(', ')} s (od lewej do prawej, wierszami)`).join('\n');

  setItem(id, { step: 'Transkrypcja' });
  const transcript = await transcribe(video, dir);
  writeFileSync(join(dir, 'transcript.txt'), transcript);

  setItem(id, { step: 'Analiza psychologii filmu (model wizyjny)', transcript, shots: JSON.stringify(shots) });
  const avg = shots.length ? (shots.reduce((a, s) => a + s.len, 0) / shots.length).toFixed(2) : '?';
  const prompt = [
    'Jesteś analitykiem viralowych TikToków i psychologii retencji.',
    'Zrób ULTRA BREAKDOWN tego filmu po polsku, tak szczegółowo, żeby inny twórca mógł odtworzyć IDENTYCZNĄ psychologię i mechanikę na zupełnie innym temacie.',
    '', `DANE FILMU: autor @${it.author} (${it.author_fans} obserwujących), ${dur.toFixed(1)} s, ${it.plays} wyświetleń, ${it.likes} polubień, ${it.comments} komentarzy, ${it.shares} udostępnień, ${it.saves} zapisów.`,
    `Opis: ${it.descr}`, `Dźwięk: ${it.music || '?'}`,
    `Cięcia montażowe (wykryte automatycznie): ${shots.length} ujęć, średnio ${avg} s. Lista: ${shots.slice(0, 80).map(s => `#${s.n} ${s.start}-${s.end}`).join('; ')}`,
    '', 'TRANSKRYPCJA Z CZASAMI:', transcript.slice(0, 8000), '',
    'OBRAZY: pierwszy to hook.jpg = pierwsze 3 s, 4 klatki na sekundę (12 klatek, od lewej do prawej, wierszami). Kolejne to arkusze z całego filmu:', sheetMap, '',
    'Struktura odpowiedzi (markdown, konkretnie, z czasami w sekundach):',
    '## 1. Werdykt w 3 zdaniach: dlaczego to działa',
    '## 2. Hook 0-3 s: pierwsza klatka, ruch, tekst na ekranie, pierwsze słowa, jaka luka ciekawości się otwiera',
    '## 3. Oś czasu: tabela | czas | co widać | co słychać/tekst | funkcja psychologiczna |',
    '## 4. Rytm montażu: długości ujęć, przyspieszenia, pattern interrupts, punch-iny',
    '## 5. Mechanizmy retencji: otwarte pętle, nagrody, eskalacja, payoff, pętla do ponownego obejrzenia',
    '## 6. Psychologia: konkretne wyzwalacze i moment, w którym działają',
    '## 7. Warstwa wizualna i napisy: styl, kolory, kadrowanie, typ napisów, tempo',
    '## 8. Dźwięk: muzyka, lektor, efekty, cisze, akcenty',
    '## 9. Zaangażowanie: co prowokuje komentarze, udostępnienia i zapisy',
    '## 10. PRZEPIS DO REMIKSU: szablon krok po kroku z czasami, który da się wypełnić innym tematem, plus 3 przykładowe hooki w tym stylu na temat edukacyjny',
    '## 11. Czego NIE kopiować (rzeczy specyficzne dla twórcy albo chronione prawem: materiał, muzyka, teksty)',
    '', 'Bez myślników typu pauza i półpauza. Całość umieść między znacznikami <BREAKDOWN> i </BREAKDOWN>.',
  ].join('\n');
  const { text, model } = await chat({ prompt, images: ['hook.jpg', ...sheets].map(f => join(dir, f)), model: VISION_MODEL, maxTokens: 8000, timeoutMs: 600_000 });
  const m = text.match(/<BREAKDOWN>([\s\S]*?)<\/BREAKDOWN>/);
  const md = (m ? m[1] : text).trim().replace(/[\u2013\u2014]/g, '-');
  if (md.length < 400) throw new Error('Model zwrócił za krótką analizę: ' + md.slice(0, 200));
  writeFileSync(join(dir, 'BREAKDOWN.md'), `# Analiza: ${it.url}\n\n${md}\n`);
  rmSync(video, { force: true });   // frames, transcript and breakdown stay; the video itself is not needed any more
  setItem(id, { status: 'ready', step: '', breakdown: md, model, analyzed_at: nowIso() });
}

export function deleteItem(wsId, id) {
  const it = getItem(wsId, id); if (!it) return false;
  if (it.dir && it.dir.startsWith(LIB_DIR) && existsSync(it.dir)) rmSync(it.dir, { recursive: true, force: true });
  db.prepare('DELETE FROM tiktok_lib WHERE id=?').run(it.id);
  return true;
}
export function framePath(wsId, id, name) {
  const it = getItem(wsId, id);
  if (!it?.dir || !/^(hook|sheet-\d+)\.jpg$/.test(name)) return null;
  const p = join(it.dir, name);
  return existsSync(p) ? p : null;
}

/** Turn a breakdown into a queue topic for one of the channels. */
export function remixToQueue(wsId, id, { channel_id, topic = '', hook = '' } = {}) {
  const it = getItem(wsId, id);
  if (!it || it.status !== 'ready') throw err(409, 'Najpierw zrób analizę tego filmu.');
  const ch = channel_id ? db.prepare('SELECT id, name FROM channels WHERE id=? AND workspace_id=?').get(Number(channel_id), wsId)
    : db.prepare('SELECT id, name FROM channels WHERE workspace_id=? ORDER BY id LIMIT 1').get(wsId);
  const t = String(topic || '').trim().slice(0, 200) || `Remiks: ${String(it.descr || it.author).slice(0, 120)}`;
  const notes = `Remiks filmu @${it.author} (${it.plays} wyświetleń): odtwórz jego mechanikę na naszym temacie. Analiza dołączona do zadania.`;
  return Number(db.prepare("INSERT INTO queue(workspace_id,channel_id,topic,hook,notes,status,remix_id) VALUES(?,?,?,?,?,'idea',?)")
    .run(wsId, ch?.id || null, t, String(hook || '').slice(0, 300), notes, it.id).lastInsertRowid);
}

/** Copies a remix source (breakdown and frames) into the job folder and returns the brief block. */
export function remixForJob(wsId, queueId, jobDir) {
  const q = queueId ? db.prepare('SELECT remix_id FROM queue WHERE id=? AND workspace_id=?').get(queueId, wsId) : null;
  const it = q?.remix_id ? getItem(wsId, q.remix_id) : null;
  if (!it || it.status !== 'ready' || !it.dir) return '';
  const dir = join(jobDir, 'remiks'); mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(it.dir)) if (/^(hook|sheet-\d+)\.jpg$|^(BREAKDOWN\.md|transcript\.txt)$/.test(f)) copyFileSync(join(it.dir, f), join(dir, f));
  return [
    '# REMIKS (obowiązkowy szkielet filmu)',
    `Odtwórz IDENTYCZNĄ psychologię, strukturę beatów, tempo montażu, typ hooka i mechanikę retencji filmu ${it.url} (@${it.author}, ${it.plays} wyświetleń).`,
    'Pełna analiza: remiks/BREAKDOWN.md (przeczytaj całą przed planem; sekcja 10 "PRZEPIS DO REMIKSU" to szkielet). Klatki: remiks/hook.jpg i remiks/sheet-*.jpg, transkrypcja: remiks/transcript.txt.',
    'Temat, fakty, teksty, obraz i muzyka są NASZE: nie kopiuj niczego 1:1, kopiujesz tylko mechanikę. Styl wizualny i zasady z tego pliku nadal obowiązują.',
  ].join('\n');
}

/* ---------- competitor research before a render (local studio apify.js, condensed) ---------- */
/** Top TikToks on the topic, squeezed into a short brief the agent reads before planning. */
export async function competitorBrief(topic) {
  const rows = await apifyTikTok({ searchQueries: [String(topic).slice(0, 120)], searchSection: '/video', resultsPerPage: 20 }, 180_000);
  const top = rows.filter(v => v.playCount).sort((a, b) => (b.diggCount || 0) - (a.diggCount || 0)).slice(0, 8);
  if (!top.length) return '';
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + ' mln' : n >= 1e3 ? Math.round(n / 1e3) + ' tys.' : String(n));
  return [
    '# RESEARCH KONKURENCJI (najmocniejsze TikToki na ten temat, Apify)',
    'Sprawdź, jakie hooki, długości i obietnice wygrywają, i zrób coś lepszego. Niczego nie kopiuj dosłownie.',
    ...top.map((v, i) => `${i + 1}. @${v.authorMeta?.name || '?'}: ${fmt(v.playCount || 0)} wyświetleń, ${fmt(v.diggCount || 0)} polubień, ${Math.round(v.videoMeta?.duration || 0)} s. Opis: "${String(v.text || '').replace(/\s+/g, ' ').slice(0, 160)}"`),
  ].join('\n');
}

/* ---------- add one TikTok by its link (works without Apify: metadata from yt-dlp) ---------- */
export async function addByLink(wsId, url) {
  url = String(url || '').trim();
  if (!/^https:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\//i.test(url)) throw err(400, 'Wklej link do filmu na TikToku (https://www.tiktok.com/@konto/video/...).');
  let meta;
  try { meta = JSON.parse((await run(findBin('yt-dlp'), ['--dump-json', '--no-playlist', '--skip-download', url], { timeout: 120_000 })).stdout); }
  catch (e) { throw err(422, 'Nie udało się odczytać filmu z tego linku: ' + String(e.message).slice(0, 160)); }
  const tid = String(meta.id || '');
  if (!/^\d+$/.test(tid)) throw err(422, 'To nie wygląda na film z TikToka.');
  db.prepare(`INSERT INTO tiktok_lib(workspace_id,tiktok_id,url,author,descr,cover,duration,plays,likes,comments,shares,saves,music,query)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,tiktok_id) DO NOTHING`).run(wsId, tid, meta.webpage_url || url, meta.uploader || meta.channel || '',
    String(meta.description || meta.title || '').slice(0, 600), meta.thumbnail || '', Number(meta.duration || 0), Number(meta.view_count || 0), Number(meta.like_count || 0),
    Number(meta.comment_count || 0), Number(meta.repost_count || 0), 0, String(meta.track || '').slice(0, 200), 'link');
  const it = db.prepare('SELECT id FROM tiktok_lib WHERE workspace_id=? AND tiktok_id=?').get(wsId, tid);
  startBreakdown(wsId, it.id);
  return it.id;
}
