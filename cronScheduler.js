import schedule from "node-schedule";
import fs from "fs";
import path from "path";
import { main } from "./extractConsumerNumber.js";

const PENDING_FOLDER = "./PendingImages";

// Run every 24 hours (e.g., at midnight)
// Cron syntax: 0 0 * * * (At 00:00 every day)
const job = schedule.scheduleJob("0 0 * * *", async function () {
    console.log("\n⏰ Running Scheduled Job: Retrying Pending Images...");

    if (!fs.existsSync(PENDING_FOLDER)) {
        console.log("📂 No Pending folder found. Skipping.");
        return;
    }

    const files = fs
        .readdirSync(PENDING_FOLDER)
        .filter((f) => /\.(png|jpg|jpeg)$/i.test(f));

    if (files.length === 0) {
        console.log("✅ No pending images to retry.");
        return;
    }

    console.log(`Found ${files.length} pending images.`);

    // Prepare files for main()
    // Since main() accepts an array of objects for buffer mode, we can read them into memory.
    // OR we can make main() robust enough to handle a different source.
    // Given current memory-mode impl, let's load them into buffers.

    const filesArg = files.map(f => {
        const fullPath = path.join(PENDING_FOLDER, f);
        const buffer = fs.readFileSync(fullPath);
        const ext = path.extname(f).toLowerCase();
        const mime = ext === ".png" ? "image/png" : "image/jpeg";

        return {
            originalname: f,
            buffer: buffer,
            mimetype: mime,
            path: fullPath // Tracking path to delete later
        };
    });

    // Run extraction
    try {
        const results = await main(filesArg);

        // Cleanup successfully processed pending files
        // 'results.success' contains { original: 'filename' }
        // We should match and delete from PENDING_FOLDER

        results.success.forEach(s => {
            const processedFile = filesArg.find(f => f.originalname === s.original);
            if (processedFile) {
                try { fs.unlinkSync(processedFile.path); } catch (e) { }
            }
        });

        console.log(`🎉 Retry Job Complete. Processed: ${results.stats.success}`);

    } catch (err) {
        console.error("❌ Scheduled Job Failed:", err);
    }
});

export default job;
