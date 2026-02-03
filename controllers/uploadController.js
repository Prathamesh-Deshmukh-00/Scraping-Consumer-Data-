import { main } from "../extractConsumerNumber.js";
import ExtractionHistory from "../models/ExtractionHistory.js";
import path from "path";

export const uploadImages = async (req, res) => {
  console.log("this controller is called ", req.files)
  try {
    const files = req.files.map((file) => ({
      filename: file.originalname, // Use originalname since we don't save to disk
      size: file.size,
    }));

    // ✅ Run main() with IN-MEMORY buffers
    // req.files is now an array of objects with { buffer, mimetype, originalname, ... }
    const extractionResults = await main(req.files);
    const batchId = req.body.batchId || `batch_${Date.now()}`;

    // Save History (Upsert/Update logic for batch)
    if (extractionResults?.stats) {
      await ExtractionHistory.findOneAndUpdate(
        { batchId: batchId },
        {
          $setOnInsert: { timestamp: new Date() },
          $inc: {
            totalImages: extractionResults.stats.total,
            successCount: extractionResults.stats.success,
            duplicateCount: extractionResults.stats.duplicate || 0,
            failedCount: extractionResults.stats.failed,
            firstAttemptSuccessCount: extractionResults.stats.firstAttemptSuccess,
            retrySuccessCount: extractionResults.stats.retrySuccess
          },
          $push: {
            failures: {
              $each: extractionResults.failed.map(f => ({
                filename: f.file,
                reason: f.reason
              }))
            },
            duplicates: {
              $each: extractionResults.success
                .filter(s => s.isDuplicate)
                .map(s => ({
                  filename: path.basename(s.original),
                  consumerNumber: s.consumerNumber
                }))
            }
          }
        },
        { upsert: true, new: true }
      );
    }

    // ✅ Send response only after main() completes
    res.status(200).json({
      success: true,
      message: "Images uploaded and processed successfully!",
      processedFiles: extractionResults.success, // Keep compatibility if needed, or send full object
      extractionReport: extractionResults, // Send full report
      originalFiles: files,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Error uploading or processing images",
    });
  }
};
