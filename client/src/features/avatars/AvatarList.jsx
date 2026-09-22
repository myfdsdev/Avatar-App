import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { avatarApi } from "@/services/avatar.api";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import AvatarCard from "./AvatarCard";

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
          <div className="mt-4 flex justify-center">
            <Button as={Link} to="/studio">
              Create your first
            </Button>
          </div>
        </Card>
      )}

      {avatars?.length > 0 && (
        <>
          <h2 className="mb-4 text-h3 font-semibold">My avatars</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {avatars.map((avatar) => (
              <AvatarCard key={avatar._id} avatar={avatar} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
