import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  country: { type: String, default: "" },
  adressa: { type: String, default: "" },
  company: { type: String, required: true },
});

export default mongoose.model("Client", clientSchema);
