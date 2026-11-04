import { api } from "@/lib/apiClient";

/**
 * The workspace's own LemonSlice and ElevenLabs keys (bring your own key).
 * The keys never come back: only `{ hasKey, last4 }` for each service.
 */
export const byokApi = {
  /** Resolves to `{ keys: { lemonslice, elevenlabs }, canManage }`. */
  get: () => api.get("/byok"),
  /** Any of `lemonslice`, `elevenlabs`; each is checked with the vendor before it is saved. */
  save: (keys) => api.put("/byok", keys),
  remove: (service) => api.del(`/byok/${service}`),
};
