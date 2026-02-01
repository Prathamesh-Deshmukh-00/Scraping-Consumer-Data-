// 1. Load environment variables from the .env file immediately
import 'dotenv/config';

import { GoogleGenAI, Type } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import ConsumerNumber from "./models/consumerNumberModel.js";

// --- Configuration ---
const IMAGE_FOLDER = "./Images";
const MODEL_NAME = "gemini-2.5-flash-lite";
const MAX_RETRIES = 5;
const MAX_REQUESTS_PER_MINUTE = 5;
// Calculate the minimum delay required to stay under the limit
const MIN_DELAY_MS = (60 / MAX_REQUESTS_PER_MINUTE) * 1000;
// --- End Configuration ---

// Initialize the client. It will automatically use the GEMINI_API_KEY from the environment.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

async function main(targetFiles = []) {
  try {
    let files = [];

    // 1. Determine which files to process
    if (targetFiles && targetFiles.length > 0) {
      files = targetFiles;
    } else {
      // Fallback to directory scan
      if (!fs.existsSync(IMAGE_FOLDER)) {
        console.error(`Image folder not found: ${IMAGE_FOLDER}`);
        return [];
      }
      files = fs.readdirSync(IMAGE_FOLDER)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ext === ".png" || ext === ".jpg" || ext === ".jpeg";
        })
        .map(file => path.join(IMAGE_FOLDER, file));
    }

    if (files.length === 0) {
      console.log("No images found to process.");
      return [];
    }

    console.log(`Found ${files.length} images to process.`);

    const allResults = [];

    // 2. Process each image with rate limiting
    for (const filePath of files) {
      console.log(`Processing: ${filePath}`);
      const startTime = Date.now();

      try {
        const result = await extractWithRetry(filePath);
        if (result && result.consumer_Bill_Number) {
          console.log(`   -> Extracted: ${result.consumer_Bill_Number}`);
          const consumerNumber = result.consumer_Bill_Number;

          // Rename file
          const dir = path.dirname(filePath);
          const ext = path.extname(filePath);
          const safeNumber = consumerNumber.replace(/[^a-z0-9]/gi, '_');
          const finalPath = path.join(dir, `${safeNumber}_${Date.now()}${ext}`);

          fs.renameSync(filePath, finalPath);
          console.log(`   -> Renamed to: ${path.basename(finalPath)}`);

          allResults.push({
            file: filePath,
            newPath: finalPath,
            data: { consumer_Bill_Number: consumerNumber }
          });

          // ✅ Save to MongoDB (Upsert to prevent duplicates)
          try {
            await ConsumerNumber.findOneAndUpdate(
              { consumerNumber: consumerNumber },
              { consumerNumber: consumerNumber },
              { upsert: true, new: true }
            );
            console.log(`   -> Saved to MongoDB: ${consumerNumber}`);
          } catch (dbError) {
            console.error(`   -> MongoDB Save Error: ${dbError.message}`);
          }

        } else {
          console.log(`   -> No number extracted.`);
        }
      } catch (error) {
        console.error(`   -> Error processing ${filePath}:`, error.message);
      }

      // Enforce rate limit delay
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_DELAY_MS) {
        await delay(MIN_DELAY_MS - elapsedTime);
      }
    }

    // Cleanup images
    try {
      for (const file of files) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    } catch (e) { }

    return allResults;

  } catch (error) {
    console.error("Fatal error in main loop:", error);
    throw error;
  }
}

export { main };
