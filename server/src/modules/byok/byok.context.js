import { AsyncLocalStorage } from "node:async_hooks";
import { Workspace } from "../../models/index.js";
import { logger } from "../../config/logger.js";
import { open } from "../../utils/secretBox.js";

/**
 * Bring your own key: LemonSlice and ElevenLabs run on the workspace's own
 * keys, never the install's. A workspace without a key simply cannot use that
 * vendor - there is no fallback to a key in the environment.
 *
 * The keys travel with the request (or the agent job) in AsyncLocalStorage,
 * so the code that talks to a vendor asks `byokKey("lemonslice")` instead of
 * having a workspace threaded through every provider and renderer. The store
 * is entered in three places:
 *
 *   resolveWorkspace     every signed-in API request; it also leaves them on
 *                        req.byokKeys, and asyncHandler re-enters them, because
 *                        a body parser that reads the stream (multer) resumes
 *                        the request outside the store
 *   link + MCP routes    the avatar's / token's workspace, signed in or not
 *   agent worker         the called avatar's workspace, at the start of a job
 *
 * Outside those (a timer, a script) there are no keys, which reads as "not set
 * up" - the safe answer.
 */

export const BYOK_SERVICES = ["lemonslice", "elevenlabs"];

const store = new AsyncLocalStorage();

/** A workspace's keys, decrypted. A key that cannot be read counts as missing. */
export function keysOf(workspace) {
  const keys = {};
  for (const service of BYOK_SERVICES) {
    const sealed = workspace?.apiKeys?.[service];
    if (!sealed) {
      keys[service] = "";
      continue;
    }
    try {
      keys[service] = open(sealed);
    } catch (err) {
      // The encryption key changed since this was saved; the owner has to enter it again.
      logger.warn({ workspaceId: String(workspace._id), service, err: err.message }, "workspace API key could not be decrypted");
      keys[service] = "";
    }
  }
  return keys;
}

/** Runs `fn` with these keys (from keysOf) in scope. */
export const withKeys = (keys, fn) => store.run(keys, fn);

/**
 * Puts a workspace's keys in scope for the rest of the calling async function.
 * Accepts the workspace document or its id.
 */
export async function enterWorkspaceKeys(workspaceOrId) {
  const workspace =
    workspaceOrId?.apiKeys !== undefined
      ? workspaceOrId
      : await Workspace.findById(workspaceOrId?._id || workspaceOrId).select("apiKeys").lean();
  store.enterWith(keysOf(workspace));
}

/** The key for a service in the current request or job; "" when there is none. */
export const byokKey = (service) => store.getStore()?.[service] || "";
