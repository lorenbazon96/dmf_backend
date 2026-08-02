import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Company from "../models/Company.js";
import User from "../models/User.js";
import Client from "../models/Client.js";
import Project from "../models/Project.js";
import WarehouseItem from "../models/WarehouseItem.js";
import WarehouseMovement from "../models/WarehouseMovement.js";
import Worker from "../models/Worker.js";
import { userCanAccessCompany } from "../middleware/auth.js";
import { schemas, validate } from "../middleware/validation.js";

const router = Router();
const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");

router.get("/", async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { name: { $in: req.user.companies || [] } };
  const companies = await Company.find(filter).sort({ name: 1 });
  res.json(companies);
});

router.post("/", validate(schemas.company), async (req, res) => {
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
    if (err.code === 11000) return res.status(409).json({ error: "Company already exists" });
    throw err;
  }
});

router.put("/:id", validate(schemas.company), async (req, res) => {
  const payload = {};
  if (req.body.name !== undefined) payload.name = req.body.name;
  if (req.body.workStart !== undefined) payload.workStart = req.body.workStart;
  if (req.body.workEnd !== undefined) payload.workEnd = req.body.workEnd;
  if (req.body.breaks !== undefined) payload.breaks = req.body.breaks;
  if (req.body.workDays !== undefined) payload.workDays = req.body.workDays;
  const session = await Company.startSession(); let company;
  try {
    await session.withTransaction(async () => {
      const existing = await Company.findById(req.params.id).session(session);
      if (!existing) throw Object.assign(new Error("Not found"), { status: 404 });
      if (!userCanAccessCompany(req.user, existing.name)) throw Object.assign(new Error("Company access denied"), { status: 403 });
      company = await Company.findByIdAndUpdate(existing._id, payload, { new: true, runValidators: true, session });
      if (payload.name && payload.name !== existing.name) {
        await Client.updateMany({ company: existing.name }, { $set: { company: payload.name } }, { session });
        await Project.updateMany({ company: existing.name }, { $set: { company: payload.name } }, { session });
        await WarehouseItem.updateMany({ company: existing.name }, { $set: { company: payload.name } }, { session });
        await WarehouseMovement.updateMany({ company: existing.name }, { $set: { company: payload.name } }, { session });
        await Worker.updateMany({ company: existing.name }, { $set: { company: payload.name } }, { session });
        await User.updateMany({ companies: existing.name }, { $set: { "companies.$": payload.name } }, { session });
      }
    });
    res.json(company);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Company already exists", code: "DUPLICATE_COMPANY" });
    throw err;
  } finally { await session.endSession(); }
});

router.delete("/:id", async (req, res) => {
  const session = await Company.startSession();
  let counts;
  let files = [];
  try {
    await session.withTransaction(async () => {
      const company = await Company.findById(req.params.id).session(session);
      if (!company) throw Object.assign(new Error("Not found"), { status:404 });
      if (!userCanAccessCompany(req.user, company.name)) throw Object.assign(new Error("Company access denied"), { status:403 });
      if (req.body?.confirmName !== company.name) throw Object.assign(new Error("Company name confirmation does not match"), { status:400, code:"CONFIRM_NAME_MISMATCH" });
      const projects = await Project.find({ company: company.name }).select("drawings.pdfFile drawings.dwgFile").session(session);
      files = projects.flatMap(p => p.drawings.flatMap(d => [d.pdfFile, d.dwgFile])).filter(Boolean).map(f => path.join(uploadsDir, path.basename(f)));
      const projectResult = await Project.deleteMany({ company:company.name }, { session });
      const clientResult = await Client.deleteMany({ company:company.name }, { session });
      const workerResult = await Worker.deleteMany({ company:company.name }, { session });
      const itemResult = await WarehouseItem.deleteMany({ company:company.name }, { session });
      const movementResult = await WarehouseMovement.deleteMany({ company:company.name }, { session });
      const userResult = await User.updateMany({ companies:company.name }, { $pull:{ companies:company.name } }, { session });
      await Company.deleteOne({ _id:company._id }, { session });
      counts = { projects:projectResult.deletedCount, clients:clientResult.deletedCount, workers:workerResult.deletedCount, warehouseItems:itemResult.deletedCount, warehouseMovements:movementResult.deletedCount, usersUpdated:userResult.modifiedCount, companies:1 };
    });
    await Promise.all(files.map(file => fs.promises.unlink(file).catch(e => { if (e.code !== "ENOENT") console.error("File cleanup failed", file, e.message); })));
    res.json({ message:"Deleted", counts });
  } finally { await session.endSession(); }
});

export default router;
