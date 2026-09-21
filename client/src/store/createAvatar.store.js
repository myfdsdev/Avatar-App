import { create } from "zustand";

/**
 * Whether the create-avatar dialog is open, and which template it starts from.
 *
 * Global because it opens from several places - the sidebar, the avatar
 * library, the dashboard's templates - and is mounted once for the whole
 * signed-in app.
 *
 * `show` takes no argument on purpose: it is passed straight to onClick, and a
 * click event must not be mistaken for a template.
 */
export const useCreateAvatar = create((set) => ({
  open: false,
  preset: null,
  show: () => set({ open: true, preset: null }),
  showTemplate: (preset) => set({ open: true, preset }),
  hide: () => set({ open: false, preset: null }),
}));
