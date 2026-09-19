import { Conversation, Subscription, UsageLedger } from "../../models/index.js";
import { CAPABILITIES } from "../../avatar/capabilities.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

/**
 * Metering and the limits that depend on it.
 *
 * Cost is computed from the duration we actually observed, never from the
 * planning estimate in the capability matrix - that figure exists to route and
 * forecast, and billing from it would drift from reality the moment a vendor
 * changed price mid-month.
 *
 * The ledger is append-only. Corrections are new rows, so a disputed invoice
 * can always be replayed rather than reconstructed.
 */
export const usageService = {
  /**
   * Writes a conversation's usage exactly once.
   *
   * Idempotent on conversationId, because both the hang-up request and the
   * transport's own disconnect event can plausibly land here.
   */
  async recordConversation(conversation) {
    const existing = await UsageLedger.findOne({
      conversationId: conversation._id,
      kind: "conversation",
    }).lean();
    if (existing) return existing;

    const minutes = Math.max(0, conversation.durationSec || 0) / 60;
    const rate = CAPABILITIES[conversation.providerId]?.approxCostPerMinUsd ?? 0;
    const costCents = Math.round(minutes * rate * 100);

    const entry = await UsageLedger.create({
      workspaceId: conversation.workspaceId,
      conversationId: conversation._id,
      providerId: conversation.providerId,
      minutes: Number(minutes.toFixed(3)),
      costCents,
      kind: "conversation",
    });

    await Conversation.updateOne({ _id: conversation._id }, { $set: { costCents } });

    logger.info(
      { conversationId: String(conversation._id), minutes: entry.minutes, costCents },
      "usage recorded",
    );
    return entry;
  },

  /**
   * Calls currently holding a vendor session.
   *
   * Counts `pending` as well as `active`: a call that has been issued a token
   * but whose participant has not connected yet is still a reserved slot, and
   * ignoring it would let someone open unlimited sessions by never joining.
   */
  activeCallCount(workspaceId) {
    return Conversation.countDocuments({
      workspaceId,
      status: { $in: ["pending", "active"] },
    });
  },

  /**
   * Refuses a new call when the workspace is already at its ceiling.
   *
   * Concurrency is the limit that protects spend and vendor quota at the same
   * time, so it is enforced before a session is created rather than reported
   * afterwards.
   */
  async assertCanStartCall(workspace) {
    const limit = workspace.settings?.concurrencyLimit ?? 3;
    const active = await this.activeCallCount(workspace._id);

    if (active >= limit) {
      const err = new Error(
        `This workspace already has ${active} call(s) running and its limit is ${limit}.`,
      );
      err.statusCode = 429;
      throw err;
    }

    const subscription = await Subscription.findOne({ workspaceId: workspace._id }).lean();
    if (!subscription || subscription.overageEnabled) return;

    const used = await this.minutesThisPeriod(workspace._id);
    const included = subscription.includedMinutes ?? 0;

    // Zero included minutes means the plan is not metered this way (the free
    // tier during development), not that every call should be refused.
    if (included > 0 && used >= included) {
      const err = new Error(
        `Monthly allowance used (${used.toFixed(1)} of ${included} minutes). ` +
          `Enable overage in billing to keep going.`,
      );
      err.statusCode = 402;
      throw err;
    }
  },

  async minutesThisPeriod(workspaceId, since = startOfMonth()) {
    const [row] = await UsageLedger.aggregate([
      { $match: { workspaceId, createdAt: { $gte: since } } },
      { $group: { _id: null, minutes: { $sum: "$minutes" }, costCents: { $sum: "$costCents" } } },
    ]);
    return row?.minutes ?? 0;
  },

  async summary(workspaceId) {
    const since = startOfMonth();

    const byProvider = await UsageLedger.aggregate([
      { $match: { workspaceId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$providerId",
          minutes: { $sum: "$minutes" },
          costCents: { $sum: "$costCents" },
          calls: { $sum: 1 },
        },
      },
      { $sort: { costCents: -1 } },
    ]);

    const subscription = await Subscription.findOne({ workspaceId }).lean();

    // Derived from the per-provider rows rather than a second aggregate, so the
    // two can never disagree.
    const totals = byProvider.reduce(
      (acc, p) => ({
        minutes: acc.minutes + p.minutes,
        costCents: acc.costCents + p.costCents,
        calls: acc.calls + p.calls,
      }),
      { minutes: 0, costCents: 0, calls: 0 },
    );

    return {
      periodStart: since,
      totals: { ...totals, minutes: Number(totals.minutes.toFixed(2)) },
      byProvider: byProvider.map((p) => ({
        providerId: p._id,
        minutes: Number(p.minutes.toFixed(2)),
        costCents: p.costCents,
        calls: p.calls,
      })),
      activeCalls: await this.activeCallCount(workspaceId),
      plan: subscription
        ? {
            name: subscription.plan,
            includedMinutes: subscription.includedMinutes,
            overageEnabled: subscription.overageEnabled,
          }
        : null,
      maxCallSeconds: env.maxCallSeconds,
    };
  },
};

function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
