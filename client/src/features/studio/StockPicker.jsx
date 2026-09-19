import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { studioApi } from "@/services/studio.api";
import MediaPreview from "@/components/media/MediaPreview";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";

/**
 * Pick one of the vendor's own pre-trained avatars.
 *
 * Worth its own flow rather than a provider option: nothing is uploaded and
 * nothing is trained, so none of the upload UI applies - and on plans where
 * training is a paid feature, this is the only route to a working avatar.
 */
export default function StockPicker({ onAdopt, adopting, error }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const { data: avatars, isLoading, error: loadError } = useQuery({
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
  if (loadError) return <Note>{loadError.message}</Note>;
  if (!avatars?.length) return <Note>No vendor on this install offers ready-made avatars.</Note>;

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-4">
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

      <div className="mt-4 grid max-h-[520px] grid-cols-2 gap-4 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((avatar) => {
          const isSelected = selected?.providerAvatarId === avatar.providerAvatarId;
          return (
            <button
              key={`${avatar.providerId}:${avatar.providerAvatarId}`}
              type="button"
              onClick={() => setSelected(avatar)}
              className={`overflow-hidden rounded-lg border text-left transition-colors ${
                isSelected ? "border-pink" : "border-border hover:border-border-strong"
              }`}
            >
              <MediaPreview src={avatar.previewUrl} className="aspect-[3/4] w-full" />
              <div className="p-3">
                <p className="truncate text-ui">{avatar.name}</p>
                <p className="mt-0.5 truncate text-ui text-text-faint">{avatar.providerId}</p>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 rounded border border-red/40 bg-red/10 px-4 py-3 text-ui text-red">
          {error.message}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => onAdopt(selected)} disabled={!selected || adopting}>
          {adopting ? "Adding…" : "Use this avatar"}
        </Button>
        {selected && <span className="text-ui text-text-muted">{selected.name}</span>}
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
