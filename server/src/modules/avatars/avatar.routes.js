import { Router } from "express";
import { avatarController } from "./avatar.controller.js";
import { avatarValidation } from "./avatar.validation.js";
import { validate } from "../../middleware/validate.js";
import { resolveWorkspace } from "../../middleware/workspace.js";

const router = Router();

router.use(resolveWorkspace);

router.get("/", avatarController.list);
router.get("/:id", validate(avatarValidation.byId), avatarController.get);
router.delete("/:id", validate(avatarValidation.byId), avatarController.remove);

export default router;
