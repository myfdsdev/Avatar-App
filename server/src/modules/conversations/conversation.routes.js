import { Router } from "express";
import { conversationController } from "./conversation.controller.js";
import { conversationValidation } from "./conversation.validation.js";
import { validate } from "../../middleware/validate.js";
import { resolveWorkspace } from "../../middleware/workspace.js";

const router = Router();

router.use(resolveWorkspace);

router.get("/", validate(conversationValidation.list), conversationController.list);
router.get("/:id", validate(conversationValidation.byId), conversationController.get);

export default router;
