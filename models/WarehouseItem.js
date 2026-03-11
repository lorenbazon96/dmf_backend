import mongoose from "mongoose";

const warehouseItemSchema = new mongoose.Schema({
  type: { type: String, required: true },
  name: { type: String, required: true },
  specs: { type: String, default: "" },
  qty: { type: Number, default: 0 },
  company: { type: String, required: true },
});

export default mongoose.model("WarehouseItem", warehouseItemSchema);
