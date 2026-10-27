// mailer.js: email through Brevo SMTP. Without BREVO_SMTP_USER/KEY it runs
// "dry": logs what it would send and reports dry:true, so the app still works.
import nodemailer from 'nodemailer';

const USER = process.env.BREVO_SMTP_USER || '';
const KEY = process.env.BREVO_SMTP_KEY || '';
const PORT = Number(process.env.BREVO_SMTP_PORT || 587);
const FROM = process.env.MAIL_FROM || 'TikTok Studio <no-reply@soft-synergy.com>';

export const mailerReady = Boolean(USER && KEY);
const transport = mailerReady ? nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com', port: PORT, secure: PORT === 465, auth: { user: USER, pass: KEY },
}) : null;

export async function sendMail({ to, subject, html }) {
  if (!to) return { ok: false, error: 'brak adresu odbiorcy' };
  if (!mailerReady) {
    console.log(`[mailer:dry] "${subject}" -> ${to}`);
    return { ok: true, dry: true };
  }
  try {
    const info = await transport.sendMail({ from: FROM, to, subject, html, text: stripHtml(html) });
    return { ok: true, id: info.messageId };
  } catch (e) {
    console.error('[mailer] error:', e.message);
    return { ok: false, error: e.message };
  }
}

const stripHtml = (s = '') => s.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
export const esc = (s = '') => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function emailShell(title, body, appUrl = process.env.APP_URL || '') {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f6f4f0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d1b26">
  <div style="max-width:600px;margin:0 auto;padding:28px 22px">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6a5cff;font-weight:700">TikTok Studio</div>
    <h1 style="font-size:24px;margin:8px 0 18px;line-height:1.2">${title}</h1>
    <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #ebe7df">${body}</div>
    <p style="margin-top:22px;font-size:12px;color:#7a7686">Wysłane automatycznie przez TikTok Studio (Soft Synergy).
    ${appUrl ? `Ustawienia maili: <a href="${appUrl}/app/ustawienia" style="color:#6a5cff">${appUrl}/app/ustawienia</a>` : ''}</p>
  </div></body></html>`;
}
