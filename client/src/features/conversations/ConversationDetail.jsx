import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { conversationApi } from "@/services/conversation.api";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import MediaPreview from "@/components/media/MediaPreview";
import { LinkPill, StatusPill } from "./ConversationList";
import { formatDuration, formatOffset, formatWhen } from "./format";

/**
 * One call's transcript, as a chat.
 *
 * Lines are written by the worker while the call happens, so this page keeps
 * polling while the call is live - and for a short while after it ends, because
 * the avatar's last reply is committed as the call tears down and can land a
 * moment after the hang-up that brought the caller here.
 */
const SETTLE_MS = 20_000;

export default function ConversationDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => conversationApi.get(id),
    refetchInterval: (query) => {
      const c = query.state.data?.conversation;
      if (!c) return false;
      if (c.status === "active" || c.status === "pending") return 3000;
      if (c.endedAt && Date.now() - new Date(c.endedAt).getTime() < SETTLE_MS) return 2000;
      return false;
    },
  });

  if (isLoading) return <p className="text-text-muted">Loading conversation…</p>;
  if (error) return <p className="text-red">{error.message}</p>;

  const { conversation: c, transcript } = data;
  const name = c.avatar?.name || "Deleted avatar";
  const turns = transcript?.turns || [];
  // Offsets count from the first thing said if the start was never recorded.
  const origin = c.startedAt ? new Date(c.startedAt).getTime() : turns[0]?.tsMs || 0;

  return (
    <>
      <Link to="/conversations" className="text-ui text-text-muted hover:text-text">
        ← All conversations
      </Link>

      <header className="mb-6 mt-4 flex items-center gap-4">
        <MediaPreview
          src={c.avatar?.previewUrl}
          fallback=""
          className="h-14 w-14 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-h2">{name}</h1>
            {c.source === "link" && <LinkPill />}
            <StatusPill status={c.status} />
          </div>
          {c.guest?.name && (
            <p className="mt-1 text-ui">
              with {c.guest.name}
              {c.guest.email && (
                <a href={`mailto:${c.guest.email}`} className="ml-2 text-text-muted hover:text-text">
                  {c.guest.email}
                </a>
              )}
            </p>
          )}
          <p className="mt-1 text-ui text-text-muted">
            {formatWhen(c.startedAt || c.createdAt)} · {formatDuration(c.durationSec)}
            {turns.length > 0 && ` · ${turns.length} ${turns.length === 1 ? "message" : "messages"}`}
          </p>
        </div>
        {c.avatar && (
          <Button as={Link} to={`/call/${c.avatar._id}`} variant="secondary">
            Call again
          </Button>
        )}
      </header>

      <Card className="p-6">
        {turns.length === 0 ? (
          <p className="py-8 text-center text-text-muted">{emptyMessage(c)}</p>
        ) : (
          <ol className="flex flex-col gap-5">
            {turns.map((turn, i) => (
              <Turn
                key={`${turn.tsMs}-${i}`}
                turn={turn}
                speaker={turn.role === "user" ? c.guest?.name || "You" : name}
                offset={formatOffset(turn.tsMs - origin)}
                avatar={c.avatar}
              />
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

function Turn({ turn, speaker, offset, avatar }) {
  const mine = turn.role === "user";

  return (
    <li className={clsx("flex items-end gap-3", mine && "flex-row-reverse")}>
      {!mine && (
        <MediaPreview
          src={avatar?.previewUrl}
          fallback=""
          className="h-8 w-8 shrink-0 rounded-full"
        />
      )}
      <div className={clsx("flex max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
        <p className="mb-1 text-label text-text-faint">
          {speaker} · {offset}
          {turn.interrupted && " · cut off"}
        </p>
        <p
          className={clsx(
            "whitespace-pre-wrap rounded-lg px-4 py-2.5 text-ui leading-relaxed",
            mine ? "rounded-br-sm bg-pink-dim text-text" : "rounded-bl-sm bg-surface-2 text-text",
          )}
        >
          {turn.text}
        </p>
      </div>
    </li>
  );
}

function emptyMessage(c) {
  if (c.pipelineMode === "full-pipeline") {
    return "This avatar's vendor runs the conversation itself, so no transcript is recorded here.";
  }
  if (c.status === "active" || c.status === "pending") {
    return "Nothing said yet. Lines appear here as they are spoken.";
  }
  return "No transcript for this call. Nothing was said, or it happened before calls were recorded.";
}
