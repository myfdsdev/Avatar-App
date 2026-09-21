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

// One conversation entry per call, enforced by the database. Two processes can
// finish the same call at once - the caller's hang-up in the API and the agent
// worker noticing the room close - and a read-then-insert check alone lets
// both through. Adjustments are exempt; they are how corrections are recorded.
usageLedgerSchema.index(
  { conversationId: 1, kind: 1 },
  { unique: true, partialFilterExpression: { kind: "conversation" } },
);

export const UsageLedger = mongoose.model("UsageLedger", usageLedgerSchema);
