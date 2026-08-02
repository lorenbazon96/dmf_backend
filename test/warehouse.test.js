import test from "node:test";
import assert from "node:assert/strict";
import { warehouseItemProjectReferenceQuery } from "../routes/warehouse.js";

test("warehouse in-use query protects references from projects in every status",()=>{
 const id="507f1f77bcf86cd799439011", query=warehouseItemProjectReferenceQuery(id);
 assert.equal(query.status,undefined);
 assert.equal(query["drawings.assignedMaterials.warehouseItemId"],id);
});
