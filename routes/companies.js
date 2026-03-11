import { Router } from "express";
import Company from "../models/Company.js";

const router = Router();

router.get("/", async (req, res) => {
  const companies = await Company.find().sort({ name: 1 });
  res.json(companies);
});

router.post("/", async (req, res) => {
  const company = await Company.create({ name: req.body.name });
  res.status(201).json(company);
});

router.put("/:id", async (req, res) => {
  const company = await Company.findByIdAndUpdate(
    req.params.id,
    { name: req.body.name },
    { new: true },
  );
  if (!company) return res.status(404).json({ error: "Not found" });
  res.json(company);
});

router.delete("/:id", async (req, res) => {
  const company = await Company.findByIdAndDelete(req.params.id);
  if (!company) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
});

export default router;
