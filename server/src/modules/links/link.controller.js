import { linkService } from "./link.service.js";
import { asyncHandler } from "../../middleware/validate.js";

export const linkController = {
  describe: asyncHandler(async (req, res) => {
    res.json(await linkService.describe(req.params.token));
  }),

  start: asyncHandler(async (req, res) => {
    res.status(201).json(await linkService.startCall(req.params.token, req.body));
  }),

  end: asyncHandler(async (req, res) => {
    res.json(
      await linkService.endCall(req.params.token, req.params.conversationId, req.body.callToken),
    );
  }),
};
