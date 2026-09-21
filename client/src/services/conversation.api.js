import { api } from "@/lib/apiClient";

export const conversationApi = {
  list: () => api.get("/conversations").then((r) => r.conversations),

  /** `{ conversation, transcript }` - transcript is null when nothing was recorded. */
  get: (id) => api.get(`/conversations/${id}`),
};
