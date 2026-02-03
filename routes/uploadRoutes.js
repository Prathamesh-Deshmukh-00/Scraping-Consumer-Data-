import express from "express";
import { uploadImages } from "../controllers/uploadController.js";
import multer from "multer";

const router = express.Router();

// Configure Multer storage (Memory Storage)
const storage = multer.memoryStorage();

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
