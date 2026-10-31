// kanal-silniki.js: adds the "Silniki" channel (3D engine films, agents from kit/kanaly/silniki) to a Studio account.
// usage: node scripts/kanal-silniki.js                 lists accounts
//        node scripts/kanal-silniki.js <email>         adds the channel to that user's studio (once)
// Run after the first sign-up at http://localhost:4318. The server may keep running.
import Database from 'better-sqlite3';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = new Database(process.env.DB_PATH || join(process.env.DATA_DIR || join(ROOT, 'data'), 'cloud.db'));
db.pragma('busy_timeout = 5000');
const cols = db.prepare('PRAGMA table_info(channels)').all().map(c => c.name);
if (!cols.includes('agent_kit')) { console.log('Baza nie ma jeszcze kolumny agent_kit: uruchom raz serwer (npm start albo bash scripts/autostart.sh) i spróbuj ponownie.'); process.exit(1); }

const email = process.argv[2];
const rows = db.prepare('SELECT w.id, w.name, u.email FROM workspaces w JOIN users u ON u.id = w.owner_id ORDER BY w.id').all();
if (!email) {
  if (!rows.length) console.log('Brak kont. Załóż konto na http://localhost:4318, potem uruchom ten skrypt z adresem e-mail.');
  for (const r of rows) console.log(`${r.email}  (studio "${r.name}", id ${r.id})`);
  console.log('\nDodaj kanał: node scripts/kanal-silniki.js <email>');
  process.exit(0);
}
const ws = rows.find(r => r.email.toLowerCase() === email.toLowerCase());
if (!ws) { console.log(`Nie ma konta ${email}. Konta: ${rows.map(r => r.email).join(', ') || 'brak'}`); process.exit(1); }
const had = db.prepare("SELECT id FROM channels WHERE workspace_id=? AND agent_kit='silniki'").get(ws.id);
if (had) { console.log(`Kanał Silniki już jest w studiu "${ws.name}" (id ${had.id}).`); process.exit(0); }
const id = db.prepare(`INSERT INTO channels(workspace_id,name,niche,audience,goal,product,cta,voice,language,length_sec,color,agent_kit)
  VALUES(?,?,?,?,?,?,?,'Puck','polski',160,'#ff6b1a','silniki')`).run(ws.id, 'Silniki',
  'Kontrowersyjne tezy o silnikach i motoryzacji wyjaśnione na modelach 3D: jak działa silnik, mity mechaników, tuning, eksploatacja, dziwne konstrukcje. Seria 3D z B-rollem, bębnem "Na końcu", kartą wyboru i pętlą.',
  'Kierowcy i fani motoryzacji w Polsce, 18 do 40 lat, od laika po mechanika; lubią się spierać w komentarzach (spór plemienny: marki, układy cylindrów, diesel kontra benzyna).',
  'Czas oglądania i komentarze (pytanie-wybór), zapisy; przekierowanie na film na YouTube (link w bio).',
  'Jeśli lektor wspomina skaner OBD albo produkt z TikTok Shop: pokaż go w użyciu i kartę koszyka ze strzałką w dół (sekcja M w 01-standard-kanalu.md). Jeśli nie wspomina, nic nie reklamuj.',
  'Film na YouTube, link w bio (karta CTA tam, gdzie mówi o nim lektor)').lastInsertRowid;
console.log(`Dodano kanał Silniki (id ${id}) do studia "${ws.name}" (${ws.email}). Odśwież Studio w przeglądarce.`);
