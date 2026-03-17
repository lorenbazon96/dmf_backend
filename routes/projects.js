import { Router } from "express";
import Project from "../models/Project.js";

const router = Router();

router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.company) filter.company = req.query.company;
  if (req.query.status) filter.status = req.query.status;
  const projects = await Project.find(filter).sort({ createdAt: -1 });
  res.json(projects);
});

router.get("/:id", async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json(project);
});

router.post("/", async (req, res) => {
  const project = await Project.create(req.body);
  res.status(201).json(project);
});

router.put("/:id", async (req, res) => {
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json(project);
});

router.put("/:id/start", async (req, res) => {
  const project = await Project.findByIdAndUpdate(
    req.params.id,
    { startedAt: new Date(), status: "in-progress" },
    { new: true },
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json(project);
});

router.put("/:id/complete-task", async (req, res) => {
  const { drawingIndex, workerIndex, completedAt } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });

  const drawing = project.drawings[drawingIndex];
  if (!drawing) return res.status(400).json({ error: "Invalid drawing index" });

  const worker = drawing.assignedWorkers[workerIndex];
  if (!worker) return res.status(400).json({ error: "Invalid worker index" });

  worker.status = "completed";
  worker.completedAt = completedAt || new Date();

  for (let i = drawingIndex + 1; i < project.drawings.length; i++) {
    const nextDrawing = project.drawings[i];
    if (nextDrawing.isAssemblyDrawing) continue;
    const alreadyAssigned = nextDrawing.assignedWorkers.some(
      (aw) =>
        aw.workerId === worker.workerId && aw.operation === worker.operation,
    );
    if (!alreadyAssigned) {
      const hasTreatment =
        nextDrawing.treatments && nextDrawing.treatments.length > 0;
      if (hasTreatment) {
        nextDrawing.assignedWorkers.push({
          workerName: worker.workerName,
          workerId: worker.workerId,
          operation: worker.operation,
          note: "",
          type: "auto",
          status: "pending",
          estimatedMinutes: worker.estimatedMinutes || 0,
        });
      }
    }
    break;
  }

  const allCompleted = project.drawings.every((d) =>
    d.assignedWorkers.every((w) => w.status === "completed"),
  );
  if (allCompleted) {
    project.status = "completed";
  }

  await project.save();
  res.json(project);
});

router.put("/:id/remove-worker", async (req, res) => {
  const { drawingIndex, workerIndex } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });

  const drawing = project.drawings[drawingIndex];
  if (!drawing) return res.status(400).json({ error: "Invalid drawing index" });

  drawing.assignedWorkers.splice(workerIndex, 1);
  await project.save();
  res.json(project);
});

router.delete("/:id", async (req, res) => {
  const project = await Project.findByIdAndDelete(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
});

export default router;
