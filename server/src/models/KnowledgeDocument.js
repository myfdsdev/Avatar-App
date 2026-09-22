import mongoose from "mongoose";

/**
 * A document in an avatar's knowledge base.
 *
 * Only the extracted text is kept - it is all a call ever reads - so no file
 * has to be stored, served or cleaned up. Kept out of the Persona so a long
 * PDF is never loaded just to render an avatar list.
 */
const knowledgeDocumentSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    avatarId: { type: mongoose.Schema.Types.ObjectId, ref: "Avatar", required: true, index: true },
    name: { type: String, required: true, trim: true },
    mime: String,
    bytes: Number,
    text: { type: String, required: true },
    chars: { type: Number, required: true },
    // Cut at MAX_DOC_CHARS (ai/knowledge.js); the UI says so.
    truncated: { type: Boolean, default: false },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

knowledgeDocumentSchema.index({ workspaceId: 1, avatarId: 1, createdAt: 1 });

export const KnowledgeDocument = mongoose.model("KnowledgeDocument", knowledgeDocumentSchema);
