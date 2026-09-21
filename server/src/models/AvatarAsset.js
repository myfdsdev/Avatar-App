import mongoose from "mongoose";

/**
 * The uploaded photo or training video behind an avatar.
 *
 * `publicUrl` is not a convenience field - vendors may fetch the file
 * from their own servers, so the asset must be publicly reachable before an
 * avatar can be created from it.
 */
const avatarAssetSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    kind: { type: String, enum: ["image", "video"], required: true },
    storageKey: { type: String, required: true },
    publicUrl: { type: String, required: true },
    bytes: Number,
    mime: String,
    checksum: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const AvatarAsset = mongoose.model("AvatarAsset", avatarAssetSchema);
