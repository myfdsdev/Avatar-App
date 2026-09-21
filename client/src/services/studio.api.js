import { api } from "@/lib/apiClient";

export const studioApi = {
  /** What this install can offer: storage driver, usable vendors, upload limits. */
  options: () => api.get("/studio/options"),

  async createFromPhoto({ file, name, providerId, behaviour }) {
    const form = new FormData();
    form.append("name", name);
    if (providerId) form.append("providerId", providerId);
    // Multipart has no nesting, so the brief travels as JSON and the server
    // parses it back before validating.
    if (behaviour) form.append("behaviour", JSON.stringify(behaviour));
    form.append("image", file);

    // Goes through the shared client so it gets the token and the 401 retry.
    const { avatar } = await api.upload("/studio/photo", form);
    return avatar;
  },
};
