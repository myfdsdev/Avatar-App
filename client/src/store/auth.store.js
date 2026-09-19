import { create } from "zustand";

const KEY = "avatar-app.auth";

/**
 * Auth state, mirrored into localStorage so a reload does not sign the user out.
 *
 * Only the tokens and a display copy of the user live here. Anything
 * authoritative is re-read from the server, because localStorage is editable by
 * the person sitting in front of it.
 */
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

function save(state) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode, blocked storage - the session still works for this tab.
  }
}

const initial = load();

export const useAuth = create((set) => ({
  user: initial?.user || null,
  accessToken: initial?.accessToken || null,
  refreshToken: initial?.refreshToken || null,

  signedIn: () => Boolean(useAuth.getState().accessToken),

  setSession: ({ user, accessToken, refreshToken }) => {
    const next = { user, accessToken, refreshToken };
    save(next);
    set(next);
  },

  /** Replaces only the tokens, after a refresh. */
  setTokens: ({ accessToken, refreshToken }) =>
    set((s) => {
      const next = { ...s, accessToken, refreshToken };
      save({ user: next.user, accessToken, refreshToken });
      return { accessToken, refreshToken };
    }),

  clear: () => {
    save(null);
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
