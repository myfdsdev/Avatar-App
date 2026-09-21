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

// The public link. Managing it needs an account; using it does not - see
// modules/links.
router.get("/:id/share", validate(avatarValidation.byId), avatarController.getShare);
router.put("/:id/share", validate(avatarValidation.setShare), avatarController.setShare);
router.post("/:id/share/reset", validate(avatarValidation.byId), avatarController.resetShare);

export default router;
