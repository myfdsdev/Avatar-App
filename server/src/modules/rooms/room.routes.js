import { Router } from "express";
import { roomController } from "./room.controller.js";
import { roomValidation } from "./room.validation.js";
import { validate } from "../../middleware/validate.js";
import { resolveWorkspace } from "../../middleware/workspace.js";

const router = Router();

router.use(resolveWorkspace);

router.post("/", validate(roomValidation.start), roomController.start);
router.delete("/:conversationId", validate(roomValidation.end), roomController.end);

export default router;
