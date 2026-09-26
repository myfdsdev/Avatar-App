import { voiceService } from "./voice.service.js";
import { asyncHandler } from "../../middleware/validate.js";

export const voiceController = {
  list: asyncHandler(async (req, res) => {
    res.json({ voices: await voiceService.list(req.workspace) });
  }),

  create: asyncHandler(async (req, res) => {
    const voice = await voiceService.create({ workspace: req.workspace, ...req.body });
    res.status(201).json({ voice });
  }),

  remove: asyncHandler(async (req, res) => {
    await voiceService.remove({ workspace: req.workspace, voiceId: req.params.voiceId });
    res.status(204).end();
  }),
};
