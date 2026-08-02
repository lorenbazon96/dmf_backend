import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Project from "../models/Project.js";
import { companyFilterForUser, userCanAccessCompany } from "../middleware/auth.js";
import { schemas, validate } from "../middleware/validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "uploads");

const router = Router();

router.get("/", async (req, res) => {
  const filter = companyFilterForUser(req.user, req.query.company);
  if (!filter) return res.status(403).json({ error: "Company access denied" });
  if (req.query.status) filter.status = req.query.status;
  const projects = await Project.find(filter).sort({ createdAt: -1 });
  res.json(projects);
});

router.get("/:id", async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, project.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  res.json(project);
});

router.post("/", validate(schemas.project), async (req, res) => {
  if (!userCanAccessCompany(req.user, req.body.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const project = await Project.create(req.body);
  res.status(201).json(project);
});

router.put("/:id", validate(schemas.project), async (req, res) => {
  const existing = await Project.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  if (req.body.company && !userCanAccessCompany(req.user, req.body.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true,
  });
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json(project);
});

router.put("/:id/start", async (req, res) => {
  const existing = await Project.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const project = await Project.findByIdAndUpdate(
    req.params.id,
    { startedAt: new Date(), status: "in-progress" },
    { new: true },
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json(project);
});

router.put("/:id/pause", async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, project.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  project.status = "paused";
  project.pausedAt = new Date();
  await project.save();
  res.json(project);
});

router.put("/:id/resume", async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, project.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  if (project.pausedAt) {
    project.totalPausedMs = (project.totalPausedMs || 0) + (Date.now() - new Date(project.pausedAt).getTime());
    project.pausedAt = null;
  }
  project.status = "in-progress";
  await project.save();
  res.json(project);
});

router.put("/:id/complete-task", validate(schemas.completeTask), async (req, res) => {
  const { drawingIndex, workerIndex, completedAt } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, project.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }

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

router.put("/:id/remove-worker", validate(schemas.removeWorker), async (req, res) => {
  const { drawingIndex, workerIndex } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, project.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }

  const drawing = project.drawings[drawingIndex];
  if (!drawing) return res.status(400).json({ error: "Invalid drawing index" });
  if (!drawing.assignedWorkers[workerIndex]) {
    return res.status(400).json({ error: "Invalid worker index" });
  }

  drawing.assignedWorkers.splice(workerIndex, 1);
  await project.save();
  res.json(project);
});

router.delete("/:id", async (req, res) => {
  const existing = await Project.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const project = await Project.findByIdAndDelete(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });

  for (const drawing of project.drawings || []) {
    for (const field of [drawing.pdfFile, drawing.dwgFile]) {
      if (!field) continue;
      const filename = path.basename(field);
      const filePath = path.join(uploadsDir, filename);
      fs.unlink(filePath, () => {});
    }
  }

  res.json({ message: "Deleted" });
});

export default router;
