import { api } from "@/lib/apiClient";

/** The workspace's own voices - clones made in LiveKit Cloud, added by id. */
export const voiceApi = {
  list: async () => (await api.get("/voices")).voices,
  create: async ({ name, voiceId, gender }) =>
    (await api.post("/voices", { name, voiceId, ...(gender && { gender }) })).voice,
  remove: (id) => api.del(`/voices/${id}`),
};
