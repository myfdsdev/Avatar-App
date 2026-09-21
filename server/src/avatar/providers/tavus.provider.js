import { BaseAvatarProvider } from "./base.provider.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

const API = "https://tavusapi.com/v2";

/**
 * Tavus - trained faces, and the conversation itself.
 *
 * Two things make Tavus different from every other adapter here:
 *
 *   1. Training is real and asynchronous. Unlike LemonSlice, a face is an
 *      object on Tavus's side with a lifecycle, so createFromVideo returns a
 *      job and the avatar is not callable until it resolves.
 *
 *   2. It is full-pipeline. Tavus runs speech, language and rendering itself
 *      and hands back a Daily room, so there is no renderer for it and our
 *      agent worker never runs. createSession is implemented here instead.
 *
 * Statuses are normalised to our own vocabulary on the way in - Tavus reports
 * "started"/"ready"/"completed"/"error" across two different endpoints and a
 * webhook, and letting that vocabulary spread through the app would mean every
 * caller learning Tavus's dialect.
 */
export class TavusProvider extends BaseAvatarProvider {
  constructor({ apiKey } = {}) {
    super("tavus");
    this.apiKey = apiKey;
  }

  #assertKey() {
    if (!this.apiKey) {
      const err = new Error("TAVUS_API_KEY is not set");
      err.statusCode = 501;
      throw err;
    }
  }

  async #request(path, { method = "GET", body } = {}) {
    this.#assertKey();

    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        "x-api-key": this.apiKey,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });

    const text = await res.text();
    const payload = text ? JSON.parse(text) : null;

    if (!res.ok) throw translateError(res.status, payload, method, path);

    return payload;
  }

  /**
   * A still image also needs a voice - Tavus cannot infer one from a photo the
   * way it can from a training video's audio.
   */
  async createFromPhoto({ imageUrl, name, voiceName = env.tavusDefaultVoice, callbackUrl }) {
    const created = await this.#request("/faces", {
      method: "POST",
      body: {
        train_image_url: imageUrl,
        face_name: name,
        voice_name: voiceName,
        model_name: env.tavusModel,
        auto_fix_training_image: true,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      },
    });

    logger.info({ faceId: created.face_id, status: created.status }, "tavus face training started");

    return normaliseFace(created);
  }

  async createFromVideo({ videoUrl, name, callbackUrl }) {
    const created = await this.#request("/faces", {
      method: "POST",
      body: {
        train_video_url: videoUrl,
        face_name: name,
        model_name: env.tavusModel,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      },
    });

    logger.info({ faceId: created.face_id }, "tavus face training started from video");

    return { providerJobId: created.face_id, status: toJobStatus(created.status) };
  }

  /**
   * Tavus has no separate job resource - the face *is* the job, and its id is
   * the job id.
   */
  async getTrainingStatus(providerJobId) {
    const face = await this.#request(`/faces/${providerJobId}`);
    const status = toJobStatus(face.status);

    return {
      status,
      progress: parseProgress(face.training_progress, status),
      providerAvatarId: status === "succeeded" ? face.face_id : undefined,
      // A still is the useful preview; the short clip is the fallback.
      previewUrl: face.thumbnail_image_url || face.thumbnail_video_url || undefined,
      error: face.error_message || undefined,
    };
  }

  /**
   * Tavus's pre-trained faces. Available on plans that refuse to train new
   * ones, so this is the fallback when createFromVideo returns 402.
   */
  async listStockAvatars() {
    const body = await this.#request("/faces");

    return (body.data || [])
      .filter((face) => toJobStatus(face.status) === "succeeded")
      .map((face) => ({
        providerAvatarId: face.face_id,
        name: face.face_name || face.face_id,
        previewUrl: face.thumbnail_image_url || face.thumbnail_video_url,
        voiceId: face.default_voice_id,
        model: face.model_name,
      }));
  }

  async deleteAvatar(providerAvatarId) {
    await this.#request(`/faces/${providerAvatarId}`, { method: "DELETE" });
    return { deleted: true, providerAvatarId };
  }

  /**
   * Full-pipeline entry point. Returns a Daily room the browser joins directly;
   * nothing of ours sits in the media path.
   */
  async createSession({ avatar, persona, callbackUrl }) {
    const conversation = await this.#request("/conversations", {
      method: "POST",
      body: {
        face_id: avatar.providerAvatarId,
        ...(avatar.providerPalId ? { pal_id: avatar.providerPalId } : {}),
        conversation_name: `${avatar.name} call`,
        ...(persona?.systemPrompt ? { conversational_context: persona.systemPrompt } : {}),
        ...(persona?.greeting ? { custom_greeting: persona.greeting } : {}),
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        properties: {
          max_call_duration: persona?.maxCallSeconds || env.maxCallSeconds,
          ...(persona?.language ? { languages: [persona.language] } : {}),
        },
      },
    });

    return {
      providerSessionId: conversation.conversation_id,
      transport: "daily",
      joinUrl: conversation.conversation_url,
      token: conversation.meeting_token,
    };
  }

  async endSession(providerSessionId) {
    await this.#request(`/conversations/${providerSessionId}/end`, { method: "POST" });
  }
}

/**
 * Turns Tavus's terse replies into something a user can act on.
 *
 * 402 in particular arrives as the single word "Payment required", which tells
 * nobody whose payment, for what, or what to do instead - and it is the most
 * likely failure on a new account, because training a face is a paid feature
 * while the API key that lists stock faces works fine.
 */
function translateError(status, payload, method, path) {
  const detail = payload?.message || `Tavus ${method} ${path} failed (${status})`;

  if (status === 402) {
    const err = new Error(
      "Tavus requires a paid plan to train a face. The free tier allows " +
        "conversations with their stock faces, but not creating your own. " +
        "Either upgrade the Tavus plan, or use LemonSlice, which makes an " +
        "avatar from a single photo with no training step.",
    );
    err.statusCode = 402;
    err.providerMessage = detail;
    return err;
  }

  if (status === 401 || status === 403) {
    const err = new Error(`Tavus rejected the API key (${status}). Check TAVUS_API_KEY.`);
    err.statusCode = 502;
    return err;
  }

  const err = new Error(detail);
  // Other 4xx are our mistake or the user's, not an outage.
  err.statusCode = status >= 400 && status < 500 ? 422 : 502;
  return err;
}

/**
 * Tavus uses "started" on create, "ready"/"completed" on success, and "error"
 * on failure, across three surfaces. Collapse it once, here.
 */
function toJobStatus(tavusStatus) {
  switch (tavusStatus) {
    case "ready":
    case "completed":
      return "succeeded";
    case "error":
    case "failed":
      return "failed";
    case "started":
    case "training":
      return "running";
    default:
      return "queued";
  }
}

/**
 * Tavus reports progress as a "done/total" string rather than a number, and
 * omits it entirely on some responses.
 */
function parseProgress(raw, status) {
  if (status === "succeeded") return 100;
  if (typeof raw !== "string") return undefined;

  const [done, total] = raw.split("/").map(Number);
  if (!Number.isFinite(done) || !Number.isFinite(total) || total === 0) return undefined;
  return Math.round((done / total) * 100);
}

function normaliseFace(created) {
  const status = toJobStatus(created.status);
  return status === "succeeded"
    ? { providerAvatarId: created.face_id, status: "ready" }
    : { providerJobId: created.face_id, status: "training" };
}

export { toJobStatus };
