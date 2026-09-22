import {
  AuditLog,
  Avatar,
  Conversation,
  KnowledgeDocument,
  Plan,
  Subscription,
  User,
  Workspace,
} from "../../models/index.js";
import { isPlatformAdmin } from "../../middleware/admin.js";
import { authService } from "../auth/auth.service.js";
import { roomService } from "../rooms/room.service.js";
import { usageService } from "../billing/usage.service.js";
import { logger } from "../../config/logger.js";

/**
 * What a platform admin sees: every user, across every workspace.
 *
 * Mostly read-only. The few actions that change an account - blocking and
 * assigning a plan - are each written to the target workspace's audit log.
 *
 * Avatars, calls and minutes belong to a workspace, not a person, so a user's
 * figures are their workspace's. Nearly every workspace has one user.
 */

const DAY = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 25;
const CHART_DAYS = 14;

const notFound = () => {
  const err = new Error("User not found");
  err.statusCode = 404;
  return err;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A timezone MongoDB and Intl both accept, or UTC. */
function safeZone(tz) {
  try {
    if (tz) {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return tz;
    }
  } catch {
    // Unknown zone: fall through.
  }
  return "UTC";
}

/** The last `days` calendar dates in `tz`, oldest first, as YYYY-MM-DD. */
function lastDays(days, tz, now = Date.now()) {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  return Array.from({ length: days }, (_, i) => format.format(new Date(now - (days - 1 - i) * DAY)));
}

const minutes = (seconds) => Math.round((seconds / 60) * 10) / 10;

export const adminService = {
  async overview({ tz }) {
    const zone = safeZone(tz);
    const now = Date.now();
    const since1d = new Date(now - DAY);
    const since7d = new Date(now - 7 * DAY);
    // A day of slack: the oldest chart day starts at midnight in `zone`, which
    // can be up to a day before now - 14 days.
    const sinceChart = new Date(now - (CHART_DAYS + 1) * DAY);

    const [
      totalUsers,
      blockedUsers,
      newUsers7d,
      totalAvatars,
      totalCalls,
      calls24h,
      calls7d,
      totals,
      totals7d,
      busyWorkspaces,
      daily,
      live,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ blockedAt: { $ne: null } }),
      User.countDocuments({ createdAt: { $gte: since7d } }),
      Avatar.countDocuments(),
      Conversation.countDocuments(),
      Conversation.countDocuments({ createdAt: { $gte: since1d } }),
      Conversation.countDocuments({ createdAt: { $gte: since7d } }),
      sumCalls({}),
      sumCalls({ createdAt: { $gte: since7d } }),
      Conversation.distinct("workspaceId", { createdAt: { $gte: since7d } }),
      Conversation.aggregate([
        { $match: { createdAt: { $gte: sinceChart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: zone } },
            calls: { $sum: 1 },
            seconds: { $sum: "$durationSec" },
          },
        },
      ]),
      Conversation.find({ status: "active" })
        .sort({ startedAt: -1 })
        .limit(20)
        .populate("avatarId", "name")
        .select("avatarId workspaceId userId source guest startedAt createdAt")
        .lean(),
    ]);

    // Active: signed in, or made a call, in the last seven days.
    const activeUsers7d = await User.countDocuments({
      $or: [{ lastLoginAt: { $gte: since7d } }, { workspaceId: { $in: busyWorkspaces } }],
    });

    const byDay = new Map(daily.map((d) => [d._id, d]));
    const owners = await usersById(live.map((c) => c.userId));

    return {
      timezone: zone,
      users: { total: totalUsers, new7d: newUsers7d, active7d: activeUsers7d, blocked: blockedUsers },
      avatars: { total: totalAvatars },
      calls: {
        total: totalCalls,
        last24h: calls24h,
        last7d: calls7d,
        live: live.length,
      },
      minutes: { total: minutes(totals.seconds), last7d: minutes(totals7d.seconds) },
      costCents: { total: totals.costCents, last7d: totals7d.costCents },
      daily: lastDays(CHART_DAYS, zone, now).map((date) => ({
        date,
        calls: byDay.get(date)?.calls || 0,
        minutes: minutes(byDay.get(date)?.seconds || 0),
      })),
      liveCalls: live.map((c) => ({
        id: c._id,
        avatar: c.avatarId?.name || "Deleted avatar",
        user: owners.get(String(c.userId)) || null,
        source: c.source,
        guest: c.guest?.name || null,
        startedAt: c.startedAt || c.createdAt,
      })),
    };
  },

  async listUsers({ q, page = 1 }) {
    const filter = q
      ? {
          $or: [
            { email: { $regex: escapeRegex(q), $options: "i" } },
            { name: { $regex: escapeRegex(q), $options: "i" } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .select("email name workspaceId createdAt lastLoginAt blockedAt")
        .lean(),
    ]);

    const workspaceIds = users.map((u) => u.workspaceId).filter(Boolean);
    const [avatarCounts, callStats, subscriptions] = await Promise.all([
      Avatar.aggregate([
        { $match: { workspaceId: { $in: workspaceIds } } },
        { $group: { _id: "$workspaceId", n: { $sum: 1 } } },
      ]),
      Conversation.aggregate([
        { $match: { workspaceId: { $in: workspaceIds } } },
        {
          $group: {
            _id: "$workspaceId",
            calls: { $sum: 1 },
            seconds: { $sum: "$durationSec" },
            lastCallAt: { $max: "$createdAt" },
          },
        },
      ]),
      Subscription.find({ workspaceId: { $in: workspaceIds } })
        .select("workspaceId plan planId")
        .populate("planId", "name")
        .lean(),
    ]);

    const avatars = keyed(avatarCounts);
    const calls = keyed(callStats);
    const plans = new Map(subscriptions.map((s) => [String(s.workspaceId), s.planId?.name || s.plan]));

    return {
      total,
      page,
      pageSize: PAGE_SIZE,
      users: users.map((u) => {
        const ws = String(u.workspaceId);
        const stat = calls.get(ws);
        return {
          id: u._id,
          email: u.email,
          name: u.name || null,
          admin: isPlatformAdmin(u.email),
          blocked: Boolean(u.blockedAt),
          plan: plans.get(ws) || null,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt || null,
          lastCallAt: stat?.lastCallAt || null,
          avatars: avatars.get(ws)?.n || 0,
          calls: stat?.calls || 0,
          minutes: minutes(stat?.seconds || 0),
        };
      }),
    };
  },

  async getUser(id) {
    const user = await User.findById(id)
      .select("email name role workspaceId createdAt lastLoginAt blockedAt blockedReason blockedBy")
      .populate("blockedBy", "email")
      .lean();
    if (!user) throw notFound();

    const workspaceId = user.workspaceId;
    const [workspace, subscription, avatars, conversations, totals, totals7d, documents] =
      await Promise.all([
        Workspace.findById(workspaceId).select("name createdAt settings").lean(),
        Subscription.findOne({ workspaceId })
          .select("plan planId status assignedAt")
          .populate("planId", "name key")
          .lean(),
        Avatar.find({ workspaceId })
          .sort({ createdAt: -1 })
          .select("name previewUrl status providerId sourceType createdAt updatedAt")
          .lean(),
        Conversation.find({ workspaceId })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate("avatarId", "name")
          .select("avatarId source guest status startedAt endedAt durationSec costCents endReason createdAt")
          .lean(),
        sumCalls({ workspaceId }),
        sumCalls({ workspaceId, createdAt: { $gte: new Date(Date.now() - 7 * DAY) } }),
        KnowledgeDocument.countDocuments({ workspaceId }),
      ]);

    const [limits, minutesThisMonth] = workspace
      ? await Promise.all([
          usageService.limitsFor(workspace),
          usageService.minutesThisPeriod(workspace._id),
        ])
      : [null, 0];

    return {
      user: {
        ...user,
        id: user._id,
        admin: isPlatformAdmin(user.email),
        blocked: Boolean(user.blockedAt),
        blockedBy: user.blockedBy?.email || null,
      },
      workspace: workspace && { _id: workspace._id, name: workspace.name, createdAt: workspace.createdAt },
      subscription: subscription && {
        plan: subscription.plan,
        planId: subscription.planId?._id || null,
        planName: subscription.planId?.name || null,
        status: subscription.status,
        assignedAt: subscription.assignedAt || null,
      },
      limits,
      minutesThisMonth: minutes(minutesThisMonth * 60),
      stats: {
        avatars: avatars.length,
        documents,
        calls: totals.calls,
        calls7d: totals7d.calls,
        minutes: minutes(totals.seconds),
        costCents: totals.costCents,
        lastCallAt: conversations[0]?.createdAt || null,
      },
      avatars,
      conversations: conversations.map((c) => ({
        id: c._id,
        avatar: c.avatarId?.name || "Deleted avatar",
        source: c.source,
        guest: c.guest?.name || null,
        status: c.status,
        startedAt: c.startedAt || c.createdAt,
        durationSec: c.durationSec || 0,
        costCents: c.costCents || 0,
        endReason: c.endReason || null,
      })),
    };
  },
};

/* ---------------------------------------------------------------- actions */

const fail = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  return err;
};

async function audit({ user, admin, action, meta, ip }) {
  if (!user.workspaceId) return;
  await AuditLog.create({
    workspaceId: user.workspaceId,
    actorId: admin._id,
    action,
    target: { kind: "user", id: String(user._id) },
    meta,
    ip,
  }).catch((err) => logger.warn({ err: err.message, action }, "audit log write failed"));
}

Object.assign(adminService, {
  /**
   * Blocks an account: sign-in, token refresh and every API call are refused
   * from now on, refresh tokens are revoked, its live calls are ended, and -
   * for a workspace owner - its avatars stop answering share links.
   *
   * Admins cannot be blocked (take them off ADMIN_EMAILS first), and nobody
   * can block themselves.
   */
  async block(id, { reason }, { admin, ip }) {
    const user = await User.findById(id).select("email workspaceId").lean();
    if (!user) throw notFound();
    if (String(user._id) === String(admin._id)) throw fail(422, "You cannot block yourself.");
    if (isPlatformAdmin(user.email)) {
      throw fail(422, "Admins cannot be blocked. Remove them from ADMIN_EMAILS first.");
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { blockedAt: new Date(), blockedReason: reason || undefined, blockedBy: admin._id } },
    );
    await authService.revokeAll(user._id);
    const ended = await endLiveCalls(user);

    await audit({ user, admin, action: "admin.user.block", meta: { reason, endedCalls: ended }, ip });
    logger.info({ userId: String(user._id), endedCalls: ended }, "user blocked by admin");
    return this.getUser(id);
  },

  async unblock(id, { admin, ip }) {
    const user = await User.findById(id).select("workspaceId").lean();
    if (!user) throw notFound();

    await User.updateOne(
      { _id: user._id },
      { $unset: { blockedAt: "", blockedReason: "", blockedBy: "" } },
    );
    await audit({ user, admin, action: "admin.user.unblock", ip });
    return this.getUser(id);
  },

  /** Puts the user's workspace on a plan; its limits apply from the next call. */
  async assignPlan(id, { planId }, { admin, ip }) {
    const user = await User.findById(id).select("workspaceId").lean();
    if (!user) throw notFound();
    if (!user.workspaceId) throw fail(422, "This user has no workspace to put on a plan.");

    const plan = await Plan.findById(planId).lean();
    if (!plan) throw fail(404, "Plan not found");
    if (!plan.active) throw fail(422, "That plan is archived and cannot be assigned.");

    const previous = await Subscription.findOne({ workspaceId: user.workspaceId }).select("plan").lean();
    await Subscription.updateOne(
      { workspaceId: user.workspaceId },
      {
        $set: {
          plan: plan.key,
          planId: plan._id,
          assignedAt: new Date(),
          assignedBy: admin._id,
          status: "active",
        },
      },
      { upsert: true },
    );

    await audit({
      user,
      admin,
      action: "admin.plan.assign",
      meta: { from: previous?.plan || null, to: plan.key },
      ip,
    });
    return this.getUser(id);
  },
});

/**
 * Ends what a blocked user has running. For a workspace owner that is every
 * call in the workspace, share-link calls included; for a member, their own.
 */
async function endLiveCalls(user) {
  if (!user.workspaceId) return 0;
  const workspace = await Workspace.findById(user.workspaceId);
  if (!workspace) return 0;

  const owner = String(workspace.ownerId) === String(user._id);
  const live = await Conversation.find({
    workspaceId: workspace._id,
    status: { $in: ["pending", "active"] },
    ...(owner ? {} : { userId: user._id }),
  })
    .select("_id")
    .lean();

  for (const c of live) {
    await roomService
      .endCall({ workspace, conversationId: c._id, endReason: "account blocked" })
      .catch((err) => logger.warn({ err: err.message, conversationId: String(c._id) }, "could not end call"));
  }
  return live.length;
}

async function sumCalls(match) {
  const [row] = await Conversation.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        calls: { $sum: 1 },
        seconds: { $sum: "$durationSec" },
        costCents: { $sum: "$costCents" },
      },
    },
  ]);
  return row || { calls: 0, seconds: 0, costCents: 0 };
}

const keyed = (rows) => new Map(rows.map((r) => [String(r._id), r]));

async function usersById(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select("email name").lean();
  return new Map(users.map((u) => [String(u._id), { id: u._id, email: u.email, name: u.name || null }]));
}
