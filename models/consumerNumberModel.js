import mongoose from "mongoose";

const consumerNumberSchema = new mongoose.Schema(
    {
        consumerNumber: {
            type: String,
            required: true,
            unique: true, // Ensure no duplicates
            trim: true,
        },
    },
    { timestamps: true }
);

const ConsumerNumber = mongoose.model("ConsumerNumber", consumerNumberSchema);

export default ConsumerNumber;
