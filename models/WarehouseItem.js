import mongoose from "mongoose";

const warehouseItemSchema = new mongoose.Schema({
  type: { type: String, required: true },
  name: { type: String, required: true },
  specs: { type: String, default: "" },
  qty: { type: Number, default: 0, min: 0 },
  reservedQty: { type: Number, default: 0, min: 0 },
  company: { type: String, required: true },
});

warehouseItemSchema.virtual("availableQty").get(function () { return this.qty - this.reservedQty; });
warehouseItemSchema.set("toJSON", { virtuals: true });
warehouseItemSchema.pre("validate", function () {
  if (this.reservedQty > this.qty) this.invalidate("reservedQty", "reservedQty cannot exceed qty");
});

export default mongoose.model("WarehouseItem", warehouseItemSchema);
