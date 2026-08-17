import { Router } from "express";
import User from "../models/User.js";
import InstallationState from "../models/InstallationState.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";
import { schemas, validate } from "../middleware/validation.js";

const router = Router();

function createAuthToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      companies: user.companies || [],
      purpose: "auth",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

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

async function allowInitialUserOrAdmin(req, res, next) {
  const [hasUser, initialized] = await Promise.all([
    User.exists({}),
    InstallationState.exists({ _id: "initial-admin" }),
  ]);
  if (!hasUser && !initialized) {
    req.initialSetup = true;
    return next();
  }

  return authenticateToken(req, res, () => requireAdmin(req, res, next));
}

router.post("/register", validate(schemas.register), allowInitialUserOrAdmin, async (req, res) => {
  const { email, password, fullName } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "Email already exists" });
  const companies = Array.isArray(req.body.companies) ? req.body.companies : [];
  let user;
  if (req.initialSetup) {
    const session = await User.startSession();
    try {
      await session.withTransaction(async () => {
        await InstallationState.create([{ _id: "initial-admin" }], { session });
        if (await User.exists({}).session(session)) {
          throw Object.assign(new Error("Admin access required"), { status: 403, code: "ADMIN_ACCESS_REQUIRED" });
        }
        [user] = await User.create([{ email, password, fullName, role: "admin", companies }], { session });
      });
    } catch (error) {
      if (error.code === 11000 || await User.exists({})) {
        return res.status(403).json({ error: "Admin access required", code: "ADMIN_ACCESS_REQUIRED" });
      }
      throw error;
    } finally {
      await session.endSession();
    }
  } else {
    user = await User.create({ email, password, fullName, role: req.body.role, companies });
  }
  res
    .status(201)
    .json({ _id: user._id, email: user.email, fullName: user.fullName, role: user.role, companies: user.companies });
});

const authLimiter = rateLimit({ windowMs: 15*60*1000, limit: 10, standardHeaders: true, legacyHeaders: false });
router.post("/login", authLimiter, validate(schemas.login), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const match = await user.comparePassword(password);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET is not configured" });
  }

  const responseUser = {
    _id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    companies: user.companies || [],
  };

  res.json({
    ...responseUser,
    user: responseUser,
    token: createAuthToken(user),
  });
});

router.put("/me/:id", authenticateToken, validate(schemas.me), async (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (req.body.fullName !== undefined) user.fullName = req.body.fullName;
  if (req.body.email !== undefined) user.email = req.body.email;
  if (req.body.password) user.password = req.body.password;
  await user.save();
  res.json({ _id: user._id, email: user.email, fullName: user.fullName });
});

router.get("/me/:id", authenticateToken, async (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const user = await User.findById(req.params.id).select("-password");
  if (!user) return res.status(404).json({ error: "Not found" });
  const obj = user.toObject();
  if (!obj.createdAt) obj.createdAt = user._id.getTimestamp();
  res.json(obj);
});

router.post("/forgot-password", authLimiter, validate(schemas.forgot), async (req, res) => {
  const { email } = req.body;
  const user = await User.findOneAndUpdate(
    { email },
    { $inc: { passwordResetVersion: 1 } },
    { new: true },
  );
  if (!user) return res.json({ ok: true });

  const token = jwt.sign({ id: user._id, purpose: "password-reset", version: user.passwordResetVersion }, process.env.PASSWORD_RESET_SECRET, {
    expiresIn: "1h",
  });

  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/#/reset-password?token=${token}`;

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

router.post("/reset-password", authLimiter, validate(schemas.reset), async (req, res) => {
  const { token, password } = req.body;
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.PASSWORD_RESET_SECRET);
    if (decoded.purpose !== "password-reset") throw new Error("Invalid token purpose");
  } catch {
    return res.status(400).json({ error: "Invalid or expired token" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate(
    { _id: decoded.id, passwordResetVersion: decoded.version },
    { $set: { password: passwordHash }, $inc: { passwordResetVersion: 1 } },
  );
  if (!user) return res.status(400).json({ error: "Invalid or expired token" });
  res.json({ ok: true });
});

export default router;
