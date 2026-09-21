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

    /** BCP-47-ish code driving STT, TTS and the vendor's own language setting. */
    language: { type: String, default: "en" },

    /**
     * How the avatar moves, as opposed to what it says.
     *
     * LemonSlice steers gesture and demeanour with a separate prompt; feeding
     * it the conversational brief produces an avatar that gestures like a
     * customer-service script. The renderer has always read these - they were
     * simply missing from the model.
     */
    motionPrompt: String,
    idlePrompt: String,

    /** Hard ceiling for one call. Falls back to MAX_CALL_SECONDS when unset. */
    maxCallSeconds: { type: Number, min: 60, max: 14400 },

    tools: [{ name: String, description: String, schema: mongoose.Schema.Types.Mixed }],
  },
  { timestamps: true },
);

export const Persona = mongoose.model("Persona", personaSchema);
