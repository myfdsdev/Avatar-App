import pino from "pino";
import { env, isProd } from "./env.js";

export const logger = pino({
  level: isProd ? "info" : "debug",
  transport: isProd ? undefined : { target: "pino-pretty", options: { colorize: true } },
  base: { env: env.nodeEnv },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.apiKey",
      "*.secret",
      "*.password",
      "*.passwordHash",
    ],
    remove: true,
  },
});
