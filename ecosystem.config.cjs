// PM2 config for the VPS. Secrets live in .env (loaded by dotenv), not here.
module.exports = {
  apps: [{
    name: 'tiktok-studio-cloud',
    script: 'src/server.js',
    // the VPS default node is 18; better-sqlite3 12 needs 20+, so point at a newer build
    interpreter: process.env.NODE_BIN || 'node',
    cwd: __dirname,
    instances: 1,          // SQLite + in-process scheduler: keep a single process
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production' },
    out_file: 'logs/out.log',
    error_file: 'logs/err.log',
    time: true,
  }],
};
