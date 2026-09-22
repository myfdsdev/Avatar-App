import { BaseAvatarProvider, NotSupportedError } from "./base.provider.js";
import { logger } from "../../config/logger.js";

const AGENTS_API = "https://lemonslice.com/api/agents";

/**
 * The LemonSlice agent id behind an avatar adopted from the account's agents,
 * or null for one made from an image. Photo avatars keep a URL in
 * `providerAvatarId`, so the two cannot be confused.
 *
 * Lives here rather than in the renderer so the API can ask without loading
 * the LiveKit plugin.
 */
export function agentIdOf(avatar) {
  const id = avatar.providerAvatarId;
  return typeof id === "string" && /^agent_[A-Za-z0-9]+$/.test(id) ? id : null;
}

/**
 * LemonSlice - photo avatars.
 *
 * Unusually, there is no avatar to create. LemonSlice takes the image URL at
 * session time and animates it on the fly, with no training step and no
 * vendor-side object to register, update or delete. So `createFromPhoto` makes
 * no API call at all: it validates that the image is something LemonSlice will
 * actually be able to fetch, and the URL itself becomes the providerAvatarId.
 *
 * The image does not have to be publicly reachable. LemonSlice will also take
 * the bytes directly - `agentImage` on the LiveKit plugin, `image_base64` on
 * the control endpoint - so a localhost URL is fine as long as *we* can read
 * it. The renderer resolves that at call time; all this needs to know is that
 * the reference points at a real image.
 *
 * Video clones are not offered; LemonSlice animates stills only.
 *
 * Ready-made avatars are the agents saved on the LemonSlice account behind the
 * API key. A call to one of those passes its agent id instead of an image, so
 * LemonSlice uses the face and motion settings configured on its side.
 */
export class LemonSliceProvider extends BaseAvatarProvider {
  constructor({ apiKey } = {}) {
    super("lemonslice");
    // Only the runtime renderer authenticates; the control plane never calls
    // LemonSlice, so a missing key here is not an error.
    this.apiKey = apiKey;
  }

  async createFromPhoto({ imageUrl, name }) {
    await assertUsableImage(imageUrl);

    logger.info({ name }, "lemonslice avatar accepted (no vendor-side object)");

    return {
      providerAvatarId: imageUrl,
      previewUrl: imageUrl,
      status: "ready",
    };
  }

  async createFromVideo() {
    throw new NotSupportedError(this.id, "createFromVideo");
  }

  async getTrainingStatus() {
    throw new NotSupportedError(this.id, "getTrainingStatus");
  }

  /**
   * The account's own LemonSlice agents.
   *
   * `/api/agents` is not in LemonSlice's published API reference; it is what
   * their dashboard uses and it answers to the same API key. LemonSlice's
   * public library is not reachable with a key at all, so this is the whole of
   * what an account can offer.
   */
  async listStockAvatars() {
    if (!this.apiKey) return [];

    const res = await fetch(AGENTS_API, {
      headers: { "X-API-Key": this.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`LemonSlice agent listing failed (${res.status})`);
    }

    const { agents = [] } = await res.json();
    return agents
      .filter((a) => a.agent_id && a.image_url)
      .map((a) => ({
        providerAvatarId: a.agent_id,
        name: a.name || "LemonSlice avatar",
        previewUrl: a.image_url,
        previewVideoUrl: a.first_video_url || undefined,
      }));
  }

  /**
   * One agent's own settings, translated into a starting brief.
   *
   * Only what our pipeline can honour is carried over. Their voice id and LLM
   * belong to LemonSlice's hosted pipeline, which a render-only call never
   * uses, so those stay behind.
   */
  async describeStockAvatar(agentId) {
    if (!this.apiKey) return null;

    const res = await fetch(`${AGENTS_API}/${encodeURIComponent(agentId)}`, {
      headers: { "X-API-Key": this.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`LemonSlice agent lookup failed (${res.status})`);

    const a = await res.json();
    const text = (value, max) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined);
    const speed = Number(a.voice_speed);
    const duration = Number(a.max_conv_dur);

    return {
      behaviour: {
        systemPrompt: text(a.system_prompt, 4000),
        // Their preview script is SSML; the greeting is spoken as plain text.
        greeting: text(a.first_video_script?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), 400),
        language: text(a.language_code, 10),
        motionPrompt: text(a.text_prompt, 400),
        idlePrompt: text(a.idle_text_prompt, 400),
        voiceSpeed: speed >= 0.5 && speed <= 1.5 ? speed : undefined,
        maxCallSeconds: duration >= 60 ? Math.min(Math.round(duration), 14400) : undefined,
        useDefaultPrompt: typeof a.ignore_default_personality === "boolean" ? !a.ignore_default_personality : undefined,
      },
      render: {
        aspectRatio: ["2x3", "9x16", "1x1"].includes(a.aspect_ratio) ? a.aspect_ratio : undefined,
        model: ["flash", "lite"].includes(a.model_override) ? a.model_override : undefined,
      },
    };
  }

  /**
   * Nothing is created on LemonSlice's side - an adopted agent stays theirs to
   * manage - so deletion is purely local either way.
   */
  async deleteAvatar(providerAvatarId) {
    return { deleted: true, providerAvatarId, vendorSideObject: false };
  }
}

/**
 * Rejects anything that is not actually an image we can read.
 *
 * Checked here rather than at call time so the user is told while they are
 * still looking at the upload screen, rather than minutes later as a call that
 * never produces video. A private host is fine - the renderer sends bytes in
 * that case - so only reachability from *this* process matters.
 */
async function assertUsableImage(imageUrl) {
  let url;
  try {
    url = new URL(imageUrl);
  } catch {
    throw badRequest(`"${imageUrl}" is not a valid URL`);
  }

  if (!/^https?:$/.test(url.protocol)) {
    throw badRequest(`Image URL must be http(s), got "${url.protocol}"`);
  }

  let res;
  try {
    res = await fetch(imageUrl, { method: "HEAD", signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw badRequest(`Could not reach the image URL: ${err.message}`);
  }

  if (!res.ok) {
    throw badRequest(`Image URL returned ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw badRequest(`Expected an image, got "${contentType || "no content-type"}"`);
  }
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 422;
  return err;
}
