const db = require("../db/db");

const MissionModel = {

  getAll(type = 'plan') { // untuk mengambil db sesuai tipe, yakni plan atau misi
    return db.prepare("SELECT * FROM missions WHERE type = ?").all(type);
  },

  getById(id) {
    return db.prepare("SELECT * FROM missions WHERE id = ?").get(id);
  },

  create(name, data, type = 'plan') { // sekarang accept data type
    const stmt = db.prepare("INSERT INTO missions (name, data, type) VALUES (?, ?, ?)");
    const result = stmt.run(name, JSON.stringify(data), type);
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
