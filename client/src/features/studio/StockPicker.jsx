import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { studioApi } from "@/services/studio.api";
import MediaPreview from "@/components/media/MediaPreview";
import Card from "@/components/common/Card";

/**
 * Browse the vendor's own pre-trained avatars.
 *
 * Purely a chooser: picking one hands it upward and the brief is collected in a
 * dialog. Keeping the two apart means the grid can stay large and scrollable
 * without a form competing with it for the page.
 *
 * Worth its own flow rather than a provider option - nothing is uploaded and
 * nothing is trained, and on plans where training is a paid feature this is the
 * only route to a working avatar.
 */
export default function StockPicker({ onChoose }) {
  const [query, setQuery] = useState("");

  const { data: avatars, isLoading, error } = useQuery({
    queryKey: ["stock-avatars"],
    queryFn: studioApi.stock,
    // The vendor's catalogue barely changes; refetching on every visit is waste.
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!avatars) return [];
    const q = query.trim().toLowerCase();
    return q ? avatars.filter((a) => a.name.toLowerCase().includes(q)) : avatars;
  }, [avatars, query]);

  if (isLoading) return <Note>Loading ready-made avatars…</Note>;
  if (error) return <Note>{error.message}</Note>;
  if (!avatars?.length) return <Note>No vendor on this install offers ready-made avatars.</Note>;

  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          className="h-10 w-72 rounded border border-border bg-bg px-3 text-ui text-text outline-none transition-colors placeholder:text-text-faint focus:border-border-strong"
        />
        <p className="text-ui text-text-faint">
          {filtered.length} of {avatars.length}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((avatar) => (
          <button
            key={`${avatar.providerId}:${avatar.providerAvatarId}`}
            type="button"
            onClick={() => onChoose(avatar)}
            className="overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-border-strong"
          >
            <MediaPreview src={avatar.previewUrl} className="aspect-[3/4] w-full" />
            <div className="p-3">
              <p className="truncate text-ui">{avatar.name}</p>
              <p className="mt-0.5 truncate text-ui text-text-faint">{avatar.providerId}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function Note({ children }) {
  return (
    <Card className="mt-6">
      <p className="text-ui text-text-muted">{children}</p>
    </Card>
  );
}
