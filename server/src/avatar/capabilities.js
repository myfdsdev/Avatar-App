/**
 * What each avatar vendor can actually do.
 *
 * Kept as plain data, not scattered through if-statements, because both the
 * server (routing a create request) and the client (disabling options the
 * selected vendor cannot serve) read the same matrix. An unsupported
 * combination is therefore impossible to select, rather than failing at the
 * vendor API call.
 *
 * Two shapes matter most:
 *   render-only    we run STT/LLM/TTS, the vendor turns our audio into video.
 *                  We keep control of latency, model choice and cost.
 *   full-pipeline  the vendor runs the whole conversation. Our agent worker is
 *                  not involved at all; the client connects to their transport.
 *
 * Node plugin availability is a hard constraint for this stack: LiveKit ships
 * Node plugins for only about half its avatar integrations, and this is a
 * Node-only codebase.
 *
 * `acceptsDirectUpload` decides whether a vendor can be used at all without
 * public object storage. Most fetch assets from a URL themselves; LemonSlice
 * will also take the bytes, which is the difference between working on a
 * laptop and needing an R2 bucket first.
 */

/**
 * @typedef {Object} ProviderCapabilities
 * @property {boolean} photoAvatar            create an avatar from one still image
 * @property {boolean} videoClone             train a likeness from a video recording
 * @property {boolean} byoLLM                 accepts our own language model
 * @property {boolean} emotions               emotional state can be driven at runtime
 * @property {boolean} realtimeImageUpdate    appearance can change mid-call
 * @property {boolean} nonHumanCharacters     animates non-human subjects
 * @property {boolean} acceptsDirectUpload    takes image bytes, not just a URL
 * @property {boolean} [developmentOnly]      a local stub, not a real vendor
 * @property {boolean} stockAvatars           offers ready-made avatars to use as-is
 * @property {'livekit'|'daily'|'websocket'} transport
 * @property {'render-only'|'full-pipeline'} pipelineMode
 * @property {number}  approxCostPerMinUsd    planning figure only, not billing
 * @property {boolean} nodePlugin             usable from this Node codebase
 */

/** @type {Record<string, ProviderCapabilities>} */
export const CAPABILITIES = {
  mock: {
    // A stub, not a vendor. Priced at zero, which is exactly why it must never
    // win automatic selection: "cheapest capable provider" would otherwise pick
    // it every time and quietly hand everyone a fake avatar.
    developmentOnly: true,
    photoAvatar: true,
    videoClone: true,
    byoLLM: true,
    emotions: false,
    realtimeImageUpdate: false,
    nonHumanCharacters: true,
    acceptsDirectUpload: true,
    stockAvatars: false,
    transport: "livekit",
    pipelineMode: "render-only",
    approxCostPerMinUsd: 0,
    nodePlugin: true,
  },

  // The full-pipeline counterpart to `mock`. Without it that whole branch -
  // vendor-hosted sessions, a non-LiveKit transport, the billing clock starting
  // at session creation - could only be exercised against a hosted vendor,
  // which costs
  // real money on every run.
  "mock-hosted": {
    developmentOnly: true,
    photoAvatar: true,
    videoClone: true,
    byoLLM: false,
    emotions: false,
    realtimeImageUpdate: false,
    nonHumanCharacters: true,
    acceptsDirectUpload: true,
    // Mirrors a hosted vendor - full-pipeline and stock-backed - so both of
    // those paths
    // are testable without spending a vendor's quota.
    stockAvatars: true,
    transport: "daily",
    pipelineMode: "full-pipeline",
    approxCostPerMinUsd: 0,
    nodePlugin: true,
  },

  lemonslice: {
    photoAvatar: true,
    videoClone: false,
    byoLLM: true,
    // Both go through LemonSlice's session control endpoint rather than the
    // LiveKit plugin, which exposes neither.
    emotions: true,
    realtimeImageUpdate: true,
    nonHumanCharacters: true,
    // Takes the image as bytes, so it works without public object storage.
    acceptsDirectUpload: true,
    // The agents saved on the LemonSlice account behind the key.
    stockAvatars: true,
    transport: "livekit",
    pipelineMode: "render-only",
    approxCostPerMinUsd: 0.164,
    nodePlugin: true,
  },


  // Documented but not selectable: LiveKit ships these as Python-only plugins,
  // so they cannot be driven from this codebase without a separate runtime.
  // Left here so the gap is visible rather than forgotten.
  simli: {
    photoAvatar: true,
    videoClone: false,
    byoLLM: true,
    emotions: false,
    realtimeImageUpdate: false,
    nonHumanCharacters: true,
    acceptsDirectUpload: false,
    stockAvatars: false,
    transport: "livekit",
    pipelineMode: "render-only",
    approxCostPerMinUsd: 0.01,
    nodePlugin: false,
  },

  heygen: {
    photoAvatar: true,
    videoClone: true,
    byoLLM: true,
    emotions: false,
    realtimeImageUpdate: false,
    nonHumanCharacters: false,
    acceptsDirectUpload: false,
    stockAvatars: true,
    transport: "livekit",
    pipelineMode: "render-only",
    approxCostPerMinUsd: 0.1,
    nodePlugin: false,
  },
};

export const PROVIDER_IDS = Object.keys(CAPABILITIES);

/** Providers this codebase can actually drive today. */
export const USABLE_PROVIDER_IDS = PROVIDER_IDS.filter((id) => CAPABILITIES[id].nodePlugin);

/** Providers offering ready-made avatars that need no upload or training. */
export const hasStockAvatars = (providerId) => Boolean(CAPABILITIES[providerId]?.stockAvatars);

/** Stubs that must be asked for by name rather than chosen automatically. */
export const isDevelopmentOnly = (providerId) =>
  Boolean(CAPABILITIES[providerId]?.developmentOnly);

/** Vendors that need publicly fetchable storage before they can be used. */
export const requiresPublicUrl = (providerId) => !CAPABILITIES[providerId]?.acceptsDirectUpload;

/**
 * Capability a given avatar source requires.
 * @param {'photo'|'video'} sourceType
 */
export const capabilityForSource = (sourceType) =>
  sourceType === "video" ? "videoClone" : "photoAvatar";
