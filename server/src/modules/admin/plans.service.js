import { Plan, Subscription } from "../../models/index.js";

/**
 * Plans, as admins manage them.
 *
 * A plan's key is fixed once created - it is what subscriptions and reports
 * show - while everything else can change, and takes effect for everyone on
 * the plan straight away (see usageService.limitsFor).
 */

const fail = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  return err;
};

/** Plan plus how many workspaces are on it. */
async function withUsers(plans) {
  const counts = await Subscription.aggregate([
    { $match: { planId: { $in: plans.map((p) => p._id) } } },
    { $group: { _id: "$planId", n: { $sum: 1 } } },
  ]);
  const byPlan = new Map(counts.map((c) => [String(c._id), c.n]));
  return plans.map((p) => ({ ...p, users: byPlan.get(String(p._id)) || 0 }));
}

/** Only one default: making a plan default clears it everywhere else. */
async function claimDefault(planId) {
  await Plan.updateMany({ _id: { $ne: planId }, isDefault: true }, { $set: { isDefault: false } });
}

export const plansService = {
  async list() {
    const plans = await Plan.find().sort({ active: -1, priceCents: 1, createdAt: 1 }).lean();
    return withUsers(plans);
  },

  async create(fields, adminId) {
    if (await Plan.exists({ key: fields.key })) {
      throw fail(409, `A plan with the key "${fields.key}" already exists.`);
    }
    if (fields.isDefault && fields.active === false) {
      throw fail(422, "An archived plan cannot be the default for new sign-ups.");
    }
    const plan = await Plan.create({ ...fields, createdBy: adminId });
    if (plan.isDefault) await claimDefault(plan._id);
    return (await withUsers([plan.toObject()]))[0];
  },

  async update(id, fields) {
    const plan = await Plan.findById(id);
    if (!plan) throw fail(404, "Plan not found");

    const next = { ...plan.toObject(), ...fields };
    if (next.isDefault && next.active === false) {
      throw fail(422, "An archived plan cannot be the default for new sign-ups.");
    }

    Object.assign(plan, fields);
    await plan.save();
    if (plan.isDefault) await claimDefault(plan._id);
    return (await withUsers([plan.toObject()]))[0];
  },

  /** Only a plan nobody is on; one that is in use is archived instead. */
  async remove(id) {
    const plan = await Plan.findById(id).lean();
    if (!plan) throw fail(404, "Plan not found");

    const users = await Subscription.countDocuments({ planId: id });
    if (users > 0) {
      throw fail(409, `${users} user${users === 1 ? " is" : "s are"} on this plan. Archive it instead, or move them first.`);
    }
    await Plan.deleteOne({ _id: id });
    return { id };
  },
};
