import { Router } from "express";
import User from "../models/User.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, password, fullName } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "Email already exists" });
  const user = await User.create({ email, password, fullName });
  res
    .status(201)
    .json({ _id: user._id, email: user.email, fullName: user.fullName });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const match = await user.comparePassword(password);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });
  res.json({
    _id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });
});

router.put("/me/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (req.body.fullName !== undefined) user.fullName = req.body.fullName;
  if (req.body.email !== undefined) user.email = req.body.email;
  if (req.body.password) user.password = req.body.password;
  await user.save();
  res.json({ _id: user._id, email: user.email, fullName: user.fullName });
});

router.get("/me/:id", async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) return res.status(404).json({ error: "Not found" });
  const obj = user.toObject();
  if (!obj.createdAt) obj.createdAt = user._id.getTimestamp();
  res.json(obj);
});

export default router;
