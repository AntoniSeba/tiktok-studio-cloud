// auth.js: passwords (scrypt), cookie sessions, workspace API keys and a small
// in-memory rate limiter. No third-party auth dependency on purpose.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { db, nowIso } from './db.js';

const SESSION_DAYS = 30;
export const COOKIE = 'tss_session';
const isProd = () => process.env.NODE_ENV === 'production';

export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
export const newToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [alg, saltB64, hashB64] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const got = scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expected, got);
}

export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200;

export function passwordProblem(p) {
  const s = String(p || '');
  if (s.length < 8) return 'Hasło musi mieć co najmniej 8 znaków.';
  if (s.length > 200) return 'Hasło jest za długie.';
  return '';
}

// ---- sessions ---------------------------------------------------------------
export function createSession(res, userId) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(sha256(token), userId, expires.toISOString());
  db.prepare('UPDATE users SET last_login_at=? WHERE id=?').run(nowIso(), userId);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isProd(), expires, path: '/' });
}

export function destroySession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

function userFromSession(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.email, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash=?`).get(sha256(token));
  if (!row) return null;
  if (row.expires_at < nowIso()) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token)); return null; }
  return { id: row.id, email: row.email, name: row.name };
}

export const workspaceOfUser = (userId) =>
  db.prepare('SELECT * FROM workspaces WHERE owner_id=? ORDER BY id LIMIT 1').get(userId);

// ---- API keys ---------------------------------------------------------------
// Shown once in full; only a hash and a short prefix are stored.
export function rotateApiKey(wsId) {
  const key = 'tss_' + newToken(24);
  db.prepare('UPDATE workspaces SET api_key_hash=?, api_key_prefix=? WHERE id=?').run(sha256(key), key.slice(0, 10), wsId);
  return key;
}

function workspaceFromApiKey(req) {
  const h = String(req.headers.authorization || '');
  const key = h.startsWith('Bearer ') ? h.slice(7).trim() : String(req.headers['x-api-key'] || '').trim();
  if (!key || !key.startsWith('tss_')) return null;
  return db.prepare('SELECT * FROM workspaces WHERE api_key_hash=?').get(sha256(key)) || null;
}

/**
 * Resolves who is calling: a logged-in browser (cookie) or an integration (API key).
 * Cookie writes must come from our own pages: SameSite=Lax plus the X-Requested-With
 * header (which a cross-site form cannot set) closes CSRF.
 */
export function attachAuth(req, _res, next) {
  const apiWs = workspaceFromApiKey(req);
  if (apiWs) { req.ws = apiWs; req.via = 'api'; return next(); }
  const user = userFromSession(req);
  if (user) { req.user = user; req.ws = workspaceOfUser(user.id); req.via = 'session'; }
  next();
}

export function requireWorkspace(req, res, next) {
  if (!req.ws) return res.status(401).json({ ok: false, error: 'Zaloguj się albo podaj klucz API (Authorization: Bearer tss_...).' });
  if (req.via === 'session' && !['GET', 'HEAD'].includes(req.method) && req.headers['x-requested-with'] !== 'fetch') {
    return res.status(403).json({ ok: false, error: 'Brak nagłówka X-Requested-With: fetch.' });
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Ta operacja wymaga zalogowania w przeglądarce.' });
  requireWorkspace(req, res, next);
}

// ---- rate limit -------------------------------------------------------------
const buckets = new Map();
/** Allows `max` hits per `windowMs` per key (ip + route). */
// the test suite signs up many accounts from one address; it raises every limit instead of disabling it
const LIMIT_SCALE = process.env.NODE_ENV === 'test' ? 10 : 1;
export function rateLimit(name, max, windowMs) {
  max *= LIMIT_SCALE;
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return next(); }
    if (++b.n > max) {
      res.set('Retry-After', String(Math.ceil((b.reset - now) / 1000)));
      return res.status(429).json({ ok: false, error: 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.' });
    }
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); }, 60_000).unref();
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso()), 3600_000).unref();
