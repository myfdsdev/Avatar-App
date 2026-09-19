import { avatarService } from "./avatar.service.js";
import { asyncHandler } from "../../middleware/validate.js";

export const avatarController = {
  list: asyncHandler(async (req, res) => {
    res.json({ avatars: await avatarService.list(req.workspace._id) });
  }),

  get: asyncHandler(async (req, res) => {
    res.json({ avatar: await avatarService.get(req.workspace._id, req.params.id) });
  }),

  remove: asyncHandler(async (req, res) => {
    res.json(await avatarService.remove(req.workspace._id, req.params.id));
  }),
};
