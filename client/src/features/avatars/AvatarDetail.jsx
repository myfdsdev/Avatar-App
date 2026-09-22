import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { avatarApi } from "@/services/avatar.api";
import { studioApi } from "@/services/studio.api";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import AvatarSettings from "./AvatarSettings";
import AvatarChat from "./AvatarChat";
import ShareDialog from "./ShareDialog";
import { useAutosave } from "./useAutosave";

/**
 * One avatar: talk to it, or change how it looks, sounds and behaves.
 *
 * Laid out like LemonSlice's agent page - a rounded panel with the name and an
 * edit pencil on the left, Chat / Settings on the right, and a menu beside
 * them. Creating an avatar lands here, on Settings.
 *
 * Settings save themselves as they change (see useAutosave), so there is no
 * Save button; the header says when a save is in flight or has failed.
 */
const TABS = [
  { id: "chat", label: "Chat", icon: ChatIcon },
  { id: "settings", label: "Settings", icon: SlidersIcon },
];

export default function AvatarDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "chat" ? "chat" : "settings";

  const { data: avatar, isLoading, error } = useQuery({
    queryKey: ["avatar", id],
    queryFn: () => avatarApi.get(id),
  });
  const { data: options } = useQuery({ queryKey: ["studio-options"], queryFn: studioApi.options });
  const autosave = useAutosave(id);

  if (isLoading) return <Panel><p className="p-8 text-text-muted">Loading avatar…</p></Panel>;
  if (error || !avatar) {
    return (
      <Panel>
        <p className="p-8 text-text-muted">{error?.message || "Avatar not found"}</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <Header
        avatar={avatar}
        tab={tab}
        onTab={(next) => setParams(next === "settings" ? {} : { tab: next }, { replace: true })}
        autosave={autosave}
      />
      {tab === "chat" ? (
        <AvatarChat avatar={avatar} />
      ) : (
        // Keyed so a different avatar starts from its own values, not the last one's.
        <AvatarSettings key={avatar._id} avatar={avatar} options={options} onChange={autosave.queue} />
      )}
    </Panel>
  );
}

function Panel({ children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] rounded-xl border border-border bg-surface">{children}</div>
  );
}

function Header({ avatar, tab, onTab, autosave }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 rounded-t-xl bg-surface/90 px-6 py-5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/avatars")}
          aria-label="Back to avatars"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <ChevronLeftIcon />
        </button>
        <EditableName name={avatar.name} onRename={(name) => autosave.queue({ name }, { now: true })} />
      </div>

      <div className="flex items-center gap-3">
        <SaveStatus status={autosave.status} error={autosave.error} />
        <div role="tablist" className="flex gap-1 rounded-lg border border-border bg-bg p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => onTab(id)}
              className={clsx(
                "flex h-9 items-center gap-2 rounded-sm border px-4 text-ui font-medium transition-colors",
                tab === id
                  ? "border-border-strong bg-surface-2 text-text"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
        <MoreMenu avatar={avatar} />
      </div>
    </header>
  );
}

/** The name with a pencil; the pencil turns it into an input until Enter or blur. */
function EditableName({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const cancelled = useRef(false);

  // Follows the saved name, but only when it actually changes - so a rename
  // shows at once instead of flicking back until the save lands.
  useEffect(() => setValue(name), [name]);

  // Enter and Escape both just blur, so the rename is committed exactly once.
  const commit = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      setValue(name);
      return;
    }
    const next = value.trim();
    if (next && next !== name) onRename(next);
    else setValue(name);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        maxLength={80}
        aria-label="Avatar name"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancelled.current = true;
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
        }}
        className="h-9 min-w-0 rounded-sm border border-border-strong bg-bg px-2 text-h3 font-medium text-text outline-none"
      />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-h3 font-medium">{value}</h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Rename avatar"
        title="Rename"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        <PencilIcon />
      </button>
    </div>
  );
}

function SaveStatus({ status, error }) {
  if (status === "idle") return null;
  const text = {
    saving: "Saving…",
    saved: "Saved",
    error: `Couldn't save${error?.message ? `: ${error.message}` : ""}`,
  }[status];
  return (
    <span
      role="status"
      className={clsx("max-w-[240px] truncate text-ui", status === "error" ? "text-red" : "text-text-faint")}
      title={text}
    >
      {text}
    </span>
  );
}

/** Share and delete - the actions that are about the avatar rather than its settings. */
function MoreMenu({ avatar }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !menu.current?.contains(e.target) && setOpen(false);
    const escape = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const remove = useMutation({
    mutationFn: () => avatarApi.remove(avatar._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avatars"] });
      navigate("/avatars");
    },
  });

  const item =
    "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-ui transition-colors hover:bg-surface-hover";

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-bg text-text-muted transition-colors hover:text-text"
      >
        <DotsIcon />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-48 rounded border border-border-strong bg-surface-2 p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              setSharing(true);
            }}
          >
            Share link
          </button>
          <button
            type="button"
            role="menuitem"
            className={clsx(item, "text-red")}
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
          >
            Delete avatar
          </button>
        </div>
      )}

      {sharing && <ShareDialog avatar={avatar} onClose={() => setSharing(false)} />}

      <Modal
        open={confirming}
        onClose={() => !remove.isPending && setConfirming(false)}
        title={`Delete ${avatar.name}?`}
        description="Its settings and share link go with it. Past conversations stay in your history."
        footer={
          <>
            {remove.isError && <span className="mr-auto text-ui text-red">{remove.error.message}</span>}
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      />
    </div>
  );
}

const stroke = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function ChevronLeftIcon() {
  return (
    <svg {...stroke}>
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg {...stroke} width={15} height={15}>
      <path d="M10.5 2.5l3 3L6 13H3v-3z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg {...stroke}>
      <path d="M8 2.5c3.3 0 5.5 2.1 5.5 4.8S11.3 12 8 12c-.8 0-1.6-.1-2.3-.4L2.5 13l.9-2.6C2.8 9.5 2.5 8.4 2.5 7.3 2.5 4.6 4.7 2.5 8 2.5z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg {...stroke}>
      <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="6" cy="11.5" r="1.5" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg {...stroke} fill="currentColor" stroke="none">
      <circle cx="8" cy="3.5" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="8" cy="12.5" r="1.2" />
    </svg>
  );
}
