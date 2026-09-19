import { BaseAvatarProvider, NotSupportedError } from "./base.provider.js";
import { logger } from "../../config/logger.js";

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
 * Video clones are not offered; those route to Tavus.
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

  /** Nothing exists on LemonSlice's side, so deletion is purely local. */
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
