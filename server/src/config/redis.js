import IORedis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

let client;

export function getRedis() {
  if (!client) {
    client = new IORedis(env.redisUrl, {
      // BullMQ requires this to be null rather than a finite retry count.
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    client.on("error", (err) => logger.error({ err }, "redis error"));
  }
  return client;
}

export async function closeRedis() {
  if (client) await client.quit();
  client = undefined;
}
