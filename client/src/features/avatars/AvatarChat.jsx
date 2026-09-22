import MediaPreview from "@/components/media/MediaPreview";
import Button from "@/components/common/Button";
import CallSurface from "@/features/call/CallSurface";
import { useCall } from "@/features/call/useCall";

/**
 * The Chat tab: a live call with the avatar, without leaving its page.
 *
 * Same call as the call room (see useCall) - hanging up lands on the
 * transcript either way.
 */
export default function AvatarChat({ avatar }) {
  const { connection, starting, ending, error, setError, start, hangUp } = useCall(avatar._id);

  if (connection) {
    return (
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-2">
        <CallSurface connection={connection} avatar={avatar} onEnd={hangUp} ending={ending} onError={setError} />
        {error && <p className="mt-4 text-ui text-red">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 pb-16 pt-4">
      <div className="aspect-[2/3] h-[460px] max-w-full overflow-hidden rounded-xl border border-border bg-surface-3">
        {avatar.previewVideoUrl ? (
          <video
            src={avatar.previewVideoUrl}
            poster={avatar.previewUrl}
            autoPlay
            muted
            loop
            playsInline
            aria-label={avatar.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <MediaPreview src={avatar.previewUrl} alt={avatar.name} className="h-full w-full object-cover" />
        )}
      </div>

      {error && (
        <p className="mt-5 max-w-md rounded border border-red/40 bg-red/10 px-4 py-3 text-ui text-red">{error}</p>
      )}
      {!avatar.callable && (
        <p className="mt-5 text-ui text-text-faint">
          {avatar.unavailableReason || `Avatar is ${avatar.status} — not callable yet`}
        </p>
      )}

      <Button size="lg" className="mt-6" onClick={start} disabled={starting || !avatar.callable}>
        {starting ? "Connecting…" : "Start chat"}
      </Button>
    </div>
  );
}
