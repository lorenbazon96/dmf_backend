import test from "node:test";
import assert from "node:assert/strict";
import { warehouseItemActiveProjectReferenceQuery, warehouseItemCanBeDeleted } from "../routes/warehouse.js";

test("only a current reservation blocks warehouse item deletion",()=>{
 assert.equal(warehouseItemCanBeDeleted({reservedQty:0}),true);
 assert.equal(warehouseItemCanBeDeleted({reservedQty:undefined}),true);
 assert.equal(warehouseItemCanBeDeleted({reservedQty:1}),false);
});

test("only non-completed projects block deletion of a referenced warehouse item",()=>{
 const id="507f1f77bcf86cd799439011";
 assert.deepEqual(warehouseItemActiveProjectReferenceQuery(id),{
  status:{$ne:"completed"},
  "drawings.assignedMaterials.warehouseItemId":id,
 });
});
