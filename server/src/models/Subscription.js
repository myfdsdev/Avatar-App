import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      unique: true,
    },
    stripeCustomerId: { type: String, index: true },
    stripeSubId: { type: String, index: true },
    // The plan's key, kept for display; `planId` is what the limits come from.
    plan: { type: String, default: "free" },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", index: true },
    assignedAt: Date,
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["active", "trialing", "past_due", "canceled", "incomplete"],
      default: "active",
    },
    includedMinutes: { type: Number, default: 0 },
    overageEnabled: { type: Boolean, default: false },
    currentPeriodEnd: Date,
  },
  { timestamps: true },
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
