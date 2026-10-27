// db.js: SQLite schema for TikTok Studio Cloud.
// Every business row carries workspace_id, and every query in the app filters on
// it, so one account never sees another account's data.
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '../data/cloud.db');
if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT DEFAULT '',
  pass_hash     TEXT NOT NULL,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  api_key_hash      TEXT DEFAULT '',
  api_key_prefix    TEXT DEFAULT '',
  timezone          TEXT DEFAULT 'Europe/Warsaw',
  mail_to           TEXT DEFAULT '',
  digest_enabled    INTEGER DEFAULT 1,
  digest_hour       INTEGER DEFAULT 8,
  weekly_day        INTEGER DEFAULT 1,      -- 0 = Sunday ... 6 = Saturday
  reminders_enabled INTEGER DEFAULT 1,
  cadence_per_day   INTEGER DEFAULT 1,
  ai_model          TEXT DEFAULT '',
  onboarded_at      TEXT,
  last_digest_date  TEXT DEFAULT '',
  last_weekly_date  TEXT DEFAULT '',
  created_at        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ws_owner ON workspaces(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_apikey ON workspaces(api_key_hash) WHERE api_key_hash <> '';

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  used        INTEGER DEFAULT 0
);

-- a workspace can run several TikTok channels; videos and topics belong to one
CREATE TABLE IF NOT EXISTS channels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  handle        TEXT DEFAULT '',
  niche         TEXT DEFAULT '',
  audience      TEXT DEFAULT '',
  goal          TEXT DEFAULT '',
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_channels_ws ON channels(workspace_id);

CREATE TABLE IF NOT EXISTS videos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id    INTEGER REFERENCES channels(id) ON DELETE SET NULL,
  ref           TEXT NOT NULL,              -- stable external id (slug); integrations upsert by it
  title         TEXT NOT NULL,
  hook          TEXT DEFAULT '',
  topic         TEXT DEFAULT '',
  visual        TEXT DEFAULT '',
  voice         TEXT DEFAULT '',
  pace          TEXT DEFAULT '',
  cta           TEXT DEFAULT '',
  category      TEXT DEFAULT '',
  pin           TEXT DEFAULT '',            -- pinned comment
  caption       TEXT DEFAULT '',
  url           TEXT DEFAULT '',            -- link to the published TikTok
  file_url      TEXT DEFAULT '',            -- where the rendered file lives (link or path)
  duration_sec  REAL DEFAULT 0,
  source        TEXT DEFAULT 'manual',      -- manual | api | ai | csv
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(workspace_id, ref)
);
CREATE INDEX IF NOT EXISTS idx_videos_ws ON videos(workspace_id);

CREATE TABLE IF NOT EXISTS stats (
  video_id      INTEGER PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  posted        INTEGER DEFAULT 0,
  publish_date  TEXT DEFAULT '',
  views         INTEGER DEFAULT 0,
  avg_watch     REAL DEFAULT 0,             -- seconds
  completion    REAL DEFAULT 0,             -- % watched to the end
  likes         INTEGER DEFAULT 0,
  comments      INTEGER DEFAULT 0,
  shares        INTEGER DEFAULT 0,
  saves         INTEGER DEFAULT 0,
  followers     INTEGER DEFAULT 0,
  notes         TEXT DEFAULT '',
  updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS schedule (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  video_id      INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  scheduled_at  TEXT NOT NULL,              -- UTC ISO 8601 (the browser converts to local time)
  caption       TEXT DEFAULT '',
  status        TEXT DEFAULT 'planned',     -- planned | posted | skipped
  reminded      INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_schedule_ws ON schedule(workspace_id, scheduled_at);

CREATE TABLE IF NOT EXISTS queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id    INTEGER REFERENCES channels(id) ON DELETE SET NULL,
  topic         TEXT NOT NULL,
  hook          TEXT DEFAULT '',
  notes         TEXT DEFAULT '',
  status        TEXT DEFAULT 'idea',        -- idea | script | render | qa | done
  priority      INTEGER DEFAULT 2,          -- 1 high, 2 normal, 3 low
  video_id      INTEGER REFERENCES videos(id) ON DELETE SET NULL,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_queue_ws ON queue(workspace_id);
`);

// generation jobs: one headless opencode run (DeepSeek) that writes, voices and renders a video
db.exec(`
CREATE TABLE IF NOT EXISTS gen_jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id    INTEGER REFERENCES channels(id) ON DELETE SET NULL,
  queue_id      INTEGER REFERENCES queue(id) ON DELETE SET NULL,
  topic         TEXT NOT NULL,
  hook          TEXT DEFAULT '',
  notes         TEXT DEFAULT '',
  model         TEXT DEFAULT '',
  status        TEXT DEFAULT 'queued',      -- queued | running | done | error | canceled
  phase         TEXT DEFAULT '',
  phase_detail  TEXT DEFAULT '',
  log           TEXT DEFAULT '',
  error         TEXT DEFAULT '',
  video_id      INTEGER REFERENCES videos(id) ON DELETE SET NULL,
  cost_usd      REAL DEFAULT 0,
  tokens_in     INTEGER DEFAULT 0,
  tokens_out    INTEGER DEFAULT 0,
  turns         INTEGER DEFAULT 0,
  pid           INTEGER,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  started_at    TEXT,
  finished_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_gen_ws ON gen_jobs(workspace_id, created_at);
`);

// lightweight migrations: CREATE TABLE IF NOT EXISTS never adds columns to an existing table
function ensureColumns(table, cols) {
  const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
  for (const [name, def] of cols) if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
}
// what the generator needs to know about a channel: what it promotes, its look and its voice
ensureColumns('channels', [
  ['product', "TEXT DEFAULT ''"], ['cta', "TEXT DEFAULT ''"], ['colors', "TEXT DEFAULT ''"],
  ['voice', "TEXT DEFAULT 'Puck'"], ['language', "TEXT DEFAULT 'polski'"], ['length_sec', 'INTEGER DEFAULT 40'],
]);
ensureColumns('videos', [['media_path', "TEXT DEFAULT ''"]]);
ensureColumns('gen_jobs', [['opts', "TEXT DEFAULT ''"], ['queued_at', 'TEXT']]);   // opts JSON: per-film overrides; queued_at: when it entered the live queue (held jobs wait for a start)
ensureColumns('videos', [['format', "TEXT DEFAULT 'short'"]]);   // short | long_vertical | long_wide   // JSON: per-film overrides (length, voice, own script)   // a rendered file the Studio stores itself
ensureColumns('channels', [['color', "TEXT DEFAULT '#22b8cf'"]]);   // accent of the TikTok account in the switcher and lists
ensureColumns('queue', [['remix_id', 'INTEGER']]);                  // tiktok_lib row this topic remixes (Inspiracje)
// the full TikTok Studio analytics screen of a video (as in the local studio), not only the basics
ensureColumns('stats', [
  ['total_watch_time', 'REAL DEFAULT 0'], ['reached', 'INTEGER DEFAULT 0'], ['profile_views', 'INTEGER DEFAULT 0'],
  ['src_fyp', 'REAL DEFAULT 0'], ['src_profile', 'REAL DEFAULT 0'], ['src_following', 'REAL DEFAULT 0'],
  ['src_search', 'REAL DEFAULT 0'], ['src_sound', 'REAL DEFAULT 0'],
  ['new_viewers', 'REAL DEFAULT 0'], ['returning_viewers', 'REAL DEFAULT 0'], ['retention_curve', "TEXT DEFAULT ''"],
]);

// prompt fragments the user can switch on in the generate dialog (local studio "subskills")
db.exec(`
CREATE TABLE IF NOT EXISTS subskills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  body          TEXT DEFAULT '',
  enabled       INTEGER DEFAULT 1,
  default_on    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_subskills_ws ON subskills(workspace_id);
`);

// files a user attaches to a generation (PDF source material); text is extracted on upload
db.exec(`
CREATE TABLE IF NOT EXISTS uploads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  path          TEXT NOT NULL,
  size          INTEGER DEFAULT 0,
  text_chars    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

export const nowIso = () => new Date().toISOString();

/** Videos of one workspace with their stats flattened in; channelId narrows to one channel. */
export function listVideos(wsId, channelId) {
  return db.prepare(`
    SELECT v.*,
      COALESCE(s.posted,0) posted, COALESCE(s.publish_date,'') publish_date,
      COALESCE(s.views,0) views, COALESCE(s.avg_watch,0) avg_watch, COALESCE(s.completion,0) completion,
      COALESCE(s.likes,0) likes, COALESCE(s.comments,0) comments, COALESCE(s.shares,0) shares,
      COALESCE(s.saves,0) saves, COALESCE(s.followers,0) followers, COALESCE(s.notes,'') notes,
      COALESCE(s.total_watch_time,0) total_watch_time, COALESCE(s.reached,0) reached, COALESCE(s.profile_views,0) profile_views,
      COALESCE(s.src_fyp,0) src_fyp, COALESCE(s.src_profile,0) src_profile, COALESCE(s.src_following,0) src_following,
      COALESCE(s.src_search,0) src_search, COALESCE(s.src_sound,0) src_sound,
      COALESCE(s.new_viewers,0) new_viewers, COALESCE(s.returning_viewers,0) returning_viewers, COALESCE(s.retention_curve,'') retention_curve,
      (SELECT sc.scheduled_at FROM schedule sc WHERE sc.video_id = v.id AND sc.status = 'planned'
         ORDER BY sc.scheduled_at LIMIT 1) next_slot
    FROM videos v LEFT JOIN stats s ON s.video_id = v.id
    WHERE v.workspace_id = @ws AND (@ch IS NULL OR v.channel_id = @ch)
    ORDER BY v.created_at DESC, v.id DESC
  `).all({ ws: wsId, ch: channelId || null });
}

export default db;
