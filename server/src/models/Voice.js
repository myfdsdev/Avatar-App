import mongoose from "mongoose";

const voiceSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
    provider: { type: String, enum: ["cartesia", "elevenlabs", "mock"], required: true },
    providerVoiceId: { type: String, required: true },
    name: { type: String, required: true },
    language: { type: String, default: "en" },
    previewUrl: String,
    // Stock voices are shared across workspaces and cannot be edited or deleted.
    isStock: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Voice = mongoose.model("Voice", voiceSchema);
