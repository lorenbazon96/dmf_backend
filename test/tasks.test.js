import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionTask, elapsedMinutes, findTask, nextRevision, projectAllowsTaskAction, taskTransitions } from "../services/tasks.js";

test("all task transition combinations are explicit",()=>{const states=Object.keys(taskTransitions),allowed=new Set(["pending:in-progress","in-progress:paused","in-progress:completed","paused:in-progress"]);for(const from of states)for(const to of states)assert.equal(canTransitionTask(from,to),allowed.has(`${from}:${to}`),`${from} -> ${to}`);});
test("paused tasks cannot complete and task actions require a running project",()=>{assert.equal(canTransitionTask("paused","completed"),false);for(const action of ["start","pause","resume","complete"]){assert.equal(projectAllowsTaskAction("in-progress",action),true);assert.equal(projectAllowsTaskAction("paused",action),false);}});
test("a successful state mutation increments revision exactly once",()=>assert.equal(nextRevision(7),8));
test("findTask searches stable assignment ids across drawings",()=>{const wanted={_id:"b"},project={drawings:[{assignedWorkers:[{_id:"a"}]},{assignedWorkers:[wanted]}]};assert.equal(findTask(project,"b").task,wanted);assert.equal(findTask(project,"missing"),null);});
test("elapsedMinutes excludes pauses",()=>{const now=new Date("2026-01-01T01:00:00Z");assert.equal(elapsedMinutes({startedAt:new Date("2026-01-01T00:00:00Z"),totalPausedMs:600000},now),50);assert.equal(elapsedMinutes({startedAt:new Date("2026-01-01T00:00:00Z"),pausedAt:new Date("2026-01-01T00:45:00Z")},now),45);});
