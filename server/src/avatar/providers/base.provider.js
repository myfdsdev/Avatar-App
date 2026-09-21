import { CAPABILITIES } from "../capabilities.js";

/**
 * Contract every avatar vendor adapter implements.
 *
 * Only the control plane lives here - creating, training and deleting avatars.
 * Driving a live call is a different lifecycle in a different process, and is
 * defined by AvatarRenderer in src/agent/renderers/base.renderer.js.
 *
 * Adding a vendor should mean one new file plus a registry entry. If it ever
 * requires changing a caller, this interface is wrong rather than the caller.
 */
export class BaseAvatarProvider {
  /** @param {string} id key into CAPABILITIES */
  constructor(id) {
    if (new.target === BaseAvatarProvider) {
      throw new TypeError("BaseAvatarProvider is abstract");
    }
    if (!CAPABILITIES[id]) {
      throw new Error(`Unknown provider id: ${id}`);
    }
    this.id = id;
  }

  /** @returns {import("../capabilities.js").ProviderCapabilities} */
  get capabilities() {
    return CAPABILITIES[this.id];
  }

  /**
   * Turn a still image into a ready-to-use avatar.
   *
   * `imageUrl` must be reachable from the public internet: vendors fetch it
   * from their own infrastructure, so a localhost or signed-private URL fails.
   *
   * @param {{ imageUrl: string, name: string }} input
   * @returns {Promise<{ providerAvatarId: string, previewUrl?: string, status: 'ready'|'training' }>}
   */
  // eslint-disable-next-line no-unused-vars
  async createFromPhoto(input) {
    throw new NotSupportedError(this.id, "createFromPhoto");
  }

  /**
   * Start training a likeness from a video. Always asynchronous - resolve it
   * later via getTrainingStatus or a provider webhook.
   *
   * @param {{ videoUrl: string, name: string }} input
   * @returns {Promise<{ providerJobId: string, status: 'queued'|'running' }>}
   */
  // eslint-disable-next-line no-unused-vars
  async createFromVideo(input) {
    throw new NotSupportedError(this.id, "createFromVideo");
  }

  /**
   * @param {string} providerJobId
   * @returns {Promise<{ status: 'queued'|'running'|'succeeded'|'failed', progress?: number,
   *                     providerAvatarId?: string, previewUrl?: string, error?: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async getTrainingStatus(providerJobId) {
    throw new NotSupportedError(this.id, "getTrainingStatus");
  }

  /** @param {string} providerAvatarId */
  // eslint-disable-next-line no-unused-vars
  async deleteAvatar(providerAvatarId) {
    throw new NotSupportedError(this.id, "deleteAvatar");
  }

  /**
   * Ready-made avatars the vendor already hosts, usable with no upload and no
   * training. Guarded by `capabilities.stockAvatars`.
   *
   * Worth having as a first-class concept rather than a vendor detail: training
   * is often the paid tier while using a stock avatar is not, so this can be
   * the only route an account actually has to a working avatar.
   *
   * @returns {Promise<Array<{providerAvatarId: string, name: string, previewUrl?: string}>>}
   */
  async listStockAvatars() {
    throw new NotSupportedError(this.id, "listStockAvatars");
  }

  /**
   * Full-pipeline vendors run the conversation themselves. They return a
   * session the client connects to directly; render-only vendors leave this
   * unimplemented because our own agent worker handles the call.
   *
   * @param {{ avatar: object, persona?: object }} input
   * @returns {Promise<{ providerSessionId: string, transport: string, joinUrl?: string, token?: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async createSession(input) {
    throw new NotSupportedError(this.id, "createSession");
  }
}

/**
 * Thrown when a capability is called on a vendor that does not have it.
 * Callers are expected to check `capabilities` first; this is the backstop.
 */
export class NotSupportedError extends Error {
  constructor(providerId, method) {
    super(`Provider "${providerId}" does not support ${method}()`);
    this.name = "NotSupportedError";
    this.providerId = providerId;
    this.method = method;
    this.statusCode = 422;
  }
}

/**
 * Thrown when a vendor exists but cannot be driven from this codebase - LiveKit
 * ships its plugin for Python only. Distinct from NotSupportedError so the UI
 * can explain "not available here" rather than "this cannot be done".
 */
export class UnavailableInRuntimeError extends Error {
  constructor(providerId) {
    super(
      `Provider "${providerId}" has no Node plugin (Python-only) and cannot be used from this server`,
    );
    this.name = "UnavailableInRuntimeError";
    this.providerId = providerId;
    this.statusCode = 501;
  }
}
