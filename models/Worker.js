import mongoose from "mongoose";

const workerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, default: "" },
  address: { type: String, default: "" },
  contact: { type: String, default: "" },
  jobPosition: { type: String, default: "" },
  busy: { type: Boolean, default: false },
  freeIn: { type: String, default: "" },
  company: { type: String, required: true },
  ratings: {
    pipeCutting: { type: Number, default: 0 },
    sheetCutting: { type: Number, default: 0 },
    welding: { type: Number, default: 0 },
    bending: { type: Number, default: 0 },
    grinding: { type: Number, default: 0 },
    drilling: { type: Number, default: 0 },
    assembly: { type: Number, default: 0 },
  },
  operations: {
    pipeCutting: { type: Boolean, default: true },
    sheetCutting: { type: Boolean, default: true },
    welding: { type: Boolean, default: true },
    bending: { type: Boolean, default: true },
    grinding: { type: Boolean, default: true },
    drilling: { type: Boolean, default: true },
    assembly: { type: Boolean, default: true },
  },
  projectsCompleted: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Worker", workerSchema);
