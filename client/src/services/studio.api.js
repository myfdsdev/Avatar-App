import { api } from "@/lib/apiClient";

async function upload(endpoint, field, { file, name, providerId }) {
  const form = new FormData();
  form.append("name", name);
  if (providerId) form.append("providerId", providerId);
  form.append(field, file);

  // Goes through the shared client so it gets the token and the 401 retry.
  const { avatar } = await api.upload(`/studio/${endpoint}`, form);
  return avatar;
}

export const studioApi = {
  /** What this install can offer: storage driver, usable vendors, upload limits. */
  options: () => api.get("/studio/options"),

  /** Ready-made avatars the vendor already hosts. No upload, no training. */
  stock: () => api.get("/studio/stock").then((r) => r.avatars),

  adoptStock: ({ providerId, providerAvatarId, name }) =>
    api.post("/studio/stock", { providerId, providerAvatarId, name }).then((r) => r.avatar),

  createFromPhoto: (input) => upload("photo", "image", input),

  /**
   * Resolves as soon as training is accepted, not when it finishes - the
   * avatar comes back in a `training` state and settles later.
   */
  createFromVideo: (input) => upload("video", "video", input),
};
