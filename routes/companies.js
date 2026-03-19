import { Router } from "express";
import Company from "../models/Company.js";

const router = Router();

router.get("/", async (req, res) => {
  const companies = await Company.find().sort({ name: 1 });
  res.json(companies);
});

router.post("/", async (req, res) => {
  try {
    const payload = {};
    if (req.body.name !== undefined) payload.name = req.body.name;
    if (req.body.workStart !== undefined) payload.workStart = req.body.workStart;
    if (req.body.workEnd !== undefined) payload.workEnd = req.body.workEnd;
    if (req.body.breaks !== undefined) payload.breaks = req.body.breaks;
    if (req.body.workDays !== undefined) payload.workDays = req.body.workDays;
    const company = await Company.create(payload);
    res.status(201).json(company);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Company already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  const payload = {};
  if (req.body.name !== undefined) payload.name = req.body.name;
  if (req.body.workStart !== undefined) payload.workStart = req.body.workStart;
  if (req.body.workEnd !== undefined) payload.workEnd = req.body.workEnd;
  if (req.body.breaks !== undefined) payload.breaks = req.body.breaks;
  if (req.body.workDays !== undefined) payload.workDays = req.body.workDays;
  const company = await Company.findByIdAndUpdate(
    req.params.id,
    payload,
    { new: true, runValidators: true },
  );
  if (!company) return res.status(404).json({ error: "Not found" });
  res.json(company);
});

router.delete("/:id", async (req, res) => {
  const company = await Company.findByIdAndDelete(req.params.id);
  if (!company) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
});

export default router;
