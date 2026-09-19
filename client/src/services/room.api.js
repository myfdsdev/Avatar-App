import { api } from "@/lib/apiClient";

export const roomApi = {
  /**
   * Returns the connection envelope. `transport` decides how to connect:
   * "livekit" for vendors we render ourselves, otherwise the vendor's own.
   */
  start: (avatarId) => api.post("/rooms", { avatarId }),
  end: (conversationId) => api.del(`/rooms/${conversationId}`),
};
