const express = require("express");
const router = express.Router();
const MissionController = require("../controllers/missionController");

router.get("/", MissionController.getAllMissions);
router.post("/", MissionController.createMission);
router.get("/:id", MissionController.getMissionById);
router.put("/:id", MissionController.updateMission);
router.delete("/:id", MissionController.deleteMission);

module.exports = router;
