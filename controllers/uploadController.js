import { main } from "../extractConsumerNumber.js";

export const uploadImages = async (req, res) => {
  console.log("this controller is called ", req.files)
  try {
    const files = req.files.map((file) => ({
      filename: file.filename,
      path: file.path,
      size: file.size,
    }));

    // ✅ Run main() with SPECIFIC files
    const uploadedFilePaths = req.files.map(f => f.path);
    const extractionResults = await main(uploadedFilePaths);

    // ✅ Send response only after main() completes
    res.status(200).json({
      success: true,
      message: "Images uploaded and processed successfully!",
      processedFiles: extractionResults,
      originalFiles: files,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Error uploading or processing images",
    });
  }
};
