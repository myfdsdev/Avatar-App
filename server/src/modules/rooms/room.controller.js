import { roomService } from "./room.service.js";
import { asyncHandler } from "../../middleware/validate.js";

export const roomController = {
  start: asyncHandler(async (req, res) => {
    const connection = await roomService.startCall({
      workspace: req.workspace,
      avatarId: req.body.avatarId,
      userId: req.auth?.userId,
    });
    res.status(201).json(connection);
  }),

  end: asyncHandler(async (req, res) => {
    res.json(
      await roomService.endCall({
        workspace: req.workspace,
        conversationId: req.params.conversationId,
      }),
    );
  }),
};
