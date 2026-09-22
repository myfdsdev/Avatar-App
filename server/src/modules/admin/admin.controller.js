import { adminService } from "./admin.service.js";
import { plansService } from "./plans.service.js";
import { asyncHandler } from "../../middleware/validate.js";
import { isPlatformAdmin } from "../../middleware/admin.js";
import { User } from "../../models/index.js";

/** Who is acting and from where - recorded with every change an admin makes. */
const actor = (req) => ({ admin: req.admin, ip: req.ip });

export const adminController = {
  /** Whether the caller is a platform admin - the client uses it to show the Admin link. */
  access: asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth.userId).select("email").lean();
    res.json({ admin: isPlatformAdmin(user?.email) });
  }),

  overview: asyncHandler(async (req, res) => {
    res.json(await adminService.overview(req.query));
  }),

  listUsers: asyncHandler(async (req, res) => {
    res.json(await adminService.listUsers(req.query));
  }),

  getUser: asyncHandler(async (req, res) => {
    res.json(await adminService.getUser(req.params.id));
  }),

  block: asyncHandler(async (req, res) => {
    res.json(await adminService.block(req.params.id, req.body, actor(req)));
  }),

  unblock: asyncHandler(async (req, res) => {
    res.json(await adminService.unblock(req.params.id, actor(req)));
  }),

  assignPlan: asyncHandler(async (req, res) => {
    res.json(await adminService.assignPlan(req.params.id, req.body, actor(req)));
  }),

  listPlans: asyncHandler(async (req, res) => {
    res.json({ plans: await plansService.list() });
  }),

  createPlan: asyncHandler(async (req, res) => {
    res.status(201).json({ plan: await plansService.create(req.body, req.admin._id) });
  }),

  updatePlan: asyncHandler(async (req, res) => {
    res.json({ plan: await plansService.update(req.params.id, req.body) });
  }),

  removePlan: asyncHandler(async (req, res) => {
    res.json(await plansService.remove(req.params.id));
  }),
};
