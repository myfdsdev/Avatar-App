import mongoose from "mongoose";

/**
 * One line of a call.
 *
 * `tsMs` is wall-clock epoch milliseconds, not an offset - the client derives
 * "0:42 into the call" from it and the conversation's start, and an absolute
 * time stays meaningful even if the start is never recorded.
 *
 * `interrupted` marks an avatar reply the caller talked over. Its text is what
 * was actually spoken before the cut, not what the model meant to say.
 */
const turnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    tsMs: { type: Number, required: true },
    interrupted: Boolean,
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
