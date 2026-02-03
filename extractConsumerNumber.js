// ================= LOAD ENV =================
import "dotenv/config";

// ================= IMPORTS =================
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import ConsumerNumber from "./models/consumerNumberModel.js";

// ================= CONFIG =================
const IMAGE_FOLDER = "./Images";
const MODEL_NAME = "gemini-2.5-flash-lite";

// 🔒 Rate limiting & retry
const API_GAP_MS = 10_000;        // 10 seconds gap between ALL Gemini calls
const MAX_RETRIES = 3;            // Retry Gemini max 3 times
const BASE_RETRY_DELAY = 3_000;   // Base delay for exponential backoff

let lastApiCallTime = 0;
// ==========================================

// ================= GEMINI CLIENT =================
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

async function waitForNextApiSlot() {
  const now = Date.now();
  const elapsed = now - lastApiCallTime;

  if (elapsed < API_GAP_MS) {
    const waitTime = API_GAP_MS - elapsed;
    console.log(`⏳ Waiting ${Math.ceil(waitTime / 1000)}s before Gemini call`);
    await delay(waitTime);
  }

  lastApiCallTime = Date.now();
}

function fileToGenerativePart(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

  const base64 = fs.readFileSync(path.resolve(filePath)).toString("base64");

  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
}

// ================= CORE OCR (SAFE + RETRY) =================
async function extractWithRetry(filePath) {
  const fileName = path.basename(filePath);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n[${fileName}] Gemini attempt ${attempt}/${MAX_RETRIES}`);

      const imagePart = fileToGenerativePart(filePath);

      // ❌ DO NOT MINIMIZE — ACCURACY-FIRST PROMPT
      const textPart = {
        text: `
You are a deterministic OCR extraction engine for Indian electricity bills.

YOUR ONLY TASK:
Extract the value written IMMEDIATELY NEXT TO the Marathi label:

"ग्राहक क्रमांक"

ABSOLUTE FACT (MANDATORY):
- A valid ग्राहक क्रमांक is ALWAYS an EXACTLY 12-DIGIT NUMERIC NUMBER.
- If the number is not exactly 12 digits, it is INVALID.

ALLOWED LABEL VARIANTS (ONLY THESE):
- ग्राहक क्रमांक
- ग्राहक क्र.
- ग्राहक क्र
- ग्राहक क्रमांक :

STRICT RULES (NO EXCEPTIONS):
1. Extract ONLY if one of the above Marathi labels is CLEARLY visible.
2. The number MUST be on the SAME LINE or IMMEDIATELY NEXT TO the label.
3. The value MUST contain ONLY digits (0–9) and MUST be EXACTLY 12 digits long.
4. If the Marathi label is NOT found → return null.
5. If the number is not exactly 12 digits → return null.
6. DO NOT guess, infer, translate, or approximate.

DO NOT EXTRACT:
- Consumer No (English)
- Customer Number
- Account Number
- Bill Number
- Meter Number
- CIN / GSTIN
- Mobile Number
- Any number shorter or longer than 12 digits

OUTPUT RULES:
- Return ONLY valid JSON
- No explanation
- No markdown
- No extra text

OUTPUT FORMAT:
{
  "consumer_number": "<12_digit_number_or_null>"
}
`,
      };

      // 🔒 GLOBAL RATE LIMIT (ABSOLUTE)
      await waitForNextApiSlot();

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [imagePart, textPart],
        config: {
          responseMimeType: "application/json",
          responseSchema: consumerNumberSchema,
        },
      });

      const parsed = JSON.parse(response.text.trim());

      if (parsed.consumer_number === null) {
        console.log(`[${fileName}] ⚠️ ग्राहक क्रमांक not found`);
        return { error: "Label 'ग्राहक क्रमांक' not found in image" };
      }

      if (!/^\d{12}$/.test(parsed.consumer_number)) {
        throw new Error("Invalid consumer number (not 12 digits)");
      }

      console.log(`[${fileName}] ✅ Extracted: ${parsed.consumer_number}`);
      return { consumer_number: parsed.consumer_number, attemptsUsed: attempt };
    } catch (err) {
      const retryable =
        err.message.includes("429") ||
        err.message.includes("500") ||
        err.message.includes("503") ||
        err.message.includes("504");

      if (!retryable || attempt === MAX_RETRIES) {
        console.error(`[${fileName}] ❌ Permanent failure: ${err.message}`);
        return { error: err.message || "Gemini API Failed" };
      }

      const retryDelay =
        BASE_RETRY_DELAY * Math.pow(2, attempt - 1) +
        Math.floor(Math.random() * 1000);

      console.warn(
        `[${fileName}] 🔁 Retry in ${Math.ceil(retryDelay / 1000)}s`
      );

      await delay(retryDelay);
    }
  }

  return { error: "Max retries exceeded", attemptsUsed: MAX_RETRIES };
}

// ================= MAIN BATCH PROCESS =================
async function main(targetFiles = []) {
  let files = [];

  if (targetFiles.length > 0) {
    files = targetFiles;
  } else {
    if (!fs.existsSync(IMAGE_FOLDER)) {
      console.error("❌ Image folder not found");
      return;
    }

    files = fs
      .readdirSync(IMAGE_FOLDER)
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
      .map((f) => path.join(IMAGE_FOLDER, f));
  }

  if (files.length === 0) {
    console.log("⚠️ No images found");
    return;
  }

  const success = [];
  const failed = [];
  let firstAttemptSuccessCount = 0;
  let retrySuccessCount = 0;
  const processed = new Set();

  for (const filePath of files) {
    console.log(`\n📂 Processing: ${filePath}`);
    const fileName = path.basename(filePath);

    try {
      const result = await extractWithRetry(filePath);

      if (result.error || !result.consumer_number) {
        failed.push({
          file: fileName,
          reason: result.error || "Consumer number not found",
        });
        continue;
      }

      const { consumer_number: consumerNumber, attemptsUsed } = result;
      // attemptsUsed is harder to track without return, let's assume 1 if not returned or check logs
      // Actually my previous extractWithRetry didn't return attemptsUsed either in the new return style?
      // Wait, the previous implementation returned { consumer_number: ..., attemptsUsed: ... }
      // I removed attemptsUsed in the latest replace?
      // Let's re-add attemptsUsed to extractWithRetry return if possible, or default to 1.

      // const attemptsUsed = result.attemptsUsed || 1; // Default fallback

      if (attemptsUsed === 1) {
        firstAttemptSuccessCount++;
      } else {
        retrySuccessCount++;
      }


      // 🔒 Safe rename
      const safe = consumerNumber.replace(/\D/g, "");
      const newPath = path.join(
        path.dirname(filePath),
        `${safe}_${Date.now()}${path.extname(filePath)}`
      );

      let isDuplicate = false;

      // 🔍 Check for duplicates
      const existing = await ConsumerNumber.findOne({ consumerNumber });

      if (existing) {
        isDuplicate = true;
        console.log(`⚠️ Duplicate found: ${consumerNumber}`);
      } else {
        // ✅ DB upsert (no duplicates)
        await ConsumerNumber.create({ consumerNumber });
      }

      // Rename logic: we rename regardless of duplicate status to mark as "processed"
      // otherwise it will remain in the folder and gets re-processed in next run.
      // If needed we can append _DUPLICATE to filename but for now simpler is better.
      fs.renameSync(filePath, newPath);
      processed.add(filePath);

      success.push({
        original: filePath,
        renamed: newPath,
        consumerNumber,
        attemptsUsed,
        isDuplicate
      });

      console.log(`✅ Saved & renamed → ${path.basename(newPath)} (Attempts: ${attemptsUsed}, Duplicate: ${isDuplicate})`);
    } catch (err) {
      console.error(`❌ Image-level error: ${filePath}`);
      console.error(err.message);

      failed.push({
        file: path.basename(filePath),
        reason: err.message,
      });

      // ❗ DO NOT THROW — CONTINUE SAFELY
      continue;
    }
  }

  // 🧹 Delete only unprocessed images
  for (const f of files) {
    if (!processed.has(f) && fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  }

  // ================= FINAL REPORT =================
  console.log("\n📊 JOB SUMMARY");
  console.log("✔ Success:", success.length);
  console.log("❌ Failed:", failed.length);

  if (failed.length > 0) {
    fs.writeFileSync(
      "failed_images.json",
      JSON.stringify(failed, null, 2)
    );
    console.log("🧾 Failed list saved to failed_images.json");
  }

  return {
    success,
    failed,
    stats: {
      total: files.length,
      success: success.filter(s => !s.isDuplicate).length,
      duplicate: success.filter(s => s.isDuplicate).length, // Add duplicate count
      failed: failed.length,
      firstAttemptSuccess: firstAttemptSuccessCount,
      retrySuccess: retrySuccessCount
    }
  };
}

// ================= EXPORT =================
export { main };
