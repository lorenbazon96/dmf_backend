import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Project from "../models/Project.js";
import WarehouseItem from "../models/WarehouseItem.js";
import WarehouseMovement from "../models/WarehouseMovement.js";
import Worker from "../models/Worker.js";
import { aggregateMaterials, inventoryDelta, resolveMaterials, validTransition } from "../services/inventory.js";
import { activateAvailableTasks, canTransitionTask, elapsedMinutes, findTask, nextRevision, projectAllowsTaskAction } from "../services/tasks.js";
import { companyFilterForUser, userCanAccessCompany } from "../middleware/auth.js";
import { schemas, validate } from "../middleware/validation.js";

const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");
const router = Router();
const fail = (message, status, code) => Object.assign(new Error(message), { status, code });
const assignments = drawings => (drawings || []).flatMap(d => d.assignedWorkers || []);
const materialShape = drawings => (drawings || []).map(d => (d.assignedMaterials || []).map(m => ({ name:m.name || "", specs:m.specs || "", useQty:Number(m.useQty || 0), warehouseItemId:m.warehouseItemId ? String(m.warehouseItemId) : null })));
const materialsEqual = (a,b) => JSON.stringify(materialShape(a)) === JSON.stringify(materialShape(b));
const filesFor = projects => projects.flatMap(p => (p.drawings || []).flatMap(d => [d.pdfFile, d.dwgFile])).filter(Boolean).map(x => path.join(uploadsDir, path.basename(x)));
async function unlinkFiles(files) { await Promise.all(files.map(file => fs.promises.unlink(file).catch(e => { if (e.code !== "ENOENT") console.error("File cleanup failed", file, e.message); }))); }
async function checkWorkers(drawings, company, session) {
  const ids = [...new Set(assignments(drawings).map(x => x.workerId).filter(Boolean))];
  if (!assignments(drawings).length) throw fail("At least one worker is required", 422, "WORKER_REQUIRED");
  if (await Worker.countDocuments({ _id: { $in: ids }, company }).session(session) !== ids.length) throw fail("Worker company mismatch", 422, "INVALID_WORKER");
}
function preserveTaskLifecycle(currentDrawings, nextDrawings) {
  const existing = new Map(assignments(currentDrawings).map(task => [String(task._id), task]));
  const lifecycle = ["status", "startedAt", "pausedAt", "totalPausedMs", "actualMinutes", "pausedByProject", "history", "completedAt"];
  for (const task of assignments(nextDrawings)) {
    const old = task._id ? existing.get(String(task._id)) : null;
    const sameTask = old && String(old.workerId) === String(task.workerId) && old.operation === task.operation;
    for (const field of lifecycle) delete task[field];
    if (sameTask) {
      for (const field of lifecycle) task[field] = old[field];
    } else {
      delete task._id;
      task.status = "pending";
    }
  }
}
async function movement(item, project, values, req, session) {
  await WarehouseMovement.create([{ warehouseItemId:item._id, company:item.company, projectId:project._id, projectRn:project.rn, itemName:item.name, actorUserId:req.user.id, ...values }], { session });
}
async function saveProjectRevision(project, expectedRevision, session) {
  project.revision = nextRevision(expectedRevision);
  await project.validate();
  const result = await Project.replaceOne({ _id:project._id, revision:expectedRevision }, project.toObject(), { session });
  if (!result.modifiedCount) throw fail("Project was modified",409,"PROJECT_CONFLICT");
  return project;
}
async function runningProjects(company, session, current) {
  const projects = await Project.find({ company, status:"in-progress", _id:{ $ne:current._id } }).sort({ startedAt:1, createdAt:1 }).session(session);
  projects.push(current);
  return projects;
}
async function saveChangedProjects(changed, session) {
  for (const project of changed) await saveProjectRevision(project, project.revision, session);
}

router.get("/", async (req,res) => { const filter=companyFilterForUser(req.user,req.query.company); if(!filter)return res.status(403).json({error:"Company access denied"}); if(req.query.status)filter.status=req.query.status; res.json(await Project.find(filter).sort({createdAt:-1})); });
router.get("/:id", async (req,res) => { const p=await Project.findById(req.params.id); if(!p)return res.status(404).json({error:"Not found"}); if(!userCanAccessCompany(req.user,p.company))return res.status(403).json({error:"Company access denied"}); res.json(p); });

router.post("/", validate(schemas.project), async (req,res) => {
  if(!userCanAccessCompany(req.user,req.body.company))return res.status(403).json({error:"Company access denied"});
  const session=await Project.startSession(); let project;
  try { await session.withTransaction(async()=>{ preserveTaskLifecycle([],req.body.drawings); await checkWorkers(req.body.drawings,req.body.company,session); await resolveMaterials(req.body.drawings,req.body.company,session); [project]=await Project.create([{...req.body,status:"active",inventoryMode:"reserved-v2"}],{session}); for(const [id,n] of aggregateMaterials(project.drawings)){const item=await WarehouseItem.findOneAndUpdate({_id:id,company:project.company,$expr:{$gte:[{$subtract:["$qty","$reservedQty"]},n]}},{$inc:{reservedQty:n}},{new:true,session});if(!item)throw fail("Insufficient available stock",409,"INSUFFICIENT_AVAILABLE_STOCK");await movement(item,project,{reservedDelta:n,type:"reserve"},req,session);}}); res.status(201).json(project); } finally { await session.endSession(); }
});

router.put("/:id", validate(schemas.project), async (req,res) => {
  const snapshot=await Project.findById(req.params.id); if(!snapshot)return res.status(404).json({error:"Not found"}); if(!userCanAccessCompany(req.user,snapshot.company))return res.status(403).json({error:"Company access denied"});
  const forbidden=["company","status","startedAt","pausedAt","totalPausedMs","completedAt","inventoryMode","revision"]; for(const k of forbidden)delete req.body[k];
  if(snapshot.status==="completed" && req.body.drawings!==undefined) return res.status(409).json({error:"Completed project tasks and materials cannot be changed",code:"COMPLETED_PROJECT_IMMUTABLE"});
  const session=await Project.startSession(); let project;
  try { await session.withTransaction(async()=>{
    const current=await Project.findOne({_id:snapshot._id,revision:snapshot.revision}).session(session); if(!current)throw fail("Project was modified",409,"PROJECT_CONFLICT");
    const drawings=req.body.drawings ?? current.drawings.map(d=>d.toObject());
    if (req.body.drawings !== undefined) preserveTaskLifecycle(current.drawings, drawings);
    await checkWorkers(drawings,current.company,session);
    if(req.body.drawings!==undefined){
      if (current.inventoryMode === "reserved-v2") await resolveMaterials(drawings,current.company,session);
      else {
        await resolveMaterials(drawings,current.company,session);
        await resolveMaterials(current.drawings,current.company,session);
      }
      for(const [id,delta] of inventoryDelta(current.drawings,drawings)){if(!delta)continue;
        if(current.inventoryMode==="reserved-v2" && current.status==="active") { const query={_id:id,company:current.company}; if(delta>0)query.$expr={$gte:[{$subtract:["$qty","$reservedQty"]},delta]}; else query.reservedQty={$gte:-delta}; const item=await WarehouseItem.findOneAndUpdate(query,{$inc:{reservedQty:delta}},{new:true,session});if(!item)throw fail("Insufficient available stock",409,"INSUFFICIENT_AVAILABLE_STOCK");await movement(item,current,{reservedDelta:delta,type:delta>0?"reserve":"release"},req,session); }
        else if(["in-progress","paused"].includes(current.status) || current.inventoryMode!=="reserved-v2"){const query={_id:id,company:current.company};if(delta>0)query.$expr={$gte:[{$subtract:["$qty","$reservedQty"]},delta]};const item=await WarehouseItem.findOneAndUpdate(query,{$inc:{qty:-delta}},{new:true,session});if(!item)throw fail("Insufficient available stock",409,"INSUFFICIENT_AVAILABLE_STOCK");await movement(item,current,{qtyDelta:-delta,type:"project-adjustment"},req,session);}
      }
    }
    project=await Project.findOneAndUpdate({_id:current._id,revision:current.revision},{$set:{...req.body,drawings},$inc:{revision:1}},{new:true,runValidators:true,session}); if(!project)throw fail("Project was modified",409,"PROJECT_CONFLICT");
    if(project.status==="in-progress"){
      const projects=await runningProjects(project.company,session,project);
      const changed=activateAvailableTasks(projects,new Date(),req.user.id);
      await saveChangedProjects(changed,session);
    }
  }); res.json(project); } finally { await session.endSession(); }
});

router.put("/:id/start", async(req,res)=>{
  const session=await Project.startSession(); let project;
  try { await session.withTransaction(async()=>{
    const current=await Project.findById(req.params.id).session(session);
    if(!current)throw fail("Not found",404,"NOT_FOUND");
    if(!userCanAccessCompany(req.user,current.company))throw fail("Company access denied",403,"COMPANY_ACCESS_DENIED");
    if(current.status!=="active")throw fail("Invalid transition",409,"INVALID_TRANSITION");
    if(current.inventoryMode==="reserved-v2")for(const[id,n]of aggregateMaterials(current.drawings)){
      const item=await WarehouseItem.findOneAndUpdate({_id:id,company:current.company,reservedQty:{$gte:n},qty:{$gte:n}},{$inc:{qty:-n,reservedQty:-n}},{new:true,session});
      if(!item)throw fail("Inventory conflict",409,"INVENTORY_CONFLICT");
      await movement(item,current,{qtyDelta:-n,reservedDelta:-n,type:"project-consumption"},req,session);
    }
    const now=new Date();
    current.status="in-progress"; current.startedAt=now;
    const projects=await runningProjects(current.company,session,current);
    const changed=activateAvailableTasks(projects,now,req.user.id);
    changed.add(current);
    await saveChangedProjects(changed,session);
    project=current;
  }); res.json(project); } finally { await session.endSession(); }
});

async function projectPauseResume(req,res,to){
  const session=await Project.startSession(); let project;
  try { await session.withTransaction(async()=>{
    const p=await Project.findById(req.params.id).session(session);
    if(!p)throw fail("Not found",404,"NOT_FOUND");
    if(!userCanAccessCompany(req.user,p.company))throw fail("Company access denied",403,"COMPANY_ACCESS_DENIED");
    if(!validTransition(p.status,to))throw fail("Invalid transition",409,"INVALID_TRANSITION");
    const now=new Date();
    if(to==="paused")for(const task of assignments(p.drawings))if(task.status==="in-progress"){
      task.history.push({from:task.status,to:"paused",at:now,actorUserId:req.user.id,reason:"project-paused"});
      task.status="paused"; task.pausedAt=now; task.pausedByProject=true;
    }
    if(to==="paused")p.pausedAt=now;
    else { p.totalPausedMs=(p.totalPausedMs||0)+(p.pausedAt?now-new Date(p.pausedAt):0); p.pausedAt=null; }
    p.status=to;
    const projects=await runningProjects(p.company,session,p);
    const changed=activateAvailableTasks(projects,now,req.user.id);
    changed.add(p);
    await saveChangedProjects(changed,session);
    project=p;
  }); res.json(project); } finally { await session.endSession(); }
}
router.put("/:id/pause",(req,res)=>projectPauseResume(req,res,"paused")); router.put("/:id/resume",(req,res)=>projectPauseResume(req,res,"in-progress"));

async function taskAction(req,res,action){
  const session=await Project.startSession(); let project;
  try { await session.withTransaction(async()=>{
    const p=await Project.findById(req.params.projectId).session(session);
    if(!p)throw fail("Not found",404,"NOT_FOUND");
    if(!userCanAccessCompany(req.user,p.company))throw fail("Company access denied",403,"COMPANY_ACCESS_DENIED");
    const found=req.taskIndexes?{task:p.drawings[req.taskIndexes.drawingIndex]?.assignedWorkers[req.taskIndexes.workerIndex]}:findTask(p,req.params.taskId);
    if(!found?.task)throw fail("Task not found",404,"TASK_NOT_FOUND");
    const to={pause:"paused",resume:"in-progress",complete:"completed"}[action];
    if(!canTransitionTask(found.task.status,to))throw fail("Invalid task transition",409,"INVALID_TASK_TRANSITION");
    if(!projectAllowsTaskAction(p.status,action))throw fail("Project is not running",409,"PROJECT_NOT_RUNNING");
    const projects=await runningProjects(p.company,session,p);
    if(action==="resume"&&projects.some(other=>assignments(other.drawings).some(task=>task.status==="in-progress"&&String(task._id)!==String(found.task._id)&&String(task.workerId)===String(found.task.workerId))))throw fail("Worker is already working on another task",409,"WORKER_BUSY");
    const now=new Date(),from=found.task.status;
    found.task.status=to;
    found.task.history ||= [];
    found.task.history.push({from,to,at:now,actorUserId:req.user.id,reason:`task-${action}`});
    if(action==="pause"){found.task.pausedAt=now;found.task.pausedByProject=false;}
    if(action==="resume"){found.task.totalPausedMs=(found.task.totalPausedMs||0)+(now-new Date(found.task.pausedAt));found.task.pausedAt=null;found.task.pausedByProject=false;}
    if(action==="complete"){
      found.task.actualMinutes=elapsedMinutes(found.task,now); found.task.completedAt=now; found.task.pausedAt=null;
      if(assignments(p.drawings).every(t=>t.status==="completed")){p.status="completed";p.completedAt=now;}
    }
    const changed=activateAvailableTasks(projects,now,req.user.id);
    changed.add(p);
    await saveChangedProjects(changed,session);
    project=p;
  }); res.json(project); } finally { await session.endSession(); }
}
for(const action of ["pause","resume","complete"])router.put(`/:projectId/tasks/:taskId/${action}`,(req,res)=>taskAction(req,res,action));

router.put("/:id/complete-task",validate(schemas.completeTask),async(req,res)=>{req.params.projectId=req.params.id;req.taskIndexes=req.body;return taskAction(req,res,"complete");});
router.put("/:id/remove-worker",validate(schemas.removeWorker),async(req,res)=>{const session=await Project.startSession();let project;try{await session.withTransaction(async()=>{const p=await Project.findById(req.params.id).session(session);if(!p)throw fail("Not found",404,"NOT_FOUND");if(!userCanAccessCompany(req.user,p.company))throw fail("Company access denied",403,"COMPANY_ACCESS_DENIED");const revision=p.revision,d=p.drawings[req.body.drawingIndex],task=d?.assignedWorkers[req.body.workerIndex];if(!task)throw fail("Invalid worker index",400,"INVALID_WORKER_INDEX");if(task.status!=="pending")throw fail("Only pending tasks can be removed",409,"TASK_ALREADY_STARTED");if(assignments(p.drawings).length===1)throw fail("Cannot remove last worker",422,"WORKER_REQUIRED");d.assignedWorkers.splice(req.body.workerIndex,1);project=await saveProjectRevision(p,revision,session);});res.json(project);}finally{await session.endSession();}});

router.delete("/:id",async(req,res)=>{const p=await Project.findById(req.params.id);if(!p)return res.status(404).json({error:"Not found"});if(!userCanAccessCompany(req.user,p.company))return res.status(403).json({error:"Company access denied"});const files=filesFor([p]),session=await Project.startSession();try{await session.withTransaction(async()=>{const current=await Project.findById(p._id).session(session);if(!current)throw fail("Not found",404,"NOT_FOUND");if(current.inventoryMode==="reserved-v2"&&current.status==="active")for(const[id,n]of aggregateMaterials(current.drawings)){const item=await WarehouseItem.findOneAndUpdate({_id:id,company:current.company,reservedQty:{$gte:n}},{$inc:{reservedQty:-n}},{new:true,session});if(!item)throw fail("Inventory conflict",409,"INVENTORY_CONFLICT");await movement(item,current,{reservedDelta:-n,type:"release"},req,session);}await Project.deleteOne({_id:current._id},{session});});await unlinkFiles(files);res.json({message:"Deleted"});}finally{await session.endSession();}});

export default router;
