const db = require("../db/db");

const MissionModel = {

  getAll() {
    return db.prepare("SELECT * FROM missions").all();
  },

  getById(id) {
    return db.prepare("SELECT * FROM missions WHERE id = ?").get(id);
  },

  create(name, data) {
    const stmt = db.prepare("INSERT INTO missions (name, data) VALUES (?, ?)");
    const result = stmt.run(name, JSON.stringify(data));
    return { id: result.lastInsertRowid };
  },

  update(id, name, data) {
    db.prepare("UPDATE missions SET name = ?, data = ? WHERE id = ?")
      .run(name, JSON.stringify(data), id);
  },

  delete(id) {
    db.prepare("DELETE FROM missions WHERE id = ?").run(id);
  }
};

module.exports = MissionModel;
