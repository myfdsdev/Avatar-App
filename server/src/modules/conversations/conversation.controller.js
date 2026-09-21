import { conversationService } from "./conversation.service.js";
import { asyncHandler } from "../../middleware/validate.js";

export const conversationController = {
  list: asyncHandler(async (req, res) => {
    res.json({ conversations: await conversationService.list(req.workspace._id, req.query) });
  }),

  get: asyncHandler(async (req, res) => {
    res.json(await conversationService.get(req.workspace._id, req.params.id));
  }),
};
