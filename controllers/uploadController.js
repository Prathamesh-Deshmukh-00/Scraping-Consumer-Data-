export const uploadImages = (req, res) => {
  try {
    const files = req.files.map((file) => ({
      filename: file.filename,
      path: file.path,
      size: file.size,
    }));

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully!",
      files,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Error uploading images",
    });
  }
};
