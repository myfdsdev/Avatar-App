import crypto from "node:crypto";
import { BaseAvatarProvider } from "./base.provider.js";

/**
 * A working provider that talks to nothing.
 *
 * This is not a test double bolted on afterwards - it is how the product runs
 * before any vendor account exists, and it is the reference implementation of
 * the interface. Photo avatars resolve immediately; video clones deliberately
 * take a few seconds so the asynchronous training path, the job polling and the
 * webhook handling are all exercised for real rather than skipped in dev.
 */
export class MockAvatarProvider extends BaseAvatarProvider {
  constructor({ trainingMs = 10_000, id = "mock" } = {}) {
    super(id);
    this.trainingMs = trainingMs;
    /** @type {Map<string, {startedAt:number, name:string}>} */
    this.jobs = new Map();
  }

  async createFromPhoto({ imageUrl, name }) {
    if (!imageUrl) throw new Error("createFromPhoto requires imageUrl");
    return {
      providerAvatarId: `mock_av_${crypto.randomUUID()}`,
      // The uploaded image is its own preview - nothing is generated.
      previewUrl: imageUrl,
      status: "ready",
      name,
    };
  }

  async createFromVideo({ videoUrl, name }) {
    if (!videoUrl) throw new Error("createFromVideo requires videoUrl");
    const providerJobId = `mock_job_${crypto.randomUUID()}`;
    this.jobs.set(providerJobId, { startedAt: Date.now(), name, videoUrl });
    return { providerJobId, status: "queued" };
  }

  async getTrainingStatus(providerJobId) {
    const job = this.jobs.get(providerJobId);
    if (!job) return { status: "failed", error: "Unknown job" };

    const elapsed = Date.now() - job.startedAt;
    if (elapsed >= this.trainingMs) {
      return {
        status: "succeeded",
        progress: 100,
        providerAvatarId: `mock_av_${crypto.randomUUID()}`,
        previewUrl: job.videoUrl,
      };
    }
    return {
      status: "running",
      progress: Math.min(99, Math.floor((elapsed / this.trainingMs) * 100)),
    };
  }

  async deleteAvatar(providerAvatarId) {
    return { deleted: true, providerAvatarId };
  }

  /**
   * Only meaningful for the full-pipeline variant, which is why it returns that
   * variant's transport rather than the class's own default.
   */
  async createSession({ avatar }) {
    const id = `mock_sess_${crypto.randomUUID()}`;
    return {
      providerSessionId: id,
      transport: this.capabilities.transport,
      joinUrl: `https://mock.invalid/rooms/${id}`,
      token: null,
      avatarName: avatar?.name,
    };
  }

  async endSession(providerSessionId) {
    return { ended: true, providerSessionId };
  }

  /** A small fixed catalogue, so the stock flow has something to exercise. */
  async listStockAvatars() {
    return [
      { providerAvatarId: "mock_stock_ada", name: "Ada", previewUrl: "https://example.invalid/ada.jpg" },
      { providerAvatarId: "mock_stock_kai", name: "Kai", previewUrl: "https://example.invalid/kai.jpg" },
      { providerAvatarId: "mock_stock_rio", name: "Rio", previewUrl: "https://example.invalid/rio.jpg" },
    ];
  }
}
