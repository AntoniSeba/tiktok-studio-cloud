// auth.js: register / login / forgot / reset forms on one page, picked by URL.
const params = new URLSearchParams(location.search);
const token = params.get('token');
const formId = location.pathname === '/rejestracja' ? 'f-register'
  : location.pathname === '/reset-hasla' ? (token ? 'f-reset' : 'f-forgot') : 'f-login';
const form = document.getElementById(formId);
form.hidden = false;
document.title = `TikTok Studio: ${form.querySelector('h1').textContent}`;
(form.querySelector('input:not([type=hidden])') || {}).focus?.();

// keep a typed e-mail when switching between login and register
const remembered = sessionStorage.getItem('tss-email');
if (remembered) form.querySelectorAll('input[type=email]').forEach(i => { i.value = remembered; });

document.querySelectorAll('.pw-toggle').forEach(b => b.addEventListener('click', () => {
  const input = b.previousElementSibling;
  input.type = input.type === 'password' ? 'text' : 'password';
  b.textContent = input.type === 'password' ? 'Pokaż' : 'Ukryj';
}));

const msg = form.querySelector('.msg');
const show = (text, kind = 'err') => { msg.textContent = text; msg.className = `msg show ${kind}`; };

function localCheck() {
  const email = form.querySelector('input[type=email]');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { email.focus(); return 'Podaj poprawny adres e-mail, np. jan@firma.pl.'; }
  const pass = form.querySelector('input[name=password]');
  if (pass && pass.minLength > 0 && pass.value.length < 8) { pass.focus(); return 'Hasło musi mieć co najmniej 8 znaków.'; }
  if (pass && !pass.value) { pass.focus(); return 'Wpisz hasło.'; }
  return '';
}

const endpoint = { 'f-register': '/api/auth/register', 'f-login': '/api/auth/login', 'f-forgot': '/api/auth/forgot', 'f-reset': '/api/auth/reset' }[formId];

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const problem = localCheck();
  if (problem) return show(problem);
  const body = Object.fromEntries(new FormData(form));
  if (body.email) { body.email = body.email.trim(); sessionStorage.setItem('tss-email', body.email); }
  if (token) body.token = token;
  const btn = form.querySelector('button[type=submit]');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Chwileczkę...';
  try {
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'Coś poszło nie tak. Spróbuj ponownie.');
    if (formId === 'f-forgot') { show(j.message, 'ok'); return; }
    const next = params.get('next');
    location.href = next && next.startsWith('/app') ? next : j.next || '/app';
  } catch (err) {
    show(err.message === 'Failed to fetch' ? 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.' : err.message);
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
});
