import "dotenv/config";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import WarehouseItem from "../models/WarehouseItem.js";
await mongoose.connect(process.env.MONGO_URI, process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {});
const projects = await Project.updateMany({ inventoryMode: { $exists: false } }, { $set: { inventoryMode: "legacy-consumed" } });
const items = await WarehouseItem.updateMany({ reservedQty: { $exists: false } }, { $set: { reservedQty: 0 } });
console.log({ projects: projects.modifiedCount, warehouseItems: items.modifiedCount });
await mongoose.disconnect();
