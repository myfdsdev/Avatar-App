import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { voiceApi } from "@/services/voice.api";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";

/**
 * "Your voices": the workspace's own cloned voices.
 *
 * LiveKit has no public cloning API, so the clone is made in the LiveKit Cloud
 * dashboard and only its v_* id is added here. Like the Knowledge Base, this
 * row saves through its own requests rather than the avatar's autosave; the
 * voice picker above reads the same query.
 */
const KEY = ["custom-voices"];
const DASHBOARD = "https://cloud.livekit.io";

export function useCustomVoices() {
  return useQuery({ queryKey: KEY, queryFn: voiceApi.list });
}

export default function CustomVoices({ selected, onAdded }) {
  const queryClient = useQueryClient();
  const { data: voices = [], isLoading } = useCustomVoices();
  const [adding, setAdding] = useState(false);

  const remove = useMutation({
    mutationFn: voiceApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-body font-medium">Your voices</p>
          <p className="mt-1 max-w-md text-ui text-text-muted">
            Clone your own voice and use it on any avatar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-9 shrink-0 rounded-sm border border-border-strong bg-bg px-4 text-ui font-semibold text-text transition-colors hover:bg-surface-3"
        >
          Add voice
        </button>
      </div>

      {isLoading && <p className="mt-4 text-ui text-text-muted">Loading voices…</p>}
      {voices.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-bg">
          {voices.map((v) => (
            <li key={v._id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-ui font-medium">
                  {v.name}
                  {selected === v.providerVoiceId && (
                    <span className="ml-2 text-label text-text-muted">· in use</span>
                  )}
                </p>
                <p className="truncate font-mono text-label text-text-faint">{v.providerVoiceId}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove "${v.name}" from your voices?`)) remove.mutate(v._id);
                }}
                disabled={remove.isPending}
                aria-label={`Remove ${v.name}`}
                className="shrink-0 rounded-sm px-2 py-1 text-ui text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {remove.error && <p className="mt-2 text-ui text-red">{remove.error.message}</p>}

      <AddVoiceDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(voice) => {
          queryClient.invalidateQueries({ queryKey: KEY });
          setAdding(false);
          onAdded?.(voice);
        }}
      />
    </div>
  );
}

function AddVoiceDialog({ open, onClose, onAdded }) {
  const [name, setName] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [gender, setGender] = useState("");

  const create = useMutation({
    mutationFn: voiceApi.create,
    onSuccess: (voice) => {
      setName("");
      setVoiceId("");
      setGender("");
      onAdded(voice);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    create.mutate({ name: name.trim(), voiceId: voiceId.trim(), gender: gender || undefined });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add your voice"
      description="Clone a voice in LiveKit Cloud, then add it here to use it on your avatars."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-voice" disabled={!name.trim() || !voiceId.trim() || create.isPending}>
            {create.isPending ? "Adding…" : "Add voice"}
          </Button>
        </>
      }
    >
      <ol className="space-y-2 text-ui text-text-muted">
        <li>
          1. Open{" "}
          <a href={DASHBOARD} target="_blank" rel="noreferrer" className="text-text underline underline-offset-2">
            LiveKit Cloud
          </a>{" "}
          → <span className="text-text">Voices → Custom voices → Create voice clone</span>.
        </li>
        <li>
          2. Record or upload about 10 seconds of clear speech (MP3, WAV, OGG or WEBM, under 4 MB) with no
          background noise.
        </li>
        <li>
          3. Copy the voice ID it gives you - it starts with <code className="font-mono text-text">v_</code> - and
          paste it below.
        </li>
      </ol>

      <form id="add-voice" onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Name">
          <input
            value={name}
            maxLength={60}
            placeholder="My voice"
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Voice ID">
          <input
            value={voiceId}
            maxLength={40}
            placeholder="v_RT5PsNhXvMaB"
            spellCheck={false}
            onChange={(e) => setVoiceId(e.target.value)}
            className={clsx(inputClass, "font-mono")}
          />
        </Field>
        <Field label="Gender (optional)">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className={clsx(inputClass, "cursor-pointer [color-scheme:dark]")}
          >
            <option value="">Not set</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>
        {create.error && <p className="text-ui text-red">{create.error.message}</p>}
      </form>
    </Modal>
  );
}

const inputClass =
  "h-10 w-full rounded border border-border bg-bg px-4 text-ui text-text outline-none transition-colors placeholder:text-text-faint focus:border-border-strong";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-ui font-medium">{label}</span>
      {children}
    </label>
  );
}
