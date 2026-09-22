import { useRef } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import MediaPreview from "@/components/media/MediaPreview";
import { timeAgo } from "@/utils/timeAgo";
import AvatarMenu from "./AvatarMenu";

/**
 * An avatar in "My avatars", modelled on LemonSlice's card: the face fills it,
 * the name and when it was last edited sit top-left with the ⋯ menu opposite,
 * and on hover the card darkens to offer Start call in the middle and Settings
 * along the bottom.
 *
 * Touch screens have no hover, so there the controls are always shown and the
 * card itself opens the settings.
 *
 * A face with a talking clip plays it while hovered.
 */
export default function AvatarCard({ avatar, className }) {
  const video = useRef(null);
  const settings = `/avatars/${avatar._id}`;

  // Settings live on the persona, so an edit there counts as an edit too.
  const edited = [avatar.updatedAt, avatar.personaId?.updatedAt]
    .filter(Boolean)
    .sort()
    .at(-1);

  const status = statusLabel(avatar);

  const revealed =
    "opacity-0 transition-opacity duration-200 ease-ease group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";

  return (
    <div
      className={clsx(
        "group relative aspect-[5/7] overflow-hidden rounded-lg border border-border bg-surface-2",
        className,
      )}
      onMouseEnter={() => video.current?.play().catch(() => {})}
      onMouseLeave={() => {
        if (!video.current) return;
        video.current.pause();
        video.current.currentTime = 0;
      }}
    >
      {avatar.previewVideoUrl ? (
        <video
          ref={video}
          src={avatar.previewVideoUrl}
          poster={avatar.previewUrl}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <MediaPreview src={avatar.previewUrl} className="absolute inset-0 h-full w-full object-cover" />
      )}

      {/* The whole card opens the settings; the controls below sit above it. */}
      <Link to={settings} aria-label={`${avatar.name} settings`} className="absolute inset-0" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 ease-ease group-hover:bg-black/45 [@media(hover:none)]:bg-black/25"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 via-black/30 to-transparent px-4 pb-12 pt-3.5">
        <div className="min-w-0">
          <p className="truncate text-body font-semibold text-white">{avatar.name}</p>
          {edited && <p className="mt-0.5 text-ui text-white/70">Last edited {timeAgo(edited)}</p>}
          {status && (
            <span
              className={clsx(
                "mt-2 inline-block rounded-full bg-black/60 px-2.5 py-0.5 text-label backdrop-blur",
                avatar.isStub ? "text-yellow" : "text-white/80",
              )}
            >
              {status}
            </span>
          )}
        </div>
        <div className={clsx("pointer-events-auto -mr-1.5 -mt-1", revealed, "has-[[aria-expanded=true]]:opacity-100")}>
          <AvatarMenu
            avatar={avatar}
            buttonClassName="flex h-8 w-8 items-center justify-center rounded-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          />
        </div>
      </div>

      <div className={clsx("pointer-events-none absolute inset-0 flex items-center justify-center px-6", revealed)}>
        {avatar.callable ? (
          <Link to={`/call/${avatar._id}`} className="pointer-events-auto flex flex-col items-center gap-2.5 text-white">
            <span className="flex h-14 w-14 scale-90 items-center justify-center rounded-full bg-green text-white shadow-lg transition-transform duration-200 ease-ease group-hover:scale-100">
              <CameraGlyph />
            </span>
            <span className="text-ui font-semibold">Start call</span>
          </Link>
        ) : (
          <span className="text-center text-ui text-white/80">
            {avatar.unavailableReason || "Not ready to call yet"}
          </span>
        )}
      </div>

      <Link
        to={settings}
        className={clsx(
          "absolute inset-x-0 bottom-0 flex h-12 items-center justify-center gap-2 border-t border-white/15 bg-black/20 text-ui font-semibold text-white backdrop-blur-sm hover:bg-black/40",
          revealed,
        )}
      >
        <SlidersIcon />
        Settings
      </Link>
    </div>
  );
}

/** A pill for anything other than "ready to call". */
function statusLabel(avatar) {
  if (avatar.isStub) return "Stub";
  if (avatar.callable) return null;
  return avatar.status === "training" ? "Training…" : avatar.status;
}

function CameraGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="m17 10.2 3.4-2.3a.7.7 0 0 1 1.1.6v7a.7.7 0 0 1-1.1.6L17 13.8Z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
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
      <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="6" cy="11.5" r="1.5" />
    </svg>
  );
}
