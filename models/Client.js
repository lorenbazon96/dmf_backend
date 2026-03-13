import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
  clientType: { type: String, enum: ["company", "person"], default: "company" },
  clientName: { type: String, required: true },
  country: { type: String, default: "" },
  adressa: { type: String, default: "" },
  owner: { type: String, default: "" },
  contact: { type: String, default: "" },
  email: { type: String, default: "" },
  oib: { type: String, default: "" },
  company: { type: String, required: true },
  responsiblePersons: [
    {
      fullName: { type: String, default: "" },
      email: { type: String, default: "" },
      contact: { type: String, default: "" },
      note: { type: String, default: "" },
    },
  ],
}, { timestamps: true });

export default mongoose.model("Client", clientSchema);
