import mongoose from "mongoose";
const schema = new mongoose.Schema({
  warehouseItemId: { type: mongoose.Schema.Types.ObjectId, ref: "WarehouseItem", required: true }, company: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null }, projectRn: { type: String, default: "" }, itemName: { type: String, required: true },
  qtyDelta: { type: Number, default: 0 }, reservedDelta: { type: Number, default: 0 },
  type: { type: String, enum: ["opening", "manual-adjustment", "manual-receipt", "manual-issue", "reserve", "release", "project-consumption", "project-adjustment"], required: true },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, required: true }, supplier: { type: String, default: "" }, destination: { type: String, default: "" }, reason: { type: String, default: "" }, createdAt: { type: Date, default: Date.now },
});
schema.index({ warehouseItemId: 1, createdAt: -1 }); schema.index({ company: 1, createdAt: -1 }); schema.index({ projectId: 1, createdAt: -1 });
export default mongoose.model("WarehouseMovement", schema);
