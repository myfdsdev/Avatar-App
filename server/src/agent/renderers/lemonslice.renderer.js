import * as lemonslice from "@livekit/agents-plugin-lemonslice";
import { BaseAvatarRenderer } from "./base.renderer.js";
import { logger } from "../../config/logger.js";

const CONTROL_API = "https://lemonslice.com/api/liveai/sessions";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Drives a LemonSlice avatar for the length of a call.
 *
 * The plugin owns the media path: it takes the session's TTS audio and
 * publishes lip-synced video into the room. Two things it does not own, and
 * this class fills in:
 *
 *   The image. LemonSlice accepts a URL *or* the bytes. Ours usually live on
 *   localhost, which their servers cannot fetch, so anything not publicly
 *   reachable is read here and passed as a Buffer. That is what lets the whole
 *   integration work without an object-storage bucket.
 *
 *   Emotions and live image swaps. The Node plugin exposes neither; they are
 *   POSTs to LemonSlice's session control endpoint, addressed by the session id
 *   the plugin hands back from start().
 *
 * `agentPrompt` is not the conversational system prompt - it steers the
 * avatar's movement and demeanour only. The persona's system prompt goes to the
 * language model, and confusing the two produces an avatar that gestures like a
 * customer-service script.
 */
export class LemonSliceRenderer extends BaseAvatarRenderer {
  constructor({ apiKey } = {}) {
    super("lemonslice");
    if (!apiKey) {
      throw new Error("LEMONSLICE_API_KEY is required to render LemonSlice avatars");
    }
    this.apiKey = apiKey;
    this.avatarSession = null;
  }

  async start({ session, room, avatar }) {
    const agentId = agentIdOf(avatar);
    const image = agentId ? { agentId } : await resolveImage(avatar);

    // A LemonSlice agent carries its own motion prompts, so the generic
    // defaults are only filled in for plain images; the persona's own still wins.
    const motion = avatar.persona?.motionPrompt || (agentId ? undefined : "a person talking");
    const idle = avatar.persona?.idlePrompt || (agentId ? undefined : "a calm person waiting");

    this.avatarSession = new lemonslice.AvatarSession({
      apiKey: this.apiKey,
      ...image,
      ...(motion && { agentPrompt: motion }),
      ...(idle && { agentIdlePrompt: idle }),
      ...(renderPayload(avatar) && { extraPayload: renderPayload(avatar) }),
    });

    const sessionId = await this.avatarSession.start(session, room);
    logger.info(
      {
        sessionId,
        avatar: avatar.name,
        source: agentId ? "agent" : image.agentImage ? "bytes" : "url",
      },
      "lemonslice renderer started",
    );
    return sessionId;
  }

  async stop() {
    // aclose(), not close() - the plugin follows the agents framework naming.
    await this.avatarSession?.aclose?.();
    this.avatarSession = null;
  }

  /**
   * LemonSlice models emotion as a pose trigger rather than a named mood, so
   * this maps onto that rather than inventing a second vocabulary.
   */
  async setEmotion(emotion) {
    await this.#control({ event: "pose-trigger", pose_trigger: { name: emotion } });
  }

  /**
   * Swaps the reference image mid-call. Takes effect in under a second.
   *
   * Sends base64 when the image is not publicly reachable, for the same reason
   * start() does - their servers cannot fetch our localhost.
   */
  async updateImage(imageUrl) {
    const image = await resolveImage({ previewUrl: imageUrl, providerAvatarId: imageUrl });

    await this.#control(
      image.agentImage
        ? { event: "update-image", image_base64: image.agentImage.toString("base64") }
        : { event: "update-image", image_url: image.agentImageUrl },
    );
  }

  /** Nudges the idle timer so a long pause does not end the session. */
  async keepAlive() {
    await this.#control({ event: "reset-idle-timeout" });
  }

  async #control(body) {
    const sessionId = this.avatarSession?.sessionId;
    if (!sessionId) throw new Error("Renderer not started");

    const res = await fetch(`${CONTROL_API}/${sessionId}/control`, {
      method: "POST",
      headers: { "X-API-Key": this.apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`LemonSlice control "${body.event}" failed (${res.status}): ${detail}`);
    }
    return res.json().catch(() => ({}));
  }
}

/**
 * The settings page's aspect ratio and model, in LemonSlice's session fields.
 * "standard" is their flagship, which they select by sending no model at all.
 */
export function renderPayload(avatar) {
  const { aspectRatio, model } = avatar.render || {};
  const payload = {
    ...(aspectRatio && { aspect_ratio: aspectRatio }),
    ...(model && model !== "standard" && { model }),
  };
  return Object.keys(payload).length ? payload : null;
}

/**
 * The LemonSlice agent id behind an avatar adopted from the account's agents,
 * or null for one made from an image. Photo avatars keep a URL in
 * `providerAvatarId`, so the two cannot be confused.
 */
export function agentIdOf(avatar) {
  const id = avatar.providerAvatarId;
  return typeof id === "string" && /^agent_[A-Za-z0-9]+$/.test(id) ? id : null;
}

const PRIVATE_HOST =
  /^(localhost$|127\.|0\.0\.0\.0$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

/**
 * Decides whether LemonSlice gets a URL or the bytes.
 *
 * A publicly reachable URL is preferred - it saves us transferring the image on
 * every call. Anything they cannot reach is fetched here instead, which is the
 * difference between this working on a laptop and requiring a bucket.
 */
export async function resolveImage(avatar) {
  const source = avatar.providerAvatarId || avatar.previewUrl;
  if (!source) throw new Error("Avatar has no image to render");

  let host;
  try {
    host = new URL(source).hostname;
  } catch {
    throw new Error(`Avatar image is not a valid URL: ${source}`);
  }

  if (!PRIVATE_HOST.test(host)) {
    return { agentImageUrl: source };
  }

  const res = await fetch(source, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Could not read avatar image (${res.status}): ${source}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`Avatar image is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB; max is 10 MB`);
  }

  return {
    agentImage: buffer,
    agentImageMimeType: res.headers.get("content-type") || "image/png",
  };
}
