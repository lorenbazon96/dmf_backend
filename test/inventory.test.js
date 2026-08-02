import test from "node:test";
import assert from "node:assert/strict";
import { aggregateMaterials, inventoryDelta, validTransition } from "../services/inventory.js";
const drawings=n=>[{assignedMaterials:[{warehouseItemId:"507f1f77bcf86cd799439011",useQty:n}]}];
test("useQty is not multiplied by drawing quantity",()=>assert.equal(aggregateMaterials([{quantity:99,...drawings(3)[0]}]).values().next().value,3));
test("inventory delta compares aggregates",()=>assert.equal(inventoryDelta(drawings(2),drawings(5)).values().next().value,3));
test("inventory delta includes additions, removals and unchanged values",()=>{const other="507f1f77bcf86cd799439012";const d=inventoryDelta(drawings(2),[{assignedMaterials:[{warehouseItemId:other,useQty:4}]}]);assert.equal(d.get("507f1f77bcf86cd799439011"),-2);assert.equal(d.get(other),4);assert.equal(inventoryDelta(drawings(2),drawings(2)).get("507f1f77bcf86cd799439011"),0);});
test("material aggregation rejects invalid quantities before inventory writes",()=>{for(const qty of [0,-1,NaN,Infinity])assert.throws(()=>aggregateMaterials(drawings(qty)),err=>err.status===422&&err.code==="INVALID_MATERIAL_QUANTITY");});
test("all project transition combinations are strict",()=>{const states=["active","in-progress","paused","completed"],allowed=new Set(["active:in-progress","in-progress:paused","in-progress:completed","paused:in-progress"]);for(const from of states)for(const to of states)assert.equal(validTransition(from,to),allowed.has(`${from}:${to}`),`${from} -> ${to}`);});
