import { CAPABILITIES } from "../../avatar/capabilities.js";
import { NotSupportedError } from "../../avatar/providers/base.provider.js";

/**
 * Contract for driving an avatar during a live call.
 *
 * The control-plane counterpart is BaseAvatarProvider. They are deliberately
 * separate: creating an avatar is a request/response concern that belongs to
 * the API process, while rendering one is a long-lived job inside the LiveKit
 * agent worker. Collapsing them would tie the API's lifetime to a call's.
 *
 * Only render-only vendors implement this. Full-pipeline vendors (Tavus) run
 * the conversation on their own infrastructure, so no renderer is involved -
 * the client connects straight to their session.
 */
export class BaseAvatarRenderer {
  /** @param {string} id key into CAPABILITIES */
  constructor(id) {
    if (new.target === BaseAvatarRenderer) {
      throw new TypeError("BaseAvatarRenderer is abstract");
    }
    if (!CAPABILITIES[id]) throw new Error(`Unknown provider id: ${id}`);
    this.id = id;
  }

  get capabilities() {
    return CAPABILITIES[this.id];
  }

  /**
   * Attach the avatar to a room. After this resolves the vendor is publishing
   * video; audio still flows from the session's TTS.
   *
   * @param {{ session: object, room: object, avatar: object }} ctx
   */
  // eslint-disable-next-line no-unused-vars
  async start(ctx) {
    throw new NotSupportedError(this.id, "start");
  }

  /** Release vendor-side resources. Must be safe to call twice. */
  async stop() {}

  /**
   * Drive an emotional state mid-call. Guarded by `capabilities.emotions`.
   * @param {string} emotion
   */
  // eslint-disable-next-line no-unused-vars
  async setEmotion(emotion) {
    throw new NotSupportedError(this.id, "setEmotion");
  }

  /**
   * Swap the avatar's appearance mid-call. Guarded by
   * `capabilities.realtimeImageUpdate`.
   * @param {string} imageUrl publicly reachable
   */
  // eslint-disable-next-line no-unused-vars
  async updateImage(imageUrl) {
    throw new NotSupportedError(this.id, "updateImage");
  }
}
