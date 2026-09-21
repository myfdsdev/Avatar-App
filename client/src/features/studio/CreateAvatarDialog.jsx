import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studioApi } from "@/services/studio.api";
import { useCreateAvatar } from "@/store/createAvatar.store";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import BehaviourFields from "./BehaviourFields";
import { briefFromPreset } from "./presets";

/**
 * Creating an avatar is one form: a face and a brief.
 *
 * It opens straight from any "Create" action instead of from a page, because
 * there is only one way to make an avatar now and a page whose only job is to
 * lead to a form is a step nobody needs.
 *
 * Photo is the only source because it is the only one a real vendor here can
 * serve. The ready-made and video-clone endpoints still exist on the server, so
 * bringing either back is UI work only.
 */
export default function CreateAvatarDialog() {
  const open = useCreateAvatar((s) => s.open);
  // Mounted only while open, so every opening starts from an empty form.
  return open ? <CreateAvatarForm /> : null;
}

const EMPTY_BRIEF = {
  name: "",
  systemPrompt: "",
  greeting: "",
  language: "en",
  temperature: 0.6,
  motionPrompt: "",
  maxCallSeconds: 1800,
};

function CreateAvatarForm() {
  const hide = useCreateAvatar((s) => s.hide);
  const preset = useCreateAvatar((s) => s.preset);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [dragging, setDragging] = useState(false);
  // A template from the dashboard arrives as the starting brief.
  const [brief, setBrief] = useState(() =>
    preset ? { ...EMPTY_BRIEF, ...briefFromPreset(preset) } : EMPTY_BRIEF,
  );

  const { data: options } = useQuery({ queryKey: ["studio-options"], queryFn: studioApi.options });
  const limits = options?.limits.photo;

  // Checked up front: without a vendor the upload would succeed and the create
  // would then be refused, after the person had filled in the whole form.
  const noVendor = options && !options.providers.some((p) => p.photoAvatar && p.usable);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const create = useMutation({
    mutationFn: () => {
      const { name, ...behaviour } = brief;
      return studioApi.createFromPhoto({ file, name: name.trim(), behaviour });
    },
    onSuccess: (avatar) => {
      queryClient.invalidateQueries({ queryKey: ["avatars"] });
      hide();
      navigate(avatar.status === "ready" ? `/call/${avatar._id}` : "/avatars");
    },
  });

  const close = () => {
    if (!create.isPending) hide();
  };

  const pick = (chosen) => {
    if (!chosen) return;
    if (limits && !limits.types.includes(chosen.type)) {
      setFileError(`That file type is not supported. Use ${formatTypes(limits.types)}.`);
      return;
    }
    if (limits && chosen.size > limits.maxBytes) {
      setFileError(`That image is ${mb(chosen.size)}. The limit is ${mb(limits.maxBytes)}.`);
      return;
    }
    setFileError(null);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  };

  const choose = () => fileInput.current?.click();

  const missing = !file ? "Add a photo to continue." : !brief.name.trim() ? "Give it a name." : null;
  const canSubmit = !missing && !noVendor && !create.isPending;

  return (
    <Modal
      open
      onClose={close}
      title="Create an avatar"
      description={
        preset
          ? `Starting from the ${preset.label} template. Upload a face and adjust anything below.`
          : "Upload a face, then tell it how to behave."
      }
      footer={
        <>
          {missing && <span className="mr-auto text-ui text-text-faint">{missing}</span>}
          <Button variant="ghost" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit}>
            {create.isPending ? "Creating…" : "Create avatar"}
          </Button>
        </>
      }
    >
      {noVendor && (
        <p className="mb-6 rounded border border-border-strong bg-surface-2 px-4 py-3 text-ui text-yellow">
          No avatar vendor is set up, so a photo cannot be animated yet. Add{" "}
          <code className="font-mono">LEMONSLICE_API_KEY</code> to{" "}
          <code className="font-mono">server/.env</code> and restart the server.
        </p>
      )}

      <div className="mb-6 flex items-start gap-5">
        <button
          type="button"
          onClick={choose}
          disabled={create.isPending}
          aria-label={file ? "Change photo" : "Choose a photo"}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={clsx(
            "flex aspect-[3/4] w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 transition-colors",
            preview ? "border border-border" : "border border-dashed",
            dragging ? "border-pink bg-pink-dim" : !preview && "border-border-strong hover:bg-surface-3",
          )}
        >
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
              className="text-text-muted"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
          )}
        </button>

        <div className="min-w-0 pt-1">
          <p className="font-medium">Photo</p>
          <p className="mt-1 text-ui text-text-muted">
            Any face works: a photo, an illustration, a mascot. Drop it here or choose a file.
          </p>
          {limits && (
            <p className="mt-1 text-ui text-text-faint">
              {formatTypes(limits.types)} · up to {mb(limits.maxBytes)}
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={choose}
            disabled={create.isPending}
          >
            {file ? "Change photo" : "Choose photo"}
          </Button>
          {fileError && <p className="mt-2 text-ui text-red">{fileError}</p>}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept={limits?.types.join(",") || "image/*"}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            // Cleared so choosing the same file again still fires a change.
            e.target.value = "";
          }}
        />
      </div>

      <BehaviourFields
        value={brief}
        onChange={setBrief}
        options={options}
        disabled={create.isPending}
      />

      {create.isError && (
        <p className="mt-6 rounded border border-border-strong bg-surface-2 px-4 py-3 text-ui text-red">
          {create.error.message}
        </p>
      )}
    </Modal>
  );
}

const mb = (bytes) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

/** "image/jpeg" → "JPG", for a list a person can read. */
const formatTypes = (types) =>
  types.map((t) => t.split("/")[1].toUpperCase().replace("JPEG", "JPG")).join(", ");
