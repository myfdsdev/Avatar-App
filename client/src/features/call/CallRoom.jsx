import { useCallback, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { avatarApi } from "@/services/avatar.api";
import { roomApi } from "@/services/room.api";
import MediaPreview from "@/components/media/MediaPreview";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import CallSurface from "./CallSurface";

/**
 * Pre-join, then live call.
 *
 * The live part is `CallSurface`, shared with the public share-link page; it
 * branches on the API's `transport`, never on vendor. However the call ends -
 * hang-up, time limit, the room closing - the caller lands on its transcript.
 *
 * Rendered without the app shell - a call wants the whole window.
 */
export default function CallRoom() {
  const { avatarId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState(null);
  // Hang-up and the room closing both end up here, often back to back.
  const finished = useRef(false);

  const { data: avatar, isLoading } = useQuery({
    queryKey: ["avatar", avatarId],
    queryFn: () => avatarApi.get(avatarId),
  });

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      finished.current = false;
      setConnection(await roomApi.start(avatarId));
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }, [avatarId]);

  const hangUp = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    setEnding(true);
    const conversationId = connection?.conversationId;
    try {
      if (conversationId) await roomApi.end(conversationId);
    } catch {
      // The call is over either way; a failed cleanup call must not trap the
      // user on this screen. A queue worker reconciles usage from room events.
    } finally {
      setConnection(null);
      setEnding(false);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // Straight to what was just said. The transcript page keeps polling
      // briefly, since the last reply can land a moment after hang-up.
      navigate(conversationId ? `/conversations/${conversationId}` : "/avatars");
    }
  }, [connection, navigate, queryClient]);

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
  ) : (
    <CallSurface
      connection={connection}
      avatar={avatar}
      onEnd={hangUp}
      ending={ending}
      onError={setError}
    />
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
