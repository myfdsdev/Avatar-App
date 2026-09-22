import { avatarService } from "./avatar.service.js";
import { asyncHandler } from "../../middleware/validate.js";

export const avatarController = {
  list: asyncHandler(async (req, res) => {
    res.json({ avatars: await avatarService.list(req.workspace._id) });
  }),

  get: asyncHandler(async (req, res) => {
    res.json({ avatar: await avatarService.get(req.workspace._id, req.params.id) });
  }),

  update: asyncHandler(async (req, res) => {
    res.json({ avatar: await avatarService.update(req.workspace._id, req.params.id, req.body) });
  }),

  remove: asyncHandler(async (req, res) => {
    res.json(await avatarService.remove(req.workspace._id, req.params.id));
  }),

  getShare: asyncHandler(async (req, res) => {
    res.json({ share: await avatarService.getShare(req.workspace._id, req.params.id) });
  }),

  setShare: asyncHandler(async (req, res) => {
    res.json({ share: await avatarService.setShare(req.workspace._id, req.params.id, req.body) });
  }),

  resetShare: asyncHandler(async (req, res) => {
    res.json({ share: await avatarService.resetShare(req.workspace._id, req.params.id) });
  }),
};
