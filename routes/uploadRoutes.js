import express from "express";
import { uploadImages } from "../controllers/uploadController.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Ensure upload directory exists
const uploadDir = "./images";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper to generate next sequential filename
function getNextFileNumber() {
  const files = fs.readdirSync(uploadDir);
  const billFiles = files.filter((f) => f.startsWith("ElectricityBill"));
  return billFiles.length + 1;
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const fileNumber = getNextFileNumber();
    const filename = `ElectricityBill${fileNumber}${ext}`;
    cb(null, filename);
  },
});

// File filter (optional)
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Initialize multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

// Route for multiple image upload
router.post("/upload-images", upload.array("images", 50), uploadImages);

export default router;
