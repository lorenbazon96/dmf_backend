import mongoose from "mongoose";

const breakSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
}, { _id: false });

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  workStart: { type: String, default: "07:00" },
  workEnd: { type: String, default: "15:00" },
  breaks: { type: [breakSchema], default: [] },
  workDays: { type: [Number], default: [1, 2, 3, 4, 5] },
});

export default mongoose.model("Company", companySchema);
