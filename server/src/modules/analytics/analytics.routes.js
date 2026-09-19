import { Router } from "express";
import { analyticsController } from "./analytics.controller.js";
import { resolveWorkspace } from "../../middleware/workspace.js";

const router = Router();

router.use(resolveWorkspace);
router.get("/usage", analyticsController.usage);

export default router;
