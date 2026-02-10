const express = require("express");
const router = express.Router();

const projectController = require("../controllers/projectController");

router.post("/", projectController.create);
router.get("/", projectController.list);
router.get("/:id", projectController.getOne);
router.patch("/:id", projectController.update);
router.delete("/:id", projectController.remove);
router.patch("/:id/status", projectController.updateStatus);

module.exports = router;
