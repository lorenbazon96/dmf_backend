import { Router } from "express";
import Company from "../models/Company.js";
import User from "../models/User.js";
import Client from "../models/Client.js";
import Project from "../models/Project.js";
import WarehouseItem from "../models/WarehouseItem.js";
import Worker from "../models/Worker.js";
import { userCanAccessCompany } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { name: { $in: req.user.companies || [] } };
  const companies = await Company.find(filter).sort({ name: 1 });
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

    if (req.user.role !== "admin") {
      await User.findByIdAndUpdate(req.user.id, { $addToSet: { companies: company.name } });
    }

    res.status(201).json(company);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Company already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  const existing = await Company.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.name)) {
    return res.status(403).json({ error: "Company access denied" });
  }

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

  if (payload.name && payload.name !== existing.name) {
    await Promise.all([
      Client.updateMany({ company: existing.name }, { $set: { company: payload.name } }),
      Project.updateMany({ company: existing.name }, { $set: { company: payload.name } }),
      WarehouseItem.updateMany({ company: existing.name }, { $set: { company: payload.name } }),
      Worker.updateMany({ company: existing.name }, { $set: { company: payload.name } }),
      User.updateMany({ companies: existing.name }, { $set: { "companies.$": payload.name } }),
    ]);
  }

  res.json(company);
});

router.delete("/:id", async (req, res) => {
  const existing = await Company.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.name)) {
    return res.status(403).json({ error: "Company access denied" });
  }

  const company = await Company.findByIdAndDelete(req.params.id);
  if (!company) return res.status(404).json({ error: "Not found" });
  await User.updateMany({ companies: company.name }, { $pull: { companies: company.name } });
  res.json({ message: "Deleted" });
});

export default router;
