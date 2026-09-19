import mongoose from "mongoose";

/** How an avatar behaves, kept separate from how it looks. */
const personaSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    systemPrompt: { type: String, required: true },
    llmModel: { type: String, default: "claude-sonnet-5" },
    temperature: { type: Number, min: 0, max: 2, default: 0.7 },
    greeting: String,
    tools: [{ name: String, description: String, schema: mongoose.Schema.Types.Mixed }],
  },
  { timestamps: true },
);

export const Persona = mongoose.model("Persona", personaSchema);
