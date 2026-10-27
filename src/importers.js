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
