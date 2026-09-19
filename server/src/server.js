import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { getStorage } from "./integrations/storage/registry.js";

async function main() {
  await connectDb();

  // Settled before the first request, so every capability readout and every
  // vendor guard is answering from a verified fact rather than a hope.
  await getStorage().verifyPublicAccess();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info({ port: env.port, provider: env.avatarProvider }, "api listening");
  });

  // Let in-flight requests finish rather than cutting live connections.
  const shutdown = (signal) => {
    logger.info({ signal }, "shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "failed to start");
  process.exit(1);
});
