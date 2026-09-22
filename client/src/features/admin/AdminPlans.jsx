import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { adminApi } from "@/services/admin.api";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Modal from "@/components/common/Modal";
import AdminGate from "./AdminGate";
import { Th } from "./parts";
import { money } from "./format";

/**
 * Plans: what an admin can put a user on.
 *
 * A plan's limits are read at the moment they matter, so an edit here reaches
 * everyone on the plan without re-assigning. Plans in use are archived rather
 * than deleted - archiving only stops new assignments. Assigning happens on
 * each user's admin page.
 */
export default function AdminPlans() {
  return (
    <AdminGate>
      <Plans />
    </AdminGate>
  );
}

// Must match server/src/modules/admin/plan.templates.js.
const TEMPLATE_KEYS = ["free", "starter", "pro", "business"];

const EMPTY = {
  name: "",
  key: "",
  description: "",
  price: "0",
  includedMinutes: "0",
  overageEnabled: false,
  concurrencyLimit: "3",
  maxAvatars: "0",
  isDefault: false,
};

function Plans() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | "new" | plan
  const [deleting, setDeleting] = useState(null);

  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: adminApi.plans,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-user"] });
  };

  const templates = useMutation({
    mutationFn: adminApi.addPlanTemplates,
    onSuccess: refresh,
  });
  const missingTemplates = TEMPLATE_KEYS.filter((k) => !plans.some((p) => p.key === k));

  const toggleActive = useMutation({
    mutationFn: (plan) => adminApi.updatePlan(plan._id, { active: !plan.active, ...(plan.active && { isDefault: false }) }),
    onSuccess: refresh,
  });

  return (
    <>
      <PageHeader
        title="Plans"
        description="Create plans here, then assign them from a user's admin page."
        action={
          <div className="flex gap-2">
            {plans.length > 0 && missingTemplates.length > 0 && (
              <Button variant="secondary" onClick={() => templates.mutate()} disabled={templates.isPending}>
                {templates.isPending ? "Adding…" : "Add ready-made plans"}
              </Button>
            )}
            <Button onClick={() => setEditing("new")}>New plan</Button>
          </div>
        }
      />
      {templates.isError && <p className="mb-4 text-ui text-red">{templates.error.message}</p>}
      {templates.data?.added.length > 0 && (
        <p className="mb-4 text-ui text-text-muted">
          Added {templates.data.added.join(", ")}. None is the default for new sign-ups until you choose one.
        </p>
      )}

      {isLoading && <p className="text-text-muted">Loading plans…</p>}
      {error && <p className="text-red">{error.message}</p>}
      {toggleActive.isError && <p className="mb-4 text-ui text-red">{toggleActive.error.message}</p>}

      {!isLoading && plans.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-text-muted">No plans yet.</p>
          <p className="mt-1 text-ui text-text-faint">
            Start from Free, Starter, Pro and Business - priced above what a call costs - or make your own.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => templates.mutate()} disabled={templates.isPending}>
              {templates.isPending ? "Adding…" : "Add ready-made plans"}
            </Button>
            <Button variant="secondary" onClick={() => setEditing("new")}>
              Create your own
            </Button>
          </div>
        </Card>
      )}

      {plans.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-ui">
              <thead>
                <tr className="text-text-faint">
                  <Th>Plan</Th>
                  <Th align="right">Price / month</Th>
                  <Th align="right">Minutes / month</Th>
                  <Th align="right">Calls at once</Th>
                  <Th align="right">Avatars</Th>
                  <Th align="right">Users</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p._id} className={clsx("border-t border-border", !p.active && "opacity-60")}>
                    <td className="py-3 pr-4">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        <span className="font-mono text-label text-text-faint">{p.key}</span>
                        {p.isDefault && (
                          <span className="rounded-full bg-green-dim px-2 py-0.5 text-label text-green">
                            Default for new sign-ups
                          </span>
                        )}
                        {!p.active && (
                          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-label text-text-muted">
                            Archived
                          </span>
                        )}
                      </p>
                      {p.description && <p className="mt-0.5 text-text-muted">{p.description}</p>}
                    </td>
                    <td className="py-3 text-right tabular-nums">{p.priceCents ? money(p.priceCents) : "Free"}</td>
                    <td className="py-3 text-right tabular-nums">
                      {p.includedMinutes ? p.includedMinutes.toLocaleString() : "Unlimited"}
                      {p.includedMinutes > 0 && p.overageEnabled && (
                        <span className="block text-label text-text-faint">then overage</span>
                      )}
                    </td>
                    <td className="py-3 text-right tabular-nums">{p.concurrencyLimit}</td>
                    <td className="py-3 text-right tabular-nums">{p.maxAvatars || "Unlimited"}</td>
                    <td className="py-3 text-right tabular-nums">{p.users}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive.mutate(p)}
                          disabled={toggleActive.isPending}
                        >
                          {p.active ? "Archive" : "Restore"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(p)}
                          disabled={p.users > 0}
                          title={p.users > 0 ? "People are on this plan - archive it instead" : undefined}
                          className="hover:text-red"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <PlanDialog
          plan={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <DeleteDialog
          plan={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            refresh();
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}

/** Create or edit. The key is set once, on create - it defaults to the name, slugged. */
function PlanDialog({ plan, onClose, onSaved }) {
  const creating = !plan;
  const [form, setForm] = useState(() =>
    plan
      ? {
          name: plan.name,
          key: plan.key,
          description: plan.description || "",
          price: String((plan.priceCents || 0) / 100),
          includedMinutes: String(plan.includedMinutes ?? 0),
          overageEnabled: Boolean(plan.overageEnabled),
          concurrencyLimit: String(plan.concurrencyLimit ?? 3),
          maxAvatars: String(plan.maxAvatars ?? 0),
          isDefault: Boolean(plan.isDefault),
        }
      : EMPTY,
  );
  const [keyTouched, setKeyTouched] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const payload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    priceCents: Math.round(Number(form.price || 0) * 100),
    includedMinutes: Number(form.includedMinutes || 0),
    overageEnabled: form.overageEnabled,
    concurrencyLimit: Number(form.concurrencyLimit || 1),
    maxAvatars: Number(form.maxAvatars || 0),
    isDefault: form.isDefault,
  });

  const save = useMutation({
    mutationFn: () =>
      creating ? adminApi.createPlan({ key: form.key.trim(), ...payload() }) : adminApi.updatePlan(plan._id, payload()),
    onSuccess: onSaved,
  });

  const valid = form.name.trim() && (!creating || /^[a-z0-9][a-z0-9-]{1,31}$/.test(form.key.trim()));

  return (
    <Modal
      open
      onClose={() => !save.isPending && onClose()}
      title={creating ? "New plan" : `Edit ${plan.name}`}
      description={
        creating
          ? "Set the limits. Zero minutes or avatars means no limit."
          : `Changes apply to everyone on this plan from their next call${plan.users ? ` (${plan.users} now)` : ""}.`
      }
      footer={
        <>
          {save.isError && <span className="mr-auto text-ui text-red">{save.error.message}</span>}
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending ? "Saving…" : creating ? "Create plan" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          value={form.name}
          maxLength={60}
          placeholder="Pro"
          onChange={(name) => set({ name, ...(creating && !keyTouched && { key: slug(name) }) })}
        />
        <Input
          label="Key"
          value={form.key}
          maxLength={32}
          placeholder="pro"
          disabled={!creating}
          hint={creating ? "Lowercase, fixed once created." : "Fixed once created."}
          onChange={(key) => {
            setKeyTouched(true);
            set({ key: key.toLowerCase() });
          }}
        />
        <div className="sm:col-span-2">
          <Input
            label="Description (optional)"
            value={form.description}
            maxLength={200}
            placeholder="For growing teams"
            onChange={(description) => set({ description })}
          />
        </div>
        <Input label="Price per month (USD)" type="number" min="0" step="0.01" value={form.price} onChange={(price) => set({ price })} />
        <Input
          label="Minutes per month"
          type="number"
          min="0"
          step="1"
          value={form.includedMinutes}
          hint="0 = unlimited"
          onChange={(includedMinutes) => set({ includedMinutes })}
        />
        <Input
          label="Calls at once"
          type="number"
          min="1"
          max="100"
          step="1"
          value={form.concurrencyLimit}
          onChange={(concurrencyLimit) => set({ concurrencyLimit })}
        />
        <Input
          label="Avatars"
          type="number"
          min="0"
          step="1"
          value={form.maxAvatars}
          hint="0 = unlimited"
          onChange={(maxAvatars) => set({ maxAvatars })}
        />
      </div>

      <div className="mt-5 space-y-3">
        <Check
          checked={form.overageEnabled}
          onChange={(overageEnabled) => set({ overageEnabled })}
          label="Allow calls past the monthly minutes"
          hint="Off: calls are refused once the minutes are used up."
        />
        <Check
          checked={form.isDefault}
          onChange={(isDefault) => set({ isDefault })}
          label="Default for new sign-ups"
          hint="New accounts start on this plan. Only one plan can be the default."
        />
      </div>
    </Modal>
  );
}

function DeleteDialog({ plan, onClose, onDeleted }) {
  const remove = useMutation({ mutationFn: () => adminApi.removePlan(plan._id), onSuccess: onDeleted });
  return (
    <Modal
      open
      onClose={() => !remove.isPending && onClose()}
      title={`Delete ${plan.name}?`}
      description="Nobody is on this plan, so deleting it changes nothing for users."
      footer={
        <>
          {remove.isError && <span className="mr-auto text-ui text-red">{remove.error.message}</span>}
          <Button variant="ghost" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {remove.isPending ? "Deleting…" : "Delete plan"}
          </Button>
        </>
      }
    />
  );
}

function Input({ label, hint, onChange, ...rest }) {
  const id = `plan-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-ui text-text-muted">
        {label}
      </label>
      <input
        id={id}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-10 w-full rounded border border-border bg-bg px-3 text-ui text-text outline-none transition-colors [color-scheme:dark] placeholder:text-text-faint focus:border-border-strong disabled:opacity-50"
        {...rest}
      />
      {hint && <p className="mt-1.5 text-label text-text-faint">{hint}</p>}
    </div>
  );
}

function Check({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-[color:var(--pink)]"
      />
      <span>
        <span className="block text-ui">{label}</span>
        {hint && <span className="block text-label text-text-faint">{hint}</span>}
      </span>
    </label>
  );
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
