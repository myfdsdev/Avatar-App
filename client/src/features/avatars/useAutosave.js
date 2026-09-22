import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { avatarApi } from "@/services/avatar.api";

const DELAY_MS = 700;

/**
 * Saves settings as they change, with no Save button.
 *
 * Edits are collected into one partial patch and sent once typing pauses, so a
 * paragraph of instructions is one request rather than one per keystroke.
 * Whatever is still waiting when the page goes is sent then, not dropped.
 *
 * `status` is "idle" | "saving" | "saved" | "error".
 */
export function useAutosave(avatarId) {
  const queryClient = useQueryClient();
  const pending = useRef({});
  const timer = useRef(null);
  const [status, setStatus] = useState("idle");

  const save = useMutation({
    mutationFn: (patch) => avatarApi.update(avatarId, patch),
    onSuccess: (avatar) => {
      queryClient.setQueryData(["avatar", avatarId], avatar);
      queryClient.invalidateQueries({ queryKey: ["avatars"] });
      setStatus(Object.keys(pending.current).length ? "saving" : "saved");
    },
    onError: () => setStatus("error"),
  });

  // Held in a ref so the unmount flush below always sends through the latest one.
  const mutate = useRef(save.mutate);
  mutate.current = save.mutate;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length) mutate.current(patch);
  }, []);

  /** Queues a partial patch; `now` sends it straight away (a rename, a toggle). */
  const queue = useCallback(
    (patch, { now = false } = {}) => {
      pending.current = mergePatch(pending.current, patch);
      setStatus("saving");
      clearTimeout(timer.current);
      if (now) flush();
      else timer.current = setTimeout(flush, DELAY_MS);
    },
    [flush],
  );

  useEffect(() => flush, [flush]);

  return { queue, status, error: save.error };
}

/** One level deep: `persona` and `render` are merged, not replaced. */
function mergePatch(a, b) {
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) {
    out[key] =
      value && typeof value === "object" && !Array.isArray(value) ? { ...a[key], ...value } : value;
  }
  return out;
}
