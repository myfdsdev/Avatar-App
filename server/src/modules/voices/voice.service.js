import { Voice } from "../../models/index.js";

/**
 * The workspace's own voices.
 *
 * LiveKit has no public API for cloning, so the clone itself is made in the
 * LiveKit Cloud dashboard (Voices → Custom voices) and only its v_* id is
 * registered here, under a name people will recognise in the voice picker.
 * The record is a label: calls speak the id stored on the persona, so deleting
 * one never breaks an avatar already using it.
 */
export const voiceService = {
  list(workspace) {
    return Voice.find({ workspaceId: workspace._id, provider: "livekit" })
      .sort({ createdAt: -1 })
      .lean();
  },

  async create({ workspace, name, voiceId, gender, language }) {
    const existing = await Voice.findOne({
      workspaceId: workspace._id,
      provider: "livekit",
      providerVoiceId: voiceId,
    });
    if (existing) {
      const err = new Error(`This voice is already added as "${existing.name}"`);
      err.statusCode = 409;
      throw err;
    }

    const voice = await Voice.create({
      workspaceId: workspace._id,
      provider: "livekit",
      providerVoiceId: voiceId,
      name,
      gender,
      ...(language && { language }),
    });
    return voice.toObject();
  },

  async remove({ workspace, voiceId }) {
    const { deletedCount } = await Voice.deleteOne({
      _id: voiceId,
      workspaceId: workspace._id,
      provider: "livekit",
    });
    if (!deletedCount) {
      const err = new Error("Voice not found");
      err.statusCode = 404;
      throw err;
    }
  },
};
