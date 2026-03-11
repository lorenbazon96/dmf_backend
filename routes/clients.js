import { Router } from "express";
import Client from "../models/Client.js";

const router = Router();

router.get("/", async (req, res) => {
  const filter = req.query.company ? { company: req.query.company } : {};
  const clients = await Client.find(filter).sort({ clientName: 1 });
  res.json(clients);
});

router.get("/:id", async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ error: "Not found" });
  res.json(client);
});

router.post("/", async (req, res) => {
  const client = await Client.create(req.body);
  res.status(201).json(client);
});

router.put("/:id", async (req, res) => {
  const client = await Client.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!client) return res.status(404).json({ error: "Not found" });
  res.json(client);
});

router.delete("/:id", async (req, res) => {
  const client = await Client.findByIdAndDelete(req.params.id);
  if (!client) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
});

export default router;
