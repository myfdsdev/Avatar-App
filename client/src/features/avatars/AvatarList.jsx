import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { avatarApi } from "@/services/avatar.api";
import { useCreateAvatar } from "@/store/createAvatar.store";
import MediaPreview from "@/components/media/MediaPreview";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import ShareDialog from "./ShareDialog";

export default function AvatarList() {
  const showCreate = useCreateAvatar((s) => s.show);
  const [sharing, setSharing] = useState(null);
  const { data: avatars, isLoading, error } = useQuery({
    queryKey: ["avatars"],
    queryFn: avatarApi.list,
  });

  return (
    <>
      <PageHeader
        title="Avatars"
        description="Everything in this workspace that can take a call."
        action={<Button onClick={showCreate}>Create avatar</Button>}
      />

      {isLoading && <p className="text-text-muted">Loading</p>}

      {error && (
        <Card className="border-red/40">
          <p className="text-ui text-red">{error.message}</p>
        </Card>
      )}

      {avatars?.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-text-muted">No avatars yet.</p>
          <div className="mt-4 flex justify-center">
            <Button onClick={showCreate}>Create your first</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {avatars?.map((avatar) => (
          <AvatarCard key={avatar._id} avatar={avatar} onShare={() => setSharing(avatar)} />
        ))}
      </div>

      {sharing && <ShareDialog avatar={sharing} onClose={() => setSharing(null)} />}
    </>
  );
}

function AvatarCard({ avatar, onShare }) {
  return (
    <Card flush hover className="flex flex-col">
      <div className="relative">
        <MediaPreview src={avatar.previewUrl} className="aspect-[4/3] w-full" />
        <div className="absolute right-3 top-3 flex gap-2">
          {avatar.share?.enabled && <Pill tone="pink">Link on</Pill>}
          {avatar.isStub && <Pill tone="yellow">Stub</Pill>}
          <Pill tone={avatar.callable ? "green" : "muted"}>{avatar.status}</Pill>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate">{avatar.name}</h3>
        <p className="mt-1 text-ui text-text-muted">
          {avatar.sourceType} · {avatar.providerId}
        </p>

        {avatar.isStub && (
          <p className="mt-2 text-ui text-yellow">Local stub — nothing was generated</p>
        )}
        {avatar.unavailableReason && (
          <p className="mt-2 text-ui text-text-faint">{avatar.unavailableReason}</p>
        )}

        <div className="mt-4 flex-1" />
        <div className="flex gap-2">
          <Button
            as={Link}
            to={`/call/${avatar._id}`}
            variant={avatar.callable ? "primary" : "secondary"}
            disabled={!avatar.callable}
            className="flex-1"
          >
            {avatar.callable ? "Start call" : "Not ready"}
          </Button>
          <Button variant="secondary" onClick={onShare} aria-label={`Share ${avatar.name}`}>
            <LinkGlyph />
            Share
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Pill({ tone = "muted", children }) {
  const tones = {
    green: "bg-green-dim text-green",
    pink: "bg-pink-dim text-pink",
    yellow: "bg-surface-3 text-yellow",
    muted: "bg-surface-3 text-text-muted",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-label backdrop-blur ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function LinkGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.1-2.1a3 3 0 0 0-4.2-4.2l-.7.7" />
      <path d="M9.5 6.5a3 3 0 0 0-4.2 0L3.2 8.6a3 3 0 0 0 4.2 4.2l.7-.7" />
    </svg>
  );
}
