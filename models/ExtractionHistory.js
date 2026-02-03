import mongoose from "mongoose";

const extractionHistorySchema = new mongoose.Schema({
    batchId: { type: String, required: true, index: true }, // Group sequential uploads
    timestamp: { type: Date, default: Date.now },
    totalImages: { type: Number, required: true, default: 0 },
    successCount: { type: Number, required: true, default: 0 },
    duplicateCount: { type: Number, required: true, default: 0 }, // Track duplicates
    duplicates: [
        {
            filename: String,
            consumerNumber: String,
        },
    ],
    failedCount: { type: Number, required: true, default: 0 },
    firstAttemptSuccessCount: { type: Number, default: 0 },
    retrySuccessCount: { type: Number, default: 0 },
    failures: [
        {
            filename: String,
            reason: String,
        },
    ],
});

export default mongoose.model("ExtractionHistory", extractionHistorySchema);
