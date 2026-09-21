import { useEffect, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { avatarApi, shareUrl } from "@/services/avatar.api";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";

/**
 * Turns an avatar's public link on and off, and hands it over.
 *
 * Anyone with the link can talk to the avatar without an account - an
 * interview candidate, a customer, a demo audience - and their calls land in
 * Conversations under the name they type. Resetting is how a link that went
 * somewhere it should not is revoked.
 */
export default function ShareDialog({ avatar, onClose }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: share, isLoading } = useQuery({
    queryKey: ["share", avatar._id],
    queryFn: () => avatarApi.getShare(avatar._id),
  });

  const settle = (next) => {
    queryClient.setQueryData(["share", avatar._id], next);
    queryClient.invalidateQueries({ queryKey: ["avatars"] });
  };

  const toggle = useMutation({
    mutationFn: (enabled) => avatarApi.setShare(avatar._id, enabled),
    onSuccess: settle,
  });

  const reset = useMutation({
    mutationFn: () => avatarApi.resetShare(avatar._id),
    onSuccess: (next) => {
      settle(next);
      setConfirmReset(false);
      setCopied(false);
    },
  });

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const url = share?.token ? shareUrl(share.token) : "";
  const busy = toggle.isPending || reset.isPending;
  const error = toggle.error || reset.error;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The field is
      // selectable, so selecting it is the fallback.
      document.getElementById("share-url")?.select();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Share ${avatar.name}`}
      description="Anyone with the link can talk to this avatar - no account needed."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-text-muted">Loading…</p>
      ) : (
        <div className="space-y-6">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block font-medium">Public link</span>
              <span className="block text-ui text-text-muted">
                {share?.enabled ? "On - the link works for anyone who has it." : "Off - the link does not work."}
              </span>
            </span>
            <Switch
              checked={Boolean(share?.enabled)}
              disabled={busy}
              onChange={(next) => toggle.mutate(next)}
            />
          </label>

          {share?.enabled && (
            <div>
              <div className="flex gap-2">
                <input
                  id="share-url"
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="h-10 min-w-0 flex-1 rounded border border-border bg-bg px-3 font-mono text-ui text-text outline-none focus:border-border-strong"
                />
                <Button onClick={copy}>{copied ? "Copied" : "Copy link"}</Button>
              </div>
              <div className="mt-3 flex items-center gap-4 text-ui">
                <a href={url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-text">
                  Open in a new tab ↗
                </a>
              </div>
            </div>
          )}

          <ul className="space-y-1.5 text-ui text-text-muted">
            <li>· They type their name, then talk - the avatar greets them by it.</li>
            <li>· Every call shows up in Conversations with their name and the full transcript.</li>
            <li>· Calls stop at the avatar&apos;s maximum call length.</li>
          </ul>

          {!avatar.callable && (
            <p className="rounded border border-border-strong bg-surface-2 px-4 py-3 text-ui text-yellow">
              This avatar cannot take calls right now, so the link will say it is unavailable.
            </p>
          )}

          {share?.token && (
            <div className="border-t border-border pt-5">
              {confirmReset ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="flex-1 text-ui text-text-muted">
                    Everyone using the current link will be cut off. Continue?
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => reset.mutate()} disabled={busy}>
                    {reset.isPending ? "Resetting…" : "Reset link"}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="text-ui text-text-muted hover:text-text"
                >
                  Reset link - make a new one and stop the old one working
                </button>
              )}
            </div>
          )}

          {error && <p className="text-ui text-red">{error.message}</p>}
        </div>
      )}
    </Modal>
  );
}

function Switch({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
        checked ? "bg-pink" : "bg-surface-3",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-text transition-transform duration-200 ease-ease",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
