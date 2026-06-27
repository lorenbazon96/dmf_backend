import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Project from "../models/Project.js";
import { userCanAccessCompany } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "uploads");

const router = Router();

router.get("/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  const storedPath = `/uploads/${filename}`;

  const project = await Project.findOne({
    $or: [
      { "drawings.pdfFile": storedPath },
      { "drawings.dwgFile": storedPath },
    ],
  });

  if (!project) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, project.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }

  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });

  return res.sendFile(filePath);
});

export default router;
