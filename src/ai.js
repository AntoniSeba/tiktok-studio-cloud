// ai.js: "paste anything" onboarding. A cheap OpenRouter model turns free text
// (channel description, a list of videos, notes, a pasted TikTok Studio export)
// into a structured setup that the user reviews before it is saved.
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';
// Models offered in the picker; override with OPENROUTER_MODELS="a,b,c".
export const MODELS = (process.env.OPENROUTER_MODELS ||
  'google/gemini-2.5-flash-lite,openai/gpt-5-nano,qwen/qwen3-235b-a22b-2507,deepseek/deepseek-v4.1-flash,deepseek/deepseek-v3.2,mistralai/mistral-small-3.2-24b-instruct')
  .split(',').map(s => s.trim()).filter(Boolean);
if (!MODELS.includes(DEFAULT_MODEL)) MODELS.unshift(DEFAULT_MODEL);

const FALLBACKS = (process.env.OPENROUTER_FALLBACKS || 'mistralai/mistral-small-3.2-24b-instruct,qwen/qwen3-235b-a22b-2507').split(',').map(x => x.trim()).filter(Boolean);

export const aiReady = () => Boolean(process.env.OPENROUTER_API_KEY);
export const MAX_INPUT = 24000;

const SYSTEM = `Jesteś asystentem konfiguracji aplikacji TikTok Studio (śledzenie filmów TikTok, kalendarz publikacji, kolejka pomysłów, analiza wyników).
Użytkownik wkleja nieuporządkowane dane: opis kanału, listę filmów, notatki, wyniki, eksport z TikTok Studio, pomysły. Zamień to na JSON dokładnie według schematu:
{
 "channel": {"name": "", "handle": "", "niche": "", "audience": "", "goal": ""},
 "videos": [{"title": "", "hook": "", "topic": "", "visual": "", "voice": "", "pace": "", "cta": "", "category": "", "url": "",
             "posted": false, "publish_date": "", "views": 0, "avg_watch": 0, "completion": 0, "likes": 0, "comments": 0, "shares": 0, "saves": 0, "followers": 0, "notes": ""}],
 "topics": [{"topic": "", "hook": "", "notes": ""}],
 "schedule": [{"video_title": "", "date": "YYYY-MM-DD", "time": "HH:MM"}],
 "settings": {"cadence_per_day": 0, "mail_to": ""},
 "summary": "",
 "questions": []
}
Zasady:
- "videos" to filmy, które już istnieją: opublikowane ORAZ gotowe/nagrane, które czekają na publikację (te mają "posted": false). Pomysły bez nagranego filmu idą do "topics".
- Każdy film z "schedule" musi też być w "videos" pod identycznym tytułem.
- Nigdy nie wymyślaj liczb, linków ani dat. Brak danych = 0 albo pusty tekst. "posted": true tylko gdy tekst mówi, że film jest opublikowany albo ma wyniki.
- "avg_watch" w sekundach, "completion" w procentach (0-100). Liczby typu "12,5 tys." zamień na 12500.
- "hook" to pierwsze zdanie lub pierwsza scena filmu. "category" to krótka etykieta typu "poradnik", "trend", "historia", jeśli wynika z tekstu.
- "schedule" tylko dla terminów publikacji podanych wprost; "video_title" musi być tytułem z "videos". Rok domyślnie bieżący: {{YEAR}}. Dziś jest {{TODAY}}.
- "handle" zaczyna się od @, jeśli podany. "summary" to 1-3 zdania po polsku: co zrozumiałeś. "questions" to maks. 3 krótkie pytania o brakujące rzeczy, które realnie pomogą.
- Tytuły i teksty zostaw w języku użytkownika. Zwróć wyłącznie JSON.`;

export async function parseSetup(text, { model, today = new Date() } = {}) {
  if (!aiReady()) throw Object.assign(new Error('Asystent AI jest wyłączony na tym serwerze (brak OPENROUTER_API_KEY). Użyj ręcznej konfiguracji.'), { status: 503 });
  const input = String(text || '').trim();
  if (input.length < 20) throw Object.assign(new Error('Wklej trochę więcej: opis kanału, listę filmów albo notatki (min. 20 znaków).'), { status: 400 });
  if (input.length > MAX_INPUT) throw Object.assign(new Error(`Za długi tekst (max ${MAX_INPUT} znaków). Wklej część, resztę dodasz potem.`), { status: 400 });
  const useModel = MODELS.includes(model) ? model : DEFAULT_MODEL;
  // models are bad at weekday arithmetic, so "in Thursday" needs the actual dates spelled out
  const names = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(today.getTime() + i * 864e5); return `${names[d.getUTCDay()]} ${d.toISOString().slice(0, 10)}`; });
  const system = SYSTEM.replace('{{YEAR}}', String(today.getFullYear()))
    .replace('{{TODAY}}', `${days[0]}. Najbliższe dni: ${days.slice(1).join(', ')}. "W czwartek" znaczy najbliższy czwartek z tej listy`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST', signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://studio.soft-synergy.com', 'X-Title': 'TikTok Studio Cloud',
      },
      // OpenRouter tries the fallbacks in order when the chosen provider fails
      body: JSON.stringify({ model: useModel, models: [useModel, ...FALLBACKS.filter(m => m !== useModel)].slice(0, 3), temperature: 0.1, max_tokens: 8000, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: input }] }),
    });
  } catch (e) {
    throw Object.assign(new Error(e.name === 'AbortError' ? 'Model AI nie odpowiedział w 90 s. Spróbuj ponownie albo wybierz inny model.' : 'Nie udało się połączyć z OpenRouter.'), { status: 502 });
  } finally { clearTimeout(timer); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) {
    console.error('[ai] OpenRouter error:', res.status, JSON.stringify(j.error || j).slice(0, 300));
    throw Object.assign(new Error('Model AI chwilowo nie odpowiada. Spróbuj ponownie za chwilę albo wybierz inny model w polu "Model AI".'), { status: 502 });
  }
  const raw = j.choices?.[0]?.message?.content || '';
  const parsed = extractJson(raw);
  if (!parsed) throw Object.assign(new Error('Model zwrócił nieczytelną odpowiedź. Spróbuj ponownie albo zmień model.'), { status: 502 });
  return { model: j.model || useModel, usage: j.usage || null, setup: cleanSetup(parsed) };
}

function extractJson(s) {
  const t = String(s).replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return null;
}

const str = (v, n = 300) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, max = 1e12) => { const x = Number(String(v ?? '').replace(',', '.').replace(/[^\d.\-]/g, '')); return Number.isFinite(x) && x > 0 ? Math.min(x, max) : 0; };
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
const time = (v) => (/^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v).padStart(5, '0') : '');

/** Clamp whatever came back (from the model or from an edited preview) to the schema. */
export function cleanSetup(s = {}) {
  const c = s.channel || {};
  const handle = str(c.handle, 60).replace(/^@*/, '');
  const st = s.settings || {};
  return {
    channel: { name: str(c.name, 80), handle: handle ? '@' + handle : '', niche: str(c.niche, 400), audience: str(c.audience, 300), goal: str(c.goal, 300) },
    videos: (Array.isArray(s.videos) ? s.videos : []).slice(0, 300).map(v => ({
      title: str(v.title, 200), hook: str(v.hook, 300), topic: str(v.topic, 120), visual: str(v.visual, 120), voice: str(v.voice, 120),
      pace: str(v.pace, 60), cta: str(v.cta, 200), category: str(v.category, 60), url: /^https?:\/\//.test(str(v.url)) ? str(v.url, 500) : '',
      posted: Boolean(v.posted) || num(v.views) > 0, publish_date: date(v.publish_date),
      views: Math.round(num(v.views)), avg_watch: num(v.avg_watch, 36000), completion: num(v.completion, 100),
      likes: Math.round(num(v.likes)), comments: Math.round(num(v.comments)), shares: Math.round(num(v.shares)),
      saves: Math.round(num(v.saves)), followers: Math.round(num(v.followers)), notes: str(v.notes, 1000),
    })).filter(v => v.title),
    topics: (Array.isArray(s.topics) ? s.topics : []).slice(0, 300).map(t => ({ topic: str(t.topic, 200), hook: str(t.hook, 300), notes: str(t.notes, 1000) })).filter(t => t.topic),
    schedule: (Array.isArray(s.schedule) ? s.schedule : []).slice(0, 300).map(x => ({ video_title: str(x.video_title, 200), date: date(x.date), time: time(x.time) || '18:00' })).filter(x => x.video_title && x.date),
    settings: { cadence_per_day: Math.min(10, Math.round(num(st.cadence_per_day))), mail_to: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(st.mail_to)) ? str(st.mail_to, 200) : '' },
    summary: str(s.summary, 600),
    questions: (Array.isArray(s.questions) ? s.questions : []).slice(0, 3).map(q => str(q, 200)).filter(Boolean),
  };
}
