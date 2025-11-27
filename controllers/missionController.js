const Mission = require("../models/missionModel");

exports.getAllMissions = (req, res) => {
  const type = req.query.type || 'plan';
  res.json(Mission.getAll(type));
};

exports.getMissionById = (req, res) => {
  res.json(Mission.getById(req.params.id));
};

exports.createMission = (req, res) => {
  const { name, data, type } = req.body;
  const result = Mission.create(name, data, type);
  res.json({ message: "Mission created", id: result.id });
};

exports.updateMission = (req, res) => {
  const { name, data } = req.body;
  Mission.update(req.params.id, name, data);
  res.json({ message: "Mission updated" });
};

exports.deleteMission = (req, res) => {
  Mission.delete(req.params.id);
  res.json({ message: "Mission deleted" });
};
