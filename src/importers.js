// importers.js: time zone math and the CSV import of a TikTok Studio export
// (or any spreadsheet with a title column). Headers are matched loosely in
// Polish and English, so users do not have to rename columns.

function tzOffsetMs(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
}

/** "2026-10-27" + "18:00" in `tz` -> UTC ISO string. */
export function zonedToUtc(date, time, tz) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = (time || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - tzOffsetMs(guess, tz);
  t = guess - tzOffsetMs(t, tz);
  return new Date(t).toISOString();
}

export function validTimezone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

// ---- CSV --------------------------------------------------------------------
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delim = [';', '\t', ','].map(d => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell); if (row.some(c => c.trim())) rows.push(row);
  return rows;
}

const ALIASES = {
  title: ['title', 'tytul', 'tytuł', 'video title', 'video', 'nazwa', 'opis', 'description', 'caption', 'film'],
  url: ['url', 'link', 'video link', 'link do filmu'],
  publish_date: ['date', 'data', 'post time', 'posted', 'publish date', 'data publikacji', 'czas publikacji', 'opublikowano', 'video posted'],
  views: ['views', 'video views', 'wyswietlenia', 'wyświetlenia', 'total views', 'odtworzenia', 'play'],
  likes: ['likes', 'polubienia', 'lajki', 'total likes'],
  comments: ['comments', 'komentarze', 'total comments'],
  shares: ['shares', 'udostepnienia', 'udostępnienia', 'total shares'],
  saves: ['saves', 'zapisy', 'zapisania', 'favorites', 'ulubione', 'add to favorites'],
  avg_watch: ['average watch time', 'avg watch time', 'sredni czas ogladania', 'średni czas oglądania', 'avg watch', 'sredni czas', 'średni czas'],
  completion: ['watched full video', 'completion', 'full video', 'obejrzane do konca', 'obejrzane do końca', 'ukonczenia', 'ukończenia', '% do konca', 'retencja'],
  followers: ['new followers', 'followers', 'nowi obserwujacy', 'nowi obserwujący', 'obserwujacy', 'obserwujący'],
  hook: ['hook', 'pierwsze zdanie'],
  topic: ['topic', 'temat'],
};
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function mapHeaders(header) {
  const map = {};
  const used = new Set();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const an = aliases.map(norm);
    let idx = header.findIndex((h, i) => !used.has(i) && an.includes(norm(h)));
    if (idx < 0) idx = header.findIndex((h, i) => !used.has(i) && an.some(a => a.length > 3 && norm(h).includes(a)));
    if (idx >= 0) { map[field] = idx; used.add(idx); }
  }
  return map;
}

const toNum = (s) => {
  let t = String(s || '').trim().toLowerCase().replace(/\s/g, '');
  let mult = 1;
  if (/(k|tys\.?)$/.test(t)) { mult = 1000; t = t.replace(/(k|tys\.?)$/, ''); }
  else if (/(m|mln)$/.test(t)) { mult = 1e6; t = t.replace(/(m|mln)$/, ''); }
  t = t.replace('%', '').replace(/s$/, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n * mult : 0;
};
const toDate = (s) => {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};

/** Rows -> setup-shaped videos (same shape as the AI parser returns). */
export function csvToVideos(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { videos: [], map: {}, error: 'Plik ma mniej niż 2 wiersze (nagłówek i dane).' };
  const header = rows[0];
  const map = mapHeaders(header);
  if (map.title === undefined && map.url === undefined) return { videos: [], map, error: 'Nie znalazłem kolumny z tytułem ani linkiem. Nazwij kolumnę "Tytuł" albo użyj asystenta AI.' };
  const videos = rows.slice(1).map(r => {
    const g = (f) => (map[f] === undefined ? '' : String(r[map[f]] ?? '').trim());
    const views = Math.round(toNum(g('views')));
    return {
      title: (g('title') || g('url')).slice(0, 200), url: /^https?:\/\//.test(g('url')) ? g('url') : '', hook: g('hook').slice(0, 300), topic: g('topic').slice(0, 120),
      publish_date: toDate(g('publish_date')), views, likes: Math.round(toNum(g('likes'))), comments: Math.round(toNum(g('comments'))),
      shares: Math.round(toNum(g('shares'))), saves: Math.round(toNum(g('saves'))), followers: Math.round(toNum(g('followers'))),
      avg_watch: toNum(g('avg_watch')), completion: Math.min(100, toNum(g('completion'))), posted: views > 0 || Boolean(toDate(g('publish_date'))),
    };
  }).filter(v => v.title);
  return { videos, map: Object.fromEntries(Object.entries(map).map(([k, i]) => [k, header[i]])) };
}

// ---- TikTok Studio "Export videos" (one row per post, with retention and traffic sources) ----
// Columns are found by name, so a reordered export still reads. Percent lists look like
// "For You: 83.3%\nPersonal Profile: 16.7%" and the retention column like "0s: 100%\n1s: 88%".
const pctList = (s) => {
  const out = {};
  for (const line of String(s || '').split(/\r?\n/)) {
    const m = line.match(/^\s*(.+?)\s*:\s*([0-9.,]+)\s*%?\s*$/);
    if (m) out[m[1].trim()] = parseFloat(m[2].replace(',', '.'));
  }
  return out;
};
const curve = (s) => Object.entries(pctList(s)).map(([k, v]) => [parseInt(k, 10), v]).filter(([k]) => Number.isFinite(k)).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const tsOf = (s) => {
  const m = String(s || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${m[4].padStart(2, '0')}:${m[5]}:${m[6] || '00'}`;
  const d = toDate(s);
  return d ? d + 'T00:00:00' : '';
};

export function isTiktokExport(text) {
  const head = norm(parseCsv(String(text || '').slice(0, 4000))[0]?.join(' '));
  return head.includes('video id') && (head.includes('audience retention') || head.includes('video views'));
}

/** TikTok Studio export -> one object per post. */
export function tiktokExportPosts(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const h = rows[0].map(norm);
  const col = (...names) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = {
    caption: col('video caption'), posted: col('posted date'), id: col('video id'), url: col('video url'), views: col('video views'),
    likes: col('like count'), comments: col('comment count'), shares: col('share count'), saves: col('favorites count'), reach: col('reach'),
    duration: col('video duration'), total: col('total time watched'), avg: col('average time watched'), full: col('watched full video rate'),
    followers: col('new followers'), profile: col('profile views'), traffic: col('traffic source'), viewers: col('viewer types'), retention: col('audience retention'),
  };
  const g = (r, k) => (c[k] < 0 ? '' : String(r[c[k]] ?? '').trim());
  // the export always writes plain decimals ("46.709" s), never thousands separators
  const n = (r, k) => { const v = parseFloat(g(r, k).replace(',', '.')); return Number.isFinite(v) ? v : 0; };
  return rows.slice(1).map(r => {
    const tr = pctList(g(r, 'traffic')), vw = pctList(g(r, 'viewers'));
    const full = n(r, 'full');
    const cap = g(r, 'caption');
    return {
      tiktok_id: g(r, 'id').replace(/\D/g, ''), url: /^https?:\/\//.test(g(r, 'url')) ? g(r, 'url') : '',
      caption: cap === '-' ? '' : cap, posted_at: tsOf(g(r, 'posted')), duration: n(r, 'duration'),
      views: Math.round(n(r, 'views')), likes: Math.round(n(r, 'likes')), comments: Math.round(n(r, 'comments')),
      shares: Math.round(n(r, 'shares')), saves: Math.round(n(r, 'saves')), reached: Math.round(n(r, 'reach')),
      total_watch_time: n(r, 'total'), avg_watch: n(r, 'avg'), completion: +(full <= 1 ? full * 100 : full).toFixed(2),
      followers: Math.round(n(r, 'followers')), profile_views: Math.round(n(r, 'profile')),
      src_fyp: tr['For You'] || 0, src_profile: tr['Personal Profile'] || 0, src_following: tr['Follow'] || 0, src_search: tr['Search'] || 0, src_sound: tr['Sound'] || 0,
      new_viewers: vw.NEW_VIEWER || 0, returning_viewers: vw.RETURN_VIEWER || 0, retention: curve(g(r, 'retention')),
    };
  }).filter(p => p.tiktok_id);
}

/** Which Studio film a post is. Strongest evidence first; a duration guess only when exactly one film
 *  of the export's channel fits (other channels share lengths like 41 s too often). */
export function matchPost(p, videos, channelId) {
  const slug = (s) => norm(String(s || '').replace(/ł/g, 'l').replace(/Ł/g, 'L')).replace(/ /g, '-');
  const byUrl = videos.find(v => v.url && v.url.includes(p.tiktok_id));
  if (byUrl) return { video: byUrl, how: 'link' };
  const cap = norm(p.caption);
  if (cap.length > 20) {
    const v = videos.find(v => v.caption && norm(v.caption).slice(0, 60) === cap.slice(0, 60));
    if (v) return { video: v, how: 'opis' };
  }
  if (p.caption && /^[a-z0-9-]+$/.test(p.caption)) {   // uploaded file name kept as the caption
    const v = videos.find(v => slug(v.title) === p.caption || v.ref === p.caption);
    if (v) return { video: v, how: 'nazwa pliku' };
  }
  if (p.duration > 0) {
    const posted = Date.parse(p.posted_at) || Infinity;
    const fit = videos.filter(v => (!channelId || v.channel_id === channelId) && v.duration_sec > 0 && Math.abs(v.duration_sec - p.duration) <= 0.15 && Date.parse(v.created_at) <= posted + 3600_000)
      .sort((a, b) => Math.abs(a.duration_sec - p.duration) - Math.abs(b.duration_sec - p.duration));
    if (fit.length === 1 || (fit.length > 1 && Math.abs(fit[1].duration_sec - p.duration) - Math.abs(fit[0].duration_sec - p.duration) > 0.1)) return { video: fit[0], how: 'długość' };
  }
  return null;
}
