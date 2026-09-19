import { RoomAudioRenderer, VideoTrack, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import MediaPreview from "./MediaPreview";

/**
 * The avatar's video.
 *
 * Video does not arrive the instant the agent joins - the renderer has to
 * publish a track first - so this stays in a waiting state until an actual
 * track exists rather than showing a black rectangle.
 */
export default function AvatarStage({ avatarName, previewUrl, isSpeaking }) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  // The agent is the only remote participant; its camera track is the avatar.
  const avatarTrack = tracks.find((t) => !t.participant.isLocal);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <span className="font-medium">{avatarName || "Avatar"}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-label ${
            isSpeaking ? "bg-green-dim text-green" : "bg-surface-3 text-text-muted"
          }`}
        >
          {isSpeaking ? "Speaking" : "Listening"}
        </span>
      </div>

      <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
        {avatarTrack ? (
          <VideoTrack trackRef={avatarTrack} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {previewUrl && (
              <MediaPreview
                src={previewUrl}
                className="h-32 w-32 rounded-lg opacity-40 grayscale"
              />
            )}
            <span className="text-ui text-text-muted">Waiting for avatar video…</span>
          </div>
        )}
      </div>

      {/* Without this the agent's audio track is never played. */}
      <RoomAudioRenderer />
    </div>
  );
}
