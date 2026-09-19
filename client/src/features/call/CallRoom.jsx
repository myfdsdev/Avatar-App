import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LiveKitRoom, useVoiceAssistant } from "@livekit/components-react";
import { avatarApi } from "@/services/avatar.api";
import { roomApi } from "@/services/room.api";
import AvatarStage from "@/components/media/AvatarStage";
import CallControls from "@/components/media/CallControls";
import MediaPreview from "@/components/media/MediaPreview";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import DailyCall from "./DailyCall";

/**
 * Pre-join, then live call.
 *
 * The connection envelope from the API carries `transport`. Render-only vendors
 * return "livekit" and are handled here; full-pipeline vendors return their own
 * transport. Branching on transport rather than on vendor keeps this component
 * out of the vendor matrix.
 *
 * Rendered without the app shell - a call wants the whole window.
 */
export default function CallRoom() {
  const { avatarId } = useParams();
  const navigate = useNavigate();
  const [connection, setConnection] = useState(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState(null);

  const { data: avatar, isLoading } = useQuery({
    queryKey: ["avatar", avatarId],
    queryFn: () => avatarApi.get(avatarId),
  });

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      setConnection(await roomApi.start(avatarId));
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }, [avatarId]);

  const hangUp = useCallback(async () => {
    setEnding(true);
    try {
      if (connection) await roomApi.end(connection.conversationId);
    } catch {
      // The call is over either way; a failed cleanup call must not trap the
      // user on this screen. A queue worker reconciles usage from room events.
    } finally {
      setConnection(null);
      setEnding(false);
      navigate("/avatars");
    }
  }, [connection, navigate]);

  if (isLoading) return <Centered>Loading avatar…</Centered>;
  if (!avatar) return <Centered>Avatar not found</Centered>;

  const body = !connection ? (
    <PreJoin
      avatar={avatar}
      onStart={start}
      starting={starting}
      error={error}
      onBack={() => navigate("/avatars")}
    />
  ) : connection.transport === "daily" ? (
    // Full-pipeline vendors host the call themselves; we only embed their room.
    <DailyCall avatar={avatar} joinUrl={connection.url} onHangUp={hangUp} ending={ending} />
  ) : connection.transport === "livekit" ? (
    <LiveKitRoom
      token={connection.token}
      serverUrl={connection.url}
      connect
      audio
      video={false}
      onDisconnected={() => setConnection(null)}
      onError={(err) => setError(err.message)}
    >
      <ActiveCall avatar={avatar} onHangUp={hangUp} ending={ending} />
    </LiveKitRoom>
  ) : (
    <Centered>Unsupported transport &quot;{connection.transport}&quot;</Centered>
  );

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex h-16 items-center gap-4 px-gutter">
        <Link to="/avatars" className="text-ui text-text-muted hover:text-text">
          ← Avatars
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-gutter pb-16">{body}</main>
    </div>
  );
}

function ActiveCall({ avatar, onHangUp, ending }) {
  const { state } = useVoiceAssistant();

  return (
    <>
      <AvatarStage
        avatarName={avatar.name}
        previewUrl={avatar.previewUrl}
        isSpeaking={state === "speaking"}
      />
      <CallControls onHangUp={onHangUp} ending={ending} />
      <p className="mt-4 text-ui text-text-faint">Agent state: {state || "connecting"}</p>
    </>
  );
}

function PreJoin({ avatar, onStart, starting, error, onBack }) {
  return (
    <>
      <Card flush>
        <MediaPreview src={avatar.previewUrl} className="aspect-square w-full" />
        <div className="p-5">
          <h2>{avatar.name}</h2>
          <p className="mt-1 text-ui text-text-muted">
            {avatar.sourceType} · {avatar.providerId}
          </p>
        </div>
      </Card>

      {error && (
        <p className="mt-4 rounded border border-red/40 bg-red/10 px-4 py-3 text-ui text-red">
          {error}
        </p>
      )}

      {!avatar.callable && (
        <p className="mt-4 text-ui text-text-faint">
          Avatar is {avatar.status} — not callable yet
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <Button size="lg" onClick={onStart} disabled={starting || !avatar.callable}>
          {starting ? "Connecting…" : "Start call"}
        </Button>
        <Button size="lg" variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </>
  );
}

function Centered({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <p className="text-text-muted">{children}</p>
    </div>
  );
}
