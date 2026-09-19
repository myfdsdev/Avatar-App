import { authService } from "./auth.service.js";
import { asyncHandler } from "../../middleware/validate.js";

export const authController = {
  register: asyncHandler(async (req, res) => {
    res.status(201).json(await authService.register(req.body));
  }),

  login: asyncHandler(async (req, res) => {
    res.json(await authService.login(req.body));
  }),

  refresh: asyncHandler(async (req, res) => {
    res.json(await authService.refresh(req.body.refreshToken));
  }),

  /** Signs out everywhere, not just this device - refresh tokens are versioned. */
  logout: asyncHandler(async (req, res) => {
    await authService.revokeAll(req.auth.userId);
    res.json({ ok: true });
  }),

  me: asyncHandler(async (req, res) => {
    res.json({ auth: req.auth, workspace: req.workspace });
  }),
};
