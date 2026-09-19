import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studioApi } from "@/services/studio.api";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Field from "@/components/forms/Field";
import Segmented from "@/components/forms/Segmented";
import StockPicker from "./StockPicker";

/**
 * Three ways to get an avatar, sharing one page.
 *
 * Which vendors appear comes from the server's capability readout rather than a
 * hardcoded list, so a vendor that is configured but cannot be served by the
 * current storage driver shows up disabled with the reason, instead of failing
 * after the upload.
 */
const SOURCES = {
  stock: {
    label: "Ready-made",
    blurb: "Pick an avatar the provider has already trained. Nothing to upload.",
    capability: "stockAvatars",
  },
  photo: {
    label: "Photo",
    blurb: "Any face works — a photo, an illustration, a mascot. No training step.",
    capability: "photoAvatar",
    prompt: "Choose an image",
  },
  video: {
    label: "Video clone",
    blurb: "A short clip of a person talking. Training takes a few minutes.",
    capability: "videoClone",
    prompt: "Choose a video",
  },
};

export default function AvatarStudio() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef(null);

  const [source, setSource] = useState("stock");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");

  const { data: options } = useQuery({ queryKey: ["studio-options"], queryFn: studioApi.options });

  const create = useMutation({
    mutationFn: (stockChoice) => {
      if (source === "stock") {
        return studioApi.adoptStock({
          providerId: stockChoice.providerId,
          providerAvatarId: stockChoice.providerAvatarId,
          name: stockChoice.name,
        });
      }
      const input = { file, name, providerId: providerId || undefined };
      return source === "video"
        ? studioApi.createFromVideo(input)
        : studioApi.createFromPhoto(input);
    },
    onSuccess: (avatar) => {
      queryClient.invalidateQueries({ queryKey: ["avatars"] });
      // A trained avatar is not callable yet, so send them to the library to
      // watch it settle rather than into a call that would be refused.
      navigate(avatar.status === "ready" ? `/call/${avatar._id}` : "/avatars");
    },
  });

  const pick = (chosen) => {
    if (!chosen) return;
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    if (!name) setName(chosen.name.replace(/\.[^.]+$/, ""));
  };

  const canSubmit = file && name.trim() && !create.isPending;
  const cfg = SOURCES[source];

  return (
    <>
      <PageHeader title="Create an avatar" description={cfg.blurb} />

      <Segmented
        value={source}
        onChange={(next) => {
          setSource(next);
          setFile(null);
          setPreview(null);
          setProviderId("");
        }}
        options={Object.entries(SOURCES).map(([value, s]) => ({ value, label: s.label }))}
      />

      {source === "stock" ? (
        <StockPicker
          onAdopt={(choice) => create.mutate(choice)}
          adopting={create.isPending}
          error={create.isError ? create.error : null}
        />
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card flush>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex aspect-[4/3] w-full items-center justify-center bg-surface-2 transition-colors hover:bg-surface-3"
              >
                {preview && source === "photo" && (
                  <img src={preview} alt="" className="h-full w-full object-cover" />
                )}
                {preview && source === "video" && (
                  <video
                    src={preview}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                )}
                {!preview && <span className="text-ui text-text-muted">{cfg.prompt}</span>}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept={options?.limits[source].types.join(",")}
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </Card>

            <Card>
              <Field label="Name" value={name} onChange={setName} placeholder="Jess" />

              <p className="mt-6 text-ui text-text-muted">Provider</p>
              <div className="mt-2 flex flex-col gap-2">
                <ProviderChoice
                  id=""
                  label="Automatic"
                  hint="Cheapest capable vendor"
                  selected={providerId === ""}
                  onSelect={setProviderId}
                />
                {options?.providers
                  .filter((p) => p[cfg.capability])
                  .map((p) => (
                    <ProviderChoice
                      key={p.id}
                      id={p.id}
                      label={p.id}
                      hint={providerHint(p, options.storage)}
                      disabled={!p.usable}
                      selected={providerId === p.id}
                      onSelect={setProviderId}
                    />
                  ))}
              </div>
            </Card>
          </div>

          {options &&
            !options.storage.reachableByVendors &&
            options.providers.some((p) => p.configured && !p.acceptsDirectUpload) && (
              <Card className="mt-4">
                <p className="text-ui text-text-muted">
                  Storage driver <code className="font-mono text-text">{options.storage.driver}</code>{" "}
                  serves localhost URLs. Vendors that fetch uploads themselves need{" "}
                  <code className="font-mono text-text">STORAGE_DRIVER=r2</code>; ones that accept
                  the bytes directly work as-is.
                </p>
              </Card>
            )}

          {create.isError && (
            <p className="mt-4 rounded border border-red/40 bg-red/10 px-4 py-3 text-ui text-red">
              {create.error.message}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={() => create.mutate()} disabled={!canSubmit}>
              {create.isPending ? (source === "video" ? "Uploading…" : "Creating…") : "Create avatar"}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/avatars")}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Says why a vendor cannot be chosen, because the reasons need different fixes:
 * one is an API key, the other is object storage.
 */
function providerHint(provider, storage) {
  if (provider.developmentOnly) return "Local stub · generates nothing";
  if (provider.usable) {
    return `$${provider.costPerMinUsd}/min${provider.nonHumanCharacters ? " · non-human ok" : ""}`;
  }
  if (!provider.configured) return "No API key configured";
  if (!storage.reachableByVendors && !provider.acceptsDirectUpload) {
    return "Fetches uploads itself · needs public storage";
  }
  return "Unavailable";
}

function ProviderChoice({ id, label, hint, disabled, selected, onSelect }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(id)}
      className={`flex items-center justify-between gap-3 rounded border px-3 py-2.5 text-left transition-colors
        ${selected ? "border-pink bg-pink-dim" : "border-border hover:bg-surface-hover"}
        disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
    >
      <span className="shrink-0 text-ui">{label}</span>
      <span className="text-right text-ui text-text-faint">{hint}</span>
    </button>
  );
}
