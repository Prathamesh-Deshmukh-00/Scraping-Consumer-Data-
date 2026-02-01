import mongoose from "mongoose";

const stageSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        order: { type: Number, required: true },
    },
    { timestamps: true }
);

const Stage = mongoose.model("Stage", stageSchema);
export default Stage;
