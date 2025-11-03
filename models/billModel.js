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
