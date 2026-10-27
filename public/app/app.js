// app.js: the logged-in TikTok Studio app. Vanilla JS, no build step.
// CSP forbids inline handlers, so every button carries data-act="name" and one
// delegated listener dispatches to ACT[name]; forms use data-form + FORMS[name].
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Polish plural: plural(5, 'film', 'filmy', 'filmów') -> '5 filmów'
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${n === 1 ? one : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? few : many}`;
};
const dec = (n) => String(n).replace('.', ',');
const fmtN = (n) => new Intl.NumberFormat('pl-PL').format(Math.round(Number(n) || 0));

// colour theme: auto follows the system, or a remembered choice
const theme = () => { try { return localStorage.getItem('tss-theme') || 'auto'; } catch { return 'auto'; } };
function applyTheme(t) { if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t; }
applyTheme(theme());
const S = { me: null, videos: [], schedule: [], queue: [], jobs: [], analysis: null, channel: '', month: null, vtab: 'all' };
try { S.channel = localStorage.getItem('tss-channel') || ''; } catch {}

// ---- api -----------------------------------------------------------------------
async function api(method, path, body) {
  let r;
  try {
    r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new Error('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.'); }
  if (r.status === 401) { location.href = '/logowanie?next=' + encodeURIComponent(location.pathname); throw new Error('Sesja wygasła.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `Błąd ${r.status}`);
  return j;
}
const chQ = () => (S.channel ? `?channel=${encodeURIComponent(S.channel)}` : '');

async function loadMe() { S.me = await api('GET', '/api/me'); if (S.channel && !S.me.channels.some(c => String(c.id) === S.channel)) S.channel = ''; }
async function loadData() {
  const [v, s, q] = await Promise.all([api('GET', '/api/videos' + chQ()), api('GET', '/api/schedule' + chQ()), api('GET', '/api/queue' + chQ())]);
  S.videos = v.videos; S.schedule = s.schedule; S.queue = q.queue;
  try { const r = await api('GET', '/api/jobs'); S.jobs = r.jobs; S.etaMin = r.eta_min || 0; } catch { S.jobs = []; }
}

// ---- time (always in the workspace time zone) ------------------------------------
const TZ = () => S.me?.workspace?.timezone || 'Europe/Warsaw';
function parts(d) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ(), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const localDate = (iso) => parts(new Date(iso)).date;
const localTime = (iso) => parts(new Date(iso)).time;
const today = () => parts(new Date()).date;
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const DOW = ['nd', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
function dayLabel(date) {
  if (date === today()) return 'dziś';
  if (date === addDays(today(), 1)) return 'jutro';
  if (date === addDays(today(), -1)) return 'wczoraj';
  const d = new Date(date + 'T12:00:00Z');
  return `${DOW[d.getUTCDay()]} ${date.slice(8, 10)}.${date.slice(5, 7)}`;
}
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
/** First day from tomorrow with fewer planned posts than the daily goal. */
function nextFreeDate() {
  const per = {};
  for (const x of S.schedule) if (x.status === 'planned') per[localDate(x.scheduled_at)] = (per[localDate(x.scheduled_at)] || 0) + 1;
  const goal = S.me?.workspace?.cadence_per_day || 1;
  for (let i = 1; i < 60; i++) { const d = addDays(today(), i); if ((per[d] || 0) < goal) return d; }
  return addDays(today(), 1);
}
const fmtSlot = (iso) => `${dayLabel(localDate(iso))}, ${localTime(iso)}`;
const isLate = (s) => s.status === 'planned' && new Date(s.scheduled_at) < new Date();

// ---- ui helpers ----------------------------------------------------------------------
let toastTimer;
function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, err ? 5000 : 2800);
}
let lastFocus = null;
function openModal(html, { wide = false } = {}) {
  lastFocus = document.activeElement;
  const m = $('#modal'); m.className = 'modal' + (wide ? ' wide' : ''); m.innerHTML = html;
  $('#overlay').classList.add('show');
  (m.querySelector('[autofocus]') || m.querySelector('input:not([type=hidden]),select,textarea,button'))?.focus();
}
/**
 * In-app confirmation (window.confirm is blocked in some embedded browsers, which made deletes
 * silently do nothing). Resolves true only on the explicit confirm button.
 */
function ask(message, { ok = 'Tak, usuń', danger = true } = {}) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'overlay show ask-ov';
    ov.innerHTML = `<div class="modal ask" role="alertdialog" aria-modal="true" aria-labelledby="ask-t"><p id="ask-t" style="font-size:17px;margin:0 0 18px">${esc(message)}</p>
      <div class="foot"><button type="button" class="btn ghost" data-ask="0">Anuluj</button><button type="button" class="btn ${danger ? 'danger-solid' : ''}" data-ask="1">${esc(ok)}</button></div></div>`;
    const done = (v) => { ov.remove(); document.removeEventListener('keydown', key, true); prev?.focus?.(); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    ov.addEventListener('click', (e) => { e.stopPropagation(); const b = e.target.closest('[data-ask]'); if (b) done(b.dataset.ask === '1'); else if (e.target === ov) done(false); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(ov);
    ov.querySelector('[data-ask="1"]').focus();
  });
}
function closeModal() { $('#overlay').classList.remove('show'); $('#modal').innerHTML = ''; lastFocus?.focus?.(); }
async function busy(btn, fn) {
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Chwileczkę...'; }
  try { return await fn(); } catch (e) { toast(e.message, true); } finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
}
const field = (label, input, hint = '', cls = '') => `<label class="fld ${cls}"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
const inp = (name, value = '', attrs = '') => `<input class="i" name="${name}" value="${esc(value)}" ${attrs}>`;
const timeChips = (name = 'time', cur = '18:00') => `<div class="chips" data-chips="${name}" aria-label="Popularne godziny">${['12:00', '15:00', '18:00', '20:00'].map(t => `<button type="button" class="${t === cur ? 'on' : ''}" data-act="chip" data-v="${t}">${t}</button>`).join('')}</div>`;
const channelSelect = (cur) => S.me.channels.length > 1
  ? field('Kanał', `<select class="i" name="channel_id">${S.me.channels.map(c => `<option value="${c.id}" ${String(c.id) === String(cur || S.channel || S.me.channels[0].id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`) : '';

// ---- navigation -------------------------------------------------------------------------
const ICON = {
  dash: '<path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-4H4zM14 7h6V4h-6z"/>',
  videos: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  queue: '<path d="M4 6h11M4 12h11M4 18h7"/><path d="M17 15l4 3-4 3z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  bot: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  plug: '<path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
};
const ROUTES = [
  ['/app', 'Pulpit', 'dash', viewDashboard],
  ['/app/agent', 'Agent', 'bot', viewAgent],
  ['/app/filmy', 'Filmy', 'videos', viewVideos],
  ['/app/kalendarz', 'Kalendarz', 'cal', viewCalendar],
  ['/app/generator', 'Kolejka renderów', 'spark', viewGenerator],
  ['/app/kolejka', 'Pomysły', 'queue', viewQueue],
  ['/app/inspiracje', 'Inspiracje', 'eye', viewInspire],
  ['/app/muzyka', 'Muzyka', 'music', viewMusic],
  ['/app/analiza', 'Analiza', 'chart', viewAnalysis],
  ['/app/integracje', 'Integracje', 'plug', viewIntegrations],
  ['/app/ustawienia', 'Ustawienia', 'gear', viewSettings],
];

function renderChrome() {
  const late = S.schedule.filter(isLate).length;
  const open = S.queue.filter(q => q.status !== 'done').length;
  const gen = S.jobs.find(j => ['queued', 'running'].includes(j.status));
  const counts = { '/app/filmy': S.videos.length || '', '/app/kalendarz': late ? `zaległe: ${late}` : '', '/app/kolejka': open || '', '/app/generator': S.jobs.filter(j => ['queued', 'running'].includes(j.status)).length || '' };
  $('#nav').innerHTML = ROUTES.map(([p, label, ic]) => `<a href="${p}" data-link class="${location.pathname === p ? 'on' : ''} ${p === '/app/kalendarz' && late ? 'warn' : ''}" ${location.pathname === p ? 'aria-current="page"' : ''}>
    <svg viewBox="0 0 24 24" aria-hidden="true">${ICON[ic]}</svg>${label}${counts[p] ? `<span class="count">${counts[p]}</span>` : ''}</a>`).join('');
  // TikTok accounts (channels): always visible, so adding a second account is one click away
  const chs = S.me.channels;
  const sel = $('#chsel');
  sel.hidden = !chs.length;
  const cur = chs.find(c => String(c.id) === S.channel);
  if (chs.length) sel.innerHTML = `<label><span class="acct-l"><i class="acct-dot" style="background:${esc(cur?.color || (chs.length > 1 ? 'var(--mute)' : chs[0].color || '#22b8cf'))}"></i>Konto TikTok</span>
    <select class="i" id="ch-switch">${chs.length > 1 ? '<option value="">Wszystkie konta</option>' : ''}${chs.map(c => `<option value="${c.id}" ${String(c.id) === S.channel ? 'selected' : ''}>${esc(c.name)}${c.handle ? ` (${esc(c.handle)})` : ''}</option>`).join('')}</select></label>
    <button type="button" class="acct-add" data-act="edit-channel">+ Dodaj konto TikTok</button>`;
  const u = S.me.user || {};
  const th = theme();
  $('#me').innerHTML = `<b>${esc(u.name || u.email)}</b>${u.name ? esc(u.email || '') + '<br>' : ''}<button type="button" data-act="logout">Wyloguj się</button>
    <div class="theme-switch" role="group" aria-label="Motyw">${[['auto', 'Auto'], ['light', 'Jasny'], ['dark', 'Ciemny']].map(([k, l]) => `<button type="button" data-act="theme" data-arg="${k}" class="${th === k ? 'on' : ''}" aria-pressed="${th === k}">${l}</button>`).join('')}</div>`;
}

async function go(path, { push = true, reload = true } = {}) {
  if (push && path !== location.pathname + location.search) history.pushState({}, '', path);
  $('#side').classList.remove('open');
  if (reload) { try { await loadMe(); await loadData(); } catch (e) { toast(e.message, true); } }
  const p = location.pathname.replace(/\/$/, '') || '/app';
  if (p === '/app/start') { renderChrome(); return viewOnboarding(); }
  // a fresh account lands on the setup instead of an empty dashboard
  if (p === '/app' && !S.me.workspace.onboarded_at && !S.me.progress.channels) { history.replaceState({}, '', '/app/start'); renderChrome(); return viewOnboarding(); }
  const route = ROUTES.find(r => r[0] === p) || ROUTES[0];
  document.title = `${route[1]}: TikTok Studio`;
  renderChrome();
  await route[3]();
  if (push) window.scrollTo(0, 0);
  $('#view').focus?.({ preventScroll: true });
}
const repaint = () => go(location.pathname + location.search, { push: false });

// ---- dashboard ----------------------------------------------------------------------------
async function viewDashboard() {
  const pr = S.me.progress;
  const ws = S.me.workspace;
  const steps = [
    { done: pr.channels > 0, t: 'Opisz swój kanał', btn: 'Ustaw', act: 'go', arg: '/app/start' },
    S.me.generator.ready
      ? { done: pr.videos > 0, t: 'Wygeneruj albo dodaj pierwszy film', btn: 'Wygeneruj film', act: 'gen-new' }
      : { done: pr.videos > 0, t: 'Dodaj pierwszy film', btn: 'Dodaj film', act: 'add-video' },
    { done: pr.scheduled > 0, t: 'Zaplanuj publikację', btn: 'Zaplanuj', act: 'schedule' },
    { done: pr.measured > 0, t: 'Wpisz wyniki opublikowanego filmu', btn: 'Wpisz wyniki', act: 'go', arg: '/app/filmy?tab=posted' },
    { done: ws.has_api_key || pr.videos > 1, t: 'Import wyników albo API (opcjonalnie)', btn: 'Integracje', act: 'go', arg: '/app/integracje' },
  ];
  const doneN = steps.filter(s => s.done).length;
  const showStart = steps.slice(0, 4).some(s => !s.done);
  const planned = S.schedule.filter(s => s.status === 'planned');
  const week = planned.filter(s => localDate(s.scheduled_at) >= today() && localDate(s.scheduled_at) <= addDays(today(), 6)).length;
  const posted = S.videos.filter(v => v.posted);
  const measured = S.videos.filter(v => v.completion > 0);
  const avgC = measured.length ? (measured.reduce((a, v) => a + v.completion, 0) / measured.length).toFixed(1).replace('.', ',') + '%' : 'brak';
  const unscheduled = S.videos.filter(v => !v.posted && !v.next_slot);
  let leader = null;
  try { if (pr.measured) leader = (await api('GET', '/api/analysis' + chQ())).analysis.top[0]; } catch {}
  const hello = S.me.user?.name ? `Cześć, ${esc(S.me.user.name)}` : 'Pulpit';

  $('#view').innerHTML = `
  <div class="head"><div><h1>${hello}</h1><p>${planned.length ? `Najbliższa publikacja: ${esc(fmtSlot(planned[0].scheduled_at))}.` : 'Nic nie czeka na publikację.'}</p></div>
    <div class="actions">${S.me.generator.ready ? '<button class="btn cyan" data-act="gen-new">Wygeneruj film</button>' : ''}<button class="btn ghost" data-act="add-video">Dodaj film</button><button class="btn" data-act="schedule">Zaplanuj publikację</button></div></div>
  ${genBanner()}
  ${showStart ? `<section class="start" aria-label="Pierwsze kroki"><div><h2>Pierwsze kroki</h2><p>Zrób te kroki raz, a Studio zacznie samo przypominać o publikacjach i liczyć, co działa.</p>
    <div class="bar"><i style="width:${doneN * 20}%"></i></div><p style="font-size:14px">${doneN} z 5 gotowe</p></div>
    <ol>${steps.map(s => `<li class="${s.done ? 'done' : ''}"><span class="ck" aria-hidden="true">${s.done ? '&#10003;' : ''}</span><span class="t">${s.t}</span>${s.done ? '<span class="sr">zrobione</span>' : `<button class="btn" data-act="${s.act}" data-arg="${s.arg || ''}">${s.btn}</button>`}</li>`).join('')}</ol></section>` : ''}
  <div class="stats">
    <div class="stat"><b>${S.videos.length}</b><span>filmy w Studio</span></div>
    <div class="stat"><b>${posted.length}</b><span>opublikowane</span></div>
    <div class="stat"><b>${week}</b><span>zaplanowane na 7 dni</span></div>
    <div class="stat"><b>${avgC}</b><span>średnio obejrzane do końca</span></div>
  </div>
  <div class="grid2">
    <section class="panel"><h2>Najbliższe publikacje</h2>
      ${planned.length ? `<div class="rows">${planned.slice(0, 6).map(slotRow).join('')}</div>` : `<div class="empty"><h3>Kalendarz jest pusty</h3>Zaplanuj film, a dostaniesz przypomnienie w godzinie publikacji.<br><button class="btn sm" data-act="schedule">Zaplanuj publikację</button></div>`}
    </section>
    <section class="panel"><h2>Gotowe, bez terminu</h2>
      ${unscheduled.length ? `<div class="rows">${unscheduled.slice(0, 6).map(v => `<div class="rowi"><div class="main"><b>${esc(v.title)}</b><small>${esc(v.hook || 'bez hooka')}</small></div><div class="acts"><button class="btn sm" data-act="schedule" data-id="${v.id}">Zaplanuj</button></div></div>`).join('')}</div>`
        : `<p style="color:var(--slate);margin:0">Każdy gotowy film ma termin. Nowe tematy czekają w <a href="/app/kolejka" data-link>kolejce pomysłów</a>.</p>`}
      ${leader ? `<h2 style="margin-top:22px">Lider wyników</h2><p style="margin:0"><b>${esc(leader.title)}</b><br><span style="color:var(--slate)">${fmtN(leader.views)} wyśw., ${leader.avg_watch}s średnio, ${leader.completion}% do końca</span></p><p><a href="/app/analiza" data-link>Zobacz, co wygrywa</a></p>` : ''}
    </section>
  </div>`;
}

function slotRow(s) {
  const late = isLate(s);
  return `<div class="rowi"><div class="main"><b>${esc(s.title)}</b><small>${esc(fmtSlot(s.scheduled_at))}</small> ${late ? '<span class="pill late">zaległe</span>' : ''}</div>
    <div class="acts"><button class="btn sm cyan" data-act="slot-posted" data-id="${s.id}">Opublikowane</button><button class="btn sm ghost" data-act="slot" data-id="${s.id}">Zmień</button></div></div>`;
}

// ---- videos ----------------------------------------------------------------------------------
function videoState(v) {
  if (v.posted) return { cls: 'posted', label: v.publish_date ? `Opublikowany ${dayLabel(v.publish_date)}` : 'Opublikowany' };
  if (v.next_slot) return new Date(v.next_slot) < new Date() ? { cls: 'late', label: `Zaległy: ${fmtSlot(v.next_slot)}` } : { cls: 'planned', label: `Zaplanowany: ${fmtSlot(v.next_slot)}` };
  return { cls: '', label: 'Bez terminu' };
}

async function viewVideos() {
  const tab = new URLSearchParams(location.search).get('tab') || S.vtab;
  S.vtab = tab;
  const filt = { all: () => true, none: v => !v.posted && !v.next_slot, planned: v => !v.posted && v.next_slot, posted: v => v.posted };
  const list = S.videos.filter(filt[tab] || filt.all);
  const n = (k) => S.videos.filter(filt[k]).length;
  const tabs = [['all', 'Wszystkie'], ['none', 'Bez terminu'], ['planned', 'Zaplanowane'], ['posted', 'Opublikowane']];
  $('#view').innerHTML = `
  <div class="head"><div><h1>Filmy</h1><p>Każdy film, jego termin i wyniki. Wyniki wpisujesz po publikacji.</p></div>
    <div class="actions"><button class="btn" data-act="add-video">Dodaj film</button></div></div>
  <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="vtab" data-arg="${k}">${l} (${n(k)})</button>`).join('')}</div>
  ${!S.videos.length ? `<div class="empty"><h3>Nie masz jeszcze filmów</h3>Dodaj pierwszy film ręcznie, wgraj CSV z TikTok Studio albo podłącz generator przez API.<br>
      <button class="btn" data-act="add-video">Dodaj pierwszy film</button> <a class="btn ghost" href="/app/integracje" data-link>Import i API</a></div>`
    : list.length ? `<section class="panel"><div class="rows">${list.map(videoRow).join('')}</div></section>`
    : `<div class="empty">Brak filmów w tej zakładce.</div>`}`;
}

function videoRow(v) {
  const st = videoState(v);
  const has = v.views || v.completion || v.avg_watch;
  return `<div class="rowi vrow"><div class="thumb ${st.cls}" aria-hidden="true">${v.posted ? '&#10003;' : v.source === 'ai' ? 'AI' : ''}</div>
    <div class="main"><b>${esc(v.title)}</b><small>${esc(v.hook || '')}</small>
      <div class="metrics"><span class="pill ${st.cls}">${esc(st.label)}</span>${has ? `<span><em>${fmtN(v.views)}</em> wyśw.</span><span><em>${dec(v.avg_watch || 0)} s</em> średnio</span><span><em>${v.completion || 0}%</em> do końca</span>` : ''}${v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener">link</a>` : ''}</div></div>
    <div class="acts">${v.media_path ? `<button class="btn sm ghost" data-act="play" data-id="${v.id}">Obejrzyj</button>` : ''}${v.posted ? '' : `<button class="btn sm ${v.next_slot ? 'ghost' : ''}" data-act="schedule" data-id="${v.id}">${v.next_slot ? 'Przesuń' : 'Zaplanuj'}</button>`}
      ${v.posted || has || !v.next_slot || new Date(v.next_slot) < new Date() ? `<button class="btn sm ${v.posted && !has ? 'cyan' : 'ghost'}" data-act="stats" data-id="${v.id}">${has ? 'Wyniki' : 'Wpisz wyniki'}</button>` : ''}
      <button class="btn sm ghost" data-act="edit-video" data-id="${v.id}">Edytuj</button>
      <button class="btn sm danger" data-act="del-video" data-id="${v.id}" aria-label="Usuń film ${esc(v.title)}">Usuń</button></div></div>`;
}

function videoModal(v) {
  const isNew = !v; v = v || {};
  openModal(`<h2 id="modal-title">${isNew ? 'Dodaj film' : 'Edytuj film'}</h2>
  <p class="sub">${isNew ? 'Wystarczy tytuł. Resztę uzupełnisz kiedy chcesz.' : ''}</p>
  <form data-form="video" data-id="${v.id || ''}" novalidate>
    ${field('Tytuł filmu', inp('title', v.title, 'required maxlength="200" autofocus placeholder="np. Skarpetki w lodówce przed egzaminem"'))}
    ${field('Hook', inp('hook', v.hook, 'maxlength="300" placeholder="Pierwsze zdanie albo pierwsza scena"'), 'To od niego zależy, czy ktoś zostanie dłużej niż 2 sekundy. Analiza porównuje hooki.')}
    ${channelSelect(v.channel_id)}
    ${isNew ? `<label class="check"><input type="checkbox" name="plan" checked> <span>Zaplanuj publikację od razu</span></label>
    <div class="fgrid" data-plan>${field('Dzień', inp('date', nextFreeDate(), 'type="date"'))}${field('Godzina', inp('time', '18:00', 'type="time"') + timeChips())}</div>` : ''}
    <details class="more" ${isNew ? '' : 'open'}><summary>Więcej szczegółów (do analizy)</summary>
      <div class="fgrid">
        ${field('Temat', inp('topic', v.topic, 'maxlength="120" placeholder="np. metody nauki"'))}
        ${field('Kategoria', inp('category', v.category, 'maxlength="60" placeholder="np. poradnik, trend, historia"'))}
        ${field('Styl wizualny', inp('visual', v.visual, 'maxlength="120" placeholder="np. napisy na b-rollu"'))}
        ${field('Głos', inp('voice', v.voice, 'maxlength="120" placeholder="np. lektor AI, mój głos"'))}
        ${field('Tempo', inp('pace', v.pace, 'maxlength="60" placeholder="np. szybkie"'))}
        ${field('CTA', inp('cta', v.cta, 'maxlength="200" placeholder="np. pytanie w komentarzu"'))}
        ${field('Opis do publikacji', `<textarea class="i" name="caption" maxlength="2200" placeholder="Opis i hashtagi">${esc(v.caption || '')}</textarea>`, '', 'full')}
        ${field('Przypięty komentarz', inp('pin', v.pin, 'maxlength="300"'), '', 'full')}
        ${field('Link do TikToka', inp('url', v.url, 'type="url" placeholder="https://www.tiktok.com/@..."'), '', 'full')}
        ${field('Plik wideo', inp('file_url', v.file_url, 'maxlength="1000" placeholder="link albo ścieżka do pliku MP4"'), '', 'full')}
      </div></details>
    <div class="err-inline" data-err></div>
    <div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn" type="submit">${isNew ? 'Dodaj film' : 'Zapisz zmiany'}</button></div>
  </form>`);
}

function statsModal(v) {
  const val = (k) => (v[k] ? v[k] : '');
  openModal(`<h2 id="modal-title">Wyniki filmu</h2><p class="sub">${esc(v.title)}</p>
  <p style="font-size:14px;color:var(--slate);margin-top:-8px">Gdzie to znajdziesz: w aplikacji TikTok otwórz film, stuknij trzy kropki, potem Analityka. Wpisz to, co masz. Puste pola zostaną bez zmian.</p>
  <form data-form="stats" data-id="${v.id}" novalidate><div class="fgrid">
    ${field('Wyświetlenia', inp('views', val('views'), 'inputmode="numeric" placeholder="np. 12500" autofocus'))}
    ${field('Średni czas oglądania (s)', inp('avg_watch', val('avg_watch'), 'inputmode="decimal" placeholder="np. 6,4"'))}
    ${field('Obejrzane do końca (%)', inp('completion', val('completion'), 'inputmode="decimal" placeholder="np. 31"'))}
    ${field('Polubienia', inp('likes', val('likes'), 'inputmode="numeric"'))}
    ${field('Komentarze', inp('comments', val('comments'), 'inputmode="numeric"'))}
    ${field('Udostępnienia', inp('shares', val('shares'), 'inputmode="numeric"'))}
    ${field('Zapisy', inp('saves', val('saves'), 'inputmode="numeric"'))}
    ${field('Nowi obserwujący', inp('followers', val('followers'), 'inputmode="numeric"'))}
    ${field('Data publikacji', inp('publish_date', v.publish_date || (v.next_slot ? localDate(v.next_slot) : today()), 'type="date"'))}
    <details class="more full" ${v.reached || v.src_fyp || v.retention_curve ? 'open' : ''}><summary>Pełna analityka z TikTok Studio (opcjonalnie)</summary><div class="fgrid">
      ${field('Łączny czas oglądania (s)', inp('total_watch_time', val('total_watch_time'), 'inputmode="decimal"'))}
      ${field('Zasięg (unikalni widzowie)', inp('reached', val('reached'), 'inputmode="numeric"'))}
      ${field('Wyświetlenia profilu', inp('profile_views', val('profile_views'), 'inputmode="numeric"'))}
      ${field('Nowi widzowie (%)', inp('new_viewers', val('new_viewers'), 'inputmode="decimal"'))}
      ${field('Powracający widzowie (%)', inp('returning_viewers', val('returning_viewers'), 'inputmode="decimal"'))}
      ${field('Ruch: Dla Ciebie (%)', inp('src_fyp', val('src_fyp'), 'inputmode="decimal"'))}
      ${field('Ruch: profil (%)', inp('src_profile', val('src_profile'), 'inputmode="decimal"'))}
      ${field('Ruch: obserwowani (%)', inp('src_following', val('src_following'), 'inputmode="decimal"'))}
      ${field('Ruch: wyszukiwanie (%)', inp('src_search', val('src_search'), 'inputmode="decimal"'))}
      ${field('Ruch: dźwięk (%)', inp('src_sound', val('src_sound'), 'inputmode="decimal"'))}
      ${field('Krzywa retencji (% widzów co sekundę)', inp('retention_curve', v.retention_curve || '', 'placeholder="np. 100, 81, 70, 64, 60"'), 'Z wykresu "Utrzymanie widzów". Pokazujemy, gdzie ludzie odpadają.', 'full')}
    </div></details>
    ${field('Notatki', `<textarea class="i" name="notes" maxlength="2000" placeholder="Co zadziałało, co nie">${esc(v.notes || '')}</textarea>`, '', 'full')}
  </div><div class="err-inline" data-err></div>
  <div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn" type="submit">Zapisz wyniki</button></div></form>`);
}

// ---- scheduling --------------------------------------------------------------------------------
function scheduleModal({ videoId, date } = {}) {
  const free = S.videos.filter(v => !v.posted && !v.next_slot);
  const others = S.videos.filter(v => !v.posted && v.next_slot);
  const pre = videoId ? S.videos.find(v => v.id === Number(videoId)) : null;
  const d = date && date >= today() ? date : (pre?.next_slot ? localDate(pre.next_slot) : nextFreeDate());
  const t = pre?.next_slot ? localTime(pre.next_slot) : '18:00';
  const opt = (v) => `<option value="${v.id}" ${pre?.id === v.id ? 'selected' : ''}>${esc(v.title)}</option>`;
  const noVideos = !free.length && !others.length && !pre;
  const defNew = !pre && !free.length;   // nothing waiting: a click on a day most likely means a new video
  openModal(`<h2 id="modal-title">Zaplanuj publikację</h2>
  <p class="sub">${date ? `Dzień: ${dayLabel(d)}.` : 'Wybierz film, dzień i godzinę.'} Przypomnimy Ci mailem w godzinie publikacji.</p>
  <form data-form="schedule" novalidate>
    ${noVideos ? `${field('Tytuł nowego filmu', inp('new_title', '', 'required maxlength="200" autofocus placeholder="np. Skarpetki w lodówce przed egzaminem"'), 'Wszystkie filmy mają już termin, więc dodamy nowy i od razu go zaplanujemy.')}`
      : field('Film', `<select class="i" name="video_id" ${pre || defNew ? '' : 'autofocus'}>
        ${free.length ? `<optgroup label="Bez terminu">${free.map(opt).join('')}</optgroup>` : ''}
        ${others.length ? `<optgroup label="Mają termin (zostanie przesunięty)">${others.map(opt).join('')}</optgroup>` : ''}
        ${pre && pre.posted ? opt(pre) : ''}
        <option value="new" ${defNew ? 'selected' : ''}>+ Nowy film...</option></select>`)
        + `<div data-newtitle ${defNew ? '' : 'hidden'}>${field('Tytuł nowego filmu', inp('new_title', '', `maxlength="200" ${defNew ? 'autofocus' : ''}`))}</div>`}
    <div class="fgrid">${field('Dzień', inp('date', d, `type="date" min="${today()}"`))}${field('Godzina', inp('time', t, 'type="time"') + timeChips('time', t))}</div>
    ${field('Opis do publikacji (opcjonalnie)', `<textarea class="i" name="caption" maxlength="2200" placeholder="Opis i hashtagi, przyda się w przypomnieniu">${esc(pre?.caption || '')}</textarea>`)}
    <div class="err-inline" data-err></div>
    <div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn" type="submit">Zaplanuj</button></div>
  </form>`);
}

function slotModal(s) {
  openModal(`<h2 id="modal-title">${esc(s.title)}</h2>
  <p class="sub">${s.status === 'posted' ? 'Opublikowany' : s.status === 'skipped' ? 'Pominięty' : isLate(s) ? 'Zaległy, termin minął' : 'Zaplanowany'}: ${esc(fmtSlot(s.scheduled_at))}</p>
  <form data-form="slot" data-id="${s.id}" novalidate>
    <div class="fgrid">${field('Dzień', inp('date', localDate(s.scheduled_at), 'type="date"'))}${field('Godzina', inp('time', localTime(s.scheduled_at), 'type="time"') + timeChips('time', localTime(s.scheduled_at)))}</div>
    ${field('Opis do publikacji', `<textarea class="i" name="caption" maxlength="2200">${esc(s.caption || '')}</textarea>`)}
    <div class="err-inline" data-err></div>
    <div class="foot">
      <button type="button" class="btn danger left" data-act="slot-delete" data-id="${s.id}">Usuń z kalendarza</button>
      ${s.status === 'planned' ? `<button type="button" class="btn ghost" data-act="slot-skip" data-id="${s.id}">Pomiń</button><button type="button" class="btn cyan" data-act="slot-posted" data-id="${s.id}">Opublikowane</button>`
        : `<button type="button" class="btn ghost" data-act="slot-replan" data-id="${s.id}">Przywróć jako zaplanowany</button>`}
      <button class="btn" type="submit">Zapisz zmiany</button>
    </div></form>`);
}

// ---- calendar ------------------------------------------------------------------------------------
async function viewCalendar() {
  const t = today();
  if (!S.month) S.month = t.slice(0, 7);
  const [y, m] = S.month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const byDay = {};
  for (const s of S.schedule) (byDay[localDate(s.scheduled_at)] ||= []).push(s);
  const monthName = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="day out" aria-hidden="true"></div>');
  for (let d = 1; d <= days; d++) {
    const date = `${S.month}-${String(d).padStart(2, '0')}`;
    const evs = (byDay[date] || []).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    cells.push(`<div class="day ${date === t ? 'today' : ''} ${date < t ? 'past' : ''}" role="button" tabindex="0" data-act="day" data-arg="${date}" aria-label="${dayLabel(date)}, ${evs.length} publikacji. Kliknij, aby zaplanować.">
      <span class="n">${d}${date === t ? '<i>dziś</i>' : ''}</span>
      ${evs.map(s => `<button type="button" class="ev ${s.status === 'planned' ? (isLate(s) ? 'late' : '') : s.status}" data-act="slot" data-id="${s.id}" title="${esc(s.title)}">${localTime(s.scheduled_at)} ${esc(s.title)}</button>`).join('')}</div>`);
  }
  const monthEntries = S.schedule.filter(s => localDate(s.scheduled_at).startsWith(S.month));
  const late = S.schedule.filter(isLate);
  const ws = S.me.workspace;
  $('#view').innerHTML = `
  <div class="head"><div><h1>Kalendarz</h1><p>Cel: ${ws.cadence_per_day} ${ws.cadence_per_day === 1 ? 'publikacja' : 'publikacje'} dziennie. Godziny w strefie ${esc(ws.timezone)}. Kliknij dzień, aby zaplanować film.</p></div>
    <div class="actions"><button class="btn" data-act="schedule">Zaplanuj publikację</button></div></div>
  ${late.length ? `<div class="panel" style="border-color:var(--bad-line);margin-bottom:16px"><h2 style="color:var(--bad)">Zaległe publikacje (${late.length})</h2><div class="rows">${late.map(slotRow).join('')}</div></div>` : ''}
  <div class="calnav"><button class="btn sm ghost" data-act="month" data-arg="-1" aria-label="Poprzedni miesiąc">Poprzedni</button><h2>${monthName}</h2><button class="btn sm ghost" data-act="month" data-arg="1" aria-label="Następny miesiąc">Następny</button>${S.month !== t.slice(0, 7) ? '<button class="btn sm ghost" data-act="month" data-arg="0">Dziś</button>' : ''}</div>
  <div class="month">${['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'].map(d => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>
  <div class="agenda panel">${monthEntries.length ? `<div class="rows">${monthEntries.map(s => `<div class="rowi"><div class="main"><b>${esc(s.title)}</b><small>${esc(fmtSlot(s.scheduled_at))}</small> <span class="pill ${s.status === 'planned' ? (isLate(s) ? 'late' : 'planned') : s.status}">${s.status === 'posted' ? 'opublikowany' : s.status === 'skipped' ? 'pominięty' : isLate(s) ? 'zaległy' : 'zaplanowany'}</span></div><div class="acts"><button class="btn sm ghost" data-act="slot" data-id="${s.id}">Otwórz</button></div></div>`).join('')}</div>` : '<p style="margin:0;color:var(--slate)">W tym miesiącu nic nie zaplanowano.</p>'}</div>`;
}

// ---- queue -------------------------------------------------------------------------------------------
const QCOLS = [['idea', 'Pomysł', 'Temat do zrobienia'], ['script', 'Skrypt', 'Piszesz tekst'], ['render', 'Render', 'Film się robi'], ['qa', 'Kontrola', 'Do obejrzenia przed publikacją'], ['done', 'Gotowe', 'Film jest w Studio']];
async function viewQueue() {
  $('#view').innerHTML = `
  <div class="head"><div><h1>Kolejka pomysłów</h1><p>Temat przechodzi od pomysłu do gotowego filmu. "Generuj film" zleca całość generatorowi; "Mam film" dodaje film zrobiony poza Studiem.</p></div></div>
  <form class="addq" data-form="add-topic" novalidate><input class="i" name="topic" maxlength="200" placeholder="Nowy temat, np. Dlaczego nauka w nocy nie działa" aria-label="Nowy temat"><input class="i" name="hook" maxlength="300" placeholder="Hook (opcjonalnie)" aria-label="Hook"><button class="btn" type="submit">Dodaj temat</button></form>
  ${!S.queue.length ? `<div class="empty" style="margin-bottom:16px"><h3>Kolejka jest pusta</h3>Wpisz pierwszy temat powyżej. Pomysły możesz też wkleić hurtem przez <a href="/app/start?tryb=ai" data-link>asystenta AI</a>.</div>` : ''}
  <div class="kanban">${QCOLS.map(([k, label, hint], i) => {
    const items = S.queue.filter(q => q.status === k);
    return `<section class="col" aria-label="${label}"><h3>${label} <span>${items.length}</span></h3><p class="hint">${hint}</p>${items.map(q => qcard(q, i)).join('')}</section>`;
  }).join('')}</div>`;
}
function qcard(q, i) {
  const vid = q.video_id && S.videos.find(v => v.id === q.video_id);
  return `<article class="qc">${q.priority === 1 ? '<span class="p1">Pilne</span>' : ''}<b>${esc(q.topic)}</b>${q.hook ? `<small>${esc(q.hook)}</small>` : ''}${vid ? `<small>Film: ${esc(vid.title)}</small>` : ''}
    <div class="qa">${i > 0 ? `<button data-act="qmove" data-id="${q.id}" data-arg="-1" aria-label="Cofnij do ${QCOLS[i - 1][1]}">Wstecz</button>` : ''}${i < 4 ? `<button data-act="qmove" data-id="${q.id}" data-arg="1" aria-label="Przesuń do ${QCOLS[i + 1][1]}">Dalej</button>` : ''}
      ${!vid && genActive(q.id) ? `<button class="go" data-act="gen-open" data-id="${genActive(q.id).id}">Postęp</button>` : ''}
      ${!vid && !genActive(q.id) && S.me.generator.ready ? `<button class="go" data-act="gen-new" data-id="${q.id}">Generuj film</button>` : ''}
      ${!vid && !genActive(q.id) && i >= 2 ? `<button data-act="qvideo" data-id="${q.id}">Mam film</button>` : ''}
      <button data-act="qedit" data-id="${q.id}">Edytuj</button><button data-act="qdel" data-id="${q.id}" aria-label="Usuń temat">Usuń</button></div></article>`;
}

// ---- analysis ------------------------------------------------------------------------------------------
async function viewAnalysis() {
  const a = (await api('GET', '/api/analysis' + chQ())).analysis;
  if (!a.sampleSize) {
    $('#view').innerHTML = `<div class="head"><div><h1>Analiza</h1><p>Co wygrywa na Twoim kanale.</p></div></div>
    <div class="empty"><h3>Jeszcze nie ma czego porównać</h3>Analiza potrzebuje wyników. Wpisz wyświetlenia i oglądalność przy opublikowanych filmach albo wgraj CSV z TikTok Studio.
    Rekomendacje pojawią się, gdy dwa warianty (np. dwa rodzaje hooka) będą miały po co najmniej 2 filmy.<br>
    <a class="btn" href="/app/filmy?tab=posted" data-link>Wpisz wyniki</a> <a class="btn ghost" href="/app/integracje" data-link>Import CSV</a></div>`;
    return;
  }
  const max = Math.max(...a.top.map(t => t.score), 1);
  const factorBlock = (f, label) => {
    const rows = a.perFactor[f];
    if (!rows.length) return '';
    const m = Math.max(...rows.map(r => r.score), 1);
    return `<section class="panel"><h2>${label}</h2><div class="bars">${rows.slice(0, 6).map((r, i) => `<div class="r ${i === 0 && rows.length > 1 ? 'w' : ''}"><span title="${esc(r.value)}">${esc(r.value)}</span><i style="width:${(r.score / m) * 100}%"></i><span>${dec(r.score)}<small style="font-weight:400;color:var(--mute)"> n=${r.n}</small></span></div>`).join('')}</div></section>`;
  };
  const blocks = Object.entries(a.factors).map(([f, l]) => factorBlock(f, l)).filter(Boolean);
  $('#view').innerHTML = `
  <div class="head"><div><h1>Analiza</h1><p>Filmy z wynikami: ${a.sampleSize} z ${a.totalVideos}. Wynik 0 do 100: czas oglądania, obejrzenia do końca, zaangażowanie i zasięg.</p></div>
    <div class="actions"><button class="btn ghost" data-act="mail" data-arg="weekly">Wyślij raport mailem</button></div></div>
  <section class="panel" style="margin-bottom:18px"><h2>Co powtarzać</h2>${a.recommendations.length ? `<ul style="margin:0;padding-left:20px">${a.recommendations.map(r => `<li style="margin:6px 0">${esc(r.text)}</li>`).join('')}</ul>`
    : '<p style="margin:0;color:var(--slate)">Rekomendacje pojawią się, gdy przynajmniej dwa warianty jednej cechy (np. hooka) będą miały po 2 filmy z wynikami. Uzupełniaj pola "Hook", "Temat" i "Styl" przy filmach.</p>'}</section>
  <div class="grid2" style="margin-bottom:18px">
    <section class="panel"><h2>Najlepsze filmy</h2><div class="bars">${a.top.map((t, i) => `<div class="r ${i === 0 ? 'w' : ''}"><span title="${esc(t.title)}">${esc(t.title)}</span><i style="width:${(t.score / max) * 100}%"></i><span>${dec(t.score)}</span></div>`).join('')}</div></section>
    <section class="panel"><h2>Najsłabsze</h2>${a.bottom.length ? `<div class="bars">${a.bottom.map(t => `<div class="r"><span title="${esc(t.title)}">${esc(t.title)}</span><i style="width:${(t.score / max) * 100}%"></i><span>${dec(t.score)}</span></div>`).join('')}</div>` : '<p style="margin:0;color:var(--slate)">Pokażemy je, gdy będzie więcej niż 5 filmów z wynikami.</p>'}</section>
  </div>
  <div class="grid2">${blocks.join('') || '<p style="color:var(--slate)">Uzupełnij hook, temat albo styl przy filmach, żeby porównać warianty.</p>'}</div>`;
}

// ---- integrations -----------------------------------------------------------------------------------------
async function viewIntegrations() {
  const ws = S.me.workspace;
  const origin = location.origin;
  $('#view').innerHTML = `
  <div class="head"><div><h1>Integracje</h1><p>Podłącz generator wideo, wgraj eksport z TikTok Studio albo wklej dane dla asystenta AI.</p></div>
    <div class="actions"><a class="btn ghost" href="/integracje" target="_blank" rel="noopener">Pełna dokumentacja API</a></div></div>
  <div class="grid2">
    <section class="panel"><h2>1. Klucz API</h2>
      <p style="margin-top:0;color:var(--slate)">Klucz pozwala Twoim narzędziom dodawać filmy i wyniki do tego konta. Traktuj go jak hasło.</p>
      ${ws.has_api_key ? `<div class="keybox"><code>${esc(ws.api_key_prefix)}... (ukryty)</code></div><p style="font-size:14px;color:var(--slate)">Pełny klucz pokazujemy tylko raz. Zgubiony? Wygeneruj nowy, stary przestanie działać.</p>
        <button class="btn ghost sm" data-act="apikey">Wygeneruj nowy klucz</button>` : `<button class="btn" data-act="apikey">Wygeneruj klucz API</button>`}
    </section>
    <section class="panel"><h2>2. Generator wideo</h2>
      <p style="margin-top:0;color:var(--slate)">Po renderze generator wysyła jedno zapytanie. Pole <code>ref</code> to stały identyfikator: ponowne wysłanie aktualizuje film zamiast tworzyć duplikat.</p>
      <pre class="code">curl -X POST ${esc(origin)}/api/videos \\
  -H "Authorization: Bearer TWOJ_KLUCZ" \\
  -H "Content-Type: application/json" \\
  -d '{"ref":"moj-film-1","title":"Mój film",
       "hook":"Pierwsze zdanie",
       "file_url":"https://.../film.mp4",
       "schedule_date":"${addDays(today(), 1)}",
       "schedule_time":"18:00"}'</pre>
    </section>
    <section class="panel"><h2>3. Eksport z TikTok Studio (CSV)</h2>
      <p style="margin-top:0;color:var(--slate)">W TikTok Studio na komputerze otwórz Analityka, potem Treści, i pobierz dane. Plik CSV wgraj tutaj. Rozpoznajemy kolumny po polsku i po angielsku, przed zapisem zobaczysz podgląd.</p>
      <label class="btn ghost" style="cursor:pointer">Wybierz plik CSV<input type="file" accept=".csv,text/csv,.tsv,.txt" data-act-change="csv" class="sr"></label>
    </section>
    <section class="panel"><h2>4. Wklej cokolwiek (asystent AI)</h2>
      <p style="margin-top:0;color:var(--slate)">Lista filmów z notatnika, wyniki przepisane z telefonu, pomysły na tematy. Asystent ułoży to w filmy, kolejkę i terminy.</p>
      <a class="btn ghost" href="/app/start?tryb=ai" data-link>Otwórz asystenta</a>
    </section>
    <section class="panel"><h2>5. Maile (Brevo)</h2>
      <p style="margin-top:0;color:var(--slate)">${S.me.mailer === 'brevo' ? `Maile wychodzą przez Brevo na adres <b>${esc(ws.mail_to || S.me.user?.email)}</b>.` : 'Wysyłka maili jest na tym serwerze w trybie testowym: wiadomości są tylko zapisywane w logu. Administrator musi ustawić BREVO_SMTP_USER i BREVO_SMTP_KEY.'}</p>
      <button class="btn ghost sm" data-act="mail" data-arg="test">Wyślij testowy mail</button> <button class="btn ghost sm" data-act="mail" data-arg="digest">Wyślij plan na dziś</button>
    </section>
  </div>`;
}

// ---- settings ----------------------------------------------------------------------------------------------
async function viewSettings() {
  const ws = S.me.workspace;
  let zones = ['Europe/Warsaw'];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch {}
  const days = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const hours = Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === ws.digest_hour ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('');
  $('#view').innerHTML = `
  <div class="head"><div><h1>Ustawienia</h1><p>Raporty, strefa czasowa, kanały i konto.</p></div></div>
  <div class="grid2">
    <section class="panel"><h2>Raporty i przypomnienia</h2>
      <form data-form="ws" novalidate>
        ${field('Wysyłaj na adres', inp('mail_to', ws.mail_to || S.me.user?.email, 'type="email"'))}
        <label class="check"><input type="checkbox" name="digest_enabled" ${ws.digest_enabled ? 'checked' : ''}> <span>Codzienny plan publikacji i raport tygodniowy</span></label>
        <div class="fgrid">${field('Godzina wysyłki', `<select class="i" name="digest_hour">${hours}</select>`)}${field('Raport tygodniowy w', `<select class="i" name="weekly_day">${days.map((d, i) => `<option value="${i}" ${i === ws.weekly_day ? 'selected' : ''}>${d}</option>`).join('')}</select>`)}</div>
        <label class="check"><input type="checkbox" name="reminders_enabled" ${ws.reminders_enabled ? 'checked' : ''}> <span>Przypomnienie, gdy nadchodzi godzina publikacji</span></label>
        ${field('Cel: publikacji dziennie', `<input class="i" name="cadence_per_day" type="number" min="1" max="10" value="${ws.cadence_per_day}">`)}
        ${field('Strefa czasowa', `<select class="i" name="timezone">${zones.map(z => `<option ${z === ws.timezone ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select>`, 'Wszystkie godziny w kalendarzu i mailach są w tej strefie.')}
        ${field('Nazwa studia', inp('name', ws.name, 'maxlength="80"'))}
        ${S.me.ai.ready ? field('Model asystenta AI', `<select class="i" name="ai_model">${S.me.ai.models.map(m => `<option value="${esc(m)}" ${m === (ws.ai_model || S.me.ai.default) ? 'selected' : ''}>${esc(m)}${m === S.me.ai.default ? ' (domyślny)' : ''}</option>`).join('')}</select>`, 'Modele przez OpenRouter. Domyślny jest tani i szybki.') : ''}
        <div class="err-inline" data-err></div><button class="btn" type="submit">Zapisz ustawienia</button>
      </form>
    </section>
    <div style="display:grid;gap:18px;align-content:start">
      <section class="panel"><h2>Konta TikTok</h2>
        <div class="rows">${S.me.channels.map(c => `<div class="rowi"><div class="main"><b><i class="acct-dot" style="background:${esc(c.color || '#22b8cf')}"></i>${esc(c.name)}</b><small>${esc([c.handle, c.niche].filter(Boolean).join(', ') || 'bez opisu')}</small></div><div class="acts"><button class="btn sm ghost" data-act="edit-channel" data-id="${c.id}">Edytuj</button>${S.me.channels.length > 1 ? `<button class="btn sm danger" data-act="del-channel" data-id="${c.id}">Usuń</button>` : ''}</div></div>`).join('') || '<p style="margin:0;color:var(--slate)">Brak kanału.</p>'}</div>
        <button class="btn sm ghost" style="margin-top:12px" data-act="edit-channel">Dodaj konto TikTok</button>
      </section>
      <section class="panel"><h2>Dodatki do generatora</h2>
        <p style="margin-top:0;color:var(--slate);font-size:14px">Własne instrukcje, które włączasz w oknie "Wygeneruj film", np. "zawsze pokaż logo w rogu" albo "kończ pytaniem do komentarzy".</p>
        <div class="rows" data-subskills><div class="loading"><span class="spin"></span></div></div>
        <button class="btn sm ghost" style="margin-top:12px" data-act="sub-edit">Dodaj dodatek</button>
      </section>
      <section class="panel"><h2>Hasło</h2>
        <form data-form="password" novalidate>
          ${field('Obecne hasło', '<input class="i" name="current" type="password" autocomplete="current-password">')}
          ${field('Nowe hasło', '<input class="i" name="password" type="password" autocomplete="new-password" minlength="8">', 'Co najmniej 8 znaków.')}
          <div class="err-inline" data-err></div><button class="btn ghost" type="submit">Zmień hasło</button>
        </form>
      </section>
      <section class="panel"><h2>Konto</h2>
        <p style="margin-top:0;color:var(--slate)">Zalogowano jako ${esc(S.me.user?.email)}.</p>
        <button class="btn ghost sm" data-act="logout">Wyloguj się</button> <button class="btn danger sm" data-act="delete-account">Usuń konto</button>
      </section>
    </div>
  </div>`;
  loadSubskills().then(list => {
    const box = $('[data-subskills]'); if (!box) return;
    box.innerHTML = list.map(x => `<div class="rowi"><div class="main"><b>${esc(x.name)}</b><small>${esc(x.body.slice(0, 120))}${x.default_on ? ' · włączony domyślnie' : ''}${x.enabled ? '' : ' · ukryty'}</small></div>
      <div class="acts"><button class="btn sm ghost" data-act="sub-edit" data-id="${x.id}">Edytuj</button><button class="btn sm danger" data-act="sub-del" data-id="${x.id}">Usuń</button></div></div>`).join('')
      || '<p style="margin:0;color:var(--slate)">Brak dodatków.</p>';
  }).catch(e => toast(e.message, true));
}
async function loadSubskills() { S.subskills = (await api('GET', '/api/subskills')).subskills; return S.subskills; }
function subskillModal(x) {
  x = x || {};
  openModal(`<h2 id="modal-title">${x.id ? 'Edytuj dodatek' : 'Nowy dodatek do generatora'}</h2>
  <p class="sub">Tekst trafia do zadania agenta, gdy zaznaczysz ten dodatek przy generowaniu.</p>
  <form data-form="subskill" data-id="${x.id || ''}" novalidate>
    ${field('Nazwa', inp('name', x.name, 'required maxlength="80" autofocus placeholder="np. Logo w rogu"'))}
    ${field('Instrukcja dla agenta', `<textarea class="i" name="body" maxlength="4000" rows="6" placeholder="np. W prawym górnym rogu przez cały film małe logo marki (tekst WR w kółku).">${esc(x.body || '')}</textarea>`)}
    <label class="check"><input type="checkbox" name="default_on" ${x.default_on ? 'checked' : ''}> <span>Zaznaczony domyślnie w oknie generowania</span></label>
    <label class="check"><input type="checkbox" name="enabled" ${x.enabled === 0 ? '' : 'checked'}> <span>Pokazuj w oknie generowania</span></label>
    <div class="err-inline" data-err></div>
    <div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn" type="submit">${x.id ? 'Zapisz' : 'Dodaj'}</button></div>
  </form>`);
}

function channelModal(c) {
  c = c || {};
  openModal(`<h2 id="modal-title">${c.id ? 'Edytuj konto TikTok' : 'Dodaj konto TikTok'}</h2><p class="sub">Każde konto ma własne filmy, kalendarz, kolejkę i ustawienia generatora. Opis pomaga agentowi pisać pod to konto.</p>
  <form data-form="channel" data-id="${c.id || ''}" novalidate>
    ${field('Nazwa kanału', inp('name', c.name, 'required maxlength="80" autofocus placeholder="np. Nauka na luzie"'))}
    <div class="fgrid">${field('Nazwa na TikToku', inp('handle', c.handle, 'maxlength="60" placeholder="@nazwa"'))}${field('Kolor konta', `<input class="i" name="color" type="color" value="${esc(c.color || '#22b8cf')}">`, 'Widać go w przełączniku kont.')}</div>
    ${field('O czym jest kanał', `<textarea class="i" name="niche" maxlength="400" placeholder="np. metody nauki dla studentów, krótkie triki przed egzaminem">${esc(c.niche || '')}</textarea>`)}
    ${field('Dla kogo', inp('audience', c.audience, 'maxlength="300" placeholder="np. studenci 1. i 2. roku"'))}
    ${field('Cel', inp('goal', c.goal, 'maxlength="300" placeholder="np. pobrania aplikacji, obserwujący"'))}
    ${channelGenFields(c)}
    <div class="err-inline" data-err></div>
    <div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn" type="submit">${c.id ? 'Zapisz' : 'Dodaj konto'}</button></div>
  </form>`);
}

// ---- generator (opencode + DeepSeek on the server) ----------------------------------------------------------
const VOICES = [['Puck', 'Puck (męski, energiczny)'], ['Charon', 'Charon (męski, spokojny)'], ['Fenrir', 'Fenrir (męski, mocny)'], ['Leda', 'Leda (kobiecy, ciepły)'], ['Kore', 'Kore (kobiecy, wyraźny)']];
function channelGenFields(c) {
  return `<details class="more" ${c.product || c.cta ? 'open' : ''}><summary>Ustawienia generatora filmów</summary><div class="fgrid">
    ${field('Produkt lub marka do wspomnienia', inp('product', c.product, 'maxlength="300" placeholder="np. aplikacja Wykłady Razem: notatki z nagrania wykładu"'), 'Puste = film bez reklamy.', 'full')}
    ${field('Wezwanie do działania (CTA)', inp('cta', c.cta, 'maxlength="200" placeholder="np. zapisz film i zacznij dziś"'), '', 'full')}
    ${field('Kolory marki', inp('colors', c.colors, 'maxlength="200" placeholder="np. #ff9a6b, #6a7dff"'))}
    ${field('Głos lektora', `<select class="i" name="voice">${VOICES.map(([v, l]) => `<option value="${v}" ${v === (c.voice || 'Puck') ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
    ${field('Język filmu', inp('language', c.language || 'polski', 'maxlength="30"'))}
    ${field('Długość filmu (s)', `<input class="i" name="length_sec" type="number" min="20" max="90" value="${c.length_sec || 40}">`)}
  </div></details>`;
}
const FORMAT_LABEL = { short: 'TikTok', long_vertical: 'Długi pionowy', long_wide: 'Długi 16:9' };
const genActive = (queueId) => S.jobs.find(j => j.queue_id === queueId && ['held', 'queued', 'running'].includes(j.status));
const phaseLabel = (k) => (S.me.generator.phases.find(p => p[0] === k) || [k, k])[1];
const fmtDur = (ms) => { const m = Math.floor(ms / 60000), sec = Math.floor(ms / 1000) % 60; return m ? `${m} min ${sec} s` : `${sec} s`; };
function jobState(j) {
  if (j.status === 'done') return { cls: 'posted', label: 'Gotowy' };
  if (j.status === 'error') return { cls: 'late', label: 'Nie udało się' };
  if (j.status === 'canceled') return { cls: 'skipped', label: 'Zatrzymany' };
  if (j.status === 'queued') return { cls: 'planned', label: 'W kolejce' };
  if (j.status === 'held') return { cls: '', label: 'Czeka na start' };
  return { cls: 'planned', label: phaseLabel(j.phase) };
}
function genBanner() {
  const j = S.jobs.find(x => ['queued', 'running'].includes(x.status));
  if (!j) return '';
  return `<section class="panel genbar" style="margin-bottom:18px"><div class="gen-row"><span class="spin" aria-hidden="true"></span>
    <div class="main"><b>Generuję: ${esc(j.topic)}</b><small>${esc(j.phase_detail || phaseLabel(j.phase))}</small></div>
    <button class="btn sm ghost" data-act="gen-open" data-id="${j.id}">Pokaż postęp</button></div></section>`;
}

async function viewGenerator() {
  const g = S.me.generator;
  const left = Math.max(0, g.dailyLimit - g.usedToday);
  const ideas = S.queue.filter(q => !q.video_id && !genActive(q.id) && q.status !== 'done').slice(0, 6);
  $('#view').innerHTML = `
  <div class="head"><div><h1>Kolejka renderów</h1><p>Generator robi filmy po kolei: skrypt, lektor, animacja z napisami i efektami, kontrola kadru, render MP4. Gotowe trafiają do zakładki Filmy. Całą serię zlecisz jednym poleceniem w zakładce <a href="/app/agent" data-link>Agent</a>.</p></div>
    <div class="actions">${S.jobs.some(j => ['queued', 'held'].includes(j.status)) ? '<button class="btn ghost" data-act="gen-cancel-queued">Wyczyść czekające</button>' : ''}${S.jobs.some(j => j.status === 'held') && g.ready ? `<button class="btn" data-act="gen-start">Uruchom kolejkę (${S.jobs.filter(j => j.status === 'held').length})</button>` : ''}${g.ready ? `<button class="btn cyan" data-act="gen-new" ${left ? '' : 'disabled'}>Wygeneruj film</button>` : ''}</div></div>
  ${(() => { const act = S.jobs.filter(j => ['queued', 'running'].includes(j.status)); return act.length ? `<div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><b>${act.length}</b><span>w kolejce i w toku</span></div><div class="stat"><b>${S.jobs.filter(j => j.status === 'done').length}</b><span>gotowe</span></div><div class="stat"><b>${S.etaMin >= 60 ? dec((S.etaMin / 60).toFixed(1)) + ' h' : (S.etaMin || 0) + ' min'}</b><span>do końca kolejki (szacunek)</span></div></div>` : ''; })()}
  ${g.ready ? '' : `<div class="empty" style="margin-bottom:18px"><h3>Generator nie działa na tym serwerze</h3>Brakuje: ${esc(g.missing.join(', '))}. Administrator musi to doinstalować. Do tego czasu możesz dodawać filmy ręcznie albo przez API.</div>`}
  <div class="grid2" style="margin-bottom:18px">
    <section class="panel"><h2>Jak to działa</h2><ol style="margin:0;padding-left:20px;color:var(--slate)">
      <li>Wybierz temat z kolejki albo wpisz nowy.</li><li>Generator pracuje 20 do 40 minut. Możesz zamknąć kartę, postęp zobaczysz tutaj.</li>
      <li>Film pojawi się w zakładce Filmy z opisem i przypiętym komentarzem. Obejrzyj go i zaplanuj publikację.</li></ol>
      <p style="color:var(--slate);font-size:14px;margin-bottom:0">Dzisiaj: ${g.usedToday} z ${g.dailyLimit} filmów. Styl, głos i produkt ustawiasz w <a href="/app/ustawienia" data-link>ustawieniach kanału</a>.</p></section>
    <section class="panel"><h2>Tematy z kolejki</h2>${ideas.length ? `<div class="rows">${ideas.map(q => `<div class="rowi"><div class="main"><b>${esc(q.topic)}</b>${q.hook ? `<small>${esc(q.hook)}</small>` : ''}</div><div class="acts">${g.ready ? `<button class="btn sm cyan" data-act="gen-new" data-id="${q.id}" ${left ? '' : 'disabled'}>Generuj</button>` : ''}</div></div>`).join('')}</div>`
      : '<p style="margin:0;color:var(--slate)">Kolejka jest pusta. Wpisz temat w oknie "Wygeneruj film" albo dodaj tematy w <a href="/app/kolejka" data-link>kolejce</a>.</p>'}</section>
  </div>
  <section class="panel"><h2>Zadania</h2>${S.jobs.length ? `<div class="rows">${S.jobs.map(j => { const st = jobState(j); return `<div class="rowi"><div class="main"><b>${esc(j.topic)}</b>
      <small>${FORMAT_LABEL[j.format] || 'TikTok'}, ${new Date(j.created_at).toLocaleString('pl-PL', { timeZone: TZ(), day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${j.position ? `, ${j.position}. w kolejce` : ''}${j.cost_usd ? `, koszt modelu ${dec(j.cost_usd.toFixed(3))} USD` : ''}</small> <span class="pill ${st.cls}">${esc(st.label)}</span>
      ${j.status === 'error' ? `<small style="display:block;color:var(--bad)">${esc(j.error)}</small>` : ''}</div>
      <div class="acts">${j.status === 'held' && g.ready ? `<button class="btn sm cyan" data-act="gen-start" data-id="${j.id}">Start</button><button class="btn sm danger" data-act="gen-cancel" data-id="${j.id}">Usuń</button>` : ''}${j.video_id ? `<button class="btn sm cyan" data-act="play" data-id="${j.video_id}">Obejrzyj</button>` : ''}<button class="btn sm ghost" data-act="gen-open" data-id="${j.id}">Szczegóły</button></div></div>`; }).join('')}</div>`
    : '<p style="margin:0;color:var(--slate)">Nie generowałeś jeszcze filmów.</p>'}</section>`;
  if (S.jobs.some(j => ['queued', 'running'].includes(j.status))) pollJobs();
}


let genPoll = null;
function pollJobs() {
  clearInterval(genPoll);
  genPoll = setInterval(async () => {
    try {
      const before = S.jobs.filter(j => ['queued', 'running'].includes(j.status)).map(j => j.id);
      const jr = await api('GET', '/api/jobs'); S.jobs = jr.jobs; S.etaMin = jr.eta_min || 0;
      const active = S.jobs.filter(j => ['queued', 'running'].includes(j.status));
      const finished = before.filter(id => !active.some(j => j.id === id)).map(id => S.jobs.find(j => j.id === id));
      for (const j of finished) toast(j?.status === 'done' ? `Film gotowy: ${j.topic}` : `Generowanie zakończone: ${jobState(j || {}).label}`, j?.status !== 'done');
      if (finished.length) { clearInterval(genPoll); if (!$('#overlay').classList.contains('show')) await repaint(); }
      else if (location.pathname === '/app/generator' && !$('#overlay').classList.contains('show')) await viewGenerator();
      else renderChrome();
    } catch {}
  }, 5000);
}

function genModal(queueId) {
  const q = queueId ? S.queue.find(x => x.id === Number(queueId)) : null;
  const g = S.me.generator;
  const ch = S.me.channels.find(c => String(c.id) === String(q?.channel_id || S.channel)) || S.me.channels[0] || {};
  openModal(`<h2 id="modal-title">Wygeneruj film</h2>
  <p class="sub">Kanał: <b>${esc(ch.name || 'bez nazwy')}</b>, ${ch.length_sec || 40} s, lektor ${esc(ch.voice || 'Puck')}${ch.product ? `, wspomni: ${esc(ch.product)}` : ', bez reklamy'}. <a href="/app/ustawienia" data-link>Zmień</a></p>
  <form data-form="gen" data-queue="${q ? q.id : ''}" novalidate>
    ${field('Temat filmu', inp('topic', q?.topic || '', 'required maxlength="200" autofocus placeholder="np. Jak zapamiętać 20 dat w 10 minut"'))}
    ${field('Hook (opcjonalnie)', inp('hook', q?.hook || '', 'maxlength="300" placeholder="Pierwsze zdanie, jeśli masz pomysł"'))}
    ${field('Notatki dla generatora (opcjonalnie)', `<textarea class="i" name="notes" maxlength="2000" placeholder="np. pokaż przykład z sesji zimowej, bez liczb">${esc(q?.notes || '')}</textarea>`)}
    ${field('Materiał źródłowy PDF (opcjonalnie)', '<input class="i" type="file" name="pdf" accept="application/pdf,.pdf">', 'Np. artykuł, prezentacja, notatki. Generator oprze film na tym pliku. Do 20 MB.')}
    ${channelSelect(q?.channel_id)}
    ${field('Format', `<select class="i" name="format"><option value="short">TikTok pionowy (20-90 s)</option><option value="long_vertical">Długi pionowy (2-10 min)</option><option value="long_wide">Długi poziomy 16:9, YouTube (2-10 min)</option></select>`)}
    ${stylePicker(g)}
    <label class="check"><input type="checkbox" name="research" ${g.research ? '' : 'disabled'} ${g.research && lsGet('tss-research') === '1' ? 'checked' : ''}> <span>Research konkurencji przed startem: agent dostanie najmocniejsze TikToki na ten temat${g.research ? ' (ok. 1-2 min, Apify)' : '. Niedostępne: brak APIFY_API_TOKEN na serwerze'}</span></label>
    <div data-gen-subs></div>
    <label class="check"><input type="checkbox" name="broll" ${g.broll ? '' : 'disabled'} ${g.broll && lsGet('tss-broll') === '1' ? 'checked' : ''}> <span>Dorzuć prawdziwe ujęcia z internetu (b-roll z Pexels, darmowa licencja)${g.broll ? '' : '. Niedostępne: brak klucza PEXELS_API_KEY na serwerze'}</span></label>
    <details class="more"><summary>Opcje filmu: długość, lektor, własny skrypt</summary><div class="fgrid">
      ${field('Długość (s)', `<input class="i" name="length_sec" type="number" min="20" max="600" placeholder="${ch.length_sec || 40} (TikTok), 180-360 (długi)">`, 'Puste = domyślna dla formatu.')}
      ${field('Głos lektora', `<select class="i" name="voice">${VOICES.map(([v, l]) => `<option value="${v}" ${v === (ch.voice || 'Puck') ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${field('Mój skrypt lektora (opcjonalnie)', `<textarea class="i" name="script" maxlength="6000" placeholder="Wklej gotowy tekst lektora. Puste = generator napisze go sam."></textarea>`, '', 'full')}
    </div></details>
    <details class="more"><summary>Agent generujący</summary>${field('Silnik i model', `<select class="i" name="model">${g.models.map(m => `<option value="${esc(m)}" ${m === g.model ? 'selected' : ''}>${esc(g.labels?.[m] || m)}${m === g.model ? ' (domyślny)' : ''}</option>`).join('')}</select>`, 'DeepSeek przez opencode jest najtańszy. Claude Code (Sonnet, Opus) jest dokładniejszy i droższy.')}</details>
    <label class="check"><input type="checkbox" name="start" checked> <span>Uruchom od razu (bez zaznaczenia film czeka w kolejce renderów na start)</span></label>
    <p style="font-size:14px;color:var(--slate)">TikTok trwa 20 do 40 minut, długi film do 1,5 h. Filmy robią się po kolei. Dziś zostało: ${Math.max(0, g.dailyLimit - g.usedToday)} z ${g.dailyLimit}.</p>
    <div class="err-inline" data-err></div>
    <div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn cyan" type="submit">Generuj film</button></div>
  </form>`, { wide: true });
  pickStyle(lsGet('tss-style') || '');
  loadSubskills().then(list => {
    const box = $('[data-gen-subs]'); const on = list.filter(x => x.enabled);
    if (!box || !on.length) return;
    box.innerHTML = `<fieldset class="subs"><legend>Dodatki do generatora</legend>${on.map(x => `<label class="check"><input type="checkbox" name="subskill" value="${x.id}" ${x.default_on ? 'checked' : ''}> <span><b>${esc(x.name)}</b> <small>${esc(x.body.slice(0, 90))}</small></span></label>`).join('')}</fieldset>`;
  }).catch(() => {});
}

// ---- visual style picker: every style shows a real example clip, so the choice is not blind ----
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
function stylePicker(g) {
  const styles = g.styles || [];
  const groups = [...new Set(styles.map(x => x.group))];
  const card = (x) => `<label class="sp-card" data-sp="${esc(x.id)}" ${x.verticalOnly ? 'data-vonly' : ''} title="${esc(x.tagline)}">
      <input type="radio" name="style" value="${esc(x.id)}">
      ${x.poster ? `<img src="${esc(x.poster)}" alt="" loading="lazy">` : '<span class="sp-noimg">brak podglądu</span>'}
      <span>${esc(x.name)}</span></label>`;
  return `<fieldset class="stylepick"><legend>Styl wizualny</legend>
    <div class="sp-wrap">
      <div class="sp-stage"><div class="sp-screen"><video data-sp-video muted loop playsinline preload="metadata"></video><div class="sp-auto" data-sp-auto>Agent dobierze styl do tematu</div></div>
        <div class="sp-info"><b data-sp-name></b><p data-sp-tag></p><p class="sp-meta" data-sp-meta></p></div></div>
      <div class="sp-list">
        <div class="sp-grid"><label class="sp-card sp-autocard" data-sp=""><input type="radio" name="style" value=""><span class="sp-noimg">Auto</span><span>Dobierz sam</span></label></div>
        ${groups.map(gr => `<h4>${esc(gr)}</h4><div class="sp-grid">${styles.filter(x => x.group === gr).map(card).join('')}</div>`).join('')}
      </div>
    </div></fieldset>`;
}
function pickStyle(id) {
  const box = $('.stylepick'); if (!box) return;
  const x = (S.me.generator.styles || []).find(s => s.id === id);
  const radio = box.querySelector(`input[name=style][value="${CSS.escape(x ? id : '')}"]`);
  if (radio) radio.checked = true;
  $$('.sp-card', box).forEach(c => c.classList.toggle('on', c.dataset.sp === (x ? id : '')));
  const v = box.querySelector('[data-sp-video]');
  box.querySelector('[data-sp-auto]').hidden = Boolean(x);
  box.querySelector('[data-sp-name]').textContent = x ? x.name : 'Auto';
  box.querySelector('[data-sp-tag]').textContent = x ? x.tagline : 'Agent przeczyta temat i wybierze jeden styl z listy, a w dzienniku pracy zapisze, dlaczego.';
  box.querySelector('[data-sp-meta]').textContent = x ? `Najlepszy do: ${x.best_for}. Autor: ${x.credit?.author || ''}, licencja ${x.credit?.license || ''}.${x.verticalOnly ? ' Tylko pionowo.' : ''}${x.video ? '' : ' Przykład w przygotowaniu.'}` : '';
  if (x?.video) { if (v.getAttribute('src') !== x.video) { v.src = x.video; v.poster = x.poster || ''; } v.hidden = false; v.play().catch(() => {}); }
  else { v.pause(); v.removeAttribute('src'); v.hidden = true; }
}

let jobPoll = null;
async function jobModal(id) {
  const render = async () => {
    let j;
    try { j = (await api('GET', `/api/jobs/${id}`)).job; } catch (e) { clearInterval(jobPoll); return toast(e.message, true); }
    if (!$('#overlay').classList.contains('show') || $('#modal').dataset.job !== String(id)) { clearInterval(jobPoll); return; }
    const phases = S.me.generator.phases.filter(p => p[0] !== 'queued');
    const at = phases.findIndex(p => p[0] === j.phase);
    const live = ['queued', 'running'].includes(j.status);
    const elapsed = j.started_at ? (j.finished_at ? new Date(j.finished_at) : new Date()) - new Date(j.started_at) : 0;
    const st = jobState(j);
    const keepLog = $('#joblog')?.open;
    $('#modal').innerHTML = `<h2 id="modal-title">${esc(j.topic)}</h2>
      <p class="sub">${j.style ? `Styl: ${esc(j.style)}. ` : ''}${j.broll ? 'B-roll z sieci. ' : ''}${j.attachment ? `Materiał: ${esc(j.attachment)}. ` : ''}<span class="pill ${st.cls}">${esc(st.label)}</span> ${j.started_at ? `czas: ${fmtDur(elapsed)}` : 'czeka na wolny generator'}${j.cost_usd ? `, koszt modelu ${dec(j.cost_usd.toFixed(3))} USD` : ''}</p>
      <ol class="phases">${phases.map((p, i) => `<li class="${j.status === 'done' || i < at ? 'done' : i === at && live ? 'now' : ''}">${p[1]}</li>`).join('')}</ol>
      ${live ? `<p style="margin:0 0 12px">${esc(j.phase_detail || 'Startuję')}</p>` : ''}
      ${j.status === 'error' ? `<div class="empty" style="border-color:var(--bad-line);color:var(--bad)">${esc(j.error)}<br><span style="color:var(--slate)">Temat wrócił do kolejki. Możesz spróbować jeszcze raz.</span></div>` : ''}
      ${j.status === 'done' && j.video_id ? `<video class="player" src="/api/videos/${j.video_id}/media" controls playsinline preload="metadata"></video>` : ''}
      <details class="more" id="joblog" ${keepLog ? 'open' : ''}><summary>Dziennik pracy generatora</summary><pre class="code joblog">${esc(j.log)}</pre></details>
      <div class="foot">${live ? `<button class="btn danger left" data-act="gen-cancel" data-id="${j.id}">Zatrzymaj</button>` : ''}
        ${j.status === 'error' && j.queue_id ? `<button class="btn ghost" data-act="gen-new" data-id="${j.queue_id}">Spróbuj ponownie</button>` : ''}
        ${j.status === 'done' && j.video_id ? `<a class="btn ghost" href="/api/videos/${j.video_id}/download">Pobierz MP4</a><button class="btn" data-act="schedule" data-id="${j.video_id}">Zaplanuj publikację</button>` : ''}
        <button class="btn ghost" data-act="close-refresh">Zamknij</button></div>`;
    $('#modal').dataset.job = String(id);
    const lg = $('.joblog'); if (lg) lg.scrollTop = lg.scrollHeight;
    if (!live) clearInterval(jobPoll);
  };
  openModal('<div class="loading"><span class="spin"></span>Ładowanie...</div>', { wide: true });
  $('#modal').dataset.job = String(id);
  clearInterval(jobPoll);
  await render();
  jobPoll = setInterval(render, 3000);
}

function playModal(v) {
  openModal(`<h2 id="modal-title">${esc(v.title)}</h2>${v.caption ? `<p class="sub">${esc(v.caption)}</p>` : ''}
    <video class="player" src="/api/videos/${v.id}/media" controls playsinline autoplay></video>
    ${v.pin ? `<p style="font-size:14px;color:var(--slate)">Przypięty komentarz: ${esc(v.pin)}</p>` : ''}
    <div class="foot"><a class="btn ghost" href="/api/videos/${v.id}/download">Pobierz MP4</a>${v.posted ? '' : `<button class="btn" data-act="schedule" data-id="${v.id}">${v.next_slot ? 'Przesuń publikację' : 'Zaplanuj publikację'}</button>`}<button class="btn ghost" data-act="close">Zamknij</button></div>`, { wide: true });
}

// ---- music library: favourites go under the generated videos ---------------------------------------------------
const fmtSec = (x) => { x = Math.round(x || 0); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };
async function viewMusic() {
  const tab = S.mtab || 'all';
  const r = await api('GET', `/api/music?filter=${tab}`);
  const st = r.settings;
  const tabs = [['all', 'Wszystkie'], ['fav', 'Ulubione'], ['trending', 'Trendy z TikToka'], ['mine', 'Moje'], ['ai', 'Wybrane przez AI']];
  $('#view').innerHTML = `
  <div class="head"><div><h1>Muzyka</h1><p>Ulubione utwory agent kładzie pod lektora (cicho, przycięte do długości filmu). Bez ulubionych film idzie bez muzyki.</p></div>
    <div class="actions"><label class="btn" style="cursor:pointer">Wgraj plik audio<input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac" data-act-change="music-file" class="sr"></label></div></div>
  <div class="grid2" style="margin-bottom:18px">
    <section class="panel"><h2>Dodaj z linku</h2>
      <form data-form="music-link" novalidate>${field('Link do utworu', inp('url', '', 'type="url" placeholder="TikTok, YouTube, SoundCloud albo plik .mp3"'), st.ytdlp ? 'Pobierzemy samo audio (do 60 MB).' : 'Na serwerze brakuje yt-dlp, działa tylko bezpośredni link do pliku.')}
      <div class="err-inline" data-err></div><button class="btn ghost" type="submit">Dodaj utwór</button></form>
    </section>
    <section class="panel"><h2>Trendy i kurator AI</h2>
      <p style="margin-top:0;font-size:14px;color:var(--slate)">${st.last_refresh ? `Ostatnie trendy: ${esc(fmtSlot(st.last_refresh))}. ` : ''}${st.last_ai ? `Kurator AI: ${esc(fmtSlot(st.last_ai))}.` : ''}${st.last_error ? `<br><span style="color:var(--bad)">Ostatni błąd: ${esc(st.last_error)}</span>` : ''}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm ghost" data-act="music-trends" ${st.apify ? '' : 'disabled'}>Pobierz trendy z TikToka</button>
        <button class="btn sm ghost" data-act="music-ai" ${st.ai ? '' : 'disabled'}>Kurator AI: wybierz ulubione</button></div>
      ${st.apify ? '' : '<small style="color:var(--slate)">Trendy wymagają klucza APIFY_API_TOKEN na serwerze.</small>'}
      <details class="more" style="margin-top:12px"><summary>Automatycznie co rano</summary>
        <form data-form="music-settings" novalidate>
          <label class="check"><input type="checkbox" name="auto_trending" ${st.auto_trending ? 'checked' : ''} ${st.apify ? '' : 'disabled'}> <span>Pobieraj trendy z TikToka codziennie</span></label>
          <label class="check"><input type="checkbox" name="auto_ai" ${st.auto_ai ? 'checked' : ''}> <span>Kurator AI codziennie dobiera ulubione</span></label>
          <div class="fgrid">${field('Hashtagi trendów', inp('hashtags', st.hashtags, 'maxlength="200"'))}${field('Ile dźwięków', `<input class="i" name="limit" type="number" min="5" max="50" value="${st.limit}">`)}</div>
          <div class="err-inline" data-err></div><button class="btn sm" type="submit">Zapisz</button></form></details>
    </section>
  </div>
  <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="mtab" data-arg="${k}">${l}</button>`).join('')}</div>
  <section class="panel"><div class="rows">${r.music.map(m => `<div class="rowi">
      <button class="btn sm ${m.favorite ? 'cyan' : 'ghost'}" data-act="music-fav" data-id="${m.id}" data-on="${m.favorite ? 1 : 0}" aria-pressed="${Boolean(m.favorite)}" title="${m.favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}">${m.favorite ? 'Ulubiony' : 'Do ulubionych'}</button>
      <div class="main"><b>${esc(m.title)}</b><small>${esc([m.author, fmtSec(m.duration), m.mood].filter(Boolean).join(' · '))}
        ${m.trend_rank ? ` <span class="pill planned">trend #${m.trend_rank}, ${m.trend_uses} filmów</span>` : ''}${m.source === 'trending' ? ` <span class="pill">${m.original ? 'original sound' : 'piosenka, prawa autorskie'}</span>` : ''}${m.added_by === 'ai' ? ' <span class="pill posted">AI</span>' : ''}</small>
        ${m.note ? `<small style="display:block">${esc(m.note)}</small>` : ''}</div>
      ${m.has_file ? `<audio controls preload="none" src="/api/music/${m.id}/file" style="height:34px;max-width:260px"></audio>` : ''}
      <div class="acts"><button class="btn sm danger" data-act="music-del" data-id="${m.id}">Usuń</button></div></div>`).join('')
    || `<div class="empty">Brak utworów w tym widoku. Wgraj plik, dodaj link${st.apify ? ' albo pobierz trendy z TikToka' : ''}.</div>`}</div></section>`;
}

// ---- inspiration: TikToks that work, broken down and remixed --------------------------------------------------
let inspirePoll = null;
async function viewInspire() {
  const tab = S.itab || 'all';
  const r = await api('GET', `/api/inspire?filter=${tab}`);
  const tabs = [['all', 'Wszystkie'], ['ready', 'Przeanalizowane'], ['work', 'W trakcie i błędy']];
  $('#view').innerHTML = `
  <div class="head"><div><h1>Inspiracje</h1><p>Znajdź TikToki, które działają w Twojej niszy, rozbierz je na części (hook, montaż, psychologia) i zrób remiks na swój temat.</p></div></div>
  ${r.apify ? '' : '<div class="empty" style="margin-bottom:18px">Wyszukiwanie TikToków wymaga klucza APIFY_API_TOKEN na serwerze. Administrator musi go dodać.</div>'}
  <section class="panel" style="margin-bottom:18px"><form data-form="inspire-search" novalidate><div class="fgrid">
    ${field('Temat albo fraza', inp('query', S.iquery || '', 'required maxlength="120" placeholder="np. jak się uczyć do egzaminu" ' + (r.apify ? '' : 'disabled')), '', 'full')}
    ${field('Sortuj', '<select class="i" name="sort"><option value="LIKES">Najwięcej polubień</option><option value="PLAYS">Najwięcej wyświetleń</option><option value="RELEVANCE">Trafność</option></select>')}
    ${field('Z okresu', '<select class="i" name="date"><option value="LAST_6_MONTHS">Ostatnie 6 miesięcy</option><option value="LAST_3_MONTHS">3 miesiące</option><option value="THIS_MONTH">Ten miesiąc</option><option value="THIS_WEEK">Ten tydzień</option><option value="ALL">Dowolnie</option></select>')}
  </div><div class="err-inline" data-err></div><button class="btn cyan" type="submit" ${r.apify ? '' : 'disabled'}>Szukaj TikToków</button> <small style="color:var(--slate)">Szukanie trwa do 2-3 minut.</small></form></section>
  <section class="panel" style="margin-bottom:18px"><form data-form="inspire-link" novalidate>${field('Albo wklej link do konkretnego TikToka', inp('url', '', 'type="url" placeholder="https://www.tiktok.com/@konto/video/..."'), 'Pobierzemy film i od razu zrobimy analizę. Działa bez wyszukiwarki.')}
    <div class="err-inline" data-err></div><button class="btn ghost" type="submit">Analizuj ten film</button></form></section>
  <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="itab" data-arg="${k}">${l}</button>`).join('')}</div>
  <div class="icards">${r.items.map(inspireCard).join('') || '<div class="empty">Brak filmów. Wyszukaj temat powyżej.</div>'}</div>`;
  clearInterval(inspirePoll);
  if (r.items.some(i => ['downloading', 'analyzing'].includes(i.status))) {
    inspirePoll = setInterval(() => { if (location.pathname === '/app/inspiracje' && !$('#overlay').classList.contains('show')) viewInspire(); else clearInterval(inspirePoll); }, 6000);
  }
}
function inspireCard(i) {
  const working = ['downloading', 'analyzing'].includes(i.status);
  return `<article class="icard">
    <div class="icover">${i.cover ? `<img src="${esc(i.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span>${fmtSec(i.duration)}</span></div>
    <div class="ibody"><b>@${esc(i.author)}</b><small>${fmtN(i.plays)} wyświetleń · ${fmtN(i.likes)} polubień · ${fmtN(i.comments)} kom.</small>
      <p>${esc(String(i.descr || '').slice(0, 140))}</p>
      ${i.status === 'ready' ? '<span class="pill posted">Przeanalizowany</span>' : working ? `<span class="pill planned"><span class="spin sm"></span> ${esc(i.step || 'Analiza')}</span>` : i.status === 'error' ? `<span class="pill late" title="${esc(i.error)}">Błąd: ${esc(String(i.error).slice(0, 60))}</span>` : ''}
      <div class="iacts">
        ${i.status === 'ready' ? `<button class="btn sm" data-act="ins-open" data-id="${i.id}">Analiza i remiks</button>` : `<button class="btn sm cyan" data-act="ins-bd" data-id="${i.id}" ${working ? 'disabled' : ''}>${i.status === 'error' ? 'Analizuj ponownie' : 'Analizuj'}</button>`}
        <a class="btn sm ghost" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">TikTok</a>
        <button class="btn sm danger" data-act="ins-del" data-id="${i.id}">Usuń</button></div></div></article>`;
}
async function inspireModal(id) {
  const { item: i } = await api('GET', `/api/inspire/${id}`);
  openModal(`<h2 id="modal-title">Analiza: @${esc(i.author)}</h2>
    <p class="sub">${fmtN(i.plays)} wyświetleń, ${fmtN(i.likes)} polubień, ${i.shots.length} ujęć. <a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">Otwórz na TikToku</a></p>
    ${i.frames.length ? `<div class="iframes">${i.frames.map(f => `<img src="/api/inspire/${i.id}/frame/${esc(f)}" alt="${esc(f)}" loading="lazy">`).join('')}</div>` : ''}
    <section class="panel" style="margin:12px 0"><h2>Zrób remiks</h2>
      <form data-form="inspire-remix" data-id="${i.id}" novalidate>
        ${field('Nasz temat', inp('topic', '', 'maxlength="200" placeholder="Puste = agent dobierze temat do konta"'))}
        ${field('Hook (opcjonalnie)', inp('hook', '', 'maxlength="300"'))}
        ${channelSelect()}
        <div class="err-inline" data-err></div><button class="btn cyan" type="submit">Dodaj remiks do pomysłów</button>
        <small style="color:var(--slate);display:block;margin-top:6px">Generator dostanie całą analizę i klatki. Kopiuje mechanikę, nie treść.</small></form></section>
    <div class="mdbox">${md(i.breakdown)}</div>
    <details class="more"><summary>Transkrypcja</summary><pre class="code">${esc(i.transcript)}</pre></details>
    <div class="foot"><button class="btn ghost" data-act="close">Zamknij</button></div>`, { wide: true });
}

// ---- agent tab: one instruction runs the whole studio -------------------------------------------------------
const AGENT_EXAMPLES = [
  'Dodaj serię 20 filmów o tym, dlaczego niebo jest niebieskie, i wyrenderuj je wszystkie.',
  'Dodaj do kolejki renderów 3 filmy o tym, dlaczego niebo jest niebieskie (bez startu).',
  'Zrób 1 długi explainer na YouTube (ok. 6 minut) o kolorach nieba i 5 TikToków, które do niego prowadzą.',
  'Zaplanuj wszystkie gotowe filmy po 2 dziennie od jutra, o 12:00 i 18:00.',
  'Co najlepiej działa na moim kanale i jakie 5 tematów zrobić dalej?',
  'Co jest teraz w kolejce renderów i ile to jeszcze potrwa?',
];
async function viewAgent() {
  const r = await api('GET', '/api/agent');
  const msgs = r.messages;
  $('#view').innerHTML = `
  <div class="head"><div><h1>Agent</h1><p>Napisz, co ma się stać, a agent zrobi to w aplikacji: doda tematy, zleci rendery TikToków i długich filmów, zaplanuje publikacje, sprawdzi wyniki. Rendery robią się po kolei w <a href="/app/generator" data-link>kolejce renderów</a>, także w nocy.</p></div>
    <div class="actions">${msgs.length ? '<button class="btn ghost sm" data-act="agent-clear">Nowa rozmowa</button>' : ''}</div></div>
  ${S.me.generator.ready ? '' : `<div class="empty" style="margin-bottom:16px">Generator nie działa na tym serwerze (brak: ${esc(S.me.generator.missing.join(', '))}). Agent doda tematy i zaplanuje publikacje, ale nie wyrenderuje filmów.</div>`}
  <section class="chat" id="chat" aria-live="polite">${msgs.length ? msgs.map(chatMsg).join('') : `<div class="empty"><h3>Od czego zacząć</h3>Kliknij przykład albo napisz własne polecenie.<div class="chips" style="margin-top:12px">${AGENT_EXAMPLES.map(e => `<button type="button" data-act="agent-ex" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div></div>`}</section>
  <form class="chatbox" data-form="agent" novalidate>
    <textarea class="i" id="agent-input" name="message" rows="3" maxlength="4000" placeholder="np. Dodaj serię 20 filmów o tym, dlaczego niebo jest niebieskie, i wyrenderuj" aria-label="Polecenie dla agenta"></textarea>
    <button class="btn cyan" type="submit">Wyślij</button>
  </form>`;
  const c = $('#chat'); c.scrollTop = c.scrollHeight;
  $('#agent-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.target.form.requestSubmit(); });
}
/** Minimal, safe Markdown for agent replies: escape first, then bold, italics, code, headings and lists. */
function md(text) {
  const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = []; let list = null; let table = null;
  const flushTable = () => { if (!table) return; out.push(`<table>${table.map((r, i) => `<tr>${r.map(c => `<${i ? 'td' : 'th'}>${inline(c)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table>`); table = null; };
  for (const raw of esc(text).split('\n')) {
    const line = raw.trimEnd();
    // markdown tables (analysis timelines): | a | b |, separator rows skipped
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (list) { out.push(`</${list}>`); list = null; }
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
      (table = table || []).push(line.trim().slice(1, -1).split('|').map(c => c.trim()));
      continue;
    }
    flushTable();
    const ul = line.match(/^\s*[-*•]\s+(.*)$/), ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      if (!list || list !== tag) { if (list) out.push(`</${list}>`); out.push(`<${tag}>`); list = tag; }
      out.push(`<li>${inline(ul ? ul[1] : ol[2])}</li>`);
      continue;
    }
    if (list) { out.push(`</${list}>`); list = null; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); continue; }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) out.push(`<p class="md-h">${inline(h[1])}</p>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`</${list}>`);
  flushTable();
  return out.join('');
}
function chatMsg(m) {
  const body = m.role === 'user' ? esc(m.content).replace(/\n/g, '<br>') : md(m.content);
  return `<div class="msg-${m.role}"><div class="bubble">${body}${m.actions?.length ? `<ul class="acts-list">${m.actions.map(a => `<li>${esc(a.summary)}</li>`).join('')}</ul>` : ''}</div></div>`;
}

/** POST with a server-sent-events response; onEvent(name, data) for each event. */
async function streamPost(path, body, onEvent) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body) });
  if (r.status === 401) { location.href = '/logowanie?next=' + encodeURIComponent(location.pathname); return; }
  if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `Błąd ${r.status}`); }
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = (block.match(/^event: (.*)$/m) || [])[1], data = (block.match(/^data: (.*)$/m) || [])[1];
      if (ev && data) { try { onEvent(ev, JSON.parse(data)); } catch {} }
    }
  }
}

// ---- onboarding -----------------------------------------------------------------------------------------------
const ONB = { mode: null, step: 0, setup: null, text: '', model: '', result: null, channel: {}, video: null };
const EXAMPLE = `Kanał @nauka.na.luzie, krótkie triki do nauki dla studentów. Publikuję raz dziennie około 18.
Opublikowane:
1. "Robisz notatki źle" - 4100 wyświetleń, średnio 5,2 s, 18% do końca, 120 lajków
2. "Skarpetki w lodówce przed egzaminem" - 38 tys. wyświetleń, 9 s, 41% do końca, hook: Włóż skarpetki do lodówki.
Gotowe, czeka: "Kartka strachu przed egzaminem", chcę go wrzucić w czwartek o 18:00.
Pomysły: przerwa 4 sekundy, kofeina po nauce, mapa myśli w 2 minuty.`;

function stepper(n, total) { return `<div class="stepper" aria-label="Krok ${n} z ${total}">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`; }

// autofocus does nothing on markup inserted after load, so focus it by hand after each step
async function viewOnboarding() { await renderOnboarding(); $('#view [autofocus]')?.focus(); }
async function renderOnboarding() {
  document.title = 'Konfiguracja: TikTok Studio';
  const tryb = new URLSearchParams(location.search).get('tryb');
  if (tryb && !ONB.mode) ONB.mode = tryb === 'ai' ? 'ai' : 'manual';
  const v = $('#view');
  const total = 5;
  if (!ONB.mode) {
    v.innerHTML = `<div class="onb">${stepper(1, total)}<h1>Skonfigurujmy Twój kanał</h1>
    <p class="sub">Za około 3 minuty będziesz mieć pierwszy film w kalendarzu. Wybierz, jak wolisz zacząć.</p>
    <div class="choice">
      <button type="button" data-act="onb-mode" data-arg="ai" ${S.me.ai.ready ? '' : 'disabled aria-disabled="true"'}><h3>Wklej, co masz</h3><p>Opis kanału, listę filmów z wynikami, notatki, pomysły. Asystent AI ułoży z tego kanał, filmy, kolejkę i terminy. Przed zapisem pokażemy podgląd.</p><span class="tag">${S.me.ai.ready ? 'Najszybciej, gdy masz już filmy' : 'Asystent AI jest niedostępny na tym serwerze'}</span></button>
      <button type="button" data-act="onb-mode" data-arg="manual"><h3>Krok po kroku</h3><p>Nazwa kanału, pierwszy film, termin publikacji i maile. Cztery krótkie ekrany.</p><span class="tag">Dobre na start od zera</span></button>
    </div>
    <p style="margin-top:22px"><button class="link" data-act="onb-skip">Pomiń, skonfiguruję później</button></p></div>`;
    return;
  }
  if (ONB.mode === 'ai' && ONB.step === 0) {
    v.innerHTML = `<div class="onb">${stepper(2, total)}<h1>Wklej, co masz</h1>
    <p class="sub">Nie musisz niczego porządkować. Napisz, o czym jest kanał, wklej listę filmów (z wynikami, jeśli masz), terminy i pomysły.</p>
    <form data-form="onb-ai" novalidate>
      <label class="fld"><span class="sr">Twoje dane</span><textarea class="i" name="text" rows="12" maxlength="24000" autofocus placeholder="np. Kanał @nauka.na.luzie o triku do nauki. Filmy: ...">${esc(ONB.text)}</textarea><small><button type="button" class="link" data-act="onb-example">Wstaw przykład</button>, żeby zobaczyć, jak to działa.</small></label>
      <details class="more"><summary>Model AI</summary>${field('Model (OpenRouter)', `<select class="i" name="model">${S.me.ai.models.map(m => `<option value="${esc(m)}" ${m === (ONB.model || S.me.workspace.ai_model || S.me.ai.default) ? 'selected' : ''}>${esc(m)}${m === S.me.ai.default ? ' (domyślny, tani)' : ''}</option>`).join('')}</select>`, 'Domyślny model jest tani i zwykle wystarcza. Inny wybierz, gdy wynik jest słaby.')}</details>
      <div class="err-inline" data-err></div>
      <div class="foot" style="justify-content:flex-start"><button class="btn" type="submit">Przeanalizuj</button><button type="button" class="btn ghost" data-act="onb-back">Wstecz</button></div>
    </form></div>`;
    return;
  }
  if (ONB.mode === 'ai' && ONB.step === 1) return renderPreview(v, total);
  if (ONB.mode === 'manual' && ONB.step === 0) {
    const c = S.me.channels[0] || ONB.channel;
    v.innerHTML = `<div class="onb">${stepper(2, total)}<h1>Twój kanał</h1><p class="sub">Wystarczy nazwa. Opis przyda się później asystentowi i w raportach.</p>
    <form data-form="onb-channel" novalidate>
      ${field('Nazwa kanału', inp('name', c.name, 'required maxlength="80" autofocus placeholder="np. Nauka na luzie"'))}
      ${field('Nazwa na TikToku', inp('handle', c.handle, 'maxlength="60" placeholder="@nazwa (opcjonalnie)"'))}
      ${field('O czym jest kanał', `<textarea class="i" name="niche" rows="3" maxlength="400" placeholder="opcjonalnie, np. krótkie triki do nauki dla studentów">${esc(c.niche || '')}</textarea>`)}
      <div class="err-inline" data-err></div>
      <div class="foot" style="justify-content:flex-start"><button class="btn" type="submit">Dalej</button><button type="button" class="btn ghost" data-act="onb-back">Wstecz</button></div>
    </form></div>`;
    return;
  }
  if (ONB.mode === 'manual' && ONB.step === 1) {
    v.innerHTML = `<div class="onb">${stepper(3, total)}<h1>Pierwszy film</h1><p class="sub">Film, który masz gotowy albo który właśnie robisz. Tytuł wystarczy.</p>
    <form data-form="onb-video" novalidate>
      ${field('Tytuł filmu', inp('title', ONB.video?.title || '', 'required maxlength="200" autofocus placeholder="np. Skarpetki w lodówce przed egzaminem"'))}
      ${field('Hook', inp('hook', ONB.video?.hook || '', 'maxlength="300" placeholder="Pierwsze zdanie filmu (opcjonalnie)"'), 'Analiza porównuje hooki, więc warto go wpisać.')}
      <div class="err-inline" data-err></div>
      <div class="foot" style="justify-content:flex-start"><button class="btn" type="submit">Dalej</button><button type="button" class="btn ghost" data-act="onb-back">Wstecz</button></div>
    </form></div>`;
    return;
  }
  if (ONB.step === 2) {
    const free = S.videos.filter(x => !x.posted);
    const planned = S.schedule.find(s => s.status === 'planned');
    if (planned) { ONB.step = 3; return renderOnboarding(); }
    if (!free.length) {
      v.innerHTML = `<div class="onb">${stepper(3, total)}<h1>Zaplanuj pierwszy film</h1><p class="sub">Nie mamy jeszcze filmu do zaplanowania. Dodaj go teraz.</p>
      <form data-form="onb-schedule" novalidate>${field('Tytuł filmu', inp('new_title', '', 'required maxlength="200" autofocus'))}
      <div class="fgrid">${field('Dzień', inp('date', nextFreeDate(), `type="date" min="${today()}"`))}${field('Godzina', inp('time', '18:00', 'type="time"') + timeChips())}</div>
      <div class="err-inline" data-err></div><div class="foot" style="justify-content:flex-start"><button class="btn" type="submit">Zaplanuj</button><button type="button" class="link" data-act="onb-next">Pomiń</button></div></form></div>`;
      return;
    }
    const pick = free.find(x => x.id === ONB.video?.id) || free[0];
    v.innerHTML = `<div class="onb">${stepper(4, total)}<h1>Kiedy publikujesz?</h1><p class="sub">Wybierz termin dla filmu. W tej godzinie dostaniesz przypomnienie mailem, a rano plan na cały dzień.</p>
    <form data-form="onb-schedule" novalidate>
      ${free.length > 1 ? field('Film', `<select class="i" name="video_id">${free.map(x => `<option value="${x.id}" ${x.id === pick.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select>`) : `<input type="hidden" name="video_id" value="${pick.id}"><p style="font-weight:600;font-size:18px;margin:0 0 14px">${esc(pick.title)}</p>`}
      <div class="fgrid">${field('Dzień', inp('date', nextFreeDate(), `type="date" min="${today()}" autofocus`))}${field('Godzina', inp('time', '18:00', 'type="time"') + timeChips())}</div>
      <p style="font-size:14px;color:var(--slate);margin-top:0">Godziny w strefie ${esc(TZ())}. Zmienisz ją w Ustawieniach.</p>
      <div class="err-inline" data-err></div>
      <div class="foot" style="justify-content:flex-start"><button class="btn" type="submit">Zaplanuj</button><button type="button" class="link" data-act="onb-next">Zrobię to później</button></div>
    </form></div>`;
    return;
  }
  if (ONB.step === 3) {
    const ws = S.me.workspace;
    const hours = Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === ws.digest_hour ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('');
    v.innerHTML = `<div class="onb">${stepper(5, total)}<h1>Raporty mailem</h1><p class="sub">Rano plan na dziś, w godzinie publikacji przypomnienie, raz w tygodniu podsumowanie tego, co wygrywa.</p>
    <form data-form="onb-mail" novalidate>
      ${field('Adres e-mail', inp('mail_to', ws.mail_to || S.me.user?.email, 'type="email" autofocus'))}
      ${field('Plan dnia o godzinie', `<select class="i" name="digest_hour">${hours}</select>`)}
      <label class="check"><input type="checkbox" name="digest_enabled" ${ws.digest_enabled ? 'checked' : ''}> <span>Wysyłaj plan dnia i raport tygodniowy</span></label>
      <label class="check"><input type="checkbox" name="reminders_enabled" ${ws.reminders_enabled ? 'checked' : ''}> <span>Przypominaj w godzinie publikacji</span></label>
      <div class="err-inline" data-err></div>
      <div class="foot" style="justify-content:flex-start"><button class="btn" type="submit">Zapisz i zakończ</button></div>
    </form></div>`;
    return;
  }
  // done
  const next = S.schedule.find(s => s.status === 'planned');
  v.innerHTML = `<div class="onb">${stepper(5, total)}<div class="done-card"><div class="tile-mini" aria-hidden="true"></div><h1>Gotowe</h1>
    <p class="sub" style="margin-bottom:12px">${next ? `"${esc(next.title)}" czeka na publikację: <b>${esc(fmtSlot(next.scheduled_at))}</b>.` : 'Kanał jest skonfigurowany. Zaplanuj film, kiedy będzie gotowy.'}</p>
    ${ONB.result ? `<p style="color:var(--slate)">Zapisano: ${[ONB.result.videos && plural(ONB.result.videos, 'film', 'filmy', 'filmów'), ONB.result.topics && `${plural(ONB.result.topics, 'temat', 'tematy', 'tematów')} w kolejce`, ONB.result.schedule && plural(ONB.result.schedule, 'termin', 'terminy', 'terminów')].filter(Boolean).join(', ') || 'konfigurację kanału'}.</p>` : ''}
    <p style="color:var(--slate)">Co dalej: po publikacji kliknij "Opublikowane" przy filmie, a po dobie wpisz wyniki. Jeśli masz generator wideo, podłącz go w Integracjach.</p>
    <div class="foot" style="justify-content:flex-start"><a class="btn" href="/app" data-link>Przejdź do pulpitu</a><a class="btn ghost" href="/app/kalendarz" data-link>Otwórz kalendarz</a><a class="btn ghost" href="/app/integracje" data-link>Integracje</a></div>
    ${S.me.generator.ready ? `<div class="panel" style="margin-top:20px;background:var(--soft);border:0"><h2>Wygeneruj pierwszy film</h2><p style="margin-top:0;color:var(--slate)">Generator napisze skrypt, nagra lektora, zrobi animację i wyrenderuje MP4 dla Twojego kanału. Trwa to zwykle 20 do 40 minut, możesz w tym czasie zamknąć kartę.</p><button class="btn cyan" data-act="gen-new">Wygeneruj film</button></div>` : ''}</div></div>`;
  await api('POST', '/api/workspace/onboarded').catch(() => {});
}

function renderPreview(v, total) {
  const s = ONB.setup;
  const posted = s.videos.filter(x => x.posted).length;
  v.innerHTML = `<div class="onb" style="max-width:900px">${stepper(3, total)}<h1>Sprawdź, co zrozumiał asystent</h1>
  <p class="sub">${esc(s.summary || 'Oto konfiguracja z Twojego tekstu.')} Popraw, co trzeba, odznacz zbędne, potem zapisz.</p>
  <form data-form="onb-apply" class="preview" novalidate>
    <section class="panel"><h2>Kanał</h2><div class="fgrid">
      ${field('Nazwa', inp('ch_name', s.channel.name || S.me.channels[0]?.name || '', 'maxlength="80" placeholder="Nazwa kanału"'))}${field('Nazwa na TikToku', inp('ch_handle', s.channel.handle, 'maxlength="60"'))}
      ${field('O czym jest kanał', inp('ch_niche', s.channel.niche, 'maxlength="400"'), '', 'full')}</div></section>
    <section class="panel"><h2>Filmy (${s.videos.length}${posted ? `, opublikowane: ${posted}` : ''})</h2>
      ${s.videos.length ? `<div class="tablewrap"><table><thead><tr><th><span class="sr">Zapisz</span></th><th>Tytuł</th><th>Hook</th><th>Wyśw.</th><th>% do końca</th></tr></thead><tbody>
      ${s.videos.map((x, i) => `<tr><td><input type="checkbox" name="v_keep_${i}" checked aria-label="Zapisz film ${i + 1}"></td><td><input type="text" name="v_title_${i}" value="${esc(x.title)}" aria-label="Tytuł"></td><td><input type="text" name="v_hook_${i}" value="${esc(x.hook)}" aria-label="Hook"></td><td>${x.views ? fmtN(x.views) : '-'}</td><td>${x.completion ? x.completion + '%' : '-'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p style="margin:0;color:var(--slate)">Nie znalazłem filmów. Dodasz je później albo wrócisz i dopiszesz.</p>'}</section>
    <div class="grid2">
      <section class="panel"><h2>Kolejka pomysłów (${s.topics.length})</h2>${s.topics.length ? s.topics.map((t, i) => `<label class="check"><input type="checkbox" name="t_keep_${i}" checked> <span>${esc(t.topic)}</span></label>`).join('') : '<p style="margin:0;color:var(--slate)">Brak pomysłów w tekście.</p>'}</section>
      <section class="panel"><h2>Terminy (${s.schedule.length})</h2>${s.schedule.length ? s.schedule.map((x, i) => `<label class="check"><input type="checkbox" name="s_keep_${i}" checked> <span>${esc(x.video_title)}: ${esc(dayLabel(x.date))}, ${esc(x.time)}</span></label>`).join('') : '<p style="margin:0;color:var(--slate)">Brak terminów. Zaplanujesz w następnym kroku.</p>'}</section>
    </div>
    ${s.questions.length ? `<div class="qs"><b>Warto uzupełnić później:</b><ul>${s.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
    <div class="err-inline" data-err></div>
    <div class="foot" style="justify-content:flex-start"><button class="btn" type="submit">Zapisz konfigurację</button><button type="button" class="btn ghost" data-act="onb-back">Popraw tekst</button>
      <span style="color:var(--mute);font-size:13px;align-self:center">Model: ${esc(ONB.usedModel || '')}</span></div>
  </form></div>`;
}

// ---- actions ---------------------------------------------------------------------------------------------------
const vById = (id) => S.videos.find(v => v.id === Number(id));
const sById = (id) => S.schedule.find(s => s.id === Number(id));
const qById = (id) => S.queue.find(q => q.id === Number(id));

const ACT = {
  close: closeModal,
  theme: (el) => { try { localStorage.setItem('tss-theme', el.dataset.arg); } catch {} applyTheme(el.dataset.arg); renderChrome(); },
  'gen-new': (el) => genModal(el.dataset.id && S.queue.some(q => q.id === Number(el.dataset.id)) ? el.dataset.id : null),
  'gen-start': async (el) => busy(el, async () => {
    const r = await api('POST', '/api/jobs/start', el.dataset.id ? { ids: [Number(el.dataset.id)] } : {});
    toast(r.still_held ? `Uruchomiono: ${r.started}. Czeka dalej (limit dzienny ${r.daily_limit}): ${r.still_held}` : `Uruchomiono: ${r.started}`);
    await repaint(); pollJobs();
  }),
  'gen-cancel-queued': async (el) => {
    if (!(await ask('Usunąć z kolejki wszystkie filmy, które się jeszcze nie renderują? Ten w trakcie renderu zostanie.'))) return;
    await busy(el, async () => { const r = await api('POST', '/api/jobs/cancel-queued'); toast(`Zatrzymano: ${r.canceled}`); await repaint(); });
  },
  'agent-ex': (el) => { const t = $('#agent-input'); t.value = el.dataset.v; t.focus(); },
  'agent-clear': async () => { if (!(await ask('Zacząć nową rozmowę? Obecna zniknie, zlecone filmy zostaną.', { ok: 'Nowa rozmowa', danger: false }))) return; await api('DELETE', '/api/agent'); viewAgent(); },
  'gen-open': (el) => jobModal(Number(el.dataset.id)),
  'gen-cancel': async (el) => {
    if (!(await ask('Usunąć ten film z kolejki renderów? Jeśli się renderuje, postęp przepadnie.'))) return;
    await busy(el, async () => { await api('POST', `/api/jobs/${el.dataset.id}/cancel`); toast('Generowanie zatrzymane'); });
  },
  play: (el) => { const v = vById(el.dataset.id); if (v) playModal(v); else go('/app/filmy'); },
  go: (el) => go(el.dataset.arg),
  logout: async () => { await api('POST', '/api/auth/logout'); location.href = '/'; },
  'add-video': () => videoModal(),
  'edit-video': (el) => videoModal(vById(el.dataset.id)),
  'del-video': async (el) => {
    const v = vById(el.dataset.id);
    if (!(await ask(`Usunąć film "${v.title}" razem z terminami i wynikami? Tego nie da się cofnąć.`))) return;
    await busy(el, async () => { await api('DELETE', `/api/videos/${v.id}`); toast('Film usunięty'); await repaint(); });
  },
  stats: (el) => statsModal(vById(el.dataset.id)),
  schedule: (el) => scheduleModal({ videoId: el.dataset.id }),
  day: (el) => scheduleModal({ date: el.dataset.arg }),
  slot: (el) => slotModal(sById(el.dataset.id)),
  'slot-posted': (el) => slotStatus(el, 'posted', 'Oznaczono jako opublikowane. Po dobie wpisz wyniki.'),
  'slot-skip': (el) => slotStatus(el, 'skipped', 'Publikacja pominięta'),
  'slot-replan': (el) => slotStatus(el, 'planned', 'Przywrócono do planu'),
  'slot-delete': async (el) => {
    if (!(await ask('Usunąć ten termin z kalendarza? Film zostanie w Studio.'))) return;
    await busy(el, async () => { await api('DELETE', `/api/schedule/${el.dataset.id}`); closeModal(); toast('Termin usunięty'); await repaint(); });
  },
  chip: (el) => {
    const box = el.closest('[data-chips]');
    const input = el.closest('form').querySelector(`[name="${box.dataset.chips}"]`);
    input.value = el.dataset.v;
    $$('button', box).forEach(b => b.classList.toggle('on', b === el));
  },
  vtab: (el) => { S.vtab = el.dataset.arg; history.replaceState({}, '', `/app/filmy?tab=${el.dataset.arg}`); viewVideos(); },
  month: (el) => {
    const d = Number(el.dataset.arg);
    if (!d) S.month = today().slice(0, 7);
    else { const [y, m] = S.month.split('-').map(Number); const n = new Date(Date.UTC(y, m - 1 + d, 1)); S.month = n.toISOString().slice(0, 7); }
    viewCalendar();
  },
  qmove: async (el) => {
    const q = qById(el.dataset.id);
    const i = QCOLS.findIndex(c => c[0] === q.status) + Number(el.dataset.arg);
    await busy(el, async () => { await api('PUT', `/api/queue/${q.id}`, { status: QCOLS[i][0] }); q.status = QCOLS[i][0]; viewQueue(); renderChrome(); });
  },
  qdel: async (el) => {
    const q = qById(el.dataset.id);
    if (!(await ask(`Usunąć temat "${q.topic}"?`))) return;
    await busy(el, async () => { await api('DELETE', `/api/queue/${q.id}`); await repaint(); });
  },
  qedit: (el) => {
    const q = qById(el.dataset.id);
    openModal(`<h2 id="modal-title">Edytuj temat</h2><form data-form="topic" data-id="${q.id}" novalidate>
      ${field('Temat', inp('topic', q.topic, 'required maxlength="200" autofocus'))}${field('Hook', inp('hook', q.hook, 'maxlength="300"'))}
      ${field('Notatki', `<textarea class="i" name="notes" maxlength="2000">${esc(q.notes)}</textarea>`)}
      ${field('Priorytet', `<select class="i" name="priority"><option value="1" ${q.priority === 1 ? 'selected' : ''}>Pilne</option><option value="2" ${q.priority === 2 ? 'selected' : ''}>Normalny</option><option value="3" ${q.priority === 3 ? 'selected' : ''}>Kiedyś</option></select>`)}
      <div class="err-inline" data-err></div><div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn" type="submit">Zapisz</button></div></form>`);
  },
  qvideo: (el) => {
    const q = qById(el.dataset.id);
    openModal(`<h2 id="modal-title">Zrób film z tematu</h2><p class="sub">Temat trafi do Gotowe, a film do zakładki Filmy.</p><form data-form="to-video" data-id="${q.id}" novalidate>
      ${field('Tytuł filmu', inp('title', cap(q.topic), 'required maxlength="200" autofocus'))}
      <label class="check"><input type="checkbox" name="plan" checked> <span>Zaplanuj publikację</span></label>
      <div class="fgrid" data-plan>${field('Dzień', inp('date', nextFreeDate(), `type="date" min="${today()}"`))}${field('Godzina', inp('time', '18:00', 'type="time"') + timeChips())}</div>
      <div class="err-inline" data-err></div><div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn" type="submit">Utwórz film</button></div></form>`);
  },
  apikey: async (el) => {
    if (S.me.workspace.has_api_key && !(await ask('Nowy klucz unieważni obecny. Narzędzia ze starym kluczem przestaną działać. Kontynuować?', { ok: 'Wygeneruj nowy', danger: false }))) return;
    await busy(el, async () => {
      const { api_key } = await api('POST', '/api/workspace/api-key');
      await loadMe();
      openModal(`<h2 id="modal-title">Twój klucz API</h2><p class="sub">Skopiuj go teraz. Ze względów bezpieczeństwa nie pokażemy go ponownie.</p>
        <div class="keybox"><code id="the-key">${esc(api_key)}</code><button class="btn sm" data-act="copy" data-arg="${esc(api_key)}">Kopiuj</button></div>
        <p style="font-size:14px;color:var(--slate)">Sprawdź go od razu: ta komenda doda testowy film (usuniesz go w zakładce Filmy).</p>
        <pre class="code" style="font-size:12.5px">curl -X POST ${esc(location.origin)}/api/videos \\
  -H "Authorization: Bearer ${esc(api_key)}" \\
  -H "Content-Type: application/json" \\
  -d '{"ref":"test-api","title":"Test integracji"}'</pre>
        <div class="foot"><button class="btn" data-act="close-refresh">Skopiowałem, zamknij</button></div>`);
    });
  },
  copy: async (el) => { try { await navigator.clipboard.writeText(el.dataset.arg); toast('Skopiowano'); } catch { toast('Zaznacz i skopiuj ręcznie', true); } },
  'close-refresh': () => { closeModal(); repaint(); },
  mail: async (el) => busy(el, async () => {
    const r = await api('POST', `/api/mail/${el.dataset.arg}`);
    toast(r.dry ? `Tryb testowy: mail do ${r.to} zapisany w logu serwera, nie wysłany.` : `Wysłano na ${r.to}`);
  }),
  'edit-channel': (el) => channelModal(S.me.channels.find(c => c.id === Number(el.dataset.id))),
  'sub-edit': async (el) => subskillModal(el.dataset.id ? (S.subskills || await loadSubskills()).find(x => x.id === Number(el.dataset.id)) : null),
  'sub-del': async (el) => { if (!(await ask('Usunąć ten dodatek do generatora?'))) return; await busy(el, async () => { await api('DELETE', `/api/subskills/${el.dataset.id}`); toast('Usunięto'); await repaint(); }); },
  mtab: (el) => { S.mtab = el.dataset.arg; viewMusic(); },
  'music-fav': (el) => busy(el, async () => { await api('PUT', `/api/music/${el.dataset.id}`, { favorite: el.dataset.on !== '1' }); await viewMusic(); }),
  'music-del': async (el) => { if (!(await ask('Usunąć ten utwór z biblioteki?'))) return; await busy(el, async () => { await api('DELETE', `/api/music/${el.dataset.id}`); toast('Usunięto'); await viewMusic(); }); },
  'music-trends': (el) => busy(el, async () => { toast('Pobieram trendy z TikToka, to potrwa do kilku minut'); const r = await api('POST', '/api/music/trending/refresh'); toast(`Trendy: ${r.top} dźwięków, nowych ${r.added}`); await viewMusic(); }),
  'music-ai': (el) => busy(el, async () => { const r = await api('POST', '/api/music/ai-curate'); toast(r.picked.length ? `Kurator AI dodał do ulubionych: ${r.picked.length}` : 'Kurator AI nie znalazł nic nowego'); await viewMusic(); }),
  itab: (el) => { S.itab = el.dataset.arg; viewInspire(); },
  'ins-bd': (el) => busy(el, async () => { await api('POST', `/api/inspire/${el.dataset.id}/breakdown`); toast('Analiza ruszyła: pobieram film, klatki i transkrypcję'); await viewInspire(); }),
  'ins-open': (el) => busy(el, () => inspireModal(el.dataset.id)),
  'ins-del': async (el) => { if (!(await ask('Usunąć ten film z biblioteki inspiracji?'))) return; await busy(el, async () => { await api('DELETE', `/api/inspire/${el.dataset.id}`); toast('Usunięto'); await viewInspire(); }); },
  'del-channel': async (el) => {
    const c = S.me.channels.find(x => x.id === Number(el.dataset.id));
    if (!(await ask(`Usunąć kanał "${c.name}"? Jego filmy zostaną w Studio bez przypisanego kanału.`))) return;
    await busy(el, async () => { await api('DELETE', `/api/channels/${c.id}`); toast('Kanał usunięty'); await repaint(); });
  },
  'delete-account': () => openModal(`<h2 id="modal-title">Usuń konto</h2><p class="sub">Usuniemy konto, wszystkie kanały, filmy, terminy i wyniki. Tego nie da się cofnąć.</p>
    <form data-form="delete-account" novalidate>${field('Wpisz hasło, aby potwierdzić', '<input class="i" name="password" type="password" autocomplete="current-password" autofocus>')}
    <div class="err-inline" data-err></div><div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn danger" type="submit">Usuń konto na zawsze</button></div></form>`),
  'onb-mode': (el) => { ONB.mode = el.dataset.arg; ONB.step = 0; viewOnboarding(); },
  'onb-back': () => {
    if (ONB.step > 0 && !(ONB.mode === 'ai' && ONB.step >= 2)) ONB.step--; else ONB.mode = null;
    history.replaceState({}, '', '/app/start'); viewOnboarding();
  },
  'onb-next': () => { ONB.step++; viewOnboarding(); },
  'onb-skip': async () => { await api('POST', '/api/workspace/onboarded'); go('/app'); },
  'onb-example': () => { const t = $('textarea[name=text]'); t.value = EXAMPLE; t.focus(); },
};

async function slotStatus(el, status, msg) {
  await busy(el, async () => { await api('PUT', `/api/schedule/${el.dataset.id}`, { status }); closeModal(); toast(msg); await repaint(); });
}

// ---- forms -----------------------------------------------------------------------------------------------------
const formData = (f) => {
  const o = {};
  for (const el of f.elements) {
    if (!el.name) continue;
    o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  }
  return o;
};
const req = (f, name, msg) => {
  const el = f.querySelector(`[name="${name}"]`);
  if (el && !el.value.trim()) { el.focus(); throw new Error(msg); }
};
// accepts what TikTok shows: "12,5 tys.", "1.2K", "3 mln", "12 500", "31%", "6,4 s"
function humanNum(v) {
  if (v === '' || v == null) return undefined;
  let t = String(v).toLowerCase().replace(/\s|\u00a0/g, '').replace(/%$|s$|sek\.?$/, '');
  let mult = 1;
  const m = t.match(/(tys\.?|k|mln\.?|m)$/);
  if (m) { mult = m[1].startsWith('t') || m[1] === 'k' ? 1e3 : 1e6; t = t.slice(0, -m[1].length); }
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? String(Math.round(Number(t) * mult * 100) / 100) : NaN;
}

const FORMS = {
  async agent(f, d) {
    if (!d.message) { f.message.focus(); throw new Error('Napisz polecenie.'); }
    const c = $('#chat');
    if (c.querySelector('.empty')) c.innerHTML = '';
    c.insertAdjacentHTML('beforeend', chatMsg({ role: 'user', content: d.message }) +
      '<div class="msg-assistant" id="agent-live"><div class="bubble"><div class="live-text"></div><ul class="acts-list live-acts" hidden></ul><p class="live-status"><span class="spin small"></span> Myślę...</p></div></div>');
    c.scrollTop = c.scrollHeight;
    f.message.value = '';
    const box = $('#agent-live'), textEl = box.querySelector('.live-text'), acts = box.querySelector('.live-acts'), status = box.querySelector('.live-status');
    let text = '', failed = '';
    await streamPost('/api/agent', { message: d.message }, (ev, data) => {
      if (ev === 'text') { text += data.delta; textEl.innerHTML = md(text); status.hidden = true; }
      else if (ev === 'action_start') { status.hidden = false; status.innerHTML = `<span class="spin small"></span> ${esc(data.label)}...`; }
      else if (ev === 'action') { acts.hidden = false; acts.insertAdjacentHTML('beforeend', `<li>${esc(data.summary)}</li>`); status.innerHTML = '<span class="spin small"></span> Myślę...'; }
      else if (ev === 'error') failed = data.message;
      else if (ev === 'done') status.hidden = true;
      c.scrollTop = c.scrollHeight;
    });
    if (failed) throw new Error(failed);
    await loadData(); renderChrome(); await viewAgent();
    if (S.jobs.some(j => ['queued', 'running'].includes(j.status))) pollJobs();
  },
  async gen(f, d) {
    req(f, 'topic', 'Wpisz temat filmu.');
    let attachment_id;
    const file = f.pdf?.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) throw new Error('PDF jest za duży (max 20 MB).');
      const up = await fetch(`/api/uploads?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-Requested-With': 'fetch' }, body: file });
      const uj = await up.json().catch(() => ({}));
      if (!up.ok || !uj.ok) throw new Error(uj.error || 'Nie udało się wgrać PDF.');
      if (!uj.upload.text_chars) toast('PDF nie ma warstwy tekstowej (skan). Generator spróbuje go odczytać sam.', true);
      attachment_id = uj.upload.id;
    }
    const r = await api('POST', '/api/generate', { attachment_id, topic: d.topic, hook: d.hook, notes: d.notes, model: d.model,
      length_sec: Number(d.length_sec) || undefined, voice: d.voice, script: d.script, format: d.format, start: d.start,
      style: f.querySelector('input[name=style]:checked')?.value || undefined, broll: Boolean(f.broll?.checked), research: Boolean(f.research?.checked),
      subskills: $$('input[name=subskill]:checked', f).map(x => Number(x.value)),
      queue_id: f.dataset.queue ? Number(f.dataset.queue) : undefined, channel_id: d.channel_id || S.channel || undefined });
    await loadData(); renderChrome();
    if (d.start) { toast('Generator przyjął zadanie'); jobModal(r.job_id); pollJobs(); }
    else { closeModal(); toast('Dodano do kolejki renderów, czeka na start'); go('/app/generator'); }
  },
  async video(f, d) {
    req(f, 'title', 'Wpisz tytuł filmu.');
    const body = { title: d.title, hook: d.hook, topic: d.topic, category: d.category, visual: d.visual, voice: d.voice, pace: d.pace, cta: d.cta, caption: d.caption, pin: d.pin, url: d.url, file_url: d.file_url };
    if (d.channel_id) body.channel_id = d.channel_id; else if (!f.dataset.id && S.channel) body.channel_id = S.channel;
    if (f.dataset.id) { await api('PUT', `/api/videos/${f.dataset.id}`, body); toast('Zapisano zmiany'); }
    else {
      if (d.plan) { if (!d.date) throw new Error('Wybierz dzień publikacji albo odznacz planowanie.'); body.schedule_date = d.date; body.schedule_time = d.time || '18:00'; }
      const r = await api('POST', '/api/videos', body);
      toast(r.video.next_slot ? `Dodano i zaplanowano: ${fmtSlot(r.video.next_slot)}` : 'Film dodany');
    }
    closeModal(); await repaint();
  },
  async 'music-link'(f, d) {
    if (!d.url) { f.url.focus(); throw new Error('Wklej link.'); }
    toast('Pobieram audio, to może potrwać minutę');
    await api('POST', '/api/music/link', { url: d.url });
    toast('Utwór dodany do ulubionych'); await viewMusic();
  },
  async 'music-settings'(f, d) {
    await api('PUT', '/api/music/settings', { auto_trending: Boolean(f.auto_trending.checked), auto_ai: Boolean(f.auto_ai.checked), hashtags: d.hashtags, limit: Number(d.limit) });
    toast('Zapisano');
  },
  async 'inspire-search'(f, d) {
    req(f, 'query', 'Wpisz temat.');
    S.iquery = d.query;
    const r = await api('POST', '/api/inspire/search', { query: d.query, sort: d.sort, date: d.date });
    toast(r.items.length ? `Znaleziono ${r.items.length} filmów` : 'Nic nie znaleziono, spróbuj innej frazy');
    S.itab = 'all'; await viewInspire();
  },
  async 'inspire-link'(f, d) {
    if (!d.url) { f.url.focus(); throw new Error('Wklej link do TikToka.'); }
    await api('POST', '/api/inspire/link', { url: d.url });
    toast('Film dodany, analiza ruszyła'); S.itab = 'all'; await viewInspire();
  },
  async 'inspire-remix'(f, d) {
    const r = await api('POST', `/api/inspire/${f.dataset.id}/remix`, { topic: d.topic, hook: d.hook, channel_id: d.channel_id || S.channel || undefined });
    closeModal(); toast('Remiks dodany do pomysłów'); await loadData(); renderChrome();
    return r;
  },
  async subskill(f, d) {
    req(f, 'name', 'Podaj nazwę dodatku.');
    const body = { name: d.name, body: d.body, default_on: Boolean(f.default_on.checked), enabled: Boolean(f.enabled.checked) };
    if (f.dataset.id) await api('PUT', `/api/subskills/${f.dataset.id}`, body); else await api('POST', '/api/subskills', body);
    closeModal(); toast('Dodatek zapisany'); await repaint();
  },
  async stats(f, d) {
    const body = { posted: 1, publish_date: d.publish_date, notes: d.notes };
    const PCT = ['completion', 'src_fyp', 'src_profile', 'src_following', 'src_search', 'src_sound', 'new_viewers', 'returning_viewers'];
    for (const k of ['views', 'avg_watch', 'completion', 'likes', 'comments', 'shares', 'saves', 'followers', 'total_watch_time', 'reached', 'profile_views', ...PCT.slice(1)]) {
      const val = humanNum(d[k]);
      if (val !== undefined) {
        if (Number.isNaN(val)) { f.querySelector(`[name=${k}]`).focus(); throw new Error('Nie rozpoznaję tej liczby. Wpisz np. 12500, 12,5 tys. albo 6,4.'); }
        if (PCT.includes(k) && Number(val) > 100) { f.querySelector(`[name=${k}]`).focus(); throw new Error('Procent nie może przekroczyć 100.'); }
        body[k] = val;
      }
    }
    if (d.retention_curve !== undefined) body.retention_curve = d.retention_curve;
    await api('PUT', `/api/videos/${f.dataset.id}/stats`, body);
    closeModal(); toast('Wyniki zapisane'); await repaint();
  },
  async schedule(f, d) {
    if (!d.date) throw new Error('Wybierz dzień.');
    if (d.video_id && d.video_id !== 'new') {
      await api('POST', '/api/schedule', { video_id: Number(d.video_id), date: d.date, time: d.time, caption: d.caption });
    } else {
      req(f, 'new_title', 'Wpisz tytuł nowego filmu.');
      await api('POST', '/api/videos', { title: d.new_title, caption: d.caption, schedule_date: d.date, schedule_time: d.time, channel_id: S.channel || undefined });
    }
    closeModal(); toast(`Zaplanowano: ${dayLabel(d.date)}, ${d.time || '18:00'}`); await repaint();
  },
  async slot(f, d) {
    if (!d.date) throw new Error('Wybierz dzień.');
    await api('PUT', `/api/schedule/${f.dataset.id}`, { date: d.date, time: d.time, caption: d.caption });
    closeModal(); toast('Zapisano termin'); await repaint();
  },
  async 'add-topic'(f, d) {
    req(f, 'topic', 'Wpisz temat.');
    await api('POST', '/api/queue', { topic: d.topic, hook: d.hook, channel_id: S.channel || undefined });
    toast('Temat dodany'); await repaint(); $('input[name=topic]')?.focus();
  },
  async topic(f, d) {
    req(f, 'topic', 'Temat nie może być pusty.');
    await api('PUT', `/api/queue/${f.dataset.id}`, { topic: d.topic, hook: d.hook, notes: d.notes, priority: Number(d.priority) });
    closeModal(); toast('Zapisano'); await repaint();
  },
  async 'to-video'(f, d) {
    req(f, 'title', 'Wpisz tytuł filmu.');
    const r = await api('POST', `/api/queue/${f.dataset.id}/to-video`, { title: d.title, date: d.plan ? d.date : undefined, time: d.time });
    closeModal(); toast(r.video.next_slot ? `Film utworzony i zaplanowany: ${fmtSlot(r.video.next_slot)}` : 'Film utworzony'); await repaint();
  },
  async ws(f, d) {
    await api('PUT', '/api/workspace', { mail_to: d.mail_to, digest_enabled: d.digest_enabled, digest_hour: Number(d.digest_hour), weekly_day: Number(d.weekly_day),
      reminders_enabled: d.reminders_enabled, cadence_per_day: Number(d.cadence_per_day), timezone: d.timezone, name: d.name, ...(d.ai_model ? { ai_model: d.ai_model } : {}) });
    toast('Ustawienia zapisane'); await repaint();
  },
  async channel(f, d) {
    req(f, 'name', 'Podaj nazwę kanału.');
    if (f.dataset.id) await api('PUT', `/api/channels/${f.dataset.id}`, d); else await api('POST', '/api/channels', d);
    closeModal(); toast('Konto zapisane'); await repaint();
  },
  async password(f, d) {
    if (!d.current) { f.current.focus(); throw new Error('Wpisz obecne hasło.'); }
    if ((d.password || '').length < 8) { f.password.focus(); throw new Error('Nowe hasło musi mieć co najmniej 8 znaków.'); }
    await api('PUT', '/api/me/password', { current: d.current, password: d.password });
    f.reset(); toast('Hasło zmienione');
  },
  async 'delete-account'(f, d) {
    if (!d.password) throw new Error('Wpisz hasło.');
    await api('DELETE', '/api/me', { password: d.password });
    location.href = '/';
  },
  async 'onb-ai'(f, d) {
    ONB.text = d.text; ONB.model = d.model;
    if ((d.text || '').length < 20) { f.text.focus(); throw new Error('Wklej trochę więcej, np. opis kanału i kilka filmów. Możesz też kliknąć "Wstaw przykład".'); }
    const btn = f.querySelector('button[type=submit]');
    const note = document.createElement('div'); note.className = 'loading'; note.innerHTML = '<span class="spin"></span>Asystent czyta Twój tekst. Zwykle trwa to 5 do 20 sekund.';
    btn.parentElement.after(note);
    try {
      const r = await api('POST', '/api/setup/ai', { text: d.text, model: d.model });
      ONB.setup = r.setup; ONB.usedModel = r.model; ONB.step = 1; viewOnboarding();
    } finally { note.remove(); }
  },
  async 'onb-apply'(f, d) {
    const s = ONB.setup;
    const setup = {
      channel: { ...s.channel, name: d.ch_name, handle: d.ch_handle, niche: d.ch_niche },
      videos: s.videos.map((x, i) => ({ ...x, title: d[`v_title_${i}`], hook: d[`v_hook_${i}`] })).filter((x, i) => d[`v_keep_${i}`] && x.title),
      topics: s.topics.filter((_, i) => d[`t_keep_${i}`]), schedule: s.schedule.filter((_, i) => d[`s_keep_${i}`]), settings: s.settings,
    };
    if (!setup.channel.name && !S.me.channels.length) { f.ch_name.focus(); throw new Error('Podaj nazwę kanału.'); }
    const r = await api('POST', '/api/setup/apply', { setup, source: 'ai' });
    ONB.result = r.counts; ONB.step = 2; await loadMe(); await loadData(); renderChrome(); viewOnboarding();
  },
  async 'onb-channel'(f, d) {
    req(f, 'name', 'Podaj nazwę kanału. Może być robocza.');
    ONB.channel = d;
    if (S.me.channels[0]) await api('PUT', `/api/channels/${S.me.channels[0].id}`, d); else await api('POST', '/api/channels', d);
    await loadMe(); ONB.step = 1; viewOnboarding();
  },
  async 'onb-video'(f, d) {
    req(f, 'title', 'Wpisz tytuł filmu. Może być roboczy.');
    const r = ONB.video?.id ? await api('PUT', `/api/videos/${ONB.video.id}`, d) : await api('POST', '/api/videos', d);
    ONB.video = r.video; await loadData(); ONB.step = 2; viewOnboarding();
  },
  async 'onb-schedule'(f, d) {
    if (!d.date) throw new Error('Wybierz dzień.');
    if (d.video_id) await api('POST', '/api/schedule', { video_id: Number(d.video_id), date: d.date, time: d.time });
    else { req(f, 'new_title', 'Wpisz tytuł filmu.'); await api('POST', '/api/videos', { title: d.new_title, schedule_date: d.date, schedule_time: d.time }); }
    await loadData(); ONB.step = 3; viewOnboarding();
  },
  async 'onb-mail'(f, d) {
    if (d.mail_to && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.mail_to)) { f.mail_to.focus(); throw new Error('Podaj poprawny e-mail.'); }
    await api('PUT', '/api/workspace', { mail_to: d.mail_to, digest_hour: Number(d.digest_hour), digest_enabled: d.digest_enabled, reminders_enabled: d.reminders_enabled });
    await loadMe(); ONB.step = 4; viewOnboarding();
  },
};

// ---- wiring -----------------------------------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (link && !e.metaKey && !e.ctrlKey && link.target !== '_blank') {
    e.preventDefault(); closeModal();
    if (link.getAttribute('href') === '/app/start?tryb=ai') { ONB.mode = 'ai'; ONB.step = 0; }
    return go(link.getAttribute('href'));
  }
  const a = e.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) {
    if (a.classList.contains('ev')) e.stopPropagation();
    e.preventDefault();
    Promise.resolve(ACT[a.dataset.act](a, e)).catch(err => toast(err.message, true));
  }
  if (e.target.id === 'overlay') closeModal();
  // mobile drawer: a tap outside it closes it
  if ($('#side').classList.contains('open') && !e.target.closest('#side, #menu-btn')) { $('#side').classList.remove('open'); $('#menu-btn').setAttribute('aria-expanded', 'false'); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#overlay').classList.contains('show')) closeModal();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const errBox = f.querySelector('[data-err]');
  if (errBox) errBox.textContent = '';
  const btn = f.querySelector('button[type=submit]');
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Chwileczkę...'; }
  try { await FORMS[f.dataset.form](f, formData(f)); }
  catch (err) { if (errBox) errBox.textContent = err.message; else toast(err.message, true); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'ch-switch') {
    S.channel = e.target.value;
    try { localStorage.setItem('tss-channel', S.channel); } catch {}
    return repaint();
  }
  if (e.target.name === 'style' && e.target.closest('.stylepick')) { lsSet('tss-style', e.target.value); pickStyle(e.target.value); return; }
  if (e.target.name === 'broll' && e.target.closest('form[data-form=gen]')) lsSet('tss-broll', e.target.checked ? '1' : '0');
  if (e.target.name === 'research' && e.target.closest('form[data-form=gen]')) lsSet('tss-research', e.target.checked ? '1' : '0');
  if (e.target.name === 'format' && e.target.closest('form[data-form=gen]')) {
    const wide = e.target.value === 'long_wide';
    $$('.sp-card[data-vonly]').forEach(c => { c.classList.toggle('off', wide); c.querySelector('input').disabled = wide; });
    if (wide && $('.sp-card.on[data-vonly]')) pickStyle('');
  }
  if (e.target.name === 'plan') { const box = e.target.closest('form').querySelector('[data-plan]'); if (box) box.hidden = !e.target.checked; }
  if (e.target.name === 'video_id' && e.target.closest('form[data-form=schedule]')) {
    const nt = e.target.closest('form').querySelector('[data-newtitle]');
    if (nt) { nt.hidden = e.target.value !== 'new'; if (!nt.hidden) nt.querySelector('input').focus(); }
  }
  if (e.target.matches('input[type=time]')) $$('[data-chips] button', e.target.closest('form')).forEach(b => b.classList.toggle('on', b.dataset.v === e.target.value));
  if (e.target.dataset.actChange === 'music-file') {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) return toast('Plik jest za duży (max 40 MB).', true);
    try {
      toast('Wgrywam utwór');
      const up = await fetch(`/api/music/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Requested-With': 'fetch' }, body: file });
      const j = await up.json().catch(() => ({}));
      if (!up.ok || !j.ok) throw new Error(j.error || 'Nie udało się wgrać pliku.');
      toast('Utwór dodany do ulubionych'); await viewMusic();
    } catch (err) { toast(err.message, true); }
    return;
  }
  if (e.target.dataset.actChange === 'csv') {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 900_000) return toast('Plik jest za duży (max ok. 900 KB).', true);
    try {
      const r = await api('POST', '/api/setup/csv', { csv: await file.text() });
      csvPreview(r);
    } catch (err) { toast(err.message, true); }
  }
});
function csvPreview(r) {
  const vids = r.setup.videos;
  window.__csv = r.setup;
  openModal(`<h2 id="modal-title">Import z CSV</h2><p class="sub">Znaleziono ${plural(vids.length, 'film', 'filmy', 'filmów')}. Rozpoznane kolumny: ${Object.entries(r.columns).map(([k, v]) => `${esc(v)}`).join(', ')}. Filmy o tym samym tytule zostaną zaktualizowane, nie zdublowane.</p>
    <div class="tablewrap preview"><table><thead><tr><th>Tytuł</th><th>Data</th><th>Wyśw.</th><th>% do końca</th></tr></thead><tbody>
    ${vids.slice(0, 50).map(v => `<tr><td>${esc(v.title)}</td><td>${esc(v.publish_date || '-')}</td><td>${v.views ? fmtN(v.views) : '-'}</td><td>${v.completion ? v.completion + '%' : '-'}</td></tr>`).join('')}</tbody></table></div>
    ${vids.length > 50 ? `<p style="color:var(--slate)">i ${vids.length - 50} więcej</p>` : ''}
    <div class="foot"><button type="button" class="btn ghost" data-act="close">Anuluj</button><button class="btn" data-act="csv-apply">Importuj ${plural(vids.length, 'film', 'filmy', 'filmów')}</button></div>`, { wide: true });
}
ACT['csv-apply'] = async (el) => busy(el, async () => {
  const r = await api('POST', '/api/setup/apply', { setup: window.__csv, source: 'csv' });
  closeModal(); toast(`Zaimportowano: nowe ${r.counts.videos}, zaktualizowane ${r.counts.updated}`); await repaint();
});

window.addEventListener('popstate', () => go(location.pathname + location.search, { push: false }));
$('#menu-btn').addEventListener('click', () => { const s = $('#side'); s.classList.toggle('open'); $('#menu-btn').setAttribute('aria-expanded', s.classList.contains('open')); });
$('#view').setAttribute('tabindex', '-1');
go(location.pathname + location.search, { push: false });
