import mongoose from "mongoose";

const voiceSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
    // "livekit" is a custom voice cloned in the LiveKit Cloud dashboard; its
    // providerVoiceId is the v_* id LiveKit Inference speaks it by.
    provider: { type: String, enum: ["cartesia", "elevenlabs", "livekit", "mock"], required: true },
    providerVoiceId: { type: String, required: true },
    name: { type: String, required: true },
    language: { type: String, default: "en" },
    gender: { type: String, enum: ["female", "male"] },
    previewUrl: String,
    // Stock voices are shared across workspaces and cannot be edited or deleted.
    isStock: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Voice = mongoose.model("Voice", voiceSchema);
