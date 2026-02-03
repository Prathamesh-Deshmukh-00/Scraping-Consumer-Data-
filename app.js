import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import uploadRoutes from "./routes/uploadRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import stageRoutes from "./routes/stageRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// ✅ MongoDB Connection
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((error) => {
    console.error("❌ MongoDB Connection Failed:", error.message);
    process.exit(1);
  });

// ✅ Middleware
app.use(cors()); // allow all origins
app.use(express.json());

// ✅ Routes
app.use("/api", uploadRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/stages", stageRoutes);
app.use("/api/history", historyRoutes);

// ✅ Default route
app.get("/", (req, res) => {
  res.send("🚀 Customer Management System API is running...");
});

// ✅ Start Server (open for all networks)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running and accessible on all networks at port ${PORT}`);
});
