import { useLocalParticipant } from "@livekit/components-react";
import Button from "@/components/common/Button";

export default function CallControls({ onHangUp, ending }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-5 py-4">
      <span className="flex items-center gap-2 text-ui text-text-muted">
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${isMicrophoneEnabled ? "bg-green" : "bg-text-faint"}`}
        />
        {isMicrophoneEnabled ? "Mic on" : "Mic muted"}
      </span>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? "Mute" : "Unmute"}
        </Button>
        <Button size="sm" variant="danger" onClick={onHangUp} disabled={ending}>
          {ending ? "Ending…" : "End call"}
        </Button>
      </div>
    </div>
  );
}
