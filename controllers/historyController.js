import ExtractionHistory from "../models/ExtractionHistory.js";

export const getExtractionHistory = async (req, res) => {
    try {
        const history = await ExtractionHistory.find().sort({ timestamp: -1 });
        res.status(200).json({
            success: true,
            history,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message || "Error fetching history",
        });
    }
};
