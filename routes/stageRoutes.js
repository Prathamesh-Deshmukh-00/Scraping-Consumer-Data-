import express from "express";
import { getStages, createStage, updateStage, deleteStage } from "../controllers/stageController.js";

const router = express.Router();

router.get("/", getStages);
router.post("/", createStage);
router.put("/:id", updateStage);
router.delete("/:id", deleteStage);

export default router;
