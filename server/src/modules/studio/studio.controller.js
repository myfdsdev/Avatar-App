import { studioService } from "./studio.service.js";
import { asyncHandler } from "../../middleware/validate.js";

export const studioController = {
  options: asyncHandler(async (req, res) => {
    res.json(studioService.options());
  }),

  stock: asyncHandler(async (req, res) => {
    res.json({ avatars: await studioService.listStock(req.workspace) });
  }),

  setStockGender: asyncHandler(async (req, res) => {
    res.json(await studioService.setStockGender({ workspace: req.workspace, ...req.body }));
  }),

  createFromStock: asyncHandler(async (req, res) => {
    const avatar = await studioService.createFromStock({
      workspace: req.workspace,
      providerId: req.body.providerId,
      providerAvatarId: req.body.providerAvatarId,
      name: req.body.name,
      gender: req.body.gender,
      behaviour: req.body.behaviour,
      userId: req.auth?.userId,
    });
    res.status(201).json({ avatar });
  }),

  createFromVideo: asyncHandler(async (req, res) => {
    const avatar = await studioService.createFromVideo({
      workspace: req.workspace,
      file: req.file,
      name: req.body.name,
      providerId: req.body.providerId,
      gender: req.body.gender,
      behaviour: req.body.behaviour,
      userId: req.auth?.userId,
    });
    // 202: accepted, but not finished - training resolves asynchronously.
    res.status(202).json({ avatar });
  }),

  createFromPhoto: asyncHandler(async (req, res) => {
    const avatar = await studioService.createFromPhoto({
      workspace: req.workspace,
      file: req.file,
      name: req.body.name,
      providerId: req.body.providerId,
      gender: req.body.gender,
      behaviour: req.body.behaviour,
      userId: req.auth?.userId,
    });
    res.status(201).json({ avatar });
  }),
};
