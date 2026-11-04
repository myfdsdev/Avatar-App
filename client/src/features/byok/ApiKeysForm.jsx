import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { byokApi } from "@/services/byok.api";
import Button from "@/components/common/Button";
import Field from "@/components/forms/Field";
import { toast } from "@/components/feedback/Toast";

/**
 * The workspace's own vendor keys. Calls and avatars run on these, never on
 * the app's: without a LemonSlice key no avatar can be made or called, and
 * without an ElevenLabs key voices cannot be cloned.
 */
export const SERVICES = [
  {
    id: "lemonslice",
    label: "LemonSlice API key",
    what: "Draws the live avatar in every call. Required.",
    getKeyUrl: "https://lemonslice.com/docs",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs API key",
    what: "Clones voices and speaks with them in calls.",
    getKeyUrl: "https://elevenlabs.io/app/settings/api-keys",
  },
];

export const BYOK_QUERY = ["byok"];

export function useByok() {
  return useQuery({ queryKey: BYOK_QUERY, queryFn: byokApi.get, staleTime: 60_000 });
}

/** Whether a workspace has every key it needs. */
export const keysComplete = (keys) => SERVICES.every((s) => keys?.[s.id]?.hasKey);

/**
 * One field per service. A blank field keeps the saved key, so the form works
 * both for a first setup and for replacing one key later.
 */
export default function ApiKeysForm({ status, canManage, onSaved, footer }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ lemonslice: "", elevenlabs: "" });
  const entered = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));

  const save = useMutation({
    mutationFn: () => byokApi.save(entered),
    onSuccess: (res) => {
      queryClient.setQueryData(BYOK_QUERY, (prev) => ({ ...prev, keys: res.keys }));
      setValues({ lemonslice: "", elevenlabs: "" });
      toast.success("API keys saved");
      onSaved?.(res.keys);
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (service) => byokApi.remove(service),
    onSuccess: (res) => {
      queryClient.setQueryData(BYOK_QUERY, (prev) => ({ ...prev, keys: res.keys }));
      toast.success("Key removed");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (Object.keys(entered).length) save.mutate();
      }}
      noValidate
    >
      {SERVICES.map((s) => {
        const saved = status?.[s.id];
        return (
          <div key={s.id} className="mt-5 first:mt-0">
            <Field
              label={s.label}
              id={`byok-${s.id}`}
              type="password"
              value={values[s.id]}
              onChange={(v) => setValues((prev) => ({ ...prev, [s.id]: v }))}
              placeholder={saved?.hasKey ? `Saved: ••••${saved.last4} (type to replace)` : "Paste your key"}
              autoComplete="off"
              spellCheck={false}
              disabled={!canManage || save.isPending}
            />
            <p className="mt-2 text-ui text-text-faint">
              {s.what}{" "}
              <a href={s.getKeyUrl} target="_blank" rel="noreferrer" className="text-text-muted underline-offset-2 hover:underline">
                Get a key
              </a>
              {canManage && saved?.hasKey && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => remove.mutate(s.id)}
                    disabled={remove.isPending}
                    className="text-text-muted underline-offset-2 hover:text-text hover:underline"
                  >
                    Remove
                  </button>
                </>
              )}
            </p>
          </div>
        );
      })}

      {!canManage && (
        <p className="mt-5 text-ui text-text-muted">Only the workspace owner or an admin can change these keys.</p>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        {footer}
        {canManage && (
          <Button type="submit" disabled={!Object.keys(entered).length || save.isPending}>
            {save.isPending ? "Checking…" : "Save keys"}
          </Button>
        )}
      </div>
    </form>
  );
}
