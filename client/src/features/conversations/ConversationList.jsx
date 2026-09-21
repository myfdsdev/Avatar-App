import { Link } from "react-router-dom";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { conversationApi } from "@/services/conversation.api";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import MediaPreview from "@/components/media/MediaPreview";
import { STATUS_LABEL, formatDuration, formatWhen } from "./format";

/**
 * Every call in the workspace, newest first, each with the caller's first line
 * so a call can be found by what it was about rather than by its timestamp.
 */
export default function ConversationList() {
  const { data: conversations, isLoading, error } = useQuery({
    queryKey: ["conversations"],
    queryFn: conversationApi.list,
    // A call that is still going should show up as live without a reload.
    refetchInterval: (query) =>
      query.state.data?.some((c) => c.status === "active" || c.status === "pending")
        ? 5000
        : false,
  });

  return (
    <>
      <PageHeader title="Conversations" description="Every call, with everything that was said." />

      {isLoading && <p className="text-text-muted">Loading conversations…</p>}
      {error && <p className="text-red">{error.message}</p>}

      {conversations?.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-text-muted">No calls yet. Talk to an avatar and it will show up here.</p>
          <div className="mt-4 flex justify-center">
            <Button as={Link} to="/avatars">
              Go to avatars
            </Button>
          </div>
        </Card>
      )}

      {conversations?.length > 0 && (
        <Card flush>
          <ul className="divide-y divide-border">
            {conversations.map((c) => (
              <li key={c._id}>
                <ConversationRow conversation={c} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function ConversationRow({ conversation: c }) {
  return (
    <Link
      to={`/conversations/${c._id}`}
      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover"
    >
      <MediaPreview
        src={c.avatar?.previewUrl}
        fallback=""
        className="h-11 w-11 shrink-0 rounded-full"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {c.avatar?.name || "Deleted avatar"}
            {c.guest?.name && <span className="font-normal text-text-muted"> with {c.guest.name}</span>}
          </span>
          {c.source === "link" && <LinkPill />}
          <StatusPill status={c.status} />
        </div>
        <p className={clsx("mt-0.5 truncate text-ui", c.preview ? "text-text-muted" : "text-text-faint")}>
          {c.preview ? `“${c.preview}”` : "No transcript"}
        </p>
      </div>

      <div className="shrink-0 text-right text-ui">
        <p className="text-text-muted">{formatWhen(c.startedAt || c.createdAt)}</p>
        <p className="mt-0.5 text-text-faint">
          {formatDuration(c.durationSec)}
          {c.turnCount > 0 && ` · ${c.turnCount} ${c.turnCount === 1 ? "message" : "messages"}`}
        </p>
      </div>
    </Link>
  );
}

export function StatusPill({ status }) {
  const live = status === "active" || status === "pending";
  return (
    <span
      className={clsx(
        "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-label",
        live ? "bg-green-dim text-green" : status === "failed" ? "bg-surface-3 text-red" : "bg-surface-3 text-text-muted",
      )}
    >
      {live && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green" />}
      {STATUS_LABEL[status] || status}
    </span>
  );
}

/** Marks a call that came in through a share link rather than from the app. */
export function LinkPill() {
  return (
    <span className="shrink-0 rounded-full bg-pink-dim px-2 py-0.5 text-label text-pink">Link</span>
  );
}
