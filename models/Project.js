import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  workerName: String,
  operation: String,
  note: { type: String, default: "" },
  type: { type: String, enum: ["auto", "manual"], default: "manual" },
});

const materialSchema = new mongoose.Schema({
  name: String,
  specs: { type: String, default: "" },
  useQty: { type: Number, default: 1 },
});

const treatmentSchema = new mongoose.Schema({
  pipeCutting: { qty: String, m: String, thickness: String },
  sheetCutting: { qty: String, m: String, thickness: String },
  welding: { m: String, size: String },
  bending: { qty: String, thickness: String },
  grinding: { m: String },
  drilling: { qty: String, dia: String },
  assembly: { qty: String, kg: String },
}, { _id: false });

const drawingSchema = new mongoose.Schema({
  drawingNo: String,
  partName: String,
  assemblyName: { type: String, default: "" },
  weight: { type: String, default: "" },
  quantity: { type: Number, default: 1 },
  pdfFile: { type: String, default: "" },
  dwgFile: { type: String, default: "" },
  isAssemblyDrawing: { type: Boolean, default: false },
  treatments: [treatmentSchema],
  assignedWorkers: [assignmentSchema],
  assignedMaterials: [materialSchema],
});

const projectSchema = new mongoose.Schema({
  rn: { type: String, required: true },
  name: { type: String, required: true },
  client: { type: String, default: "" },
  responsible: { type: String, default: "" },
  company: { type: String, required: true },
  status: { type: String, default: "active" },
  drawings: [drawingSchema],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Project", projectSchema);
