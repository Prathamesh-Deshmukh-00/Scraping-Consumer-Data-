// 1. Load environment variables from the .env file immediately
import 'dotenv/config';

import { GoogleGenAI, Type } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

// --- Configuration ---
const IMAGE_FOLDER = "./Images";
const MODEL_NAME = "gemini-2.5-flash-lite";
const MAX_RETRIES = 5;
const MAX_REQUESTS_PER_MINUTE = 5;
// Calculate the minimum delay required to stay under the limit
const MIN_DELAY_MS = (60 / MAX_REQUESTS_PER_MINUTE) * 1000;
// --- End Configuration ---

// Initialize the client. It will automatically use the GEMINI_API_KEY from the environment.
const ai = new GoogleGenAI({});

// Define the exact JSON schema for the model's output
const consumerNumberSchema = {
  type: Type.OBJECT,
  properties: {
    consumer_Bill_Number: {
      type: Type.STRING,
      description: "The unique consumer account number extracted from the electricity bill image.",
    },
  },
  required: ["consumer_Bill_Number"],
};

// Utility function to introduce a delay.
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Converts a local file to a GoogleGenerativeAI.Part object (Base64).
function fileToGenerativePart(filePath) {
  try {
    const mimeType =
      path.extname(filePath) === ".png" ? "image/png" : "image/jpeg";
    const absolutePath = path.resolve(filePath);
    const base64Data = fs.readFileSync(absolutePath).toString("base64");

    return {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };
  } catch (error) {
    console.error(`\n❌ Error reading file at ${filePath}: ${error.message}`);
    throw new Error(`File access failed: ${error.message}`);
  }
}

/**
 * Core function with Rate Limiting, Retry (5x), and Output Validation.
 * @param {string} filePath - The path to the image file.
 * @returns {Promise<{consumer_Bill_Number: string}|null>} - Extracted data or null on permanent failure.
 */
async function extractWithRetry(filePath) {
  const fileName = path.basename(filePath);
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    // Exponential Backoff with Jitter for retries
    let backoffDelay = Math.pow(2, attempt) * 1000;
    let jitter = Math.random() * 1000;
    const waitTime = backoffDelay + jitter;

    try {
      console.log(`\n[${fileName}] Attempt ${attempt}/${MAX_RETRIES}: Sending request.`);

      const imagePart = fileToGenerativePart(filePath);
      const textPart = {
        text: "You are an expert OCR and data extraction system. Your sole task is to find and extract the primary Consumer Bill Number from this electricity bill image. You must return only the JSON object as defined in the schema.",
      };

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [imagePart, textPart],
        config: {
          responseMimeType: "application/json",
          responseSchema: consumerNumberSchema,
        },
      });

      // Output Validation Check
      const jsonText = response.text.trim();
      const parsedOutput = JSON.parse(jsonText);

      if (
        typeof parsedOutput.consumer_Bill_Number === "string" &&
        parsedOutput.consumer_Bill_Number.length > 0
      ) {
        console.log(`[${fileName}] ✅ SUCCESS: Extracted number.`);
        return parsedOutput;
      }

      throw new Error(
        `Output format error: 'consumer_Bill_Number' field was empty or invalid. Raw output: ${jsonText}`
      );
    } catch (error) {
      const errorMessage = error.message.toLowerCase();
      const isRetryable =
        errorMessage.includes("429") ||
        errorMessage.includes("500") ||
        errorMessage.includes("503") ||
        errorMessage.includes("504") ||
        errorMessage.includes("output format error");

      if (isRetryable && attempt < MAX_RETRIES) {
        console.warn(
          `[${fileName}] ⚠️ Retryable error detected (${error.message.split("\n")[0]}). Retrying in ${Math.round(waitTime / 1000)}s...`
        );
        await delay(waitTime);
      } else {
        console.error(
          `[${fileName}] ❌ PERMANENT FAILURE after ${attempt} attempts: ${error.message.split("\n")[0]}`
        );
        return null;
      }
    }
  }

  return null; // All retries failed
}

async function main() {
  console.log(`Starting batch extraction from folder: ${IMAGE_FOLDER}`);
  console.log(
    `Target rate limit: Max ${MAX_REQUESTS_PER_MINUTE} RPM (Min delay: ${MIN_DELAY_MS}ms)`
  );
  console.log(`Max retries per file: ${MAX_RETRIES}`);
  console.log(
    "----------------------------------------------------------------------------------"
  );

  // 2. Process all images in the Images folder
  if (!fs.existsSync(IMAGE_FOLDER)) {
    console.error(
      `\nFATAL ERROR: Image folder not found at path: ${IMAGE_FOLDER}. Please create it and add images.`
    );
    return;
  }

  const files = fs
    .readdirSync(IMAGE_FOLDER)
    .filter((file) => /\.(png|jpe?g)$/i.test(file))
    .map((file) => path.join(IMAGE_FOLDER, file));

  if (files.length === 0) {
    console.log(
      "\nNo image files found. Please ensure images are in the './Images' folder. Exiting."
    );
    return;
  }

  const allResults = [];

  // Process each file sequentially with rate limiting
  for (const [index, filePath] of files.entries()) {
    const startTime = Date.now();

    const result = await extractWithRetry(filePath);

    if (result) {
      allResults.push({
        file: path.basename(filePath),
        data: result,
      });
    } else {
      allResults.push({
        file: path.basename(filePath),
        data: { consumer_Bill_Number: "EXTRACTION_FAILED_PERMANENTLY" },
      });
    }

    // Rate Limiting Logic
    const elapsedTime = Date.now() - startTime;
    const timeToWait = MIN_DELAY_MS - elapsedTime;

    if (timeToWait > 0 && index < files.length - 1) {
      console.log(
        `[RATE LIMITER] Delaying for ${Math.round(timeToWait / 1000)}s to ensure ≤ ${MAX_REQUESTS_PER_MINUTE} RPM...`
      );
      await delay(timeToWait);
    }
  }

  // Final Summary Output
  console.log("\n==================================================================================");
  console.log("                           ✅ BATCH PROCESSING COMPLETE");
  console.log("==================================================================================");
  console.table(
    allResults.map((r) => ({
      File: r.file,
      "Consumer Number": r.data.consumer_Bill_Number,
    }))
  );
  console.log(`\nProcessed ${files.length} image(s).`);

  // ✅ Save only consumer bill numbers as array in ConsumerBillNumber.js
  const outputPath = path.resolve("./ConsumerBillNumber.js");

  try {
    // Extract only bill numbers from allResults
    const newBillNumbers = allResults
      .map(item => item.data.consumer_Bill_Number)
      .filter(Boolean); // remove undefined or null entries

    let existingNumbers = [];

    // If file already exists, read existing array
    if (fs.existsSync(outputPath)) {
      const existingContent = fs.readFileSync(outputPath, "utf-8");

      // Try extracting existing array safely
      const match = existingContent.match(/\[([\s\S]*?)\]/);
      if (match) {
        existingNumbers = JSON.parse("[" + match[1] + "]");
      }
    }

    // Merge and remove duplicates
    const updatedNumbers = Array.from(new Set([...existingNumbers, ...newBillNumbers]));

    // Prepare updated JS file content
    const jsContent = `export const ConsumerBillNumber = ${JSON.stringify(updatedNumbers, null, 2)};\n`;

    // Write to file
    fs.writeFileSync(outputPath, jsContent, "utf-8");
    console.log(`\n📄 Consumer bill numbers updated in: ${outputPath}`);
  } catch (error) {
    console.error(`\n❌ Failed to save bill numbers: ${error.message}`);
  }

  console.log("\nresponse is:", allResults);

  // ✅ Delete all used images after completion
  try {
    for (const file of files) {
      fs.unlinkSync(file);
    }
    console.log(`\n🧹 All processed images deleted from: ${IMAGE_FOLDER}`);
  } catch (error) {
    console.error(`\n❌ Failed to delete images: ${error.message}`);
  }
}

export {main};
