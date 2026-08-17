import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import helmet from "helmet";
import { pathToFileURL } from "url";
import { validateEnv } from "./config.js";
import authRouter from "./routes/auth.js";
import companiesRouter from "./routes/companies.js";
import workersRouter from "./routes/workers.js";
import clientsRouter from "./routes/clients.js";
import warehouseRouter from "./routes/warehouse.js";
import projectsRouter from "./routes/projects.js";
import uploadRouter from "./routes/upload.js";
import filesRouter from "./routes/files.js";
import Project from "./models/Project.js";
import { authenticateToken } from "./middleware/auth.js";
import { startOrphanCleanup } from "./services/orphanCleanup.js";

dotenv.config();
export function createApp() {
 const app=express();
 const configured=(process.env.CORS_ORIGIN||process.env.FRONTEND_URL||"").split(",").map(x=>x.trim()).filter(Boolean);
 const origins=configured.length?configured:(process.env.NODE_ENV!=="production"?["http://localhost:8080","http://localhost:5173"]:[]);
 app.use(helmet());
 app.use(cors({origin(origin,cb){if(!origin||origins.includes(origin))return cb(null,true);const e=new Error("CORS rejected");e.status=403;cb(e);}}));
 app.use(express.json({limit:"1mb"}));
 app.get("/health",(req,res)=>{const ok=mongoose.connection.readyState===1;res.status(ok?200:503).json({ok,database:ok?"up":"down"});});
 app.use("/api/auth",authRouter);
 for(const [path,router] of [["companies",companiesRouter],["workers",workersRouter],["clients",clientsRouter],["warehouse",warehouseRouter],["projects",projectsRouter],["upload",uploadRouter],["files",filesRouter]]) app.use(`/api/${path}`,authenticateToken,router);
 app.use((req,res)=>res.status(404).json({error:"Not found"}));
 app.use((err,req,res,next)=>{
  console.error(err);
  if (err.code === 11000) {
   if (err.keyPattern?.company && err.keyPattern?.rn) {
    return res.status(409).json({ error: "RN number already exists", code: "DUPLICATE_RN" });
   }
   return res.status(409).json({ error: "Resource already exists", code: "DUPLICATE_RESOURCE" });
  }
  const status=err.status||((err.name==="ValidationError"||err.name==="CastError")?400:500);
  return res.status(status).json({error:status===500?"Internal server error":err.message||"Request failed",...(err.code?{code:err.code}:{})});
 });
 return app;
}
export async function findDuplicateProjectRns(){return Project.aggregate([{$group:{_id:{company:"$company",rn:"$rn"},count:{$sum:1}}},{$match:{count:{$gt:1}}},{$sort:{count:-1}},{$limit:20}]);}
export async function startServer(){validateEnv();await mongoose.connect(process.env.MONGO_URI,process.env.MONGO_DB_NAME?{dbName:process.env.MONGO_DB_NAME}:{});const duplicates=await findDuplicateProjectRns();if(duplicates.length){const values=duplicates.map(item=>`${item._id.company}/${item._id.rn} (${item.count})`).join(", ");throw new Error(`Duplicate project RN values must be resolved before startup: ${values}`);}await Project.init();const stopCleanup=startOrphanCleanup();const server=createApp().listen(process.env.PORT||3000,()=>console.log(`Server radi na portu ${process.env.PORT||3000}`));let closing=false;const shutdown=async signal=>{if(closing)return;closing=true;stopCleanup();console.log(`${signal}: shutting down`);server.close(async()=>{await mongoose.disconnect();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();};process.on("SIGTERM",()=>shutdown("SIGTERM"));process.on("SIGINT",()=>shutdown("SIGINT"));return server;}
if(import.meta.url===pathToFileURL(process.argv[1]).href) startServer().catch(err=>{console.error("Startup failed",err.message);process.exit(1);});
