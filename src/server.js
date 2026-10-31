// server.js: Express API + pages for TikTok Studio Cloud.
import 'dotenv/config';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, listVideos, nowIso } from './db.js';
import {
  attachAuth, requireWorkspace, requireUser, rateLimit, hashPassword, verifyPassword, createSession, destroySession,
  normEmail, validEmail, passwordProblem, rotateApiKey, sha256, newToken,
} from './auth.js';
import { analyze } from './analysis.js';
import { sendMail, emailShell, esc, mailerReady } from './mailer.js';
import { startScheduler, buildDailyDigest, buildWeeklyReport, localParts } from './scheduler.js';
import { parseSetup, cleanSetup, aiReady, MODELS, DEFAULT_MODEL } from './ai.js';
import { zonedToUtc, validTimezone, csvToVideos, isTiktokExport, tiktokExportPosts, matchPost } from './importers.js';
import { listMusic, musicSettings, saveMusicSettings, addMusicFile, addMusicLink, updateMusic, deleteMusic, getMusic, refreshTrending, aiCurate } from './music.js';
import { addByLink, listLibrary, searchTikToks, getItem as getInspire, startBreakdown, remixToQueue, deleteItem as deleteInspire, framePath } from './inspire.js';
import { apifyReady } from './services.js';
import { BIBLIA_IDS } from './biblia.js';
import { generatorStatus, styleList, createJob, cancelJob, resumeJob, retryJob, AGENTS, agentTemplate, agentDefault, startHeld, listJobs, jobForWorkspace, usedToday, recoverJobs, startLimitWatcher, estimateMinutes, PHASES, DAILY_LIMIT, GEN_DIR, MODELS as GEN_MODELS, DEFAULT_MODEL as GEN_DEFAULT } from './generator.js';
import { chat as agentChat, history as agentHistory, clearHistory as clearAgentHistory, AGENT_MODEL } from './marketing-agent.js';
import { basePath, BASE } from './basepath.js';
import { existsSync, rmSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(__dirname, '../public');
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.tiktokcdn.com https://*.tiktokcdn-us.com https://*.tiktokcdn-eu.com https://*.ibyteimg.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
  });
  if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});
// BASE_PATH (e.g. /tts): the Studio lives under a prefix on a shared domain
basePath(app, { '/assets': resolve(PUB, 'assets'), '/app/static': resolve(PUB, 'app') });
app.use(express.json({ limit: '1mb' }));
app.use(attachAuth);

const ok = (res, data = {}) => res.json({ ok: true, ...data });
const fail = (res, code, msg, extra = {}) => res.status(code).json({ ok: false, error: msg, ...extra });
const httpErr = (status, msg) => Object.assign(new Error(msg), { status });
const wrap = (fn) => (req, res) => Promise.resolve().then(() => fn(req, res)).catch(e => {
  if (!e.status) console.error(e);
  fail(res, e.status || 500, e.status ? e.message : 'Błąd serwera. Spróbuj ponownie.');
});
const s = (v, n = 300) => (v == null ? '' : String(v)).trim().slice(0, n);
const int = (v, d = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };
const pos = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };

const slugify = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'film';
function uniqueRef(wsId, base) {
  let ref = slugify(base), n = 2;
  const exists = db.prepare('SELECT 1 FROM videos WHERE workspace_id=? AND ref=?');
  while (exists.get(wsId, ref)) ref = `${slugify(base)}-${n++}`;
  return ref;
}

// ---- pages -----------------------------------------------------------------
const cache = process.env.NODE_ENV === 'production' ? '10m' : 0;
app.use('/assets', express.static(resolve(PUB, 'assets'), { maxAge: cache }));
// example clips of the visual styles (shown in the style picker)
app.use('/styles', express.static(resolve(PUB, 'styles'), { maxAge: cache }));
const page = (file) => (_req, res) => res.sendFile(resolve(PUB, file));
app.get('/', page('index.html'));
app.get(['/logowanie', '/rejestracja', '/reset-hasla'], (req, res) => {
  if (req.user && req.path !== '/reset-hasla') return res.redirect('/app');
  res.sendFile(resolve(PUB, 'auth.html'));
});
app.get('/integracje', page('docs.html'));
app.use('/app/static', express.static(resolve(PUB, 'app'), { maxAge: cache }));
app.get(/^\/app(\/.*)?$/, (req, res) => {
  if (!req.user) return res.redirect('/logowanie?next=' + encodeURIComponent(req.originalUrl));
  res.sendFile(resolve(PUB, 'app/index.html'));
});

// ---- health ------------------------------------------------------------------
app.get('/api/health', (_req, res) => ok(res, { mailer: mailerReady ? 'brevo' : 'dry', ai: aiReady(), time: nowIso() }));

// ---- auth --------------------------------------------------------------------
app.post('/api/auth/register', rateLimit('register', 10, 3600_000), wrap((req, res) => {
  const email = normEmail(req.body?.email);
  const name = s(req.body?.name, 80);
  if (!validEmail(email)) throw httpErr(400, 'Podaj poprawny adres e-mail.');
  const pp = passwordProblem(req.body?.password);
  if (pp) throw httpErr(400, pp);
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw httpErr(409, 'Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło.');
  const userId = db.transaction(() => {
    const u = db.prepare('INSERT INTO users(email,name,pass_hash) VALUES(?,?,?)').run(email, name, hashPassword(req.body.password));
    db.prepare('INSERT INTO workspaces(owner_id,name,mail_to) VALUES(?,?,?)').run(u.lastInsertRowid, name ? `Studio ${name}` : 'Moje studio', email);
    return u.lastInsertRowid;
  })();
  createSession(res, userId);
  ok(res, { next: BASE + '/app/start' });
}));

app.post('/api/auth/login', rateLimit('login', 20, 900_000), wrap((req, res) => {
  const email = normEmail(req.body?.email);
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !verifyPassword(req.body?.password, u.pass_hash)) throw httpErr(401, 'Nieprawidłowy e-mail lub hasło.');
  createSession(res, u.id);
  const ws = db.prepare('SELECT onboarded_at FROM workspaces WHERE owner_id=?').get(u.id);
  ok(res, { next: BASE + (ws?.onboarded_at ? '/app' : '/app/start') });
}));

app.post('/api/auth/logout', (req, res) => { destroySession(req, res); ok(res); });

app.post('/api/auth/forgot', rateLimit('forgot', 5, 3600_000), wrap(async (req, res) => {
  const email = normEmail(req.body?.email);
  const u = validEmail(email) && db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (u) {
    const token = newToken();
    db.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)').run(sha256(token), u.id, new Date(Date.now() + 3600_000).toISOString());
    const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}${BASE}`;
    const link = `${base}/reset-hasla?token=${token}`;
    await sendMail({ to: email, subject: 'Reset hasła do TikTok Studio', html: emailShell('Ustaw nowe hasło',
      `<p>Ktoś (pewnie Ty) poprosił o reset hasła. Link działa przez godzinę:</p><p><a href="${esc(link)}" style="color:#6a5cff;font-weight:700">${esc(link)}</a></p><p style="color:#7a7686">Jeśli to nie Ty, zignoruj tę wiadomość.</p>`) });
    if (!mailerReady && process.env.NODE_ENV !== 'production') console.log(`[reset] ${link}`);
  }
  ok(res, { message: 'Jeśli konto istnieje, wysłaliśmy link do resetu hasła.' });
}));

app.post('/api/auth/reset', rateLimit('reset', 10, 3600_000), wrap((req, res) => {
  const row = db.prepare('SELECT * FROM password_resets WHERE token_hash=?').get(sha256(s(req.body?.token, 200)));
  if (!row || row.used || row.expires_at < nowIso()) throw httpErr(400, 'Link wygasł albo był już użyty. Poproś o nowy.');
  const pp = passwordProblem(req.body?.password);
  if (pp) throw httpErr(400, pp);
  db.transaction(() => {
    db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPassword(req.body.password), row.user_id);
    db.prepare('UPDATE password_resets SET used=1 WHERE token_hash=?').run(row.token_hash);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
  })();
  createSession(res, row.user_id);
  ok(res, { next: '/app' });
}));

// ---- everything below needs a workspace (session or API key) -------------------
app.use('/api', (req, res, next) => (req.path === '/health' ? next() : requireWorkspace(req, res, next)));

const publicWs = (ws) => {
  const { api_key_hash, ...rest } = ws;
  return { ...rest, has_api_key: Boolean(api_key_hash) };
};
const progressOf = (wsId) => db.prepare(`SELECT
  (SELECT COUNT(*) FROM channels WHERE workspace_id=@w) channels,
  (SELECT COUNT(*) FROM videos WHERE workspace_id=@w) videos,
  (SELECT COUNT(*) FROM schedule WHERE workspace_id=@w) scheduled,
  (SELECT COUNT(*) FROM queue WHERE workspace_id=@w) topics,
  (SELECT COUNT(*) FROM stats s JOIN videos v ON v.id=s.video_id WHERE v.workspace_id=@w AND (s.views>0 OR s.completion>0)) measured`).get({ w: wsId });

app.get('/api/me', (req, res) => {
  const ws = db.prepare('SELECT * FROM workspaces WHERE id=?').get(req.ws.id);
  ok(res, { user: req.user || null, via: req.via, workspace: publicWs(ws), progress: progressOf(ws.id),
    channels: db.prepare('SELECT * FROM channels WHERE workspace_id=? ORDER BY id').all(ws.id),
    ai: { ready: aiReady(), models: MODELS, default: DEFAULT_MODEL }, mailer: mailerReady ? 'brevo' : 'dry',
    generator: { ...generatorStatus(), usedToday: usedToday(ws), phases: PHASES } });
});

app.put('/api/me/password', requireUser, wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!verifyPassword(req.body?.current, u.pass_hash)) throw httpErr(400, 'Obecne hasło się nie zgadza.');
  const pp = passwordProblem(req.body?.password);
  if (pp) throw httpErr(400, pp);
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPassword(req.body.password), u.id);
  ok(res);
}));

app.delete('/api/me', requireUser, wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!verifyPassword(req.body?.password, u.pass_hash)) throw httpErr(400, 'Hasło się nie zgadza. Konto nie zostało usunięte.');
  db.prepare('DELETE FROM users WHERE id=?').run(u.id);   // cascades to workspace, sessions and all data
  destroySession(req, res);
  ok(res);
}));

// ---- workspace settings -------------------------------------------------------
app.put('/api/workspace', requireUser, wrap((req, res) => {
  const b = req.body || {};
  const cur = req.ws;
  const tz = 'timezone' in b ? s(b.timezone, 60) : cur.timezone;
  if (!validTimezone(tz)) throw httpErr(400, 'Nieznana strefa czasowa.');
  const mail = 'mail_to' in b ? normEmail(b.mail_to) : cur.mail_to;
  if (mail && !validEmail(mail)) throw httpErr(400, 'Podaj poprawny e-mail do raportów.');
  const model = 'ai_model' in b ? s(b.ai_model, 120) : cur.ai_model;
  if (model && !MODELS.includes(model)) throw httpErr(400, 'Ten model nie jest dostępny.');
  const clamp = (k, lo, hi) => (k in b ? Math.min(hi, Math.max(lo, int(b[k], cur[k]))) : cur[k]);
  db.prepare(`UPDATE workspaces SET name=?, timezone=?, mail_to=?, digest_enabled=?, digest_hour=?, weekly_day=?,
    reminders_enabled=?, cadence_per_day=?, ai_model=? WHERE id=?`).run(
    'name' in b ? (s(b.name, 80) || cur.name) : cur.name, tz, mail,
    'digest_enabled' in b ? (b.digest_enabled ? 1 : 0) : cur.digest_enabled, clamp('digest_hour', 0, 23), clamp('weekly_day', 0, 6),
    'reminders_enabled' in b ? (b.reminders_enabled ? 1 : 0) : cur.reminders_enabled, clamp('cadence_per_day', 1, 10), model, cur.id);
  ok(res, { workspace: publicWs(db.prepare('SELECT * FROM workspaces WHERE id=?').get(cur.id)) });
}));

app.post('/api/workspace/api-key', requireUser, (req, res) => ok(res, { api_key: rotateApiKey(req.ws.id) }));
app.post('/api/workspace/onboarded', requireUser, (req, res) => {
  db.prepare('UPDATE workspaces SET onboarded_at=COALESCE(onboarded_at,?) WHERE id=?').run(nowIso(), req.ws.id);
  ok(res);
});

// ---- channels -------------------------------------------------------------------
const cleanHandle = (h) => { const t = s(h, 60).replace(/^@+/, '').replace(/\s+/g, ''); return t ? '@' + t : ''; };
function channelId(wsId, raw, { required = false } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    const first = db.prepare('SELECT id FROM channels WHERE workspace_id=? ORDER BY id LIMIT 1').get(wsId);
    if (!first && required) throw httpErr(400, 'Najpierw dodaj kanał.');
    return first?.id || null;
  }
  const byId = db.prepare('SELECT id FROM channels WHERE workspace_id=? AND id=?').get(wsId, int(raw, -1));
  if (byId) return byId.id;
  const byHandle = db.prepare('SELECT id FROM channels WHERE workspace_id=? AND lower(handle)=lower(?)').get(wsId, cleanHandle(raw));
  if (byHandle) return byHandle.id;
  throw httpErr(400, `Kanał "${raw}" nie istnieje w tym koncie.`);
}

const VOICES = ['Puck', 'Leda', 'Kore', 'Charon', 'Fenrir'];
/** Generator settings of a channel: what it promotes, its CTA, colours, voice, language, video length. */
function channelExtras(b, cur) {
  const has = (k) => k in b;
  const voice = has('voice') ? String(b.voice) : (cur.voice || 'Puck');
  const len = has('length_sec') ? Math.round(Number(b.length_sec)) : (cur.length_sec || 40);
  return {
    product: has('product') ? s(b.product, 300) : (cur.product || ''), product_info: has('product_info') ? s(b.product_info, 4000) : (cur.product_info || ''), cta: has('cta') ? s(b.cta, 200) : (cur.cta || ''),
    colors: has('colors') ? s(b.colors, 200) : (cur.colors || ''), voice: VOICES.includes(voice) ? voice : 'Puck',
    language: has('language') ? (s(b.language, 30) || 'polski') : (cur.language || 'polski'),
    length_sec: Number.isFinite(len) ? Math.min(90, Math.max(20, len)) : 40,
    color: has('color') && /^#[0-9a-f]{6}$/i.test(String(b.color)) ? String(b.color).toLowerCase() : (cur.color || '#22b8cf'),
  };
}

app.get('/api/channels', (req, res) => ok(res, { channels: db.prepare('SELECT * FROM channels WHERE workspace_id=? ORDER BY id').all(req.ws.id) }));
app.post('/api/channels', wrap((req, res) => {
  const b = req.body || {};
  const name = s(b.name, 80);
  if (!name) throw httpErr(400, 'Podaj nazwę kanału.');
  const x = channelExtras(b, {});
  const r = db.prepare('INSERT INTO channels(workspace_id,name,handle,niche,audience,goal,product,product_info,cta,colors,voice,language,length_sec,color) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.ws.id, name, cleanHandle(b.handle), s(b.niche, 400), s(b.audience, 300), s(b.goal, 300), x.product, x.product_info, x.cta, x.colors, x.voice, x.language, x.length_sec, x.color);
  ok(res, { channel: db.prepare('SELECT * FROM channels WHERE id=?').get(r.lastInsertRowid) });
}));
app.put('/api/channels/:id', wrap((req, res) => {
  const cur = db.prepare('SELECT * FROM channels WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!cur) throw httpErr(404, 'Kanał nie istnieje.');
  const b = req.body || {};
  const pick = (k, n) => (k in b ? s(b[k], n) : cur[k]);
  const name = pick('name', 80);
  if (!name) throw httpErr(400, 'Nazwa kanału nie może być pusta.');
  const x = channelExtras(b, cur);
  db.prepare('UPDATE channels SET name=?, handle=?, niche=?, audience=?, goal=?, product=?, product_info=?, cta=?, colors=?, voice=?, language=?, length_sec=?, color=? WHERE id=?')
    .run(name, 'handle' in b ? cleanHandle(b.handle) : cur.handle, pick('niche', 400), pick('audience', 300), pick('goal', 300),
      x.product, x.product_info, x.cta, x.colors, x.voice, x.language, x.length_sec, x.color, cur.id);
  ok(res);
}));
// ---- product screenshots of a channel (shown to the agent as the real app) --------------------
const SHOT_DIR = resolve(__dirname, '../data/shots');
const shotOf = (req) => {
  const x = db.prepare('SELECT * FROM channel_shots WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!x) throw httpErr(404, 'Nie ma takiego zrzutu.');
  return x;
};
const imgExt = (buf) => (buf[0] === 0x89 && buf.subarray(1, 4).toString() === 'PNG' ? 'png'
  : buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg'
  : buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP' ? 'webp' : '');
app.get('/api/channels/:id/shots', wrap((req, res) => {
  ok(res, { shots: db.prepare('SELECT id, caption, created_at FROM channel_shots WHERE channel_id=? AND workspace_id=? ORDER BY id').all(int(req.params.id), req.ws.id) });
}));
app.post('/api/channels/:id/shots', requireUser, rateLimit('shots', 60, 3600_000), express.raw({ type: () => true, limit: '10mb' }), wrap((req, res) => {
  const ch = db.prepare('SELECT id FROM channels WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!ch) throw httpErr(404, 'Kanał nie istnieje.');
  const buf = req.body;
  const ext = Buffer.isBuffer(buf) && buf.length > 100 ? imgExt(buf) : '';
  if (!ext) throw httpErr(400, 'Wgraj obraz PNG, JPG albo WEBP.');
  if (db.prepare('SELECT COUNT(*) c FROM channel_shots WHERE channel_id=?').get(ch.id).c >= 20) throw httpErr(409, 'Kanał ma już 20 zrzutów. Usuń któryś.');
  const dir = join(SHOT_DIR, String(req.ws.id));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${Date.now()}-${newToken(6)}.${ext}`);
  writeFileSync(path, buf);
  const id = db.prepare('INSERT INTO channel_shots(workspace_id,channel_id,caption,path) VALUES(?,?,?,?)').run(req.ws.id, ch.id, s(req.query.caption, 200), path).lastInsertRowid;
  ok(res, { shot: { id, caption: s(req.query.caption, 200) } });
}));
app.put('/api/shots/:id', wrap((req, res) => {
  const x = shotOf(req);
  db.prepare('UPDATE channel_shots SET caption=? WHERE id=?').run(s(req.body?.caption, 200), x.id);
  ok(res);
}));
app.delete('/api/shots/:id', wrap((req, res) => {
  const x = shotOf(req);
  rmSync(x.path, { force: true });
  db.prepare('DELETE FROM channel_shots WHERE id=?').run(x.id);
  ok(res);
}));
app.get('/api/shots/:id/img', wrap((req, res) => {
  const x = shotOf(req);
  if (!existsSync(x.path)) throw httpErr(404, 'Brak pliku zrzutu.');
  res.set('Cache-Control', 'private, max-age=300').sendFile(x.path);
}));
app.delete('/api/channels/:id', wrap((req, res) => {
  const n = db.prepare('SELECT COUNT(*) c FROM channels WHERE workspace_id=?').get(req.ws.id).c;
  if (n <= 1) throw httpErr(409, 'To jedyny kanał. Zmień jego nazwę zamiast go usuwać.');
  const r = db.prepare('DELETE FROM channels WHERE id=? AND workspace_id=?').run(int(req.params.id), req.ws.id);
  if (!r.changes) throw httpErr(404, 'Kanał nie istnieje.');
  ok(res);
}));

// ---- videos ------------------------------------------------------------------------
const VIDEO_TEXT = { title: 200, hook: 300, topic: 120, visual: 120, voice: 120, pace: 60, cta: 200, category: 60, pin: 300, caption: 2200, url: 500, file_url: 1000 };
// the local studio and existing generators post Polish field names; accept both
const LEGACY = { name: 'title', temat: 'topic', wizual: 'visual', glos: 'voice', tempo: 'pace', cat: 'category', path: 'file_url' };
const STAT_NUM = ['views', 'avg_watch', 'completion', 'likes', 'comments', 'shares', 'saves', 'followers'];
// the rest of TikTok Studio's analytics screen; percentages are 0-100, watch time in seconds
const STAT_EXTRA = ['total_watch_time', 'reached', 'profile_views', 'src_fyp', 'src_profile', 'src_following', 'src_search', 'src_sound', 'new_viewers', 'returning_viewers'];
const STAT_PCT = ['src_fyp', 'src_profile', 'src_following', 'src_search', 'src_sound', 'new_viewers', 'returning_viewers'];

function normalizeVideoBody(b = {}) {
  const out = {};
  for (const [k, v] of Object.entries(LEGACY)) if (b[k] !== undefined && b[v] === undefined) out[v] = b[k];
  for (const k of Object.keys(VIDEO_TEXT)) if (b[k] !== undefined) out[k] = b[k];
  // the old API used `title` as the post caption and `name` as the label
  if (b.name && b.title && b.title !== b.name) { out.title = b.name; out.caption = b.caption ?? b.title; }
  for (const k of Object.keys(out)) out[k] = s(out[k], VIDEO_TEXT[k]);
  if (out.url && !/^https?:\/\//i.test(out.url)) throw httpErr(400, 'Link do filmu musi zaczynać się od http:// lub https://');
  if (b.duration_sec !== undefined) out.duration_sec = pos(b.duration_sec);
  return out;
}

function writeStats(videoId, b = {}, tz) {
  db.prepare('INSERT INTO stats(video_id) VALUES(?) ON CONFLICT(video_id) DO NOTHING').run(videoId);
  const sets = [], vals = [];
  for (const k of STAT_NUM) if (b[k] !== undefined && b[k] !== '') {
    let v = pos(b[k]);
    if (k === 'completion') v = Math.min(100, v);
    if (!['avg_watch', 'completion'].includes(k)) v = Math.round(v);
    sets.push(`${k}=?`); vals.push(v);
  }
  for (const k of STAT_EXTRA) if (b[k] !== undefined && b[k] !== '') {
    let v = pos(b[k]);
    if (STAT_PCT.includes(k)) v = Math.min(100, v); else if (k !== 'total_watch_time') v = Math.round(v);
    sets.push(`${k}=?`); vals.push(v);
  }
  // retention curve: "% still watching" at each second, as typed from TikTok Studio ("100, 82, 64, ...")
  if (b.retention_curve !== undefined) {
    const pts = String(b.retention_curve).split(/[\s,;]+/).map(Number).filter(n => Number.isFinite(n) && n >= 0 && n <= 100).slice(0, 600);
    sets.push('retention_curve=?'); vals.push(pts.join(','));
  }
  if (b.notes !== undefined) { sets.push('notes=?'); vals.push(s(b.notes, 2000)); }
  if (b.posted !== undefined) { sets.push('posted=?'); vals.push(b.posted ? 1 : 0); }
  if (b.publish_date !== undefined) { sets.push('publish_date=?'); vals.push(/^\d{4}-\d{2}-\d{2}$/.test(b.publish_date) ? b.publish_date : ''); }
  // entering results implies the video is out
  if (STAT_NUM.some(k => pos(b[k]) > 0) && b.posted === undefined) {
    sets.push('posted=1');
    sets.push(`publish_date=CASE WHEN publish_date='' THEN ? ELSE publish_date END`); vals.push(localParts(new Date(), tz).date);
  }
  if (!sets.length) return;
  sets.push('updated_at=?'); vals.push(nowIso());
  db.prepare(`UPDATE stats SET ${sets.join(',')} WHERE video_id=?`).run(...vals, videoId);
}

const getVideo = (wsId, id) => listVideos(wsId).find(v => v.id === id);

app.get('/api/videos', wrap((req, res) => {
  const ch = req.query.channel ? channelId(req.ws.id, req.query.channel) : undefined;
  ok(res, { videos: listVideos(req.ws.id, ch) });
}));

/** Create, or update by `ref`/`id` (idempotent for integrations). Optional: stats, schedule_at, channel. */
app.post('/api/videos', wrap((req, res) => {
  const b = req.body || {};
  const fields = normalizeVideoBody(b);
  const ws = req.ws;
  const refIn = s(b.ref ?? (typeof b.id === 'string' ? b.id : ''), 80);
  const existing = refIn && db.prepare('SELECT id FROM videos WHERE workspace_id=? AND ref=?').get(ws.id, slugify(refIn));
  const result = db.transaction(() => {
    let id;
    if (existing) {
      id = existing.id;
      const keys = Object.keys(fields);
      if (b.channel !== undefined || b.channel_id !== undefined) { keys.push('channel_id'); fields.channel_id = channelId(ws.id, b.channel_id ?? b.channel); }
      if (keys.length) db.prepare(`UPDATE videos SET ${keys.map(k => `${k}=@${k}`).join(',')}, updated_at=@u WHERE id=@id`).run({ ...fields, u: nowIso(), id });
    } else {
      if (!fields.title) throw httpErr(400, 'Podaj tytuł filmu (pole title).');
      const ref = uniqueRef(ws.id, refIn || fields.title);
      const chId = channelId(ws.id, b.channel_id ?? b.channel);
      const row = { title: '', hook: '', topic: '', visual: '', voice: '', pace: '', cta: '', category: '', pin: '', caption: '', url: '', file_url: '', duration_sec: 0, ...fields };
      id = db.prepare(`INSERT INTO videos(workspace_id,channel_id,ref,title,hook,topic,visual,voice,pace,cta,category,pin,caption,url,file_url,duration_sec,source)
        VALUES(@ws,@ch,@ref,@title,@hook,@topic,@visual,@voice,@pace,@cta,@category,@pin,@caption,@url,@file_url,@duration_sec,@source)`)
        .run({ ...row, ws: ws.id, ch: chId, ref, source: req.via === 'api' ? 'api' : (s(b.source, 10) || 'manual') }).lastInsertRowid;
      db.prepare('INSERT INTO stats(video_id) VALUES(?)').run(id);
    }
    if (b.stats && typeof b.stats === 'object') writeStats(id, b.stats, ws.timezone);
    if (b.schedule_at || b.schedule_date) addSchedule(ws, id, b.schedule_at, b.schedule_date, b.schedule_time, b.caption ?? fields.caption);
    if (b.queue_id) db.prepare("UPDATE queue SET video_id=?, status='done', updated_at=? WHERE id=? AND workspace_id=?").run(id, nowIso(), int(b.queue_id), ws.id);
    return id;
  })();
  ok(res, { video: getVideo(ws.id, result), created: !existing });
}));

app.put('/api/videos/:id', wrap((req, res) => {
  const v = db.prepare('SELECT id FROM videos WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!v) throw httpErr(404, 'Film nie istnieje.');
  const fields = normalizeVideoBody(req.body);
  if ('title' in fields && !fields.title) throw httpErr(400, 'Tytuł nie może być pusty.');
  if (req.body?.channel_id !== undefined) fields.channel_id = channelId(req.ws.id, req.body.channel_id);
  const keys = Object.keys(fields);
  if (keys.length) db.prepare(`UPDATE videos SET ${keys.map(k => `${k}=@${k}`).join(',')}, updated_at=@u WHERE id=@id`).run({ ...fields, u: nowIso(), id: v.id });
  if (req.body?.stats) writeStats(v.id, req.body.stats, req.ws.timezone);
  ok(res, { video: getVideo(req.ws.id, v.id) });
}));

app.put('/api/videos/:id/stats', wrap((req, res) => {
  const v = db.prepare('SELECT id FROM videos WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!v) throw httpErr(404, 'Film nie istnieje.');
  writeStats(v.id, req.body || {}, req.ws.timezone);
  ok(res, { video: getVideo(req.ws.id, v.id) });
}));

// ---- TikTok Studio export: every post with its retention curve; a film's stats come from its most viewed post
function refreshPostStats(ws, videoId) {
  const best = db.prepare('SELECT * FROM tiktok_posts WHERE workspace_id=? AND video_id=? ORDER BY views DESC LIMIT 1').get(ws.id, videoId);
  if (!best) return;
  const d = JSON.parse(best.data || '{}');
  writeStats(videoId, { ...d, retention_curve: (d.retention || []).join(','), posted: 1, publish_date: (best.posted_at || '').slice(0, 10) }, ws.timezone);
  db.prepare("UPDATE videos SET url=? WHERE id=? AND url=''").run(best.url, videoId);
}
const postRow = (p, titles) => {
  const d = JSON.parse(p.data || '{}');
  return { tiktok_id: p.tiktok_id, video_id: p.video_id, video_title: titles.get(p.video_id) || '', how: p.match_how, caption: p.caption, posted_at: p.posted_at,
    duration: p.duration, views: p.views, url: p.url, completion: d.completion ?? null, avg_watch: d.avg_watch ?? null, r3: d.retention?.[3] ?? null };
};
function listPosts(wsId) {
  const titles = new Map(db.prepare('SELECT id, title FROM videos WHERE workspace_id=?').all(wsId).map(v => [v.id, v.title]));
  return db.prepare('SELECT * FROM tiktok_posts WHERE workspace_id=? ORDER BY posted_at DESC').all(wsId).map(p => postRow(p, titles));
}

app.post('/api/stats/tiktok-import', wrap((req, res) => {
  const text = String(req.body?.csv || '');
  if (!isTiktokExport(text)) throw httpErr(400, 'To nie wygląda na eksport z TikTok Studio (brak kolumn "Video ID" i "Audience retention"). Pobierz go w TikTok Studio: Analityka, Treści, Eksportuj.');
  const posts = tiktokExportPosts(text);
  if (!posts.length) throw httpErr(400, 'Plik nie ma żadnego filmu.');
  const chId = req.body?.channel_id ? channelId(req.ws.id, req.body.channel_id) : null;
  const videos = db.prepare('SELECT id, channel_id, title, ref, caption, url, duration_sec, created_at FROM videos WHERE workspace_id=?').all(req.ws.id);
  const touched = new Set();
  db.transaction(() => {
    for (const p of posts) {
      const prev = db.prepare('SELECT video_id, match_how FROM tiktok_posts WHERE workspace_id=? AND tiktok_id=?').get(req.ws.id, p.tiktok_id);
      // a link the user set by hand wins over any guess
      const m = prev?.match_how === 'ręcznie' ? { video: { id: prev.video_id }, how: 'ręcznie' } : matchPost(p, videos, chId);
      const { tiktok_id, url, caption, posted_at, duration, views, ...rest } = p;
      db.prepare(`INSERT INTO tiktok_posts(workspace_id,tiktok_id,video_id,match_how,url,caption,posted_at,duration,views,data,imported_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(workspace_id,tiktok_id) DO UPDATE SET video_id=excluded.video_id, match_how=excluded.match_how, url=excluded.url, caption=excluded.caption,
        posted_at=excluded.posted_at, duration=excluded.duration, views=excluded.views, data=excluded.data, imported_at=excluded.imported_at`)
        .run(req.ws.id, tiktok_id, m?.video.id ?? null, m?.how || '', url, caption.slice(0, 2200), posted_at, duration, views, JSON.stringify({ views, ...rest }), nowIso());
      if (m?.video.id) touched.add(m.video.id);
    }
    for (const id of touched) refreshPostStats(req.ws, id);
  })();
  const ids = new Set(posts.map(p => p.tiktok_id));
  const rows = listPosts(req.ws.id).filter(p => ids.has(p.tiktok_id));
  ok(res, { posts: rows, matched: rows.filter(p => p.video_id).length, films: touched.size });
}));

app.get('/api/stats/tiktok-posts', wrap((req, res) => ok(res, { posts: listPosts(req.ws.id) })));

/** Link a post to a film by hand (or unlink with video_id null); the film's stats follow its best post. */
app.put('/api/stats/tiktok-posts/:tid', wrap((req, res) => {
  const p = db.prepare('SELECT * FROM tiktok_posts WHERE workspace_id=? AND tiktok_id=?').get(req.ws.id, String(req.params.tid));
  if (!p) throw httpErr(404, 'Nie ma takiego posta. Zaimportuj eksport jeszcze raz.');
  const vid = req.body?.video_id ? int(req.body.video_id) : null;
  if (vid && !db.prepare('SELECT id FROM videos WHERE id=? AND workspace_id=?').get(vid, req.ws.id)) throw httpErr(404, 'Film nie istnieje.');
  db.prepare("UPDATE tiktok_posts SET video_id=?, match_how=? WHERE workspace_id=? AND tiktok_id=?").run(vid, vid ? 'ręcznie' : '', req.ws.id, p.tiktok_id);
  if (vid) refreshPostStats(req.ws, vid);
  if (p.video_id && p.video_id !== vid) refreshPostStats(req.ws, p.video_id);
  ok(res, { posts: listPosts(req.ws.id) });
}));

app.delete('/api/videos/:id', wrap((req, res) => {
  const v = db.prepare('SELECT id, media_path FROM videos WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!v) throw httpErr(404, 'Film nie istnieje.');
  db.prepare('DELETE FROM videos WHERE id=?').run(v.id);
  if (v.media_path) rmSync(v.media_path, { force: true });
  ok(res);
}));

// rendered files the Studio stores itself (generator output); only the owning workspace can read them
function mediaOf(req) {
  const v = db.prepare('SELECT id, title, media_path FROM videos WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!v?.media_path || !existsSync(v.media_path)) throw httpErr(404, 'Ten film nie ma pliku w Studio.');
  return v;
}
app.get('/api/videos/:id/media', wrap((req, res) => { const v = mediaOf(req); res.type('video/mp4'); res.sendFile(v.media_path); }));
// list thumbnail: one frame from the film, cached next to it and rebuilt when the film file changes
app.get('/api/videos/:id/thumb', wrap((req, res) => {
  const v = mediaOf(req);
  const thumb = v.media_path.replace(/\.mp4$/i, '') + '.thumb.jpg';
  if (!existsSync(thumb) || statSync(thumb).mtimeMs < statSync(v.media_path).mtimeMs) {
    const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '0.6', '-i', v.media_path, '-frames:v', '1', '-vf', 'scale=270:-2', '-q:v', '4', thumb], { timeout: 30_000 });
    if (r.status !== 0 || !existsSync(thumb)) throw httpErr(404, 'Nie udało się zrobić miniatury.');
  }
  res.set('Cache-Control', 'private, max-age=300').sendFile(thumb);
}));
app.get('/api/videos/:id/download', wrap((req, res) => { const v = mediaOf(req); res.download(v.media_path, `${slugify(v.title)}.mp4`); }));

// ---- generator (opencode + DeepSeek) ---------------------------------------------------------
app.get('/api/generator', (req, res) => ok(res, { generator: { ...generatorStatus(req.query.refresh === '1'), usedToday: usedToday(req.ws), phases: PHASES } }));
app.post('/api/generate', requireUser, rateLimit('generate', 20, 3600_000), wrap((req, res) => {
  const b = req.body || {};
  let topic = s(b.topic, 200), hook = s(b.hook, 300), notes = s(b.notes, 2000), queueId = null, chId = null, qStyle = '', qLen = 0;
  if (b.queue_id) {
    const q = db.prepare('SELECT * FROM queue WHERE id=? AND workspace_id=?').get(int(b.queue_id), req.ws.id);
    if (!q) throw httpErr(404, 'Temat nie istnieje.');
    if (q.video_id) throw httpErr(409, 'Ten temat ma już film.');
    topic = topic || q.topic; hook = hook || q.hook; notes = notes || q.notes; queueId = q.id; chId = q.channel_id; qStyle = q.style || ''; qLen = q.length_sec || 0;
  }
  if (!topic) throw httpErr(400, 'Podaj temat filmu.');
  if (!chId) chId = channelId(req.ws.id, b.channel_id ?? b.channel, { required: true });
  if (!queueId) {
    // a film started from a bare topic still gets a card in the queue, so it shows where it is
    queueId = db.prepare("INSERT INTO queue(workspace_id,channel_id,topic,hook,notes,status) VALUES(?,?,?,?,?,'render')")
      .run(req.ws.id, chId, topic, hook, notes).lastInsertRowid;
  }
  const len = Math.round(Number(b.length_sec) || qLen);   // no length sent = the one planned on the topic
  let attachment;
  if (b.attachment_id) {
    const u = db.prepare('SELECT id, name, path FROM uploads WHERE id=? AND workspace_id=?').get(int(b.attachment_id), req.ws.id);
    if (!u) throw httpErr(400, 'Załącznik nie istnieje. Wgraj PDF ponownie.');
    attachment = { id: u.id, name: u.name, path: u.path };
  }
  let format = ['short', 'long_vertical', 'long_wide'].includes(b.format) ? b.format : 'short';
  if (format === 'short' && len > 90) format = 'long_vertical';   // a vertical film over 90 s is the long vertical format, not a clipped short
  const opts = { attachment, format, length_sec: Number.isFinite(len) && len >= 20 && len <= 600 ? len : undefined,
    voice: VOICES.includes(b.voice) ? b.voice : undefined, script: s(b.script, 6000) || undefined };
  const style = styleList().find(x => x.id === ('style' in b ? b.style : qStyle));   // no style sent = the one planned on the topic
  if (style?.verticalOnly && opts.format === 'long_wide') throw httpErr(400, `Styl "${style.name}" jest tylko pionowy. Wybierz format pionowy albo inny styl.`);
  opts.style = style ? style.id : undefined;   // brak stylu = agent dobiera sam z katalogu
  opts.broll = b.broll === true || b.broll === 'true' || b.broll === 1;
  opts.research = b.research === true;
  opts.music = b.music === true;   // music is opt-in: without it the film is voice and sound effects only
  if (Array.isArray(b.biblia_off)) opts.biblia_off = b.biblia_off.filter(id => BIBLIA_IDS.includes(id));   // TikTok Bible elements switched off
  if (Array.isArray(b.subskills)) {
    const own = new Set(db.prepare('SELECT id FROM subskills WHERE workspace_id=? AND enabled=1').all(req.ws.id).map(r => r.id));
    opts.subskills = b.subskills.map(Number).filter(id => own.has(id)).slice(0, 10);
  }
  const id = createJob(req.ws, { topic, hook, notes, channelId: chId, queueId, model: s(b.model, 120), opts, start: b.start !== false });
  ok(res, { job_id: id });
}));
// ---- attachments (PDF source material for the generator) ------------------------------------
const UPLOAD_DIR = resolve(__dirname, '../data/uploads');
function pdfText(file) {
  for (const [cmd, args] of [['pdftotext', ['-layout', '-enc', 'UTF-8', file, '-']],
    ['python3', ['-c', 'import sys,pypdf;print("\n".join((p.extract_text() or "") for p in pypdf.PdfReader(sys.argv[1]).pages))', file]]]) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60_000 });
    if (r.status === 0 && r.stdout.trim()) return r.stdout;
  }
  return '';
}
app.post('/api/uploads', requireUser, rateLimit('upload', 30, 3600_000), express.raw({ type: () => true, limit: '20mb' }), wrap((req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 100) throw httpErr(400, 'Pusty plik.');
  if (buf.subarray(0, 5).toString() !== '%PDF-') throw httpErr(400, 'To nie jest plik PDF.');
  const name = s(String(req.query.name || 'dokument.pdf').replace(/[^\p{L}\p{N} ._()-]+/gu, '_'), 120) || 'dokument.pdf';
  const dir = join(UPLOAD_DIR, String(req.ws.id));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${Date.now()}-${newToken(6)}.pdf`);
  writeFileSync(path, buf);
  const text = pdfText(path);
  writeFileSync(path.replace(/\.pdf$/, '.txt'), text);
  const id = db.prepare('INSERT INTO uploads(workspace_id,name,path,size,text_chars) VALUES(?,?,?,?,?)').run(req.ws.id, name, path, buf.length, text.length).lastInsertRowid;
  ok(res, { upload: { id, name, size: buf.length, text_chars: text.length } });
}));

app.get('/api/jobs', (req, res) => ok(res, { jobs: listJobs(req.ws.id), eta_min: estimateMinutes(req.ws.id) }));
app.post('/api/jobs/start', requireUser, wrap((req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : null;
  ok(res, startHeld(req.ws, ids));
}));
app.post('/api/jobs/cancel-queued', requireUser, (req, res) => {
  const ids = db.prepare("SELECT id FROM gen_jobs WHERE workspace_id=? AND status IN ('held','queued')").all(req.ws.id).map(r => r.id);
  ok(res, { canceled: ids.filter(id => cancelJob(req.ws.id, id)).length });
});

// ---- music library (favourites go under the generated videos) ------------------------------------
app.get('/api/music', (req, res) => ok(res, { music: listMusic(req.ws.id, String(req.query.filter || 'all')), settings: musicSettings(req.ws.id) }));
app.post('/api/music/upload', requireUser, rateLimit('music-up', 60, 3600_000), express.raw({ type: () => true, limit: '40mb' }), wrap((req, res) => {
  const name = String(req.query.name || 'utwor.mp3').replace(/[^\p{L}\p{N} ._()-]+/gu, '_').slice(0, 120);
  const id = addMusicFile(req.ws.id, req.body, { filename: name, title: s(req.query.title, 120) });
  ok(res, { id });
}));
app.post('/api/music/link', requireUser, rateLimit('music-link', 30, 3600_000), wrap(async (req, res) => {
  ok(res, { id: await addMusicLink(req.ws.id, req.body?.url, { title: s(req.body?.title, 120) }) });
}));
app.post('/api/music/trending/refresh', requireUser, rateLimit('music-trend', 6, 3600_000), wrap(async (req, res) => ok(res, await refreshTrending(req.ws.id))));
app.post('/api/music/ai-curate', requireUser, rateLimit('music-ai', 20, 3600_000), wrap(async (req, res) => ok(res, await aiCurate(req.ws.id))));
app.put('/api/music/settings', requireUser, wrap((req, res) => ok(res, { settings: saveMusicSettings(req.ws.id, req.body || {}) })));
app.put('/api/music/:id', wrap((req, res) => { if (!updateMusic(req.ws.id, int(req.params.id), req.body || {})) throw httpErr(404, 'Utwór nie istnieje.'); ok(res); }));
app.delete('/api/music/:id', wrap((req, res) => { if (!deleteMusic(req.ws.id, int(req.params.id))) throw httpErr(404, 'Utwór nie istnieje.'); ok(res); }));
app.get('/api/music/:id/file', wrap((req, res) => {
  const m = getMusic(req.ws.id, int(req.params.id));
  if (!m?.file || !existsSync(m.file)) throw httpErr(404, 'Brak pliku utworu.');
  res.sendFile(m.file);
}));

// ---- inspiration: TikTok library, ultra breakdown, remix into the queue ------------------------------
app.get('/api/inspire', (req, res) => ok(res, { items: listLibrary(req.ws.id, String(req.query.filter || 'all')), apify: apifyReady() }));
app.post('/api/inspire/search', requireUser, rateLimit('inspire-search', 20, 3600_000), wrap(async (req, res) => {
  ok(res, { items: await searchTikToks(req.ws.id, req.body || {}) });
}));
app.post('/api/inspire/link', requireUser, rateLimit('inspire-link', 30, 3600_000), wrap(async (req, res) => ok(res, { id: await addByLink(req.ws.id, req.body?.url) })));
app.get('/api/inspire/:id', wrap((req, res) => {
  const it = getInspire(req.ws.id, int(req.params.id));
  if (!it) throw httpErr(404, 'Nie ma takiego filmu w bibliotece.');
  const { dir, ...item } = it;
  const frames = dir && existsSync(dir) ? readdirSync(dir).filter(f => /^(hook|sheet-\d+)\.jpg$/.test(f)).sort() : [];
  ok(res, { item: { ...item, shots: item.shots ? JSON.parse(item.shots) : [], frames } });
}));
app.post('/api/inspire/:id/breakdown', requireUser, rateLimit('inspire-bd', 30, 3600_000), wrap((req, res) => { startBreakdown(req.ws.id, int(req.params.id)); ok(res); }));
app.post('/api/inspire/:id/remix', requireUser, wrap((req, res) => ok(res, { queue_id: remixToQueue(req.ws.id, int(req.params.id), req.body || {}) })));
app.delete('/api/inspire/:id', wrap((req, res) => { if (!deleteInspire(req.ws.id, int(req.params.id))) throw httpErr(404, 'Nie ma takiego filmu.'); ok(res); }));
app.get('/api/inspire/:id/frame/:name', wrap((req, res) => {
  const p = framePath(req.ws.id, int(req.params.id), String(req.params.name));
  if (!p) throw httpErr(404, 'Brak klatki.');
  res.sendFile(p);
}));

// ---- subskills: the user's own add-ons for the generator brief -------------------------------------
// ---- generator agents: every account can rewrite the brief of each agent; empty = the kit default ----
const agentRow = (wsId, a) => {
  const own = db.prepare('SELECT updated_at FROM agent_prompts WHERE workspace_id=? AND agent=?').get(wsId, a.id);
  return { ...a, custom: Boolean(own), updated_at: own?.updated_at || null, body: agentTemplate(wsId, a.id), placeholders: [...new Set(agentDefault(a.id).match(/\{\{\w+\}\}/g) || [])] };
};
app.get('/api/agents', (req, res) => ok(res, { agents: AGENTS.map(a => agentRow(req.ws.id, a)) }));
app.get('/api/agents/:id/default', wrap((req, res) => {
  if (!AGENTS.some(a => a.id === req.params.id)) throw httpErr(404, 'Nie ma takiego agenta.');
  ok(res, { body: agentDefault(req.params.id) });
}));
app.put('/api/agents/:id', requireUser, wrap((req, res) => {
  const a = AGENTS.find(x => x.id === req.params.id);
  if (!a) throw httpErr(404, 'Nie ma takiego agenta.');
  const body = String(req.body?.body ?? '').replace(/\r\n/g, '\n');
  if (body.trim().length < 200) throw httpErr(400, 'Prompt jest za krótki (min. 200 znaków). Żeby wrócić do domyślnego, użyj "Przywróć domyślny".');
  if (body.length > 60000) throw httpErr(400, 'Prompt jest za długi (max 60 000 znaków).');
  db.prepare(`INSERT INTO agent_prompts(workspace_id, agent, body, updated_at) VALUES(?,?,?,?)
    ON CONFLICT(workspace_id, agent) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at`).run(req.ws.id, a.id, body, nowIso());
  ok(res, { agent: agentRow(req.ws.id, a) });
}));
app.delete('/api/agents/:id', requireUser, wrap((req, res) => {
  const a = AGENTS.find(x => x.id === req.params.id);
  if (!a) throw httpErr(404, 'Nie ma takiego agenta.');
  db.prepare('DELETE FROM agent_prompts WHERE workspace_id=? AND agent=?').run(req.ws.id, a.id);
  ok(res, { agent: agentRow(req.ws.id, a) });
}));

app.get('/api/subskills', (req, res) => ok(res, { subskills: db.prepare('SELECT * FROM subskills WHERE workspace_id=? ORDER BY id').all(req.ws.id) }));
app.post('/api/subskills', wrap((req, res) => {
  const b = req.body || {};
  if (!s(b.name, 80)) throw httpErr(400, 'Podaj nazwę dodatku.');
  if (db.prepare('SELECT COUNT(*) n FROM subskills WHERE workspace_id=?').get(req.ws.id).n >= 50) throw httpErr(429, 'Maksymalnie 50 dodatków.');
  const id = db.prepare('INSERT INTO subskills(workspace_id,name,body,enabled,default_on) VALUES(?,?,?,?,?)')
    .run(req.ws.id, s(b.name, 80), s(b.body, 4000), b.enabled === false ? 0 : 1, b.default_on ? 1 : 0).lastInsertRowid;
  ok(res, { id });
}));
app.put('/api/subskills/:id', wrap((req, res) => {
  const cur = db.prepare('SELECT * FROM subskills WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!cur) throw httpErr(404, 'Dodatek nie istnieje.');
  const b = req.body || {};
  db.prepare('UPDATE subskills SET name=?, body=?, enabled=?, default_on=? WHERE id=?').run(
    'name' in b ? (s(b.name, 80) || cur.name) : cur.name, 'body' in b ? s(b.body, 4000) : cur.body,
    'enabled' in b ? (b.enabled ? 1 : 0) : cur.enabled, 'default_on' in b ? (b.default_on ? 1 : 0) : cur.default_on, cur.id);
  ok(res);
}));
app.delete('/api/subskills/:id', wrap((req, res) => {
  if (!db.prepare('DELETE FROM subskills WHERE id=? AND workspace_id=?').run(int(req.params.id), req.ws.id).changes) throw httpErr(404, 'Dodatek nie istnieje.');
  ok(res);
}));

// ---- agent (one instruction runs the whole studio) ----------------------------------------
app.get('/api/agent', (req, res) => ok(res, { messages: agentHistory(req.ws.id), model: AGENT_MODEL }));
// streamed as server-sent events: text deltas and each action appear while the agent works
app.post('/api/agent', requireUser, rateLimit('agent', 40, 3600_000), async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  try { await agentChat(req.ws, req.body?.message, send); }
  catch (e) { if (!e.status) console.error(e); send('error', { message: e.status ? e.message : 'Błąd serwera. Spróbuj ponownie.' }); }
  res.end();
});
app.delete('/api/agent', requireUser, (req, res) => { clearAgentHistory(req.ws.id); ok(res); });
app.get('/api/jobs/:id', wrap((req, res) => {
  const j = jobForWorkspace(req.ws.id, int(req.params.id));
  if (!j) throw httpErr(404, 'Zadanie nie istnieje.');
  ok(res, { job: j });
}));
// frames the agent looked at (contact sheets, snapshots), shown inline in the job log
app.get('/api/jobs/:id/frame', wrap((req, res) => {
  const j = jobForWorkspace(req.ws.id, int(req.params.id));
  if (!j) throw httpErr(404, 'Zadanie nie istnieje.');
  const base = resolve(GEN_DIR, String(req.ws.id), `job-${j.id}`);
  const file = resolve(base, String(req.query.f || ''));
  if (!file.startsWith(base + '/') || !/\.(jpe?g|png|webp)$/i.test(file) || !existsSync(file)) throw httpErr(404, 'Nie ma takiej klatki.');
  res.set('Cache-Control', 'private, max-age=60').sendFile(file);
}));
app.post('/api/jobs/:id/resume', requireUser, wrap((req, res) => {
  if (!resumeJob(req.ws.id, int(req.params.id))) throw httpErr(409, 'Tego zadania nie da się wznowić (brak zapisanej pracy agenta).');
  ok(res);
}));
app.post('/api/jobs/:id/retry', requireUser, wrap((req, res) => {
  if (!retryJob(req.ws.id, int(req.params.id))) throw httpErr(409, 'Tego zadania nie da się uruchomić ponownie (już działa albo jest gotowe).');
  ok(res);
}));
app.post('/api/jobs/:id/cancel', requireUser, wrap((req, res) => {
  if (!cancelJob(req.ws.id, int(req.params.id))) throw httpErr(409, 'Tego zadania nie da się już zatrzymać.');
  ok(res);
}));

// ---- schedule ------------------------------------------------------------------------
function toUtcIso(ws, at, date, time) {
  if (at) {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) throw httpErr(400, 'Nieprawidłowa data publikacji.');
    return d.toISOString();
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw httpErr(400, 'Wybierz datę publikacji.');
  const t = /^\d{1,2}:\d{2}$/.test(String(time || '')) ? String(time).padStart(5, '0') : '18:00';
  return zonedToUtc(date, t, ws.timezone);
}
function addSchedule(ws, videoId, at, date, time, caption = '') {
  const iso = toUtcIso(ws, at, date, time);
  // one planned slot per video: re-scheduling moves it instead of piling up duplicates
  const cur = db.prepare("SELECT id FROM schedule WHERE video_id=? AND workspace_id=? AND status='planned'").get(videoId, ws.id);
  if (cur) { db.prepare('UPDATE schedule SET scheduled_at=?, caption=?, reminded=0 WHERE id=?').run(iso, s(caption, 2200), cur.id); return cur.id; }
  return db.prepare('INSERT INTO schedule(workspace_id,video_id,scheduled_at,caption) VALUES(?,?,?,?)').run(ws.id, videoId, iso, s(caption, 2200)).lastInsertRowid;
}

app.get('/api/schedule', wrap((req, res) => {
  const ch = req.query.channel ? channelId(req.ws.id, req.query.channel) : null;
  ok(res, { schedule: db.prepare(`SELECT sc.*, v.title, v.channel_id FROM schedule sc JOIN videos v ON v.id = sc.video_id
    WHERE sc.workspace_id=@w AND (@ch IS NULL OR v.channel_id=@ch) ORDER BY sc.scheduled_at`).all({ w: req.ws.id, ch }) });
}));
app.post('/api/schedule', wrap((req, res) => {
  const b = req.body || {};
  const v = db.prepare('SELECT id, caption FROM videos WHERE id=? AND workspace_id=?').get(int(b.video_id), req.ws.id);
  if (!v) throw httpErr(400, 'Wybierz film do zaplanowania.');
  const id = addSchedule(req.ws, v.id, b.scheduled_at, b.date, b.time, b.caption ?? v.caption);
  ok(res, { id });
}));
app.put('/api/schedule/:id', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM schedule WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!row) throw httpErr(404, 'Wpis nie istnieje.');
  const b = req.body || {};
  const status = 'status' in b ? s(b.status, 10) : row.status;
  if (!['planned', 'posted', 'skipped'].includes(status)) throw httpErr(400, 'Nieznany status.');
  let at = (b.scheduled_at || b.date) ? toUtcIso(req.ws, b.scheduled_at, b.date, b.time) : row.scheduled_at;
  // posted ahead of plan: the calendar and stats should show when it really went out
  if (status === 'posted' && row.status !== 'posted' && at > nowIso()) at = nowIso();
  db.transaction(() => {
    db.prepare('UPDATE schedule SET scheduled_at=?, caption=?, status=?, reminded=CASE WHEN ?<>scheduled_at THEN 0 ELSE reminded END WHERE id=?')
      .run(at, 'caption' in b ? s(b.caption, 2200) : row.caption, status, at, row.id);
    if (status === 'posted') writeStats(row.video_id, { posted: 1, publish_date: localParts(new Date(at), req.ws.timezone).date }, req.ws.timezone);
    if (status !== 'posted' && row.status === 'posted') writeStats(row.video_id, { posted: 0 }, req.ws.timezone);
  })();
  ok(res);
}));
app.delete('/api/schedule/:id', wrap((req, res) => {
  const r = db.prepare('DELETE FROM schedule WHERE id=? AND workspace_id=?').run(int(req.params.id), req.ws.id);
  if (!r.changes) throw httpErr(404, 'Wpis nie istnieje.');
  ok(res);
}));

// ---- render queue (topics) ---------------------------------------------------------------
const QSTATUS = ['idea', 'script', 'render', 'qa', 'done'];
app.get('/api/queue', wrap((req, res) => {
  const ch = req.query.channel ? channelId(req.ws.id, req.query.channel) : null;
  ok(res, { queue: db.prepare(`SELECT * FROM queue WHERE workspace_id=@w AND (@ch IS NULL OR channel_id=@ch)
    ORDER BY priority, created_at`).all({ w: req.ws.id, ch }) });
}));
app.post('/api/queue', wrap((req, res) => {
  const b = req.body || {};
  const topic = s(b.topic, 200);
  if (!topic) throw httpErr(400, 'Wpisz temat.');
  const status = QSTATUS.includes(b.status) ? b.status : 'idea';
  const r = db.prepare('INSERT INTO queue(workspace_id,channel_id,topic,hook,notes,status,priority) VALUES(?,?,?,?,?,?,?)')
    .run(req.ws.id, channelId(req.ws.id, b.channel_id ?? b.channel), topic, s(b.hook, 300), s(b.notes, 2000), status, Math.min(3, Math.max(1, int(b.priority, 2))));
  ok(res, { id: r.lastInsertRowid });
}));
app.put('/api/queue/:id', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM queue WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!row) throw httpErr(404, 'Temat nie istnieje.');
  const b = req.body || {};
  if ('status' in b && !QSTATUS.includes(b.status)) throw httpErr(400, 'Nieznany etap.');
  if ('topic' in b && !s(b.topic)) throw httpErr(400, 'Temat nie może być pusty.');
  if ('style' in b && b.style && !styleList().some(x => x.id === b.style)) throw httpErr(400, 'Nieznany styl wizualny.');
  db.prepare('UPDATE queue SET topic=?, hook=?, notes=?, status=?, priority=?, style=?, length_sec=?, updated_at=? WHERE id=?').run(
    'topic' in b ? s(b.topic, 200) : row.topic, 'hook' in b ? s(b.hook, 300) : row.hook, 'notes' in b ? s(b.notes, 2000) : row.notes,
    b.status || row.status, 'priority' in b ? Math.min(3, Math.max(1, int(b.priority, 2))) : row.priority, 'style' in b ? s(b.style, 60) : (row.style || ''),
    'length_sec' in b ? Math.min(600, Math.max(0, int(b.length_sec))) : (row.length_sec || 0), nowIso(), row.id);
  ok(res);
}));
app.delete('/api/queue/:id', wrap((req, res) => {
  const r = db.prepare('DELETE FROM queue WHERE id=? AND workspace_id=?').run(int(req.params.id), req.ws.id);
  if (!r.changes) throw httpErr(404, 'Temat nie istnieje.');
  ok(res);
}));
/** A finished topic becomes a video (and optionally gets a publish slot) in one click. */
app.post('/api/queue/:id/to-video', wrap((req, res) => {
  const q = db.prepare('SELECT * FROM queue WHERE id=? AND workspace_id=?').get(int(req.params.id), req.ws.id);
  if (!q) throw httpErr(404, 'Temat nie istnieje.');
  if (q.video_id && db.prepare('SELECT 1 FROM videos WHERE id=?').get(q.video_id)) throw httpErr(409, 'Ten temat ma już film.');
  const b = req.body || {};
  const id = db.transaction(() => {
    const vid = db.prepare(`INSERT INTO videos(workspace_id,channel_id,ref,title,hook,topic,url,source) VALUES(?,?,?,?,?,?,?,'manual')`)
      .run(req.ws.id, q.channel_id, uniqueRef(req.ws.id, q.topic), s(b.title, 200) || q.topic, q.hook, s(b.topic, 120), normalizeVideoBody({ url: b.url }).url || '').lastInsertRowid;
    db.prepare('INSERT INTO stats(video_id) VALUES(?)').run(vid);
    db.prepare("UPDATE queue SET video_id=?, status='done', updated_at=? WHERE id=?").run(vid, nowIso(), q.id);
    if (b.date) addSchedule(req.ws, vid, null, b.date, b.time, '');
    return vid;
  })();
  ok(res, { video: getVideo(req.ws.id, id) });
}));

// ---- analysis + mail ---------------------------------------------------------------------
app.get('/api/analysis', wrap((req, res) => {
  const ch = req.query.channel ? channelId(req.ws.id, req.query.channel) : undefined;
  ok(res, { analysis: analyze(req.ws.id, ch) });
}));

const recipientOf = (ws) => ws.mail_to || db.prepare('SELECT email FROM users WHERE id=?').get(ws.owner_id)?.email;
app.post('/api/mail/:kind', requireUser, rateLimit('mail', 10, 3600_000), wrap(async (req, res) => {
  const ws = req.ws;
  const to = recipientOf(ws);
  let m;
  if (req.params.kind === 'test') m = { subject: 'TikTok Studio: test maila', html: emailShell('Maile działają', '<p>Jeśli to czytasz, raporty i przypomnienia dotrą na ten adres.</p>') };
  else if (req.params.kind === 'digest') m = buildDailyDigest(ws);
  else if (req.params.kind === 'weekly') m = buildWeeklyReport(ws);
  else throw httpErr(404, 'Nieznany typ maila.');
  const r = await sendMail({ to, ...m });
  if (!r.ok) throw httpErr(502, `Nie udało się wysłać: ${r.error}`);
  ok(res, { to, dry: Boolean(r.dry) });
}));

// ---- setup (AI, CSV, manual all end in applySetup) ------------------------------------
app.post('/api/setup/ai', requireUser, rateLimit('ai', 20, 3600_000), wrap(async (req, res) => {
  const r = await parseSetup(req.body?.text, { model: s(req.body?.model, 120) || req.ws.ai_model || DEFAULT_MODEL });
  ok(res, r);
}));
app.post('/api/setup/csv', wrap((req, res) => {
  const text = String(req.body?.csv || '');
  if (text.length > 900_000) throw httpErr(400, 'Plik jest za duży (max ok. 900 KB).');
  const r = csvToVideos(text);
  if (r.error) throw httpErr(400, r.error);
  ok(res, { setup: cleanSetup({ videos: r.videos }), columns: r.map });
}));
app.post('/api/setup/apply', wrap((req, res) => {
  const setup = cleanSetup(req.body?.setup || {});
  const counts = applySetup(req.ws, setup, s(req.body?.source, 10) || 'ai');
  ok(res, { counts, progress: progressOf(req.ws.id) });
}));

export function applySetup(ws, setup, source = 'ai') {
  return db.transaction(() => {
    const counts = { channel: 0, videos: 0, updated: 0, topics: 0, schedule: 0 };
    const c = setup.channel;
    let ch = c.name ? db.prepare('SELECT * FROM channels WHERE workspace_id=? AND (lower(name)=lower(?) OR (handle<>\'\' AND lower(handle)=lower(?)))').get(ws.id, c.name, c.handle) : null;
    if (ch) {
      db.prepare(`UPDATE channels SET handle=CASE WHEN handle='' THEN ? ELSE handle END, niche=CASE WHEN niche='' THEN ? ELSE niche END,
        audience=CASE WHEN audience='' THEN ? ELSE audience END, goal=CASE WHEN goal='' THEN ? ELSE goal END WHERE id=?`).run(c.handle, c.niche, c.audience, c.goal, ch.id);
    } else if (c.name || !db.prepare('SELECT 1 FROM channels WHERE workspace_id=?').get(ws.id)) {
      const id = db.prepare('INSERT INTO channels(workspace_id,name,handle,niche,audience,goal) VALUES(?,?,?,?,?,?)')
        .run(ws.id, c.name || 'Mój kanał', c.handle, c.niche, c.audience, c.goal).lastInsertRowid;
      ch = { id }; counts.channel = 1;
    }
    const chId = ch?.id || db.prepare('SELECT id FROM channels WHERE workspace_id=? ORDER BY id LIMIT 1').get(ws.id).id;
    const byTitle = new Map(db.prepare('SELECT id, title FROM videos WHERE workspace_id=?').all(ws.id).map(v => [v.title.toLowerCase(), v.id]));
    for (const v of setup.videos) {
      let id = byTitle.get(v.title.toLowerCase());
      if (id) counts.updated++;
      else {
        id = db.prepare(`INSERT INTO videos(workspace_id,channel_id,ref,title,hook,topic,visual,voice,pace,cta,category,url,source)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ws.id, chId, uniqueRef(ws.id, v.title), v.title, v.hook, v.topic, v.visual, v.voice, v.pace, v.cta, v.category, v.url, source).lastInsertRowid;
        db.prepare('INSERT INTO stats(video_id) VALUES(?)').run(id);
        byTitle.set(v.title.toLowerCase(), id); counts.videos++;
      }
      const st = {};
      for (const k of STAT_NUM) if (v[k] > 0) st[k] = v[k];
      if (v.notes) st.notes = v.notes;
      if (v.posted) st.posted = 1;
      if (v.publish_date) st.publish_date = v.publish_date;
      writeStats(id, st, ws.timezone);
    }
    for (const t of setup.topics) {
      db.prepare('INSERT INTO queue(workspace_id,channel_id,topic,hook,notes) VALUES(?,?,?,?,?)').run(ws.id, chId, t.topic, t.hook, t.notes);
      counts.topics++;
    }
    for (const x of setup.schedule) {
      let vid = byTitle.get(x.video_title.toLowerCase());
      if (!vid) {
        // a dated slot for a video the parser did not list: the video exists, so create it
        vid = db.prepare(`INSERT INTO videos(workspace_id,channel_id,ref,title,source) VALUES(?,?,?,?,?)`)
          .run(ws.id, chId, uniqueRef(ws.id, x.video_title), x.video_title, source).lastInsertRowid;
        db.prepare('INSERT INTO stats(video_id) VALUES(?)').run(vid);
        byTitle.set(x.video_title.toLowerCase(), vid); counts.videos++;
      }
      addSchedule(ws, vid, null, x.date, x.time, ''); counts.schedule++;
    }
    const st = setup.settings;
    if (st.cadence_per_day) db.prepare('UPDATE workspaces SET cadence_per_day=? WHERE id=?').run(st.cadence_per_day, ws.id);
    if (st.mail_to) db.prepare('UPDATE workspaces SET mail_to=? WHERE id=?').run(st.mail_to, ws.id);
    return counts;
  })();
}

app.use('/api', (_req, res) => fail(res, 404, 'Nie ma takiego endpointu. Lista: /integracje'));
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'Nieprawidłowy JSON w treści zapytania.');
  if (err.type === 'entity.too.large') return fail(res, 413, 'Za duże zapytanie.');
  console.error(err);
  fail(res, 500, 'Błąd serwera.');
});
app.use((req, res) => res.status(404).sendFile(resolve(PUB, '404.html')));

if (process.env.NODE_ENV !== 'test') {
  const PORT = Number(process.env.PORT || 4318);
  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => {
    console.log(`TikTok Studio Cloud: http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`);
    console.log(`mailer: ${mailerReady ? 'Brevo' : 'DRY (brak BREVO_SMTP_*)'} | AI: ${aiReady() ? DEFAULT_MODEL : 'wyłączone (brak OPENROUTER_API_KEY)'}`);
    startScheduler();
    recoverJobs();
    startLimitWatcher();
    const g = generatorStatus();
    console.log(`generator: ${g.ready ? `gotowy (${g.model})` : `niedostępny (brak: ${g.missing.join(', ')})`}`);
  });
}
