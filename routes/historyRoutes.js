import express from "express";
import { getExtractionHistory } from "../controllers/historyController.js";

const router = express.Router();

router.get("/", getExtractionHistory);

export default router;
