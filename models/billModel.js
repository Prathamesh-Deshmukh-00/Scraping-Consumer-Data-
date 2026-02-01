import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    consumerNumber: { type: String, required: true },
    billingUnit: { type: String, required: true },
    pc: { type: String },
    consumption: { type: String },
    meterStatus: { type: String },
    billPeriod: { type: String },
    billMonth: { type: String },
    billDate: { type: String },
    billAmount: { type: String },
    billDueDate: { type: String },
    billAmountAfterDueDate: { type: String },
    promptPaymentDate: { type: String },
    billAmountWithPromptDiscount: { type: String },
    mobileNo: { type: String },
    amountToPay: { type: String },

    // ✅ Updated status field
    status: {
      type: String,
      enum: ["pending", "inprocess", "success", "fail"],
      default: "pending",
    },

    // ✅ Priority Level (P1, P2, P3) - Only relevant when status is 'inprocess'
    priority: {
      type: String,
      enum: ["none", "p1", "p2", "p3"],
      default: "none",
    },

    // ✅ Pipeline Stage Reference (Kanban)
    stageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stage",
      default: null,
    },

    // ✅ Added note field
    note: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Bill = mongoose.model("Bill", billSchema);
export default Bill;
