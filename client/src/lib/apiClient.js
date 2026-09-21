import { useAuth } from "@/store/auth.store";

const BASE = import.meta.env.VITE_API_BASE || "/api";

/**
 * Fetch wrapper that attaches the access token and recovers from expiry.
 *
 * Access tokens are deliberately short-lived, so a 401 mid-session is normal
 * rather than exceptional: it is retried once behind a single shared refresh,
 * and only a failed refresh signs the user out. Sharing that one refresh
 * matters - a page issuing six parallel requests would otherwise fire six
 * refreshes and invalidate its own tokens in the race.
 */
let refreshing = null;

async function refreshTokens() {
  const { refreshToken, setTokens, clear } = useAuth.getState();
  if (!refreshToken) return false;

  refreshing ||= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error("refresh failed");

      const body = await res.json();
      setTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
      return true;
    } catch {
      clear();
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function send(path, { method = "GET", body, form } = {}) {
  const { accessToken } = useAuth.getState();

  const headers = {
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    // FormData sets its own content-type, including the multipart boundary.
    ...(body ? { "content-type": "application/json" } : {}),
  };

  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
}

async function request(path, options = {}) {
  let res = await send(path, options);

  if (res.status === 401 && (await refreshTokens())) {
    res = await send(path, options);
  }

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const error = new Error(payload?.error?.message || `Request failed (${res.status})`);
    error.status = res.status;
    error.details = payload?.error?.details;
    throw error;
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  del: (path) => request(path, { method: "DELETE" }),
  upload: (path, form) => request(path, { method: "POST", form }),
};
