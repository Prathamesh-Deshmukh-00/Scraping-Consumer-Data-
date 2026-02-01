import ConsumerNumber from "../models/consumerNumberModel.js";
import Bill from "../models/billModel.js";
// fs not needed anymore for this controller

// ✅ GET all bills
export const getBills = async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET all bills numbers (From MongoDB)
export const getBillsNumber = async (req, res) => {
  try {
    const numbersDocs = await ConsumerNumber.find().sort({ createdAt: -1 });
    const billNumbers = numbersDocs.map(doc => doc.consumerNumber);
    res.status(200).json({ success: true, data: billNumbers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UPDATE bill by ID
export const updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBill = await Bill.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedBill)
      return res.status(404).json({ success: false, message: "Bill not found" });

    res.status(200).json({
      success: true,
      message: "Bill updated successfully",
      data: updatedBill,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ DELETE bill by ID
export const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBill = await Bill.findByIdAndDelete(id);

    if (!deletedBill)
      return res.status(404).json({ success: false, message: "Bill not found" });

    res.status(200).json({
      success: true,
      message: "Bill deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
