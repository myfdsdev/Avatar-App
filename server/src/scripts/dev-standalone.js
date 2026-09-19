/**
 * Runs the API with an in-process MongoDB, for machines without Docker or a
 * local mongod. Data lives only as long as the process.
 *
 *   npm --prefix server run dev:standalone
 *
 * This covers the API and the client. It does NOT provide LiveKit, so calls
 * will not connect - starting one needs `docker compose up -d livekit` or
 * LiveKit Cloud credentials.
 */
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { getStorage } from "../integrations/storage/registry.js";
import { seed } from "./seed.js";

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri());
logger.info("in-memory mongo started (data is not persisted)");

await getStorage().verifyPublicAccess();

const { avatar } = await seed();
logger.info({ avatar: avatar.name, id: String(avatar._id) }, "seeded");

const server = createApp().listen(env.port, () => {
  logger.info({ port: env.port }, "api listening (standalone)");
  logger.warn("LiveKit is not running - calls will fail to connect");
});

const shutdown = async () => {
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
