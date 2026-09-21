import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * A centred dialog over a dimmed page.
 *
 * Rendered in a portal so a parent's overflow or stacking context cannot clip
 * it - it is mounted inside the app shell's scrolling column.
 *
 * Closes on Escape and on a backdrop click, and restores focus to whatever
 * opened it, because a dialog that strands the keyboard is worse than no
 * dialog.
 */
export default function Modal({ open, onClose, title, description, children, footer }) {
  const panelRef = useRef(null);
  const restoreTo = useRef(null);

  // Read through a ref so the effect below runs once per opening. Callers pass
  // a fresh function every render; with it as a dependency, each keystroke in
  // the form re-ran the effect and yanked focus out of the field being typed in.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    restoreTo.current = document.activeElement;
    // Stop the page behind from scrolling under the dialog.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);

    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-6 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Only a click that both starts and ends on the backdrop closes it, so
        // a drag that happens to release outside does not throw the form away.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="my-auto w-full max-w-3xl rounded-xl border border-border bg-surface shadow-lg outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="text-h3">{title}</h2>
            {description && <p className="mt-1 text-ui text-text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-2 rounded p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
