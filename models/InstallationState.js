import mongoose from "mongoose";

const installationStateSchema = new mongoose.Schema({
  _id: { type: String, default: "initial-admin" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("InstallationState", installationStateSchema);
