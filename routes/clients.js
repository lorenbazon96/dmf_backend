import { Router } from "express";
import Client from "../models/Client.js";
import { companyFilterForUser, userCanAccessCompany } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const filter = companyFilterForUser(req.user, req.query.company);
  if (!filter) return res.status(403).json({ error: "Company access denied" });
  const clients = await Client.find(filter).sort({ clientName: 1 });
  res.json(clients);
});

router.get("/:id", async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, client.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  res.json(client);
});

router.post("/", async (req, res) => {
  if (!userCanAccessCompany(req.user, req.body.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const client = await Client.create(req.body);
  res.status(201).json(client);
});

router.put("/:id", async (req, res) => {
  const existing = await Client.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  if (req.body.company && !userCanAccessCompany(req.user, req.body.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const client = await Client.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" });
  if (!client) return res.status(404).json({ error: "Not found" });
  res.json(client);
});

router.delete("/:id", async (req, res) => {
  const existing = await Client.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!userCanAccessCompany(req.user, existing.company)) {
    return res.status(403).json({ error: "Company access denied" });
  }
  const client = await Client.findByIdAndDelete(req.params.id);
  if (!client) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
});

export default router;
