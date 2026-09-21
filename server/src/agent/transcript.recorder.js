import { Transcript } from "../models/index.js";
import { logger } from "../config/logger.js";

/**
 * Saves what was said on a call, turn by turn, as it is said.
 *
 * Written per turn rather than once at the end: the worker can die mid-call - a
 * deploy, a crash, this machine running out of memory - and a transcript that
 * only lands on a clean shutdown is lost exactly when someone most wants to
 * know what happened.
 *
 * Writes are chained so turns land in the order they were spoken, and a failed
 * write is logged and skipped. Losing one line of a transcript must never end
 * the call.
 *
 * @param {{ conversationId: import("mongoose").Types.ObjectId, workspaceId: import("mongoose").Types.ObjectId }} ids
 */
export function createTranscriptRecorder({ conversationId, workspaceId }) {
  let chain = Promise.resolve();

  return {
    /** Takes an agents ChatMessage (or anything shaped like one). */
    record(item) {
      const turn = toTurn(item);
      if (!turn) return;

      chain = chain
        .then(() =>
          Transcript.updateOne(
            { conversationId },
            { $setOnInsert: { workspaceId }, $push: { turns: turn } },
            { upsert: true },
          ),
        )
        .catch((err) => logger.error({ err, conversationId }, "transcript write failed"));
    },

    /** Resolves once every recorded turn has been written (or given up on). */
    flush: () => chain,
  };
}

/**
 * Only what the two people said. System prompts and tool traffic are part of
 * the chat context but not of the conversation, and an empty message - a turn
 * the caller abandoned before any words were recognised - is noise.
 */
export function toTurn(item) {
  if (item?.role !== "user" && item?.role !== "assistant") return null;

  const text = item.textContent?.trim();
  if (!text) return null;

  return {
    role: item.role,
    text,
    tsMs: item.createdAt || Date.now(),
    ...(item.interrupted && { interrupted: true }),
  };
}
