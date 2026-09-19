import { avatarRepository } from "./avatar.repository.js";
import { CAPABILITIES, isDevelopmentOnly } from "../../avatar/capabilities.js";
import { isConfigured } from "../../avatar/providers/registry.js";
import { trainingService } from "../../avatar/training.service.js";
import { TrainingJob } from "../../models/index.js";
import { logger } from "../../config/logger.js";

const notFound = () => {
  const err = new Error("Avatar not found");
  err.statusCode = 404;
  return err;
};

export const avatarService = {
  async list(workspaceId) {
    const avatars = await avatarRepository.listByWorkspace(workspaceId);
    await reconcileTraining(avatars);
    // Re-read only if something actually changed underneath us.
    const fresh = avatars.some((a) => a.status === "training")
      ? await avatarRepository.listByWorkspace(workspaceId)
      : avatars;
    return fresh.map(decorate);
  },

  async get(workspaceId, id) {
    let avatar = await avatarRepository.findById(workspaceId, id);
    if (!avatar) throw notFound();

    if (avatar.status === "training") {
      await reconcileTraining([avatar]);
      avatar = await avatarRepository.findById(workspaceId, id);
    }
    return decorate(avatar);
  },

  async remove(workspaceId, id) {
    const deleted = await avatarRepository.deleteById(workspaceId, id);
    if (!deleted) throw notFound();
    // The vendor-side avatar is deleted by a queue worker so a slow or failing
    // vendor never blocks the request. Wired up in Phase 2.
    return { id };
  },
};

/**
 * Brings training avatars up to date on read.
 *
 * Webhooks are the fast path, but they can be missed - a deploy, a dropped
 * request, a vendor that never fires one - and an avatar stuck at "training"
 * forever is indistinguishable from a broken product. Reading is the moment
 * someone actually cares about the answer, so it is a cheap place to check.
 *
 * Failures are swallowed: a vendor being slow must not break the avatar list.
 */
async function reconcileTraining(avatars) {
  const training = avatars.filter((a) => a.status === "training");
  if (!training.length) return;

  const jobs = await TrainingJob.find({
    avatarId: { $in: training.map((a) => a._id) },
    status: { $in: ["queued", "running"] },
  })
    .select("_id")
    .lean();

  await Promise.all(
    jobs.map((job) =>
      trainingService
        .reconcile(job._id)
        .catch((err) => logger.warn({ jobId: String(job._id), err: err.message }, "reconcile failed")),
    ),
  );
}

/**
 * Attach the vendor's capabilities to each avatar.
 *
 * The client needs these to decide what to offer - whether to show emotion
 * controls, whether a live image swap is possible - and deriving it here keeps
 * that knowledge out of the UI.
 */
function decorate(avatar) {
  const capabilities = CAPABILITIES[avatar.providerId] || null;
  const configured = isConfigured(avatar.providerId);

  return {
    ...avatar,
    capabilities,
    // Ready is not the same as callable. A vendor with no credential produces
    // avatars that look finished and fail the moment someone dials them.
    callable: avatar.status === "ready" && Boolean(capabilities?.nodePlugin) && configured,
    // Surfaced so the UI can say so. A stub returns the uploaded file as its
    // own preview, which is indistinguishable from a real result unless the
    // product admits which one it is.
    isStub: isDevelopmentOnly(avatar.providerId),
    ...(configured ? {} : { unavailableReason: `${avatar.providerId} is not configured` }),
  };
}
