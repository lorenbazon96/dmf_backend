import { Router } from "express";
import Worker from "../models/Worker.js";

const router = Router();

router.get("/", async (req, res) => {
  const filter = req.query.company ? { company: req.query.company } : {};
  const workers = await Worker.find(filter).sort({ fullName: 1 });
  res.json(workers);
});

router.get("/:id", async (req, res) => {
  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ error: "Not found" });
  res.json(worker);
});

router.post("/", async (req, res) => {
  const worker = await Worker.create(req.body);
  res.status(201).json(worker);
});

router.put("/:id", async (req, res) => {
  const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: "after",
  });
  if (!worker) return res.status(404).json({ error: "Not found" });
  res.json(worker);
});

router.put("/:id/rating", async (req, res) => {
  const { operation, rating } = req.body;
  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ error: "Not found" });

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
  const worker = await Worker.findByIdAndDelete(req.params.id);
  if (!worker) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
});

export default router;
