import mongoose from "mongoose";

const turnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    tsMs: { type: Number, required: true },
  },
  { _id: false },
);

const transcriptSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      unique: true,
    },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    turns: [turnSchema],
    summary: String,
  },
  { timestamps: true },
);

export const Transcript = mongoose.model("Transcript", transcriptSchema);
