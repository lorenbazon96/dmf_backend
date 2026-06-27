import { Router } from "express";
import WarehouseItem from "../models/WarehouseItem.js";
import { companyFilterForUser, userCanAccessCompany } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const filter = companyFilterForUser(req.user, req.query.company);
  if (!filter) return res.status(403).json({ error: "Company access denied" });
  const items = await WarehouseItem.find(filter).sort({ type: 1, name: 1 });
  res.json(items);
});

router.get("/:id", async (req, res) => {
  const item = await WarehouseItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, item.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  res.json(item);
});

router.post("/", async (req, res) => {
  if (!userCanAccessCompany(req.user, req.body.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const item = await WarehouseItem.create(req.body);
  res.status(201).json(item);
});

router.put("/:id", async (req, res) => {
  const existing = await WarehouseItem.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  if (req.body.company && !userCanAccessCompany(req.user, req.body.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const item = await WarehouseItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

router.delete("/:id", async (req, res) => {
  const existing = await WarehouseItem.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const item = await WarehouseItem.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
});

export default router;
