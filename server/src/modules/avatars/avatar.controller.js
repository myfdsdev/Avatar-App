import { avatarService } from "./avatar.service.js";
import { knowledgeService } from "./knowledge.service.js";
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

  listDocuments: asyncHandler(async (req, res) => {
    res.json({ documents: await knowledgeService.list(req.workspace._id, req.params.id) });
  }),

  addDocument: asyncHandler(async (req, res) => {
    const document = await knowledgeService.add(
      req.workspace._id,
      req.params.id,
      req.file,
      req.auth?.userId,
    );
    res.status(201).json({ document });
  }),

  removeDocument: asyncHandler(async (req, res) => {
    res.json(await knowledgeService.remove(req.workspace._id, req.params.id, req.params.docId));
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
