import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { authenticateToken, companyFilterForUser, userCanAccessCompany } from "../middleware/auth.js";
import { schemas } from "../middleware/validation.js";
import WarehouseItem from "../models/WarehouseItem.js";

test("auth middleware rejects a reset-purpose bearer before database lookup", async () => {
 process.env.JWT_SECRET="a".repeat(32);
 const token=jwt.sign({id:"507f1f77bcf86cd799439011",purpose:"password-reset"},process.env.JWT_SECRET);
 let status,body,next=false;
 await authenticateToken({headers:{authorization:`Bearer ${token}`}},{status(v){status=v;return this;},json(v){body=v;}},()=>{next=true;});
 assert.equal(status,401); assert.equal(next,false); assert.match(body.error,/Invalid/);
});
test("validation enforces email/password and strips unknown keys",()=>{
 assert.equal(schemas.register.safeParse({email:"bad",password:"short"}).success,false);
 const result=schemas.register.parse({email:" USER@example.com ",password:"12345678",admin:true});
 assert.deepEqual(result,{email:"user@example.com",password:"12345678"});
 assert.equal(schemas.workerRating.safeParse({operation:"welding",rating:100}).success,true);
 assert.equal(schemas.workerRating.safeParse({operation:"welding",rating:101}).success,false);
 assert.equal(schemas.removeWorker.safeParse({drawingIndex:-1,workerIndex:0}).success,false);
});
test("project validation preserves drawing payload shape and rejects invalid useQty",()=>{
 const base={drawings:[{drawingNo:"1",assignedWorkers:[{workerId:"507f1f77bcf86cd799439011",workerName:"A",frontendField:true}],assignedMaterials:[{warehouseItemId:"507f1f77bcf86cd799439012",name:"Steel",useQty:1,frontendField:true}]}]};
 const parsed=schemas.project.parse(base); assert.equal(parsed.drawings[0].drawingNo,"1"); assert.equal(parsed.drawings[0].assignedWorkers[0].frontendField,true);
 for(const useQty of [0,-1,Infinity,NaN])assert.equal(schemas.project.safeParse({drawings:[{assignedMaterials:[{useQty}]}]}).success,false);
 assert.equal(schemas.project.safeParse({drawings:[{treatments:[null]}]}).success,false);
});
test("warehouse movements require traceable receipt and issue details",()=>{
 assert.equal(schemas.warehouseAdjustment.safeParse({direction:"in",quantity:2,supplier:"Supplier"}).success,true);
 assert.equal(schemas.warehouseAdjustment.safeParse({direction:"in",quantity:2}).success,false);
 assert.equal(schemas.warehouseAdjustment.safeParse({direction:"out",quantity:1,destination:"Job site"}).success,true);
 assert.equal(schemas.warehouseAdjustment.safeParse({direction:"out",quantity:1}).success,false);
 assert.equal(schemas.warehouseAdjustment.safeParse({direction:"out",quantity:0,destination:"Job site"}).success,false);
 assert.equal(schemas.warehouse.safeParse({qty:5}).success,false);
 assert.equal(schemas.warehouse.safeParse({qty:5,supplier:"Supplier"}).success,true);
});
test("warehouse identity is unique only for the company, name and specification combination",()=>{
 const [fields,options]=WarehouseItem.schema.indexes().find(([,indexOptions])=>indexOptions.name==="unique_warehouse_item_identity");
 assert.deepEqual(fields,{company:1,name:1,specs:1});
 assert.equal(options.unique,true);
 assert.deepEqual(options.collation,{locale:"hr",strength:2});
});
test("company access permits assigned users and preserves non-admin company filtering",()=>{
 const user={role:"user",companies:["A"]};
 assert.equal(userCanAccessCompany(user,"A"),true); assert.equal(userCanAccessCompany(user,"B"),false);
 assert.deepEqual(companyFilterForUser(user),{company:{$in:["A"]}});
 assert.deepEqual(companyFilterForUser({role:"admin"},"B"),{company:"B"});
});
