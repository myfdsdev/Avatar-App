import { api } from "@/lib/apiClient";

/**
 * The public side of share links, used by people without an account. Goes
 * through the shared client only for its error handling; none of these
 * endpoints need or check a token.
 */
export const linkApi = {
  /** `{ avatar: { name, previewUrl }, available }` */
  describe: (token) => api.get(`/links/${token}`),

  /** Connection envelope plus `callToken`, needed to end the call. */
  start: (token, { name, email }) => api.post(`/links/${token}/calls`, { name, email }),

  end: (token, conversationId, callToken) =>
    api.post(`/links/${token}/calls/${conversationId}/end`, { callToken }),

  /**
   * Ends the call as the page unloads. A normal request is cancelled when the
   * tab closes; a beacon is not.
   */
  endOnUnload(token, conversationId, callToken) {
    const base = import.meta.env.VITE_API_BASE || "/api";
    const body = new Blob([JSON.stringify({ callToken })], { type: "application/json" });
    navigator.sendBeacon?.(`${base}/links/${token}/calls/${conversationId}/end`, body);
  },
};
