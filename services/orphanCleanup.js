import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Project from "../models/Project.js";
const uploads = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");
export async function cleanupOrphans() {
  const maxAge=Number(process.env.ORPHAN_FILE_MAX_AGE_MS||86400000), cutoff=Date.now()-maxAge;
  const projects=await Project.find({}, {"drawings.pdfFile":1,"drawings.dwgFile":1}).lean();
  const used=new Set(projects.flatMap(p=>p.drawings||[]).flatMap(d=>[d.pdfFile,d.dwgFile]).filter(Boolean).map(path.basename));
  for(const entry of await fs.readdir(uploads,{withFileTypes:true}))if(entry.isFile()&&!used.has(entry.name)){const file=path.join(uploads,entry.name);if((await fs.stat(file)).mtimeMs<cutoff)await fs.unlink(file).catch(()=>{});}
}
export function startOrphanCleanup(){const run=()=>cleanupOrphans().catch(e=>console.error("Orphan cleanup failed",e));run();const timer=setInterval(run,Number(process.env.ORPHAN_CLEANUP_INTERVAL_MS||21600000));timer.unref();return()=>clearInterval(timer);}
