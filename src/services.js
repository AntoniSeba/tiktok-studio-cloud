// services.js: small shared helpers for the modules ported from the local studio (music, inspiration,
// competitor research): one OpenRouter chat call (text or images), one Apify actor run, per-workspace
// key/value settings and binary lookup.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { db } from './db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS ws_settings (
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  value         TEXT DEFAULT '',
  PRIMARY KEY (workspace_id, key)
);`);
export const getWs = (wsId, key, def = '') => db.prepare('SELECT value FROM ws_settings WHERE workspace_id=? AND key=?').get(wsId, key)?.value ?? def;
export const setWs = (wsId, key, value) => db.prepare('INSERT INTO ws_settings(workspace_id,key,value) VALUES(?,?,?) ON CONFLICT(workspace_id,key) DO UPDATE SET value=excluded.value')
  .run(wsId, key, String(value ?? ''));

const err = (status, msg) => Object.assign(new Error(msg), { status });

// the server may run with a short PATH (no Homebrew, no ~/.local/bin), so look in the usual places too
export function findBin(name) {
  const dirs = [...String(process.env.PATH || '').split(':'), '/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local/bin'), '/usr/bin'];
  for (const d of dirs) if (d && existsSync(join(d, name))) return join(d, name);
  return name;
}

// ---- OpenRouter ----------------------------------------------------------------------------------
export const llmReady = () => Boolean(process.env.OPENROUTER_API_KEY);
export const VISION_MODEL = process.env.VISION_MODEL || 'google/gemini-2.5-flash';
export const TEXT_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';

/** One chat completion. `images` are local JPG/PNG paths sent with the prompt (vision models). */
export async function chat({ prompt, system = '', images = [], model = TEXT_MODEL, maxTokens = 4000, timeoutMs = 180_000, json = false }) {
  if (!llmReady()) throw err(503, 'Brak OPENROUTER_API_KEY na serwerze.');
  const content = images.length
    ? [{ type: 'text', text: prompt }, ...images.map(p => ({ type: 'image_url', image_url: { url: `data:image/${p.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(p).toString('base64')}` } }))]
    : prompt;
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'https://studio.soft-synergy.com', 'X-Title': 'TikTok Studio Cloud' },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.4, ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content }] }),
  }).catch(e => { throw err(502, e.name === 'TimeoutError' ? 'Model AI nie odpowiedział na czas.' : 'Nie udało się połączyć z OpenRouter.'); });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw err(502, `Model AI zwrócił błąd: ${String(j.error?.message || r.status).slice(0, 200)}`);
  return { text: j.choices?.[0]?.message?.content || '', cost: Number(j.usage?.cost || 0), model: j.model || model };
}

// ---- Apify (TikTok scraper) ----------------------------------------------------------------------
export const apifyReady = () => Boolean(process.env.APIFY_API_TOKEN);
export const TIKTOK_ACTOR = (process.env.APIFY_TIKTOK_ACTOR || 'clockworks/tiktok-scraper').replace('/', '~');

/** Run the TikTok scraper actor synchronously and return its dataset items. */
export async function apifyTikTok(input, timeoutMs = 240_000) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw err(503, 'Brak APIFY_API_TOKEN na serwerze: TikToki pobieramy przez Apify.');
  const r = await fetch(`https://api.apify.com/v2/acts/${TIKTOK_ACTOR}/run-sync-get-dataset-items`, {
    method: 'POST', signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadMusicCovers: false, shouldDownloadSubtitles: false,
      proxyCountryCode: process.env.APIFY_PROXY_COUNTRY || 'PL', ...input }),
  }).catch(e => { throw err(502, e.name === 'TimeoutError' ? 'Apify nie odpowiedział na czas.' : 'Nie udało się połączyć z Apify.'); });
  if (!r.ok) {
    const body = (await r.text().catch(() => '')).slice(0, 300);
    throw err(r.status === 402 ? 402 : 502, `Apify ${r.status}: ${body}`);
  }
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}
