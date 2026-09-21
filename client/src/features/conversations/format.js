/** "3 min 20 s", "45 s" - short enough for a list row. */
export function formatDuration(seconds) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m} min${s ? ` ${s} s` : ""}` : `${s} s`;
}

/** "Today, 14:32", "Yesterday, 09:05", or "12 Sep, 18:40". */
export function formatWhen(value) {
  if (!value) return "";
  const date = new Date(value);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  const day = date.toLocaleDateString([], { day: "numeric", month: "short" });
  return `${day}, ${time}`;
}

/** Offset into the call as "m:ss". */
export function formatOffset(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export const STATUS_LABEL = {
  pending: "Connecting",
  active: "Live",
  ended: "Ended",
  failed: "Failed",
};
