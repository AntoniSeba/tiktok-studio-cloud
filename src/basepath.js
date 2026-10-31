// basepath.js: serves the whole Studio under a path prefix (BASE_PATH, e.g. /tts behind nginx on a shared domain).
// Requests arrive with or without the prefix; pages, scripts and styles leave with every root-absolute link prefixed,
// redirects too. Without BASE_PATH nothing here runs, so local use is unchanged.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

export const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
// the app's own top-level paths (public/ and src/server.js); anything else is left alone
const ROOTS = 'api|app|assets|styles|logowanie|rejestracja|reset-hasla|integracje';
const LINK = new RegExp(`(["'\`(=])\\/(${ROOTS})(?=[\\/"'\`?#)\\s]|$)`, 'g');
const HOME = /(href=|location\.href\s*=\s*)(["'])\/\2/g;   // links and redirects to "/" (the landing page)
export const withBase = (text) => (BASE ? text.replace(LINK, `$1${BASE}/$2`).replace(HOME, `$1$2${BASE}/$2`) : text);
const TEXT = { '.html': 'html', '.js': 'application/javascript', '.css': 'css' };

/** Mount before every route. `statics` maps URL prefixes to folders served by express.static (their text files get rewritten here). */
export function basePath(app, statics) {
  if (!BASE) return;
  app.use((req, res, next) => {
    if (req.url === BASE || req.url.startsWith(BASE + '/') || req.url.startsWith(BASE + '?')) req.url = req.url.slice(BASE.length) || '/';
    const redirect = res.redirect.bind(res);
    res.redirect = (a, b) => {
      const fix = (u) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith(BASE + '/') ? BASE + u : u);
      return b === undefined ? redirect(fix(a)) : redirect(a, fix(b));
    };
    const sendFile = res.sendFile.bind(res);
    res.sendFile = (file, ...rest) => (TEXT[extname(file)] ? res.type(TEXT[extname(file)]).send(withBase(readFileSync(file, 'utf8'))) : sendFile(file, ...rest));
    if (req.method === 'GET') {
      for (const [prefix, dir] of Object.entries(statics)) {
        if (!req.path.startsWith(prefix + '/') || !TEXT[extname(req.path)]) continue;
        const file = resolve(dir, '.' + decodeURIComponent(req.path.slice(prefix.length)));
        if (file.startsWith(dir + '/') && existsSync(file)) return res.sendFile(file);
      }
    }
    next();
  });
}
