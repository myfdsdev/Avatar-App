import { usageService } from "../billing/usage.service.js";
import { asyncHandler } from "../../middleware/validate.js";

export const analyticsController = {
  usage: asyncHandler(async (req, res) => {
    res.json(await usageService.summary(req.workspace._id));
  }),
};
