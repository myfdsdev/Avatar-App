import Button from "@/components/common/Button";

/**
 * Full-pipeline vendors host the whole conversation and hand back a room URL.
 *
 * Nothing of ours sits in the media path here - no agent worker, no renderer,
 * no LiveKit - so the room is embedded directly rather than reconstructed. That
 * also means the in-call controls belong to the vendor's UI; ours would have
 * nothing to act on.
 */
export default function DailyCall({ avatar, joinUrl, onHangUp, ending }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <span className="font-medium">{avatar.name}</span>
        <span className="rounded-full bg-surface-3 px-2.5 py-1 text-label text-text-muted">
          {avatar.providerId}
        </span>
      </div>

      <iframe
        title={`Call with ${avatar.name}`}
        src={joinUrl}
        // The vendor's room asks for these itself; without them it can join but
        // never publish, which looks like a frozen call.
        allow="camera; microphone; autoplay; display-capture; fullscreen"
        className="aspect-video w-full border-0 bg-surface-2"
      />

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
        <span className="text-ui text-text-muted">
          Hosted by {avatar.providerId} — controls are in the frame
        </span>
        <Button size="sm" variant="danger" onClick={onHangUp} disabled={ending}>
          {ending ? "Ending…" : "End call"}
        </Button>
      </div>
    </div>
  );
}
