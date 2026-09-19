import mongoose from "mongoose";

/**
 * Video-cloned avatars train asynchronously and can take minutes. This tracks
 * the vendor-side job so a webhook or a poll can resolve it later.
 */
const trainingJobSchema = new mongoose.Schema(
  {
    avatarId: { type: mongoose.Schema.Types.ObjectId, ref: "Avatar", required: true, index: true },
    providerId: { type: String, required: true },
    providerJobId: { type: String, index: true },
    status: {
      type: String,
      enum: ["queued", "running", "succeeded", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    error: String,
    attempts: { type: Number, default: 0 },
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true },
);

export const TrainingJob = mongoose.model("TrainingJob", trainingJobSchema);
