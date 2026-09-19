import { api } from "@/lib/apiClient";

export const avatarApi = {
  list: () => api.get("/avatars").then((r) => r.avatars),
  get: (id) => api.get(`/avatars/${id}`).then((r) => r.avatar),
  remove: (id) => api.del(`/avatars/${id}`),
};
