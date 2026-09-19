import mongoose from "mongoose";

/**
 * Append-only billing record. Written once per conversation when it ends, and
 * never mutated - corrections are new entries, so the ledger can always be
 * replayed against an invoice.
 */
const usageLedgerSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", index: true },
    providerId: String,
    minutes: { type: Number, required: true },
    costCents: { type: Number, required: true },
    kind: { type: String, enum: ["conversation", "training", "adjustment"], default: "conversation" },
    billedAt: Date,
  },
  { timestamps: true },
);

usageLedgerSchema.index({ workspaceId: 1, createdAt: -1 });

export const UsageLedger = mongoose.model("UsageLedger", usageLedgerSchema);
