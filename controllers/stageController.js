import Stage from "../models/stageModel.js";
import Bill from "../models/billModel.js";

// ✅ Get all stages sorted by order
export const getStages = async (req, res) => {
    try {
        let stages = await Stage.find().sort({ order: 1 });

        // Seed defaults if empty
        if (stages.length === 0) {
            const defaults = [
                "Lead", "Contacted", "Meeting", "Proposal",
                "Negotiation", "Review", "Closed"
            ];
            const stageDocs = defaults.map((name, index) => ({ name, order: index }));
            stages = await Stage.insertMany(stageDocs);
        }

        res.status(200).json({ success: true, data: stages });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Create a new stage
export const createStage = async (req, res) => {
    try {
        const { name } = req.body;
        const count = await Stage.countDocuments();
        const stage = new Stage({ name, order: count });
        await stage.save();
        res.status(201).json({ success: true, data: stage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Update Stage Name
export const updateStage = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const stage = await Stage.findByIdAndUpdate(id, { name }, { new: true });
        res.status(200).json({ success: true, data: stage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ... (other functions remain the same)

// ... (other functions remain the same)

// ✅ Delete Stage (Safe Delete)
export const deleteStage = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Find the stage to delete
        const stageToDelete = await Stage.findById(id);
        if (!stageToDelete) {
            return res.status(404).json({ success: false, message: "Stage not found" });
        }

        // 2. Find a fallback stage (Previous one, or next one if it's the first)
        // Sort by order to ensure we get the correct 'previous' one
        const allStages = await Stage.find().sort({ order: 1 });

        let fallbackStage = null;
        const index = allStages.findIndex(s => s._id.toString() === id);

        if (index > 0) {
            fallbackStage = allStages[index - 1]; // Move to previous
        } else if (allStages.length > 1) {
            fallbackStage = allStages[index + 1]; // Move to next (if deleting first)
        }

        // 3. Move bills to fallback stage (if exists)
        if (fallbackStage) {
            await Bill.updateMany(
                { stageId: id },
                { stageId: fallbackStage._id }
            );
        } else {
            // If no other stages exist, bills become 'unassigned' (null stageId)
            await Bill.updateMany(
                { stageId: id },
                { stageId: null }
            );
        }

        // 4. Delete the stage
        await Stage.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Stage deleted",
            fallbackStage: fallbackStage ? fallbackStage.name : "Unassigned"
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
