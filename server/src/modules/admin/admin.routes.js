import { Router } from "express";
import { adminController } from "./admin.controller.js";
import { adminValidation } from "./admin.validation.js";
import { validate } from "../../middleware/validate.js";
import { requirePlatformAdmin } from "../../middleware/admin.js";

const router = Router();

// Answers for anyone signed in, so the client can decide whether to show Admin.
router.get("/access", adminController.access);

// Everything below is platform admins only.
router.use(requirePlatformAdmin);

router.get("/overview", validate(adminValidation.overview), adminController.overview);

router.get("/users", validate(adminValidation.listUsers), adminController.listUsers);
router.get("/users/:id", validate(adminValidation.byId), adminController.getUser);
router.post("/users/:id/block", validate(adminValidation.block), adminController.block);
router.delete("/users/:id/block", validate(adminValidation.byId), adminController.unblock);
router.put("/users/:id/plan", validate(adminValidation.assignPlan), adminController.assignPlan);

router.get("/plans", adminController.listPlans);
router.post("/plans", validate(adminValidation.createPlan), adminController.createPlan);
router.post("/plans/templates", adminController.addPlanTemplates);
router.patch("/plans/:id", validate(adminValidation.updatePlan), adminController.updatePlan);
router.delete("/plans/:id", validate(adminValidation.byId), adminController.removePlan);

export default router;
