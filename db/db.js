const Database = require("better-sqlite3");

// otomatis bikin file mission.sqlite jika belum ada
const db = new Database("./db/mission.sqlite");

// bikin tabel jika belum ada
db.prepare(`
  CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    data TEXT,
    type TEXT DEFAULT 'plan'
  )
`).run();

module.exports = db;
