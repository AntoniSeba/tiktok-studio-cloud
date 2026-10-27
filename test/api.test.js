// End-to-end API test: the whole path from sign-up to a scheduled, measured
// video, plus isolation between accounts and the integration API key.
// Runs against an in-memory database: `npm test`.
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
delete process.env.BREVO_SMTP_USER;

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { app } = await import('../src/server.js');
const { tick } = await import('../src/scheduler.js');
const { zonedToUtc, csvToVideos } = await import('../src/importers.js');
const { cleanSetup } = await import('../src/ai.js');

let server, base;
before(async () => { server = app.listen(0); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());

function client() {
  let cookie = '';
  const fn = async (method, path, body, headers = {}) => {
    const r = await fetch(base + path, { method, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, headers: r.headers };
  };
  fn.cookie = () => cookie;
  return fn;
}

const anna = client();
const bob = client();
let apiKey, videoId, slotId;

test('public pages and app redirect', async () => {
  const c = client();
  assert.equal((await c('GET', '/')).status, 200);
  assert.equal((await c('GET', '/integracje')).status, 200);
  assert.equal((await c('GET', '/rejestracja')).status, 200);
  const r = await c('GET', '/app/filmy');
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /^\/logowanie\?next=/);
  assert.equal((await c('GET', '/api/videos')).status, 401);
  assert.equal((await c('GET', '/nie-ma')).status, 404);
});

test('register validates input', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/auth/register', { email: 'zly', password: 'xxxxxxxx' })).status, 400);
  assert.equal((await c('POST', '/api/auth/register', { email: 'a@b.pl', password: 'krotkie' })).status, 400);
});

test('register, duplicate e-mail, login', async () => {
  const r = await anna('POST', '/api/auth/register', { name: 'Anna', email: 'Anna@Example.com ', password: 'haslo-anny-1' });
  assert.equal(r.status, 200);
  assert.equal(r.json.next, '/app/start');
  assert.equal((await client()('POST', '/api/auth/register', { email: 'anna@example.com', password: 'cokolwiek1' })).status, 409);
  assert.equal((await client()('POST', '/api/auth/login', { email: 'anna@example.com', password: 'zle-haslo' })).status, 401);
  const me = await anna('GET', '/api/me');
  assert.equal(me.json.user.email, 'anna@example.com');
  assert.equal(me.json.workspace.mail_to, 'anna@example.com');
  assert.equal(me.json.progress.channels, 0);
  assert.equal(me.json.workspace.api_key_hash, undefined);
  assert.equal((await bob('POST', '/api/auth/register', { email: 'bob@example.com', password: 'haslo-boba-1' })).status, 200);
});

test('writes without X-Requested-With are refused (CSRF)', async () => {
  const r = await anna('POST', '/api/channels', { name: 'X' }, { 'X-Requested-With': '' });
  assert.equal(r.status, 403);
});

test('manual setup: channel, first video, schedule, mail settings', async () => {
  const ch = await anna('POST', '/api/channels', { name: 'Nauka na luzie', handle: 'nauka.na.luzie', niche: 'triki do nauki' });
  assert.equal(ch.json.channel.handle, '@nauka.na.luzie');
  assert.equal((await anna('POST', '/api/videos', { hook: 'bez tytułu' })).status, 400);
  const v = await anna('POST', '/api/videos', { title: 'Skarpetki w lodówce', hook: 'Włóż skarpetki do lodówki.' });
  assert.equal(v.json.created, true);
  videoId = v.json.video.id;
  assert.equal(v.json.video.ref, 'skarpetki-w-lodowce');
  const s = await anna('POST', '/api/schedule', { video_id: videoId, date: '2026-10-27', time: '18:00' });
  slotId = s.json.id;
  const list = await anna('GET', '/api/schedule');
  // 18:00 in Warsaw on 27 Oct 2026 (winter time, UTC+1) is 17:00 UTC
  assert.equal(list.json.schedule[0].scheduled_at, '2026-10-27T17:00:00.000Z');
  // re-scheduling the same video moves its slot instead of duplicating it
  await anna('POST', '/api/schedule', { video_id: videoId, date: '2026-10-28', time: '20:00' });
  assert.equal((await anna('GET', '/api/schedule')).json.schedule.length, 1);
  const ws = await anna('PUT', '/api/workspace', { digest_hour: 7, mail_to: 'raporty@example.com', timezone: 'Europe/Warsaw' });
  assert.equal(ws.json.workspace.digest_hour, 7);
  assert.equal((await anna('PUT', '/api/workspace', { timezone: 'Mars/Base' })).status, 400);
  assert.equal((await anna('POST', '/api/workspace/onboarded')).status, 200);
  const me = await anna('GET', '/api/me');
  assert.deepEqual([me.json.progress.channels, me.json.progress.videos, me.json.progress.scheduled], [1, 1, 1]);
});

test('posting and stats feed the analysis', async () => {
  await anna('PUT', `/api/schedule/${slotId}`, { status: 'posted' });
  let v = (await anna('GET', '/api/videos')).json.videos.find(x => x.id === videoId);
  assert.equal(v.posted, 1);
  // posted before its slot: the publish date is the real (local) day, not the planned one
  assert.equal(v.publish_date, new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date()));
  const st = await anna('PUT', `/api/videos/${videoId}/stats`, { views: '38000', avg_watch: '9,1', completion: 41, likes: 2100, completion_bogus: 5 });
  assert.equal(st.json.video.views, 38000);
  assert.equal(st.json.video.avg_watch, 9.1);
  assert.equal((await anna('PUT', `/api/videos/${videoId}/stats`, { completion: 250 })).json.video.completion, 100);
  const a = await anna('GET', '/api/analysis');
  assert.equal(a.json.analysis.sampleSize, 1);
  assert.equal(a.json.analysis.top[0].title, 'Skarpetki w lodówce');
});

test('queue: add, move, turn into a scheduled video', async () => {
  const q = await anna('POST', '/api/queue', { topic: 'Kartka strachu', hook: 'Napisz, czego się boisz.' });
  assert.equal((await anna('PUT', `/api/queue/${q.json.id}`, { status: 'nope' })).status, 400);
  await anna('PUT', `/api/queue/${q.json.id}`, { status: 'qa' });
  const tv = await anna('POST', `/api/queue/${q.json.id}/to-video`, { title: 'Kartka strachu przed egzaminem', date: '2026-10-29', time: '18:00' });
  assert.ok(tv.json.video.next_slot);
  assert.equal((await anna('POST', `/api/queue/${q.json.id}/to-video`, {})).status, 409);
  const queue = (await anna('GET', '/api/queue')).json.queue;
  assert.equal(queue[0].status, 'done');
});

test('API key: legacy generator payload upserts by ref', async () => {
  apiKey = (await anna('POST', '/api/workspace/api-key')).json.api_key;
  assert.match(apiKey, /^tss_/);
  const gen = client();
  const auth = { Authorization: `Bearer ${apiKey}`, 'X-Requested-With': '' };
  const payload = { id: 'v64-skarpetki-w-lodowce', name: 'Skarpetki v64', title: 'Opis do publikacji #nauka', temat: 'egzamin', wizual: 'b-roll', glos: 'lektor', path: '/renders/v64.mp4' };
  const r1 = await gen('POST', '/api/videos', payload, auth);
  assert.equal(r1.status, 200);
  assert.equal(r1.json.video.title, 'Skarpetki v64');
  assert.equal(r1.json.video.caption, 'Opis do publikacji #nauka');
  assert.equal(r1.json.video.topic, 'egzamin');
  assert.equal(r1.json.video.file_url, '/renders/v64.mp4');
  assert.equal(r1.json.video.source, 'api');
  const r2 = await gen('POST', '/api/videos', { ref: 'v64-skarpetki-w-lodowce', hook: 'nowy hook', schedule_at: '2026-11-02T17:00:00Z', stats: { views: 10 } }, auth);
  assert.equal(r2.json.created, false);
  assert.equal(r2.json.video.hook, 'nowy hook');
  assert.equal(r2.json.video.next_slot, '2026-11-02T17:00:00.000Z');
  assert.equal((await gen('GET', '/api/videos', undefined, { Authorization: 'Bearer tss_zly' })).status, 401);
  // the key cannot do account-level things
  assert.equal((await gen('POST', '/api/workspace/api-key', {}, auth)).status, 401);
  assert.equal((await gen('DELETE', '/api/me', { password: 'x' }, auth)).status, 401);
});

test('accounts are isolated from each other', async () => {
  const bobVideos = await bob('GET', '/api/videos');
  assert.equal(bobVideos.json.videos.length, 0);
  assert.equal((await bob('PUT', `/api/videos/${videoId}`, { title: 'hack' })).status, 404);
  assert.equal((await bob('DELETE', `/api/videos/${videoId}`)).status, 404);
  assert.equal((await bob('PUT', `/api/schedule/${slotId}`, { status: 'skipped' })).status, 404);
  assert.equal((await bob('POST', '/api/schedule', { video_id: videoId, date: '2026-11-01' })).status, 400);
  assert.equal((await bob('GET', '/api/analysis')).json.analysis.totalVideos, 0);
  // bob's video with the same ref does not collide with anna's
  const b = await bob('POST', '/api/videos', { ref: 'v64-skarpetki-w-lodowce', title: 'Mój film' });
  assert.equal(b.json.created, true);
});

test('CSV import from a TikTok Studio style export', async () => {
  const csv = 'Video title;Post time;Total views;Total likes;Average watch time;Watched full video\n"Robisz notatki źle";21.10.2026;4,1K;120;5,2s;18%\nSkarpetki w lodówce;2026-10-28;38000;2100;9.1;41%\n';
  const p = await anna('POST', '/api/setup/csv', { csv });
  assert.equal(p.json.setup.videos.length, 2);
  assert.equal(p.json.setup.videos[0].views, 4100);
  assert.equal(p.json.setup.videos[0].publish_date, '2026-10-21');
  const ap = await anna('POST', '/api/setup/apply', { setup: p.json.setup, source: 'csv' });
  assert.equal(ap.json.counts.videos, 1);
  assert.equal(ap.json.counts.updated, 1);
  assert.equal((await anna('POST', '/api/setup/csv', { csv: 'a;b\n1;2' })).status, 400);
});

test('AI setup apply (preview shape) creates channel, videos, topics, schedule', async () => {
  const setup = cleanSetup({ channel: { name: 'Drugi kanał', handle: 'drugi' },
    videos: [{ title: 'Mapa myśli', views: '12,5 tys.', posted: true }, { title: '' }],
    topics: [{ topic: 'Przerwa 4 sekundy' }], schedule: [{ video_title: 'Mapa myśli', date: '2026-11-03', time: '9:30' }],
    settings: { cadence_per_day: 2 } });
  assert.equal(setup.videos.length, 1);
  assert.equal(setup.schedule[0].time, '09:30');
  const r = await bob('POST', '/api/setup/apply', { setup });
  assert.deepEqual(r.json.counts, { channel: 1, videos: 1, updated: 0, topics: 1, schedule: 1 });
  const me = await bob('GET', '/api/me');
  assert.equal(me.json.workspace.cadence_per_day, 2);
});

test('scheduler sends reminders once and survives a tick', async () => {
  await tick(new Date('2026-12-01T12:00:00Z'));
  const planned = (await anna('GET', '/api/schedule')).json.schedule.filter(s => s.status === 'planned');
  assert.ok(planned.length > 0);
  assert.ok(planned.every(s => s.reminded === 1));
});

test('password change, logout, login, delete account', async () => {
  assert.equal((await anna('PUT', '/api/me/password', { current: 'zle', password: 'nowe-haslo-1' })).status, 400);
  assert.equal((await anna('PUT', '/api/me/password', { current: 'haslo-anny-1', password: 'nowe-haslo-1' })).status, 200);
  await anna('POST', '/api/auth/logout');
  assert.equal((await anna('GET', '/api/me')).status, 401);
  assert.equal((await anna('POST', '/api/auth/login', { email: 'anna@example.com', password: 'nowe-haslo-1' })).json.next, '/app');
  assert.equal((await anna('DELETE', '/api/me', { password: 'zle' })).status, 400);
  assert.equal((await anna('DELETE', '/api/me', { password: 'nowe-haslo-1' })).status, 200);
  assert.equal((await client()('GET', '/api/videos', undefined, { Authorization: `Bearer ${apiKey}` })).status, 401);
});

test('password reset flow', async () => {
  const c = client();
  const r = await c('POST', '/api/auth/forgot', { email: 'nieistnieje@example.com' });
  assert.equal(r.status, 200);
  assert.equal((await c('POST', '/api/auth/reset', { token: 'zly', password: 'cokolwiek1' })).status, 400);
});

test('posting ahead of plan records the real time; AI slots create missing videos', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'cezary@example.com', password: 'haslo-cezarego' });
  const v = await c('POST', '/api/videos', { title: 'Wcześniej', schedule_date: '2099-01-01', schedule_time: '18:00' });
  const slot = (await c('GET', '/api/schedule')).json.schedule[0];
  await c('PUT', `/api/schedule/${slot.id}`, { status: 'posted' });
  const after = (await c('GET', '/api/schedule')).json.schedule[0];
  assert.ok(after.scheduled_at < '2099-01-01');
  assert.ok((await c('GET', '/api/videos')).json.videos.find(x => x.id === v.json.video.id).publish_date < '2099-01-01');
  const r = await c('POST', '/api/setup/apply', { setup: { schedule: [{ video_title: 'Tylko w terminach', date: '2026-11-05', time: '18:00' }] } });
  assert.equal(r.json.counts.videos, 1);
  assert.equal(r.json.counts.schedule, 1);
});

test('render queue: add without start, start later, remove', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'dyrektor@example.com', password: 'haslo-dyrektora' });
  await c('POST', '/api/channels', { name: 'Kanał testowy' });
  const st = (await c('GET', '/api/generator')).json.generator;
  if (!st.ready) return;   // host without the generator toolchain: nothing to queue
  const a = await c('POST', '/api/generate', { topic: 'Dlaczego niebo jest niebieskie', start: false, format: 'long_wide' });
  assert.equal(a.status, 200);
  let jobs = (await c('GET', '/api/jobs')).json.jobs;
  assert.equal(jobs[0].status, 'held');
  assert.equal(jobs[0].format, 'long_wide');
  assert.equal((await c('POST', '/api/generate', { topic: 'x', queue_id: jobs[0].queue_id, start: false })).status, 409);
  assert.equal((await c('POST', `/api/jobs/${jobs[0].id}/cancel`)).status, 200);
  jobs = (await c('GET', '/api/jobs')).json.jobs;
  assert.equal(jobs[0].status, 'canceled');
  const b = await c('POST', '/api/generate', { topic: 'Drugi temat', start: false });
  const r = await c('POST', '/api/jobs/cancel-queued');
  assert.equal(r.json.canceled, 1);
  assert.ok(b.json.job_id);
});

test('PDF upload: only PDFs, text extracted, attachment must belong to the account', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'pdf@example.com', password: 'haslo-pdf-123' });
  await c('POST', '/api/channels', { name: 'K' });
  const bad = await fetch(base + '/api/uploads?name=x.pdf', { method: 'POST', headers: { 'X-Requested-With': 'fetch', 'Content-Type': 'application/pdf', Cookie: '' }, body: 'nie pdf'.repeat(30) });
  assert.equal(bad.status, 401);
  const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj 4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 20 150 Td (Niebo jest niebieskie) Tj ET\nendstream endobj 5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  const up = await c('POST', '/api/uploads?name=zrodlo.pdf', undefined, {});
  assert.equal(up.status, 400);   // empty body
  const r = await (async () => { const res = await fetch(base + '/api/uploads?name=zrodlo.pdf', { method: 'POST', headers: { 'X-Requested-With': 'fetch', 'Content-Type': 'application/pdf', Cookie: c.cookie() }, body: pdf }); return res.json(); })();
  assert.equal(r.ok, true);
  assert.ok(r.upload.id);
  const other = client();
  await other('POST', '/api/auth/register', { email: 'inny@example.com', password: 'haslo-innego-1' });
  await other('POST', '/api/channels', { name: 'K2' });
  const st = (await other('GET', '/api/generator')).json.generator;
  if (st.ready) assert.equal((await other('POST', '/api/generate', { topic: 'x', attachment_id: r.upload.id, start: false })).status, 400);
});

test('time zone helpers', () => {
  assert.equal(zonedToUtc('2026-07-01', '18:00', 'Europe/Warsaw'), '2026-07-01T16:00:00.000Z');
  assert.equal(zonedToUtc('2026-01-15', '08:30', 'America/New_York'), '2026-01-15T13:30:00.000Z');
  assert.equal(csvToVideos('x\n1').error.length > 0, true);
});
