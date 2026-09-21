/**
 * Checks what this install can actually do with the credentials it has.
 *
 *   npm --prefix server run check
 *
 * Every check is independent and none of them are fatal - the point is a single
 * readout of which capabilities are live, not a pass/fail gate.
 */
import mongoose from "mongoose";
import { RoomServiceClient } from "livekit-server-sdk";
import { env } from "../config/env.js";
import { livekitConfig } from "../integrations/livekit/index.js";

const results = [];

/** First line of an error message - stack-ish detail is noise in a readout. */
const firstLine = (msg) => String(msg).split(/\r?\n/)[0];

const record = (name, ok, detail) => results.push({ name, ok, detail });

// ---- MongoDB ----
try {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  const { host } = mongoose.connection;
  record("MongoDB", true, host);
  await mongoose.disconnect();
} catch (err) {
  record("MongoDB", false, firstLine(err.message));
}

// ---- LiveKit ----
const lk = livekitConfig();
if (lk.isDev) {
  record("LiveKit", false, `no credentials - would use dev server at ${lk.url}`);
} else {
  try {
    const client = new RoomServiceClient(lk.url.replace(/^ws/, "http"), lk.apiKey, lk.apiSecret);
    const rooms = await client.listRooms();
    record("LiveKit Cloud", true, `${lk.url} (${rooms.length} active room(s))`);
  } catch (err) {
    record("LiveKit Cloud", false, firstLine(err.message));
  }
}

// ---- Language model ----
if (env.anthropicApiKey) {
  record("LLM", true, `Anthropic plugin, ${env.defaultLlmModel}`);
} else if (!lk.isDev) {
  record("LLM", true, `LiveKit Inference fallback, ${env.fallbackLlmModel} (no Claude)`);
} else {
  record("LLM", false, "needs LiveKit Cloud or ANTHROPIC_API_KEY");
}

// ---- Storage ----
// Local storage is fine for vendors that take the bytes (LemonSlice). A vendor
// that fetches assets itself needs public storage, so that is what r2 is for.
//
// For r2 this actually uploads a probe and fetches it back anonymously, because
// "configured" and "public" are different things: R2's S3 endpoint accepts
// uploads happily and then refuses unsigned reads, which fails at the vendor
// rather than here unless something checks.
{
  const { getStorage } = await import("../integrations/storage/registry.js");
  const storage = getStorage();

  if (storage.id === "local") {
    record("Storage", true, "local - fine for LemonSlice; URL-fetching vendors would need r2");
  } else {
    // Ask the driver to prove it, rather than trusting its own claim.
    const ok = await storage.verifyPublicAccess();
    record(
      "Storage",
      ok,
      ok
        ? `${storage.id} - uploads are publicly readable`
        : `${storage.id} - ${storage.publicReadsError}`,
    );
  }
}


// ---- Webhooks ----
record(
  "Webhook secret",
  Boolean(env.webhookSecret),
  env.webhookSecret
    ? "set - callback URLs are signed"
    : "unset - training resolves by polling only",
);

// ---- Avatar vendor ----
// The default matters more than it looks: a stub here overrides every real
// vendor, so it is reported as a problem rather than as configuration.
{
  const { isDevelopmentOnly } = await import("../avatar/capabilities.js");
  const { candidatesForSource } = await import("../avatar/providers/registry.js");

  const stub = isDevelopmentOnly(env.avatarProvider);
  const real = candidatesForSource("photo");

  let detail;
  if (stub) {
    detail =
      `AVATAR_PROVIDER=${env.avatarProvider} is a local stub and overrides every real ` +
      `vendor. Unset it to use: ${real.join(", ") || "(none configured)"}`;
  } else if (!real.length) {
    detail = "no real vendor configured - set LEMONSLICE_API_KEY to create avatars";
  } else {
    detail = `${env.avatarProvider || "automatic"} - real vendors available: ${real.join(", ")}`;
  }
  record("Avatar provider", !stub && real.length > 0, detail);
}

// ---- Report ----
const pad = Math.max(...results.map((r) => r.name.length));
console.log("");
for (const r of results) {
  console.log(`  ${r.ok ? "ok  " : "--  "} ${r.name.padEnd(pad)}  ${r.detail}`);
}

const speechReady = results.find((r) => r.name.startsWith("LiveKit"))?.ok;
console.log("");
console.log(
  speechReady
    ? "  Conversation enabled: the agent will listen and speak."
    : "  Video only: the avatar will render but not converse (needs LiveKit Cloud).",
);
console.log("");
process.exit(0);
