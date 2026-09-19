import { api } from "@/lib/apiClient";

export const analyticsApi = {
  usage: () => api.get("/analytics/usage"),
};
