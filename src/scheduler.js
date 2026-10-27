// scheduler.js: one cron tick every 5 minutes walks all workspaces and sends
// what is due in each workspace's own time zone: the daily plan, publish
// reminders, and the weekly "what is winning" report. Sent dates are stored on
// the workspace, so a restart never sends the same digest twice.
import cron from 'node-cron';
import { db, listVideos } from './db.js';
import { sendMail, emailShell, esc } from './mailer.js';
import { analyze } from './analysis.js';

/** Local date (YYYY-MM-DD), hour and weekday of `date` in a time zone. */
export function localParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: wd };
}

export const fmtLocal = (iso, tz) => new Intl.DateTimeFormat('pl-PL', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const li = (s) => `<div style="padding:9px 0;border-bottom:1px solid #f0ece4">${s}</div>`;
const h2 = (s) => `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#6a5cff;margin:18px 0 6px">${s}</h2>`;

export function buildDailyDigest(ws, now = new Date()) {
  const tz = ws.timezone;
  const today = localParts(now, tz).date;
  const planned = db.prepare(`SELECT sc.*, v.title FROM schedule sc JOIN videos v ON v.id = sc.video_id
    WHERE sc.workspace_id=? AND sc.status='planned' ORDER BY sc.scheduled_at`).all(ws.id);
  const todays = planned.filter(s => localParts(new Date(s.scheduled_at), tz).date === today);
  const overdue = planned.filter(s => localParts(new Date(s.scheduled_at), tz).date < today);
  const ready = listVideos(ws.id).filter(v => !v.posted && !v.next_slot);
  const app = process.env.APP_URL || '';
  const body = `<p style="margin:0 0 8px;color:#55516a">Plan na ${today}. Cel: ${ws.cadence_per_day} publikacji dziennie.</p>
    ${h2(`Do wstawienia dziś (${todays.length})`)}
    ${todays.map(s => li(`<b>${esc(s.title)}</b> o ${fmtLocal(s.scheduled_at, tz).slice(-5)}`)).join('') || '<p style="color:#7a7686">Nic na dziś. Zaplanuj film w kalendarzu.</p>'}
    ${overdue.length ? h2(`Zaległe (${overdue.length})`) + overdue.map(s => li(`${esc(s.title)} (${fmtLocal(s.scheduled_at, tz)})`)).join('') : ''}
    ${h2(`Gotowe, bez terminu (${ready.length})`)}
    ${ready.slice(0, 10).map(v => li(esc(v.title))).join('') || '<p style="color:#7a7686">Brak. Czas na nowe filmy z kolejki.</p>'}
    ${app ? `<p style="margin-top:16px"><a href="${app}/app/kalendarz" style="color:#6a5cff;font-weight:700">Otwórz kalendarz</a></p>` : ''}`;
  return { subject: `Plan TikTok na ${today}: ${todays.length} do wstawienia`, html: emailShell('Twój plan na dziś', body) };
}

export function buildWeeklyReport(ws) {
  const a = analyze(ws.id);
  if (!a.sampleSize) {
    return { subject: 'Raport tygodniowy: brak wyników', html: emailShell('Raport tygodniowy',
      '<p>Żaden film nie ma jeszcze wpisanych wyników. Uzupełnij wyświetlenia i oglądalność w zakładce Filmy, a raport pokaże, co wygrywa.</p>') };
  }
  const body = `<p style="margin:0;color:#55516a">Na podstawie ${a.sampleSize} filmów z wynikami.</p>
    ${h2('Co wygrywa')}${a.recommendations.map(r => li(esc(r.text))).join('') || '<p style="color:#7a7686">Potrzeba co najmniej 2 filmów na wariant, żeby wskazać zwycięzcę.</p>'}
    ${h2('Top filmy')}${a.top.map((t, i) => li(`<b>${i + 1}.</b> ${esc(t.title)}: ${t.views} wyśw., ${t.avg_watch}s, ${t.completion}% do końca`)).join('')}`;
  return { subject: `Raport tygodniowy: co wygrywa (${a.sampleSize} filmów)`, html: emailShell('Raport tygodniowy', body) };
}

const recipient = (ws) => ws.mail_to || db.prepare('SELECT email FROM users WHERE id=?').get(ws.owner_id)?.email;

export async function tick(now = new Date()) {
  for (const ws of db.prepare('SELECT * FROM workspaces').all()) {
    const to = recipient(ws);
    if (!to) continue;
    const lp = localParts(now, ws.timezone || 'Europe/Warsaw');
    try {
      if (ws.digest_enabled && lp.hour === ws.digest_hour && ws.last_digest_date !== lp.date) {
        db.prepare('UPDATE workspaces SET last_digest_date=? WHERE id=?').run(lp.date, ws.id);
        const has = db.prepare('SELECT COUNT(*) c FROM videos WHERE workspace_id=?').get(ws.id).c;
        if (has) { const m = buildDailyDigest(ws, now); await sendMail({ to, ...m }); }
      }
      if (ws.digest_enabled && lp.weekday === ws.weekly_day && lp.hour === ws.digest_hour && ws.last_weekly_date !== lp.date) {
        db.prepare('UPDATE workspaces SET last_weekly_date=? WHERE id=?').run(lp.date, ws.id);
        const m = buildWeeklyReport(ws); await sendMail({ to, ...m });
      }
      if (ws.reminders_enabled) {
        const due = db.prepare(`SELECT sc.*, v.title FROM schedule sc JOIN videos v ON v.id = sc.video_id
          WHERE sc.workspace_id=? AND sc.status='planned' AND sc.reminded=0 AND sc.scheduled_at <= ?`).all(ws.id, now.toISOString());
        if (due.length) {
          const body = due.map(d => li(`<b>${esc(d.title)}</b> (${fmtLocal(d.scheduled_at, ws.timezone)})${d.caption ? `<br><span style="color:#55516a">${esc(d.caption)}</span>` : ''}`)).join('');
          const r = await sendMail({ to, subject: `Pora wstawić ${due.length} ${due.length === 1 ? 'film' : 'filmy'} na TikToka`, html: emailShell('Pora publikować', body) });
          if (r.ok) { const mark = db.prepare('UPDATE schedule SET reminded=1 WHERE id=?'); for (const d of due) mark.run(d.id); }
        }
      }
    } catch (e) { console.error(`[scheduler] workspace ${ws.id}:`, e.message); }
  }
}

export function startScheduler() {
  cron.schedule('*/5 * * * *', () => tick().catch(e => console.error('[scheduler]', e)));
  console.log('[scheduler] co 5 minut: digest, przypomnienia, raport tygodniowy (strefa czasowa każdego konta)');
}
