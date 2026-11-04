import { Router } from "express";
import { z } from "zod";
import { byokService } from "./byok.service.js";
import { BYOK_SERVICES } from "./byok.context.js";
import { asyncHandler, validate } from "../../middleware/validate.js";
import { resolveWorkspace } from "../../middleware/workspace.js";
import { loadActor, requireManager } from "../../middleware/teamRole.js";

/**
 * The workspace's own LemonSlice and ElevenLabs keys. Mounted at /api/byok.
 * Everyone may see whether they are set (the app asks on open); only owners
 * and admins may change them.
 */
const router = Router();
router.use(resolveWorkspace, loadActor);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({
      keys: byokService.status(req.workspace),
      canManage: ["owner", "admin"].includes(req.actor.role),
    });
  }),
);

const key = z.string().trim().max(500).optional();

router.put(
  "/",
  requireManager,
  validate({ body: z.object({ lemonslice: key, elevenlabs: key }) }),
  asyncHandler(async (req, res) => {
    res.json({ keys: await byokService.save(req.workspace, req.body) });
  }),
);

router.delete(
  "/:service",
  requireManager,
  validate({ params: z.object({ service: z.enum(BYOK_SERVICES) }) }),
  asyncHandler(async (req, res) => {
    res.json({ keys: await byokService.remove(req.workspace, req.params.service) });
  }),
);

export default router;
