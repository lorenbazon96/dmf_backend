import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 5, parts: 6 },
});

const router = Router();

router.post("/", (req, res) => upload.single("file")(req, res, (err) => {
  if (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "Upload rejected" });
  }
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: "/uploads/" + req.file.filename,
  });
}));

export default router;
