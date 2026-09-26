import express from "express";
import path from "node:path";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { livekitConfig } from "./integrations/livekit/index.js";
import { implementedProviderIds } from "./avatar/providers/registry.js";
import avatarRoutes from "./modules/avatars/avatar.routes.js";
import roomRoutes from "./modules/rooms/room.routes.js";
import studioRoutes from "./modules/studio/studio.routes.js";
import voiceRoutes from "./modules/voices/voice.routes.js";
import providerWebhooks from "./webhooks/provider.webhook.js";
import authRoutes from "./modules/auth/auth.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import conversationRoutes from "./modules/conversations/conversation.routes.js";
import linkRoutes from "./modules/links/link.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import { authenticate, requireAuth } from "./middleware/auth.js";
import { getStorage } from "./integrations/storage/registry.js";

export function createApp() {
  const app = express();

  // crossOriginResourcePolicy off: uploaded images are served from this origin
  // and rendered by the client on another one during development.
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  // Runs on every request but rejects nothing; routes opt into requireAuth.
  app.use(authenticate);

  const storage = getStorage();

  /**
   * Reports what this instance can actually do, so the client can show the
   * real state instead of guessing - which provider is active, whether LiveKit
   * is the local dev server or Cloud.
   */
  app.get("/api/health", (req, res) => {
    const lk = livekitConfig();
    res.json({
      ok: true,
      env: env.nodeEnv,
      avatarProvider: env.avatarProvider,
      implementedProviders: implementedProviderIds(),
      livekit: { url: lk.url, mode: lk.isDev ? "self-hosted-dev" : "configured" },
      storage: { driver: storage.id, reachableByVendors: storage.reachableByVendors },
    });
  });

  // Only the local driver keeps files on this box; with r2 nothing is served here.
  if (storage.id === "local") {
    app.use("/uploads", express.static(path.resolve("uploads"), { maxAge: "1h" }));
  }

  app.use("/api/auth", authRoutes);

  // Everything below is workspace-scoped and needs a signed-in caller.
  app.use("/api/avatars", requireAuth, avatarRoutes);
  app.use("/api/rooms", requireAuth, roomRoutes);
  app.use("/api/studio", requireAuth, studioRoutes);
  app.use("/api/voices", requireAuth, voiceRoutes);
  app.use("/api/analytics", requireAuth, analyticsRoutes);
  app.use("/api/conversations", requireAuth, conversationRoutes);
  // Platform admin. Signed in to reach it; ADMIN_EMAILS to get past /access.
  app.use("/api/admin", requireAuth, adminRoutes);

  // Share links are used by people without an account. The token in the URL is
  // the credential; see modules/links for what it does and does not allow.
  app.use("/api/links", linkRoutes);

  // Webhooks are called by vendors, not users - they authenticate by the
  // signed callback URL instead of a bearer token.
  app.use("/api/webhooks", providerWebhooks);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
