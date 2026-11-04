import { User, Workspace } from "../models/index.js";
import { accountBlocked } from "../modules/auth/blocked.js";
import { keysOf, withKeys } from "../modules/byok/byok.context.js";

/**
 * Populates req.workspace from the authenticated token.
 *
 * Until Phase 4 this fell back to "whichever workspace exists" so the call path
 * could be developed before auth existed. That fallback is gone - it would have
 * been a complete tenancy bypass the moment it reached production, and there is
 * no longer any reason to keep it. Dev convenience now comes from the seed
 * script printing usable credentials instead.
 */
export async function resolveWorkspace(req, res, next) {
  try {
    if (!req.auth?.workspaceId) {
      const err = new Error("Authentication required");
      err.statusCode = 401;
      throw err;
    }

    // Checked per request, not only at sign-in, so a block takes effect at once
    // rather than when the access token happens to expire.
    const [workspace, person] = await Promise.all([
      Workspace.findById(req.auth.workspaceId),
      User.findById(req.auth.userId).select("workspaceId blockedAt").lean(),
    ]);
    // Also per request: someone removed from the workspace (or whose account is
    // gone) is out now, not when their access token happens to expire.
    if (!person || String(person.workspaceId) !== String(req.auth.workspaceId)) {
      const err = new Error("Authentication required");
      err.statusCode = 401;
      throw err;
    }
    // An admin acting as a blocked user is looking at exactly that account.
    if (person.blockedAt && !req.auth.impersonatedBy) throw accountBlocked();
    req.workspace = workspace;

    if (!req.workspace) {
      const err = new Error("Workspace no longer exists");
      err.statusCode = 403;
      throw err;
    }

    // The rest of the request runs on this workspace's own vendor keys.
    req.byokKeys = keysOf(req.workspace);
    withKeys(req.byokKeys, next);
  } catch (err) {
    next(err);
  }
}
