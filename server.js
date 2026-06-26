import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin not allowed"));
  },
}));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

import authRouter from "./routes/auth.js";
import companiesRouter from "./routes/companies.js";
import workersRouter from "./routes/workers.js";
import clientsRouter from "./routes/clients.js";
import warehouseRouter from "./routes/warehouse.js";
import projectsRouter from "./routes/projects.js";
import uploadRouter from "./routes/upload.js";

mongoose
  .connect(process.env.MONGO_URI, process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {})
  .then(() => console.log("Spojeno na bazu podataka"))
  .catch((err) => console.error("MongoDB greška:", err));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/workers", workersRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/warehouse", warehouseRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/upload", uploadRouter);

app.listen(PORT, () => {
  console.log(`Server radi na portu ${PORT}`);
});
