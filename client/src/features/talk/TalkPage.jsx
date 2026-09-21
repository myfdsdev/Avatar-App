import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { linkApi } from "@/services/link.api";
import MediaPreview from "@/components/media/MediaPreview";
import Button from "@/components/common/Button";
import Field from "@/components/forms/Field";
import CallSurface from "@/features/call/CallSurface";

/**
 * The page a share link opens. For someone with no account: say who you are,
 * talk to the avatar, done.
 *
 * It shows nothing about the workspace behind the link, and tells the guest
 * plainly that the conversation is transcribed for whoever sent it - they are
 * being recorded by someone they may not know, and should hear that first.
 */
const NAME_KEY = "avatar-app.guest";

function rememberedGuest() {
  try {
    return JSON.parse(localStorage.getItem(NAME_KEY)) || { name: "", email: "" };
  } catch {
    return { name: "", email: "" };
  }
}

export default function TalkPage() {
  const { token } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["link", token],
    queryFn: () => linkApi.describe(token),
    retry: false,
  });

  const [phase, setPhase] = useState("form"); // form | call | ended
  const [guest, setGuest] = useState(rememberedGuest);
  const [call, setCall] = useState(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [startError, setStartError] = useState(null);
  // Hang-up and the room closing both end up in `end`, often back to back.
  const finished = useRef(false);

  const start = async (e) => {
    e.preventDefault();
    setStarting(true);
    setStartError(null);
    try {
      const connection = await linkApi.start(token, guest);
      try {
        localStorage.setItem(NAME_KEY, JSON.stringify(guest));
      } catch {
        // Only a convenience for the next visit.
      }
      finished.current = false;
      setCall(connection);
      setPhase("call");
    } catch (err) {
      setStartError(err.details?.[0]?.message || err.message);
    } finally {
      setStarting(false);
    }
  };

  const end = useCallback(async () => {
    if (finished.current || !call) return;
    finished.current = true;
    setEnding(true);
    // Best effort: the call is over for the guest either way, and the server
    // also notices the room closing.
    await linkApi.end(token, call.conversationId, call.callToken).catch(() => {});
    setEnding(false);
    setCall(null);
    setPhase("ended");
  }, [call, token]);

  // Closing the tab cancels ordinary requests, so the hang-up goes as a beacon.
  useEffect(() => {
    if (!call) return undefined;
    const onLeave = () => linkApi.endOnUnload(token, call.conversationId, call.callToken);
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [call, token]);

  if (isLoading) return <Shell><p className="text-center text-text-muted">Loading…</p></Shell>;

  if (error || !data) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-h2">This link is not active</h1>
          <p className="mt-2 text-text-muted">
            It may have been turned off or replaced. Ask whoever sent it for a new one.
          </p>
        </div>
      </Shell>
    );
  }

  const { avatar, available } = data;

  if (phase === "call" && call) {
    return (
      <Shell wide>
        <CallSurface
          connection={call}
          avatar={avatar}
          onEnd={end}
          ending={ending}
          onError={setStartError}
        />
      </Shell>
    );
  }

  if (phase === "ended") {
    return (
      <Shell>
        <div className="text-center">
          <MediaPreview
            src={avatar.previewUrl}
            fallback=""
            className="mx-auto h-20 w-20 rounded-full"
          />
          <h1 className="mt-5 text-h2">Thanks{guest.name ? `, ${guest.name.split(" ")[0]}` : ""}!</h1>
          <p className="mt-2 text-text-muted">
            Your conversation with {avatar.name} has ended. You can close this tab.
          </p>
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={() => setPhase("form")}>
              Talk again
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <MediaPreview src={avatar.previewUrl} className="aspect-[4/3] w-full" />
        <form onSubmit={start} className="p-6">
          <h1 className="text-h2">Talk to {avatar.name}</h1>
          <p className="mt-1.5 text-ui text-text-muted">
            A live voice and video conversation with an AI avatar, right in your browser.
          </p>

          {available ? (
            <>
              <div className="mt-6">
                <Field
                  label="Your name"
                  value={guest.name}
                  onChange={(name) => setGuest((g) => ({ ...g, name }))}
                  placeholder="Priya Sharma"
                  autoComplete="name"
                  required
                  maxLength={80}
                  disabled={starting}
                />
                <Field
                  label="Email (optional)"
                  type="email"
                  value={guest.email}
                  onChange={(email) => setGuest((g) => ({ ...g, email }))}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={200}
                  disabled={starting}
                />
              </div>

              {startError && <p className="mt-4 text-ui text-red">{startError}</p>}

              <Button
                type="submit"
                size="lg"
                fullWidth
                className="mt-6"
                disabled={starting || !guest.name.trim()}
              >
                {starting ? "Connecting…" : "Join call"}
              </Button>

              <p className="mt-4 text-label leading-relaxed text-text-faint">
                Your browser will ask to use your microphone. The conversation is transcribed, and
                the transcript is shared with whoever sent you this link.
              </p>
            </>
          ) : (
            <p className="mt-6 rounded border border-border-strong bg-surface-2 px-4 py-3 text-ui text-yellow">
              {avatar.name} is not available right now. Please try again later.
            </p>
          )}
        </form>
      </div>
    </Shell>
  );
}

function Shell({ children, wide = false }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <main
        className={`mx-auto flex w-full flex-1 flex-col justify-center px-4 py-10 ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        {children}
      </main>
      <footer className="pb-6 text-center text-label text-text-faint">
        <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-pink align-middle" aria-hidden />
        Avatar App
      </footer>
    </div>
  );
}
