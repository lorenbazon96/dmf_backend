import { Router } from "express";
import Worker from "../models/Worker.js";
import Project from "../models/Project.js";
import { companyFilterForUser, userCanAccessCompany } from "../middleware/auth.js";
import { schemas, validate } from "../middleware/validation.js";

const router = Router();

router.get("/", async (req, res) => {
  const filter = companyFilterForUser(req.user, req.query.company);
  if (!filter) return res.status(403).json({ error: "Company access denied" });
  const workers = await Worker.find(filter).sort({ fullName: 1 });
  const projects = await Project.find({ ...filter, status:{ $in:["active","in-progress","paused"] } }).select("drawings.assignedWorkers");
  const workload = new Map();
  for (const project of projects) for (const drawing of project.drawings || []) for (const task of drawing.assignedWorkers || []) {
    if (!task.workerId || task.status === "completed") continue;
    const id=String(task.workerId);
    workload.set(id,(workload.get(id)||0)+Math.max(0,Number(task.estimatedMinutes)||0));
  }
  res.json(workers.map(worker=>{
    const minutes=Math.round(workload.get(String(worker._id))||0);
    const hours=Math.floor(minutes/60),rest=minutes%60;
    const freeIn=hours ? `${hours}h ${rest}min` : minutes ? `${minutes}min` : "";
    return { ...worker.toObject(), busy:minutes>0, freeIn };
  }));
});

router.get("/:id", async (req, res) => {
  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, worker.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  res.json(worker);
});

router.post("/", validate(schemas.worker), async (req, res) => {
  if (!userCanAccessCompany(req.user, req.body.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const worker = await Worker.create(req.body);
  res.status(201).json(worker);
});

router.put("/:id", validate(schemas.worker), async (req, res) => {
  const existing = await Worker.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  if (req.body.company && !userCanAccessCompany(req.user, req.body.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true });
  if (!worker) return res.status(404).json({ error: "Not found" });
  res.json(worker);
});

router.put("/:id/rating", validate(schemas.workerRating), async (req, res) => {
  const { operation, rating } = req.body;
  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, worker.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }

  if (worker.ratings[operation] !== undefined) {
    worker.ratings[operation] = Math.round(
      worker.ratings[operation] * 0.7 + rating * 0.3,
    );
    worker.markModified("ratings");
    await worker.save();
  }

  res.json(worker);
});

router.delete("/:id", async (req, res) => {
  const existing = await Worker.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const worker = await Worker.findByIdAndDelete(req.params.id);
  if (!worker) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
});

export default router;
