// ================= LOAD ENV =================
import "dotenv/config";

// ================= IMPORTS =================
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import ConsumerNumber from "./models/consumerNumberModel.js";

// ================= CONFIG =================
const IMAGE_FOLDER = "./Images";

// MODEL PRIORITY
// Removed Pro model as per request.
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

// Retry + rate-limit
const API_GAP_MS = 1500;        // Reduced from 10s to 1.5s
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 2000;
const CONCURRENCY_LIMIT = 3;    // Process 3 images at once

// ================= GEMINI CLIENTS (ROTATION) =================
const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2
].filter(Boolean); // Filter out undefined keys

if (apiKeys.length === 0) {
  console.error("❌ NO GEMINI API KEYS FOUND IN .ENV");
}

const clients = apiKeys.map(key => new GoogleGenAI({ apiKey: key }));

// ================= RESPONSE SCHEMA =================
const consumerNumberSchema = {
  type: Type.OBJECT,
  properties: {
    consumer_number: {
      type: [Type.STRING, Type.NULL],
      description:
        "12-digit number written next to Marathi label ग्राहक क्रमांक. Null if not found.",
    },
  },
  required: ["consumer_number"],
};

// ================= UTILITIES =================
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Simple concurrency limiter
async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

function bufferToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

function fileToGenerativePart(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  return bufferToGenerativePart(fs.readFileSync(filePath), mimeType);
}

// ================= PROMPT =================
const OCR_PROMPT = `
You are a deterministic OCR extraction engine for Indian electricity bills.

YOUR ONLY TASK:
Extract the value written IMMEDIATELY NEXT TO the Marathi label:

"ग्राहक क्रमांक"

ABSOLUTE FACT:
- A valid ग्राहक क्रमांक is ALWAYS an EXACTLY 12-DIGIT NUMERIC NUMBER.

ALLOWED LABEL VARIANTS:
- ग्राहक क्रमांक
- ग्राहक क्र.
- ग्राहक क्र
- ग्राहक क्रमांक :

STRICT RULES:
1. Extract ONLY if label is clearly visible.
2. Number must be on SAME LINE or IMMEDIATELY NEXT TO label.
3. Digits only, EXACTLY 12 digits.
4. If label not found → null.
5. If digits not 12 → null.
6. DO NOT guess.

DO NOT EXTRACT:
- Consumer No / Account No / Meter No
- Bill No / GSTIN / Mobile No

OUTPUT:
JSON ONLY. No text. No markdown.

FORMAT:
{
  "consumer_number": "<12_digit_or_null>"
}
`;

// ================= CORE OCR WITH FALLBACK & ROTATION =================
async function extractWithRetry(fileObj, isBuffer = false) {
  const fileName = isBuffer ? fileObj.originalname : path.basename(fileObj);
  const models = [PRIMARY_MODEL, FALLBACK_MODEL]; // Pro model removed

  let attempt = 0;

  for (const model of models) {
    // Try each client (API Key) for specific model
    // Logic: If Key 1 fails, try Key 2 with SAME model before moving to next model
    // Or: We can rotate keys per request. Let's try Key Rotation logic inside the loop.

    for (let retry = 1; retry <= MAX_RETRIES; retry++) {
      attempt++;

      // Pick client based on rotation or fallback? 
      // Strategy: Try Primary Key. If 429/Error, try Secondary Key immediately.

      let lastError = null;

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        const keyName = i === 0 ? "Key 1" : "Key 2";

        try {
          await delay(Math.random() * 500);

          console.log(`[${fileName}] Processing on ${model} (Using ${keyName})...`);

          const imagePart = isBuffer
            ? bufferToGenerativePart(fileObj.buffer, fileObj.mimetype)
            : fileToGenerativePart(fileObj);

          const response = await client.models.generateContent({
            model,
            contents: [
              imagePart,
              { text: OCR_PROMPT },
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: consumerNumberSchema,
            },
          });

          const parsed = JSON.parse(response.text.trim());

          if (parsed.consumer_number === null) {
            throw new Error("Label not found");
          }

          if (!/^\d{12}$/.test(parsed.consumer_number)) {
            throw new Error("Invalid digit length");
          }

          return {
            consumer_number: parsed.consumer_number,
            modelUsed: model,
            attemptsUsed: attempt,
            keyUsed: keyName
          };

        } catch (err) {
          lastError = err;
          const msg = err.message || "";
          // If it's a 429 or server error, continue loop to try next key immediately
          if (msg.includes("429") || msg.includes("503")) {
            console.warn(`[${fileName}] ${keyName} Exhausted/Error (${msg}). Switching key...`);
            continue; // Try next key
          } else {
            // If it's a logic error (Parsed null), breaking inner key loop to trigger normal retry
            break;
          }
        }
      }

      // If we are here, all keys failed for this retry attempt
      if (retry < MAX_RETRIES) {
        const backoff = BASE_RETRY_DELAY * Math.pow(1.5, retry - 1);
        console.warn(`[${fileName}] Retry ${retry} failed on all keys. Backing off ~${Math.ceil(backoff)}ms`);
        await delay(backoff);
      }
    }
  }

  return { error: "All models and keys failed" };
}

// ================= MAIN PROCESS =================
async function main(filesArg = null) {
  // Ensure Pending and Failed folders exist
  const PENDING_FOLDER = "./PendingImages";
  const FAIL_FOLDER = "./FailedImages";
  [PENDING_FOLDER, FAIL_FOLDER].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  let filesToProcess = [];
  let isBufferMode = false;

  if (filesArg && Array.isArray(filesArg) && filesArg.length > 0) {
    filesToProcess = filesArg; // Memory mode
    isBufferMode = true;
  } else {
    // Disk mode (fallback)
    if (!fs.existsSync(IMAGE_FOLDER)) {
      console.error("❌ Image folder not found");
      return { success: [], failed: [], stats: {} };
    }
    filesToProcess = fs
      .readdirSync(IMAGE_FOLDER)
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
      .map((f) => path.join(IMAGE_FOLDER, f));
  }

  console.log(`\n🚀 Starting Batch Processing: ${filesToProcess.length} files`);

  const success = [];
  const failed = [];
  let firstAttemptSuccess = 0;
  let retrySuccess = 0;

  // Flag to abort remaining queue
  let stopProcessing = false;

  // WORKER FUNCTION for concurrent pool
  const worker = async (fileObj) => {
    if (stopProcessing) return; // Hook to abort pending workers if limits hit

    const fileName = isBufferMode ? fileObj.originalname : path.basename(fileObj);

    try {
      const result = await extractWithRetry(fileObj, isBufferMode);

      if (result.error) {
        // === SAVE FAILED IMAGE ===
        // Sanitize error message for filename
        const safeReason = (result.error || "Unknown").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
        const failName = `FAILED_${safeReason}_${Date.now()}_${fileName}`;
        const destPath = path.join(FAIL_FOLDER, failName);

        try {
          if (isBufferMode && fileObj.buffer) {
            fs.writeFileSync(destPath, fileObj.buffer);
            console.log(`⚠️  Saved failed image: ${failName}`);
          } else if (!isBufferMode) {
            fs.copyFileSync(fileObj, destPath);
            console.log(`⚠️  Saved failed image: ${failName}`);
          }
        } catch (e) {
          console.error("Failed to save failed image:", e.message);
        }

        failed.push({ file: fileName, reason: result.error });

        // Delete from source if disk mode and not kept
        if (!isBufferMode) try { fs.unlinkSync(fileObj); } catch (e) { }
        return;
      }

      const { consumer_number, modelUsed, attemptsUsed } = result;

      if (attemptsUsed === 1) firstAttemptSuccess++;
      else retrySuccess++;

      let duplicate = false;
      try {
        duplicate = await ConsumerNumber.findOne({ consumerNumber: consumer_number });
        if (!duplicate) {
          await ConsumerNumber.create({ consumerNumber: consumer_number });
        } else {
          duplicate = true;
        }
      } catch (dbErr) {
        console.error("DB Error (continuing):", dbErr.message);
      }

      if (!isBufferMode) {
        const newName = `${consumer_number}_${Date.now()}${path.extname(fileObj)}`;
        try { fs.renameSync(fileObj, path.join(IMAGE_FOLDER, newName)); } catch (e) { }
      } else {
        // Save successful image to disk in buffer mode
        const newName = `${consumer_number}_${Date.now()}${path.extname(fileName)}`;
        try { fs.writeFileSync(path.join(IMAGE_FOLDER, newName), fileObj.buffer); } catch (e) {
          console.error("Failed to save successful image:", e.message);
        }
      }

      success.push({
        file: fileName,
        consumerNumber: consumer_number,
        isDuplicate: !!duplicate,
        modelUsed,
        attemptsUsed,
        original: fileName
      });

      console.log(`✅ ${fileName} -> ${consumer_number} (Model: ${modelUsed})`);

    } catch (err) {
      // Handle critical errors like QuotaExhausted
      if (err instanceof QuotaExhaustedError) {
        console.error(`\n🚨 CRITICAL: ${err.message} - STOPPING BATCH.`);
        stopProcessing = true;
        failed.push({ file: fileName, reason: "QuotaExhausted", isPending: true, data: fileObj });
      } else {
        // Unexpected critical error - save as failed
        const failName = `ERROR_UNEXPECTED_${Date.now()}_${fileName}`;
        const destPath = path.join(FAIL_FOLDER, failName);
        try {
          if (isBufferMode && fileObj.buffer) fs.writeFileSync(destPath, fileObj.buffer);
        } catch (e) { }

        console.error(`Error processing ${fileName}:`, err);
        failed.push({ file: fileName, reason: err.message });
      }
    }
  };

  // Run with concurrency limit
  await asyncPool(CONCURRENCY_LIMIT, filesToProcess, worker);

  // === HANDLE STOPPED / PENDING FILES ===
  if (stopProcessing) {
    console.log("\n🛑 Quota Reached. Saving pending images to storage...");
    let pendingCount = 0;

    // 1. Identify processed files
    const processedNames = new Set([...success, ...failed].map(f => f.file));

    // 2. Iterate original list to find stragglers
    for (const f of filesToProcess) {
      const fname = isBufferMode ? f.originalname : path.basename(f);

      // Check if this file was "left behind" or "QuotaExhausted"
      const failRecord = failed.find(x => x.file === fname);
      const isQuotaFailure = failRecord && failRecord.isPending;

      if (!processedNames.has(fname) || isQuotaFailure) {
        const timestamp = Date.now();
        const safeName = `PENDING_${timestamp}_${fname}`;
        const destPath = path.join(PENDING_FOLDER, safeName);

        try {
          if (isBufferMode && f.buffer) {
            fs.writeFileSync(destPath, f.buffer);
          } else if (!isBufferMode) {
            fs.renameSync(f, destPath);
          }
          pendingCount++;
        } catch (ex) {
          console.error(`Failed to save pending file ${fname}:`, ex.message);
        }
      }
    }
    console.log(`💾 Saved ${pendingCount} images to ${PENDING_FOLDER} for retry.`);
  }

  // Legacy failure log
  if (failed.length && !isBufferMode && !stopProcessing) {
    fs.writeFileSync("failed_images.json", JSON.stringify(failed, null, 2));
  }

  const stats = {
    total: filesToProcess.length,
    success: success.length,
    failed: failed.length,
    duplicate: success.filter(s => s.isDuplicate).length,
    firstAttemptSuccess,
    retrySuccess,
    stoppedDueToQuota: stopProcessing
  };

  console.log("\n📊 FINAL SUMMARY");
  console.log("Total:", stats.total);
  console.log("Success:", stats.success);
  console.log("Failed:", stats.failed);
  if (stopProcessing) console.log("⚠️ Batch stopped due to Daily Quota Limit");

  return { success, failed, stats };
}

// ================= EXPORT =================
export { main };
