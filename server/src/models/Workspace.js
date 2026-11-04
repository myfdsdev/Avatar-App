import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: String, default: "free" },
    settings: {
      // Pinned per workspace so a plan change never silently re-routes existing
      // avatars to a different vendor.
      defaultProviderId: { type: String, default: "mock" },
      defaultLlmModel: { type: String, default: "claude-sonnet-5" },
      concurrencyLimit: { type: Number, default: 3 },
      zeroDataRetention: { type: Boolean, default: false },
    },
    // A vendor's ready-made avatars carry no gender, so the workspace records
    // one per face, keyed "providerId:providerAvatarId".
    stockGenders: { type: Map, of: { type: String, enum: ["female", "male"] } },
    // The workspace's own vendor keys (bring your own key), sealed with
    // utils/secretBox.js. Read through modules/byok/byok.context.js; the API
    // only ever reports whether one is set and its last four characters.
    apiKeys: {
      lemonslice: { type: String, default: "" },
      elevenlabs: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export const Workspace = mongoose.model("Workspace", workspaceSchema);
