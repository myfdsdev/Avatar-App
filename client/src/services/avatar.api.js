import { api } from "@/lib/apiClient";

export const avatarApi = {
  list: () => api.get("/avatars").then((r) => r.avatars),
  get: (id) => api.get(`/avatars/${id}`).then((r) => r.avatar),
  remove: (id) => api.del(`/avatars/${id}`),

  /** Public share link: `{ enabled, token }`. */
  getShare: (id) => api.get(`/avatars/${id}/share`).then((r) => r.share),
  setShare: (id, enabled) => api.put(`/avatars/${id}/share`, { enabled }).then((r) => r.share),
  /** New token; every copy of the old link stops working. */
  resetShare: (id) => api.post(`/avatars/${id}/share/reset`).then((r) => r.share),
};

/** The address a share token is opened at. */
export const shareUrl = (token) => `${window.location.origin}/talk/${token}`;
