import express from "express";
import {
  getBills,
  updateBill,
  deleteBill,
} from "../controllers/billController.js";

const router = express.Router();

// ✅ GET all bills
router.get("/", getBills);

// ✅ UPDATE bill by ID
router.put("/:id", updateBill);

// ✅ DELETE bill by ID
router.delete("/:id", deleteBill);

export default router;
