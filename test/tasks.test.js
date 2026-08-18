import test from "node:test";
import assert from "node:assert/strict";
import { activateAvailableTasks, canTransitionTask, elapsedMinutes, findTask, hasRequiredWorker, nextRevision, projectAllowsTaskAction, taskCanStart, taskTransitions } from "../services/tasks.js";

test("all task transition combinations are explicit",()=>{const states=Object.keys(taskTransitions),allowed=new Set(["pending:in-progress","in-progress:paused","in-progress:completed","paused:in-progress"]);for(const from of states)for(const to of states)assert.equal(canTransitionTask(from,to),allowed.has(`${from}:${to}`),`${from} -> ${to}`);});
test("paused tasks cannot complete and task actions require a running project",()=>{assert.equal(canTransitionTask("paused","completed"),false);assert.equal(projectAllowsTaskAction("in-progress","start"),false);for(const action of ["pause","resume","complete"]){assert.equal(projectAllowsTaskAction("in-progress",action),true);assert.equal(projectAllowsTaskAction("paused",action),false);}});
test("a successful state mutation increments revision exactly once",()=>assert.equal(nextRevision(7),8));
test("assembly-only drawings do not require a worker",()=>{
 assert.equal(hasRequiredWorker([{isAssemblyDrawing:true,assignedWorkers:[]}]),true);
 assert.equal(hasRequiredWorker([{isAssemblyDrawing:false,assignedWorkers:[]}]),false);
 assert.equal(hasRequiredWorker([{isAssemblyDrawing:false,assignedWorkers:[{workerName:"Missing id"}]}]),false);
 assert.equal(hasRequiredWorker([{isAssemblyDrawing:true,assignedWorkers:[]},{isAssemblyDrawing:false,assignedWorkers:[{workerId:"w1"}]}]),true);
 assert.equal(hasRequiredWorker([{isAssemblyDrawing:false,assignedWorkers:[{workerId:"w1"}]},{isAssemblyDrawing:false,assignedWorkers:[]}]),false);
});
test("findTask searches stable assignment ids across drawings",()=>{const wanted={_id:"b"},project={drawings:[{assignedWorkers:[{_id:"a"}]},{assignedWorkers:[wanted]}]};assert.equal(findTask(project,"b").task,wanted);assert.equal(findTask(project,"missing"),null);});
test("elapsedMinutes excludes pauses",()=>{const now=new Date("2026-01-01T01:00:00Z");assert.equal(elapsedMinutes({startedAt:new Date("2026-01-01T00:00:00Z"),totalPausedMs:600000},now),50);assert.equal(elapsedMinutes({startedAt:new Date("2026-01-01T00:00:00Z"),pausedAt:new Date("2026-01-01T00:45:00Z")},now),45);});
test("a later production phase waits for every earlier task",()=>{const cutting={operation:"Rezanje lima",status:"pending"},welding={operation:"Zavarivanje",status:"pending"},drawing={assignedWorkers:[cutting,welding]};assert.equal(taskCanStart(drawing,cutting),true);assert.equal(taskCanStart(drawing,welding),false);cutting.status="completed";assert.equal(taskCanStart(drawing,welding),true);});
test("the same worker runs only one queued project at a time",()=>{const task=()=>({workerId:"w1",operation:"Rezanje lima",status:"pending",history:[]});const older={status:"in-progress",startedAt:new Date("2026-01-01"),drawings:[{assignedWorkers:[task()]}]},newer={status:"in-progress",startedAt:new Date("2026-01-02"),drawings:[{assignedWorkers:[task()]}]},now=new Date("2026-01-03");activateAvailableTasks([newer,older],now,"user");assert.equal(older.drawings[0].assignedWorkers[0].status,"in-progress");assert.equal(newer.drawings[0].assignedWorkers[0].status,"pending");older.drawings[0].assignedWorkers[0].status="completed";activateAvailableTasks([newer,older],now,"user");assert.equal(newer.drawings[0].assignedWorkers[0].status,"in-progress");});
test("a manually paused task keeps its worker while a project pause releases it",()=>{const queued={workerId:"w1",operation:"Rezanje lima",status:"pending",history:[]},paused={workerId:"w1",operation:"Rezanje lima",status:"paused",pausedByProject:false};const first={status:"in-progress",startedAt:new Date("2026-01-01"),drawings:[{assignedWorkers:[paused]}]},second={status:"in-progress",startedAt:new Date("2026-01-02"),drawings:[{assignedWorkers:[queued]}]};activateAvailableTasks([first,second],new Date(),"user");assert.equal(queued.status,"pending");first.status="paused";activateAvailableTasks([first,second],new Date(),"user");assert.equal(queued.status,"in-progress");});
test("a worker temporarily switches to a newer project and returns when the older task is ready",()=>{
 const cutting={workerId:"w2",operation:"Rezanje lima",status:"pending",history:[]};
 const grinding={workerId:"w1",operation:"Brušenje",status:"pending",history:[]};
 const newerTask={workerId:"w1",operation:"Rezanje lima",status:"pending",history:[]};
 const older={status:"in-progress",startedAt:new Date("2026-01-01"),drawings:[{assignedWorkers:[cutting,grinding]}]};
 const newer={status:"in-progress",startedAt:new Date("2026-01-02"),drawings:[{assignedWorkers:[newerTask]}]};
 const started=new Date("2026-01-03T08:00:00Z");
 activateAvailableTasks([newer,older],started,"user");
 assert.equal(cutting.status,"in-progress");
 assert.equal(grinding.status,"pending");
 assert.equal(newerTask.status,"in-progress");
 cutting.status="completed";
 const switched=new Date("2026-01-03T09:00:00Z");
 activateAvailableTasks([newer,older],switched,"user");
 assert.equal(grinding.status,"in-progress");
 assert.equal(newerTask.status,"paused");
 assert.equal(newerTask.pausedByProject,true);
 assert.equal(newerTask.history.at(-1).reason,"higher-priority-project");
});
