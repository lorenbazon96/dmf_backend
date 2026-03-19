import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  workerName: String,
  workerId: { type: String, default: "" },
  operation: String,
  note: { type: String, default: "" },
  type: { type: String, enum: ["auto", "manual"], default: "manual" },
  status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
  estimatedMinutes: { type: Number, default: 0 },
  completedAt: { type: Date, default: null },
});

const materialSchema = new mongoose.Schema({
  name: String,
  specs: { type: String, default: "" },
  useQty: { type: Number, default: 1 },
});

const treatmentSchema = new mongoose.Schema({
  pipeCutting: { qty: String, m: String, thickness: String, cuts: String, cutType: String, profile: String },
  sheetCutting: { qty: String, m: String, thickness: String, complexity: String, method: String },
  welding: { m: String, size: String, weldType: String, position: String, passes: String },
  bending: { qty: String, thickness: String, bends: String, length: String },
  grinding: { m: String, grindType: String },
  drilling: { qty: String, dia: String, thickness: String, machine: String },
  assembly: { qty: String, kg: String, complexity: String },
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
  startedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  totalPausedMs: { type: Number, default: 0 },
  drawings: [drawingSchema],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Project", projectSchema);
