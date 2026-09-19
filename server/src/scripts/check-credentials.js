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

// ---- Tavus ----
// Read-only: listing faces costs nothing. Training and conversations consume
// quota, so this never creates anything.
if (env.tavusApiKey) {
  try {
    const res = await fetch("https://tavusapi.com/v2/faces", {
      headers: { "x-api-key": env.tavusApiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const body = await res.json();
      const faces = body.data || [];
      // Tavus reports "completed", not "ready" - go through the adapter's own
      // mapping rather than guessing the vocabulary a second time here.
      const { toJobStatus } = await import("../avatar/providers/tavus.provider.js");
      const usable = faces.filter((f) => toJobStatus(f.status) === "succeeded").length;
      record("Tavus", true, `${faces.length} face(s), ${usable} usable`);
    } else {
      record("Tavus", false, `HTTP ${res.status} - key rejected`);
    }
  } catch (err) {
    record("Tavus", false, firstLine(err.message));
  }
} else {
  record("Tavus", false, "no TAVUS_API_KEY");
}

// ---- Storage ----
// Vendors fetch training assets themselves, so unreachable storage blocks every
// real vendor regardless of their own credentials.
//
// For r2 this actually uploads a probe and fetches it back anonymously, because
// "configured" and "public" are different things: R2's S3 endpoint accepts
// uploads happily and then refuses unsigned reads, which fails at the vendor
// rather than here unless something checks.
{
  const { getStorage } = await import("../integrations/storage/registry.js");
  const storage = getStorage();

  if (storage.id === "local") {
    record("Storage", false, "local - localhost URLs, vendors cannot fetch uploads");
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

  record(
    "Avatar provider",
    !stub,
    stub
      ? `AVATAR_PROVIDER=${env.avatarProvider} is a local stub and overrides every real ` +
        `vendor. Unset it to use: ${real.join(", ") || "(none configured)"}`
      : `${env.avatarProvider || "automatic"} - real vendors available: ${real.join(", ") || "none"}`,
  );
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
