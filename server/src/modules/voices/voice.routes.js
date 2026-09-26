import { Router } from "express";
import { voiceController } from "./voice.controller.js";
import { voiceValidation } from "./voice.validation.js";
import { validate } from "../../middleware/validate.js";
import { resolveWorkspace } from "../../middleware/workspace.js";

const router = Router();

router.use(resolveWorkspace);

router.get("/", voiceController.list);
router.post("/", validate(voiceValidation.create), voiceController.create);
router.delete("/:voiceId", validate(voiceValidation.remove), voiceController.remove);

export default router;
