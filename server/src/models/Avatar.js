import mongoose from "mongoose";

/**
 * A logical avatar, independent of who renders it.
 *
 * `providerId` + `providerAvatarId` is the whole anti-lock-in mechanism: the
 * same avatar can be recreated on another vendor and every conversation,
 * transcript and embed that points at this `_id` keeps working.
 */
const avatarSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    // "stock" is a vendor's own pre-trained avatar: nothing uploaded, nothing
    // trained, so it has no AvatarAsset behind it.
    sourceType: { type: String, enum: ["photo", "video", "stock"], required: true },
    status: {
      type: String,
      enum: ["draft", "training", "ready", "failed"],
      default: "draft",
      index: true,
    },

    providerId: { type: String, required: true },
    providerAvatarId: { type: String, index: true },

    assetId: { type: mongoose.Schema.Types.ObjectId, ref: "AvatarAsset" },
    previewUrl: String,

    personaId: { type: mongoose.Schema.Types.ObjectId, ref: "Persona" },
    voiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Voice" },

    failureReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

avatarSchema.index({ workspaceId: 1, status: 1 });

export const Avatar = mongoose.model("Avatar", avatarSchema);
