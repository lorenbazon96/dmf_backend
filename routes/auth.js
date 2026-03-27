import { Router } from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const router = Router();

let _transporter;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return _transporter;
}

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

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ ok: true });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/#reset-password?token=${token}`;

  await getTransporter().sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Resetiranje lozinke - DMF Production",
    html: `
      <h2>Resetiranje lozinke</h2>
      <p>Kliknite na link ispod za resetiranje lozinke:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>Link vrijedi 1 sat.</p>
    `,
  });

  res.json({ ok: true });
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.password = password;
    await user.save();
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid or expired token" });
  }
});

export default router;
