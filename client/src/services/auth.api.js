import { api } from "@/lib/apiClient";

export const authApi = {
  register: (input) => api.post("/auth/register", input),
  login: (input) => api.post("/auth/login", input),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
};
