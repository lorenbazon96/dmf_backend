import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { authenticateToken, companyFilterForUser, userCanAccessCompany } from "../middleware/auth.js";
import { schemas } from "../middleware/validation.js";

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
test("company access permits assigned users and preserves non-admin company filtering",()=>{
 const user={role:"user",companies:["A"]};
 assert.equal(userCanAccessCompany(user,"A"),true); assert.equal(userCanAccessCompany(user,"B"),false);
 assert.deepEqual(companyFilterForUser(user),{company:{$in:["A"]}});
 assert.deepEqual(companyFilterForUser({role:"admin"},"B"),{company:"B"});
});
