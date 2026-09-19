import { api } from "@/lib/apiClient";

export const healthApi = {
  get: () => api.get("/health"),
};
