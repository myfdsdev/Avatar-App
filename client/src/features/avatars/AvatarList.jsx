import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { avatarApi } from "@/services/avatar.api";
import MediaPreview from "@/components/media/MediaPreview";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";

export default function AvatarList() {
  const { data: avatars, isLoading, error } = useQuery({
    queryKey: ["avatars"],
    queryFn: avatarApi.list,
  });

  return (
    <>
      <PageHeader
        title="Avatars"
        description="Everything in this workspace that can take a call."
        action={
          <Button as={Link} to="/studio">
            Create avatar
          </Button>
        }
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
          <div className="mt-5 flex justify-center">
            <Button as={Link} to="/studio">
              Create your first
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {avatars?.map((avatar) => (
          <AvatarCard key={avatar._id} avatar={avatar} />
        ))}
      </div>
    </>
  );
}

function AvatarCard({ avatar }) {
  return (
    <Card flush hover className="flex flex-col">
      <div className="relative">
        <MediaPreview src={avatar.previewUrl} className="aspect-[4/3] w-full" />
        <div className="absolute right-3 top-3 flex gap-2">
          {avatar.isStub && <Pill tone="yellow">Stub</Pill>}
          <Pill tone={avatar.callable ? "green" : "muted"}>{avatar.status}</Pill>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
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

        <div className="mt-5 flex-1" />
        <Button
          as={Link}
          to={`/call/${avatar._id}`}
          variant={avatar.callable ? "primary" : "secondary"}
          disabled={!avatar.callable}
          fullWidth
        >
          {avatar.callable ? "Start call" : "Not ready"}
        </Button>
      </div>
    </Card>
  );
}

function Pill({ tone = "muted", children }) {
  const tones = {
    green: "bg-green-dim text-green",
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
