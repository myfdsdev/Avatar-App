import { useState } from "react";
import { create } from "zustand";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { useAuth } from "@/store/auth.store";

export const TRAINING_VIDEO_SRC = "/training/avatar-studio-training.mp4";

// Shown once per visit (sessionStorage), until the user opts out (localStorage, per user).
const SEEN_KEY = "avatar-app.training.seen";
const OPT_OUT_KEY = "avatar-app.training.hidden";

function storageGet(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    // Blocked storage - the popup just shows again next time.
  }
}

/**
 * Whether the training popup is up, shared so other first-visit popups (the
 * API keys prompt) wait their turn instead of stacking on top of it.
 */
export const useTrainingPopup = create((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** True when the training popup should open by itself on this dashboard visit. */
export function shouldAutoOpenTraining(userId) {
  if (storageGet(sessionStorage, SEEN_KEY)) return false;
  return storageGet(localStorage, `${OPT_OUT_KEY}.${userId || "anon"}`) !== "1";
}

/**
 * The training video in a popup. Plays on open; closing marks it seen for this
 * visit, and "Don't show this again" stops it opening by itself for this user.
 * It can still be opened from the dashboard's "Training video" button.
 */
export default function TrainingVideoModal({ open, onClose }) {
  const userId = useAuth((s) => s.user?._id || s.user?.id);
  const [hide, setHide] = useState(false);

  const close = () => {
    storageSet(sessionStorage, SEEN_KEY, "1");
    if (hide) storageSet(localStorage, `${OPT_OUT_KEY}.${userId || "anon"}`, "1");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Welcome to Avatar Studio"
      description="Watch this short training video to learn how to create and talk to your avatars."
      footer={
        <>
          <label className="mr-auto flex cursor-pointer items-center gap-2 text-ui text-text-muted">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
            Don&apos;t show this again
          </label>
          <Button onClick={close}>Got it</Button>
        </>
      }
    >
      <video
        src={TRAINING_VIDEO_SRC}
        controls
        autoPlay
        playsInline
        preload="auto"
        className="aspect-video w-full rounded-lg bg-black"
      />
    </Modal>
  );
}
