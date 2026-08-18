import mongoose from "mongoose";

const taskHistorySchema = new mongoose.Schema({
  from: String,
  to: String,
  at: Date,
  actorUserId: mongoose.Schema.Types.ObjectId,
  reason: String,
}, { _id: false });

const previousAssignmentSchema = new mongoose.Schema({
  workerName: String,
  workerId: String,
  operation: String,
  note: String,
  type: String,
  status: String,
  estimatedMinutes: Number,
  actualMinutes: Number,
  startedAt: Date,
  endedAt: Date,
  history: [taskHistorySchema],
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
  workerName: String,
  workerId: { type: String, default: "" },
  operation: String,
  note: { type: String, default: "" },
  type: { type: String, enum: ["auto", "manual"], default: "manual" },
  status: { type: String, enum: ["pending", "in-progress", "paused", "completed"], default: "pending" },
  estimatedMinutes: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  totalPausedMs: { type: Number, default: 0 },
  actualMinutes: { type: Number, default: null },
  pausedByProject: { type: Boolean, default: false },
  history: [taskHistorySchema],
  previousAssignments: { type: [previousAssignmentSchema], default: [] },
  completedAt: { type: Date, default: null },
});

const materialSchema = new mongoose.Schema({
  warehouseItemId: { type: mongoose.Schema.Types.ObjectId, ref: "WarehouseItem", default: null },
  name: String,
  specs: { type: String, default: "" },
  useQty: { type: Number, default: 1, min: 0.000000001 },
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
  status: { type: String, enum: ["active", "in-progress", "paused", "completed"], default: "active" },
  completedAt: { type: Date, default: null },
  revision: { type: Number, default: 0 },
  inventoryMode: { type: String, enum: ["legacy-consumed", "reserved-v2"], default: undefined },
  startedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  totalPausedMs: { type: Number, default: 0 },
  drawings: [drawingSchema],
  createdAt: { type: Date, default: Date.now },
});

projectSchema.index({ company: 1, rn: 1 }, { unique: true });

export default mongoose.model("Project", projectSchema);
