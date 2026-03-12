import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

import authRouter from "./routes/auth.js";
import companiesRouter from "./routes/companies.js";
import workersRouter from "./routes/workers.js";
import clientsRouter from "./routes/clients.js";
import warehouseRouter from "./routes/warehouse.js";
import projectsRouter from "./routes/projects.js";

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Spojeno na bazu podataka"))
  .catch((err) => console.error("MongoDB greška:", err));

app.use("/api/auth", authRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/workers", workersRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/warehouse", warehouseRouter);
app.use("/api/projects", projectsRouter);

app.listen(PORT, () => {
  console.log(`Server radi na portu ${PORT}`);
});
