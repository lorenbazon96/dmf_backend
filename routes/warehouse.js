import { Router } from "express";
import WarehouseItem from "../models/WarehouseItem.js";
import WarehouseMovement from "../models/WarehouseMovement.js";
import Project from "../models/Project.js";
import { companyFilterForUser, userCanAccessCompany } from "../middleware/auth.js";
import { schemas, validate } from "../middleware/validation.js";

const router = Router();
export const warehouseItemProjectReferenceQuery = warehouseItemId => ({
  "drawings.assignedMaterials.warehouseItemId": warehouseItemId,
});

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

router.get("/:id/movements", async (req, res) => {
  const item = await WarehouseItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, item.company)) return res.status(403).json({ error: "Company access denied" });
  res.json(await WarehouseMovement.find({ warehouseItemId: item._id }).sort({ createdAt: -1 }));
});

router.post("/", validate(schemas.warehouse), async (req, res) => {
  if (!userCanAccessCompany(req.user, req.body.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const session = await WarehouseItem.startSession();
  let item;
  try {
    await session.withTransaction(async () => {
      [item] = await WarehouseItem.create([req.body], { session });
      if (item.qty > 0) {
        await WarehouseMovement.create([{
          warehouseItemId: item._id,
          company: item.company,
          itemName: item.name,
          qtyDelta: item.qty,
          type: "opening",
          actorUserId: req.user.id,
          reason: "Initial stock",
        }], { session });
      }
    });
    res.status(201).json(item);
  } finally {
    await session.endSession();
  }
});

router.put("/:id", validate(schemas.warehouseMetadata), async (req, res) => {
  const existing = await WarehouseItem.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const item = await WarehouseItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

router.post("/:id/adjust", validate(schemas.warehouseAdjustment), async (req, res) => {
  const session = await WarehouseItem.startSession(); let item;
  try { await session.withTransaction(async () => {
    const existing = await WarehouseItem.findById(req.params.id).session(session);
    if (!existing) { const e=new Error("Not found"); e.status=404; throw e; }
    if (!userCanAccessCompany(req.user, existing.company)) { const e=new Error("Denied"); e.status=403; throw e; }
    item = await WarehouseItem.findOneAndUpdate({ _id: existing._id, $expr: { $gte: [{ $add: ["$qty", req.body.delta] }, "$reservedQty"] } }, { $inc: { qty: req.body.delta } }, { new:true, session });
    if (!item) { const e=new Error("Adjustment violates reserved stock"); e.status=409; e.code="INSUFFICIENT_AVAILABLE_STOCK"; throw e; }
    await WarehouseMovement.create([{ warehouseItemId:item._id,company:item.company,itemName:item.name,qtyDelta:req.body.delta,type:"manual-adjustment",actorUserId:req.user.id,reason:req.body.reason }],{session});
  }); res.json(item); } finally { await session.endSession(); }
});

router.delete("/:id", async (req, res) => {
  const session = await WarehouseItem.startSession();
  try {
    await session.withTransaction(async () => {
      const item = await WarehouseItem.findById(req.params.id).session(session);
      if (!item) throw Object.assign(new Error("Not found"), { status: 404 });
      if (!userCanAccessCompany(req.user, item.company)) throw Object.assign(new Error("Company access denied"), { status: 403 });
      const referenced = await Project.exists(warehouseItemProjectReferenceQuery(item._id)).session(session);
      const hasMovements = await WarehouseMovement.exists({ warehouseItemId: item._id }).session(session);
      if (item.reservedQty > 0 || referenced || hasMovements) throw Object.assign(new Error("Warehouse item is in use or has history", { cause: "history" }), { status: 409, code: "WAREHOUSE_ITEM_IN_USE" });
      const result = await WarehouseItem.deleteOne({ _id: item._id, reservedQty: 0 }, { session });
      if (!result.deletedCount) throw Object.assign(new Error("Warehouse item is in use"), { status: 409, code: "WAREHOUSE_ITEM_IN_USE" });
    });
    res.json({ message: "Deleted" });
  } finally { await session.endSession(); }
});

export default router;
