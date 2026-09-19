import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export async function connectDb(uri = env.mongoUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info({ uri: uri.replace(/\/\/.*@/, "//***@") }, "mongo connected");
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
