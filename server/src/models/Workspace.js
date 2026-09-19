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
  },
  { timestamps: true },
);

export const Workspace = mongoose.model("Workspace", workspaceSchema);
