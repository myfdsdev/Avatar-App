import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { avatarApi } from "@/services/avatar.api";
import Panel from "@/components/layout/Panel";
import Button from "@/components/common/Button";
import PortraitCall from "./PortraitCall";

/**
 * The call page, laid out like LemonSlice's avatar page: the name on the left,
 * "Customize this avatar" on the right (to its settings), and the avatar in a
 * portrait frame with Start call at its foot. The call itself happens in that
 * frame - see PortraitCall - and hanging up lands on the transcript.
 */
export default function CallRoom() {
  const { avatarId } = useParams();
  const navigate = useNavigate();

  const { data: avatar, isLoading, error } = useQuery({
    queryKey: ["avatar", avatarId],
    queryFn: () => avatarApi.get(avatarId),
  });

  // Back to wherever they came from; a direct visit goes to the avatar list.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/avatars"));

  return (
    <Panel>
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </button>
          <h1 className="truncate text-h3 font-medium">{avatar?.name || (isLoading ? "" : "Avatar")}</h1>
        </div>
        {avatar && (
          <Button as={Link} to={`/avatars/${avatar._id}`} variant="inverse">
            Customize this avatar
          </Button>
        )}
      </header>

      <div className="flex justify-center px-6 pb-10">
        {isLoading && <p className="py-16 text-text-muted">Loading avatar…</p>}
        {!isLoading && (error || !avatar) && (
          <p className="py-16 text-text-muted">{error?.message || "Avatar not found"}</p>
        )}
        {avatar && <PortraitCall avatar={avatar} />}
      </div>
    </Panel>
  );
}
