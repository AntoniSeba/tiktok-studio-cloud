// music.js: the music library of a workspace (ported from the local studio). Trending TikTok sounds
// (Apify), the user's own tracks (file upload or a link pulled with yt-dlp), favourites, and an AI
// curator (OpenRouter) that marks favourites. The generator copies the favourites into each job folder,
// so agents put real music under the voice-over instead of synthesizing it.
import { execFile, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, nowIso } from './db.js';
import { getWs, setWs, findBin, chat, llmReady, apifyReady, apifyTikTok } from './services.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MUSIC_DIR = resolve(process.env.MUSIC_DIR || join(__dirname, '../data/music'));

db.exec(`
CREATE TABLE IF NOT EXISTS music (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  author        TEXT DEFAULT '',
  source        TEXT DEFAULT 'upload',      -- trending | upload | link
  source_url    TEXT DEFAULT '',
  tiktok_id     TEXT DEFAULT '',            -- TikTok music id, dedupes trending sounds
  original      INTEGER DEFAULT 0,          -- 1 = "original sound" from a creator, 0 = licensed song
  file          TEXT DEFAULT '',
  duration      REAL DEFAULT 0,
  cover         TEXT DEFAULT '',
  mood          TEXT DEFAULT '',
  favorite      INTEGER DEFAULT 0,
  added_by      TEXT DEFAULT 'user',        -- user | ai | trend
  note          TEXT DEFAULT '',            -- why the AI picked it
  trend_rank    INTEGER,                    -- position in the last trending refresh (NULL = not trending now)
  trend_uses    INTEGER DEFAULT 0,
  trend_plays   INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_music_ws ON music(workspace_id, tiktok_id);
`);

const err = (status, msg) => Object.assign(new Error(msg), { status });
const dirOf = (wsId) => { const d = join(MUSIC_DIR, String(wsId)); mkdirSync(d, { recursive: true }); return d; };
const safeName = (s) => String(s || 'utwor').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'utwor';
function probeDuration(file) {
  try { return Number(execFileSync(findBin('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim()) || 0; }
  catch { return 0; }
}

export const musicSettings = (wsId) => ({
  auto_trending: getWs(wsId, 'music_auto_trending', '0') === '1',
  auto_ai: getWs(wsId, 'music_auto_ai', '0') === '1',
  hashtags: getWs(wsId, 'music_hashtags', 'fyp,viral,trending,polska,dlaciebie'),
  limit: Number(getWs(wsId, 'music_trending_limit', '20')),
  last_refresh: getWs(wsId, 'music_last_refresh'),
  last_error: getWs(wsId, 'music_last_error'),
  last_ai: getWs(wsId, 'music_last_ai'),
  apify: apifyReady(), ai: llmReady(), ytdlp: findBin('yt-dlp') !== 'yt-dlp',
});
export function saveMusicSettings(wsId, b = {}) {
  if ('auto_trending' in b) setWs(wsId, 'music_auto_trending', b.auto_trending ? '1' : '0');
  if ('auto_ai' in b) setWs(wsId, 'music_auto_ai', b.auto_ai ? '1' : '0');
  if ('hashtags' in b) setWs(wsId, 'music_hashtags', String(b.hashtags || '').replace(/#/g, '').split(/[\s,]+/).filter(Boolean).slice(0, 12).join(','));
  if ('limit' in b) setWs(wsId, 'music_trending_limit', String(Math.max(5, Math.min(50, Number(b.limit) || 20))));
  return musicSettings(wsId);
}

export function listMusic(wsId, filter = 'all') {
  const where = { fav: 'favorite=1', trending: 'trend_rank IS NOT NULL', mine: "source IN ('upload','link')", ai: "added_by='ai'" }[filter] || '1=1';
  return db.prepare(`SELECT id,title,author,source,source_url,original,duration,cover,mood,favorite,added_by,note,trend_rank,trend_uses,trend_plays,created_at,
    (file<>'') AS has_file FROM music WHERE workspace_id=? AND ${where} ORDER BY favorite DESC, (trend_rank IS NULL), trend_rank ASC, id DESC`).all(wsId);
}
export const getMusic = (wsId, id) => db.prepare('SELECT * FROM music WHERE id=? AND workspace_id=?').get(Number(id), wsId);

const insert = db.prepare(`INSERT INTO music(workspace_id,title,author,source,source_url,tiktok_id,original,file,duration,cover,mood,favorite,added_by,note,trend_rank,trend_uses,trend_plays)
  VALUES(@workspace_id,@title,@author,@source,@source_url,@tiktok_id,@original,@file,@duration,@cover,@mood,@favorite,@added_by,@note,@trend_rank,@trend_uses,@trend_plays)`);
const blank = { title: '', author: '', source: 'upload', source_url: '', tiktok_id: '', original: 0, file: '', duration: 0, cover: '', mood: '', favorite: 0, added_by: 'user', note: '', trend_rank: null, trend_uses: 0, trend_plays: 0 };
const MAX_TRACKS = Number(process.env.MUSIC_MAX_TRACKS || 300);
function roomFor(wsId) {
  if (db.prepare('SELECT COUNT(*) n FROM music WHERE workspace_id=?').get(wsId).n >= MAX_TRACKS) throw err(429, `Biblioteka ma już ${MAX_TRACKS} utworów. Usuń nieużywane.`);
}

/** Upload: raw audio bytes from the browser. */
export function addMusicFile(wsId, buf, { filename = '', title = '', author = '', favorite = true } = {}) {
  if (!buf?.length) throw err(400, 'Pusty plik.');
  roomFor(wsId);
  const ext = (extname(filename) || '.mp3').toLowerCase();
  if (!['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac'].includes(ext)) throw err(400, 'Obsługiwane formaty: mp3, m4a, wav, aac, ogg, flac.');
  const name = String(title || filename.replace(/\.[^.]+$/, '') || 'Utwór').slice(0, 120);
  const file = join(dirOf(wsId), `${Date.now()}-${safeName(name)}${ext}`);
  writeFileSync(file, buf);
  const duration = probeDuration(file);
  if (!duration) { unlinkSync(file); throw err(400, 'To nie wygląda na plik audio.'); }
  return Number(insert.run({ ...blank, workspace_id: wsId, title: name, author: String(author).slice(0, 120), file, duration, favorite: favorite ? 1 : 0 }).lastInsertRowid);
}

// links go out from the server, so no local or private addresses (no peeking into the server's network)
function publicUrl(url) {
  let u; try { u = new URL(url); } catch { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  return !(h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === '[::1]' || /^\[?(fc|fd|fe80)/.test(h));
}
/** Link: TikTok / YouTube / any yt-dlp page, or a direct audio URL. Audio is extracted to mp3. */
export function addMusicLink(wsId, url, { title = '', author = '', favorite = true } = {}) {
  url = String(url || '').trim();
  if (!publicUrl(url)) return Promise.reject(err(400, 'Podaj publiczny link http(s) (TikTok, YouTube, SoundCloud albo plik audio).'));
  try { roomFor(wsId); } catch (e) { return Promise.reject(e); }
  const base = join(dirOf(wsId), `${Date.now()}-link`);
  return new Promise((res, rej) => {
    execFile(findBin('yt-dlp'), ['-x', '--audio-format', 'mp3', '--no-playlist', '--max-filesize', '60M', '--no-simulate',
      '--print', '%(track,title)s\t%(artist,creator,uploader)s', '--ffmpeg-location', dirname(findBin('ffmpeg')), '-o', `${base}.%(ext)s`, url],
    { timeout: 240_000, maxBuffer: 4 * 1024 * 1024 }, (e, stdout, stderr) => {
      const file = `${base}.mp3`;
      if (e || !existsSync(file)) return rej(err(422, 'Nie udało się pobrać audio: ' + (String(stderr || e?.message || '').split('\n').filter(Boolean).pop() || '').slice(0, 200)));
      const [t = '', a = ''] = String(stdout).trim().split('\n').pop().split('\t');
      res(Number(insert.run({ ...blank, workspace_id: wsId, title: String(title || t || 'Utwór z linku').slice(0, 120), author: String(author || (a === 'NA' ? '' : a)).slice(0, 120),
        source: 'link', source_url: url, file, duration: probeDuration(file), favorite: favorite ? 1 : 0 }).lastInsertRowid));
    });
  });
}

export function updateMusic(wsId, id, b = {}) {
  const cur = getMusic(wsId, id); if (!cur) return false;
  const f = (k, v) => (k in b ? v : cur[k]);
  db.prepare('UPDATE music SET title=?, author=?, mood=?, favorite=?, added_by=? WHERE id=?').run(
    f('title', String(b.title || '').trim().slice(0, 120) || cur.title), f('author', String(b.author || '').slice(0, 120)), f('mood', String(b.mood || '').slice(0, 60)),
    f('favorite', b.favorite ? 1 : 0), 'favorite' in b && b.favorite && cur.added_by === 'trend' ? 'user' : cur.added_by, cur.id);
  return true;
}
export function deleteMusic(wsId, id) {
  const cur = getMusic(wsId, id); if (!cur) return false;
  if (cur.file && cur.file.startsWith(MUSIC_DIR) && existsSync(cur.file)) { try { unlinkSync(cur.file); } catch {} }
  db.prepare('DELETE FROM music WHERE id=?').run(cur.id);
  return true;
}

/* ---------- trending sounds from TikTok (Apify) ---------- */
const busy = new Set();
export async function refreshTrending(wsId) {
  const key = `trend-${wsId}`;
  if (busy.has(key)) throw err(409, 'Pobieranie trendów już trwa.');
  busy.add(key);
  try {
    const { hashtags, limit } = musicSettings(wsId);
    const rows = await apifyTikTok({ hashtags: hashtags.split(',').filter(Boolean), resultsPerPage: Number(process.env.MUSIC_RESULTS_PER_TAG || 30) }, 300_000);
    // one entry per sound: how many trending videos use it and how many plays they have together
    const sounds = new Map();
    for (const v of rows) {
      const m = v.musicMeta || {}; const id = String(m.musicId || '');
      if (!id || !m.playUrl) continue;
      const s = sounds.get(id) || { id, title: m.musicName || '', author: m.musicAuthor || '', original: m.musicOriginal ? 1 : 0, playUrl: m.playUrl, cover: m.coverMediumUrl || '', uses: 0, plays: 0 };
      s.uses += 1; s.plays += Number(v.playCount || 0);
      sounds.set(id, s);
    }
    const top = [...sounds.values()].sort((a, b) => b.uses - a.uses || b.plays - a.plays).slice(0, limit);
    db.prepare('UPDATE music SET trend_rank=NULL WHERE workspace_id=? AND trend_rank IS NOT NULL').run(wsId);
    let added = 0, rank = 0;
    for (const s of top) {
      rank++;
      const cur = db.prepare('SELECT * FROM music WHERE workspace_id=? AND tiktok_id=?').get(wsId, s.id);
      if (cur && cur.file && existsSync(cur.file)) {
        db.prepare('UPDATE music SET trend_rank=?, trend_uses=?, trend_plays=? WHERE id=?').run(rank, s.uses, s.plays, cur.id);
        continue;
      }
      // the CDN link is signed and expires, so the file is fetched right away
      const file = join(dirOf(wsId), `tt-${s.id}-${safeName(s.title)}.mp3`);
      try {
        const a = await fetch(s.playUrl, { signal: AbortSignal.timeout(60_000), headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.tiktok.com/' } });
        if (!a.ok) continue;
        writeFileSync(file, Buffer.from(await a.arrayBuffer()));
      } catch { continue; }
      const duration = probeDuration(file);
      if (!duration) { try { unlinkSync(file); } catch {} continue; }
      if (cur) db.prepare('UPDATE music SET file=?, duration=?, trend_rank=?, trend_uses=?, trend_plays=? WHERE id=?').run(file, duration, rank, s.uses, s.plays, cur.id);
      else insert.run({ ...blank, workspace_id: wsId, title: s.title || 'Dźwięk z TikToka', author: s.author, source: 'trending', source_url: `https://www.tiktok.com/music/x-${s.id}`,
        tiktok_id: s.id, original: s.original, file, duration, cover: s.cover, added_by: 'trend', trend_rank: rank, trend_uses: s.uses, trend_plays: s.plays });
      added++;
    }
    setWs(wsId, 'music_last_refresh', nowIso()); setWs(wsId, 'music_last_error', '');
    return { videos: rows.length, sounds: sounds.size, top: top.length, added };
  } catch (e) {
    setWs(wsId, 'music_last_error', String(e.message || e).slice(0, 400));
    if (e.status === 402) setWs(wsId, 'music_auto_trending', '0');   // out of Apify credit: stop the daily attempts
    throw e;
  } finally { busy.delete(key); }
}

/* ---------- AI curator (OpenRouter) ---------- */
export async function aiCurate(wsId, { max = 5 } = {}) {
  const key = `ai-${wsId}`;
  if (busy.has(key)) throw err(409, 'Kurator AI już pracuje.');
  const pool = db.prepare("SELECT id,title,author,duration,original,trend_rank,trend_uses,source FROM music WHERE workspace_id=? AND favorite=0 AND file<>'' ORDER BY (trend_rank IS NULL), trend_rank, id DESC LIMIT 60").all(wsId);
  if (!pool.length) return { picked: [] };
  busy.add(key);
  try {
    const channels = db.prepare('SELECT name, niche, audience FROM channels WHERE workspace_id=?').all(wsId).map(c => `- ${c.name}: ${c.niche || 'brak opisu'}${c.audience ? ` (dla: ${c.audience})` : ''}`).join('\n');
    const { text } = await chat({ json: true, maxTokens: 1500, prompt: [
      `Jesteś kuratorem muzyki do TikToków. Wybierz maksymalnie ${max} utworów, które najlepiej pasują jako tło pod lektora do filmów tych kanałów:`, channels || '- kanał bez opisu', '',
      'Preferuj: dźwięki bez wokalu albo z cichym wokalem, równy rytm, 20-90 s, trendy (niski trend_rank), "original sound" (mniej problemów z prawami na koncie firmowym).',
      'Kandydaci (JSON):', JSON.stringify(pool), '',
      'Odpowiedz wyłącznie JSON: {"picks":[{"id":<id>,"mood":"<2-4 słowa po polsku, np. spokojny lo-fi>","reason":"<krótko po polsku>"}]}',
    ].join('\n') });
    let picks = [];
    try { picks = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim()).picks || []; } catch { throw err(502, 'Kurator AI nie zwrócił listy.'); }
    const ids = new Set(pool.map(p => p.id));
    const picked = [];
    for (const p of picks) {
      if (!ids.has(Number(p.id)) || picked.length >= max) continue;
      db.prepare("UPDATE music SET favorite=1, added_by='ai', mood=?, note=? WHERE id=?").run(String(p.mood || '').slice(0, 60), String(p.reason || '').slice(0, 300), Number(p.id));
      picked.push(Number(p.id));
    }
    setWs(wsId, 'music_last_ai', nowIso());
    return { picked };
  } finally { busy.delete(key); }
}

/** Daily, for every workspace that switched it on: trends, then the AI curator. */
export async function dailyMusicJob() {
  const rows = db.prepare("SELECT DISTINCT workspace_id FROM ws_settings WHERE key IN ('music_auto_trending','music_auto_ai') AND value='1'").all();
  for (const { workspace_id: ws } of rows) {
    const s = musicSettings(ws);
    if (s.auto_trending && s.apify) { try { await refreshTrending(ws); } catch (e) { console.error(`[music] ws ${ws} trendy:`, e.message); } }
    if (s.auto_ai && s.ai) { try { await aiCurate(ws); } catch (e) { console.error(`[music] ws ${ws} kurator AI:`, e.message); } }
  }
}

/**
 * Copies the favourites into the job folder (the agent sees nothing outside it) and returns
 * the brief block that lists them. No favourites = the video goes without music.
 */
export function musicForJob(wsId, jobDir) {
  const fav = db.prepare("SELECT id,title,author,mood,duration,original,source,file FROM music WHERE workspace_id=? AND favorite=1 AND file<>'' ORDER BY id DESC LIMIT 25")
    .all(wsId).filter(m => existsSync(m.file));
  const ban = '- Nie generuj muzyki: żadnej muzyki syntezowanej w kodzie (numpy, sox, WebAudio, ffmpeg sine), żadnych beatów z AI i nie pobieraj muzyki z sieci.';
  if (!fav.length) return ['# MUZYKA', ban, '- Biblioteka ulubionych jest pusta, więc film idzie BEZ muzyki: sam lektor (pojedyncze ciche efekty przejść wolno).'].join('\n');
  const dir = join(jobDir, 'muzyka'); mkdirSync(dir, { recursive: true });
  const lines = fav.map(m => {
    const name = `${m.id}-${safeName(m.title)}${extname(m.file) || '.mp3'}`;
    try { copyFileSync(m.file, join(dir, name)); } catch { return null; }
    return `- muzyka/${name}: "${m.title}"${m.author ? ` (${m.author})` : ''}, ${m.mood || 'nastrój nieopisany'}, ${Math.round(m.duration)} s, ${m.source === 'trending' ? (m.original ? 'trend, original sound' : 'trend, piosenka') : 'własny utwór'}`;
  }).filter(Boolean);
  return [
    '# MUZYKA (ulubione z zakładki Muzyka)',
    ban,
    '- Jeśli film ma muzykę, to tylko jeden utwór z tej listy, pasujący nastrojem do tematu i stylu. Bez muzyki też wolno.',
    '- Przytnij go ffmpeg do długości filmu z wyciszeniem na końcu i zapisz jako project/assets/music.mp3 (build.py dołącza go cicho pod lektora; we własnym index.html daj data-volume ok. 0.25). Muzyka 8-10 dB ciszej niż lektor.',
    '- W meta.json dopisz "music": nazwa pliku utworu.',
    ...lines,
  ].join('\n');
}
