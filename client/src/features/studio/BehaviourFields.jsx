import Field from "@/components/forms/Field";

/**
 * Everything about how an avatar behaves, in one form.
 *
 * Shared by all three creation flows, because the brief matters more than how
 * the face was made - a stock face with no brief is the least useful thing the
 * product can produce.
 *
 * Fields that only some vendors honour say so. Silently offering a setting that
 * the selected vendor ignores is how the brief used to get dropped, and a
 * control that does nothing is worse than one that is absent.
 */
const PRESETS = [
  {
    id: "support",
    label: "Support agent",
    systemPrompt:
      "You are a calm, efficient support agent. Ask one clarifying question before " +
      "offering a fix. Keep answers to two or three sentences. If you do not know " +
      "something, say so and offer to escalate rather than guessing.",
    greeting: "Hi, what can I help you with today?",
    motionPrompt: "an attentive person listening carefully",
    temperature: 0.4,
  },
  {
    id: "tutor",
    label: "Language tutor",
    systemPrompt:
      "You are a patient language tutor. Speak simply, correct mistakes gently, and " +
      "ask a short follow-up question every turn so the learner keeps talking. Never " +
      "lecture for more than three sentences.",
    greeting: "Hey! What would you like to practise today?",
    motionPrompt: "a warm, encouraging teacher",
    temperature: 0.6,
  },
  {
    id: "interviewer",
    label: "Interviewer",
    systemPrompt:
      "You are conducting a friendly screening interview. Ask one question at a time, " +
      "listen to the whole answer, and follow up on anything vague. Do not evaluate " +
      "the candidate out loud.",
    greeting: "Thanks for joining. Ready when you are — shall we start?",
    motionPrompt: "a composed professional taking notes",
    temperature: 0.3,
  },
  {
    id: "demo",
    label: "Product demo",
    systemPrompt:
      "You are walking someone through a product. Lead with what they can do, not " +
      "with features. Ask what they are trying to achieve before explaining anything, " +
      "and keep each explanation under three sentences.",
    greeting: "Hi! What are you hoping to get out of this?",
    motionPrompt: "an energetic presenter using their hands",
    temperature: 0.7,
  },
];

const TONES = [
  { value: 0.2, label: "Precise", hint: "Sticks closely to the brief" },
  { value: 0.6, label: "Balanced", hint: "Natural, a little variation" },
  { value: 1.0, label: "Creative", hint: "Looser and more expressive" },
];

const DURATIONS = [
  { value: 300, label: "5 min" },
  { value: 900, label: "15 min" },
  { value: 1800, label: "30 min" },
  { value: 3600, label: "1 hour" },
];

export default function BehaviourFields({ value, onChange, options, disabled }) {
  const set = (patch) => onChange({ ...value, ...patch });

  const applyPreset = (preset) =>
    onChange({
      ...value,
      systemPrompt: preset.systemPrompt,
      greeting: preset.greeting,
      motionPrompt: preset.motionPrompt,
      temperature: preset.temperature,
    });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ui text-text-muted">Start from a preset</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => applyPreset(preset)}
              className="rounded-full border border-border px-3 py-1.5 text-ui text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-40"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Name"
        value={value.name ?? ""}
        onChange={(v) => set({ name: v })}
        placeholder={options?.namePlaceholder || "Jess"}
        hint="Left empty, it keeps the provider's name."
        disabled={disabled}
      />

      <div>
        <label className="block text-ui text-text-muted" htmlFor="system-prompt">
          Instructions
        </label>
        <textarea
          id="system-prompt"
          rows={6}
          value={value.systemPrompt ?? ""}
          disabled={disabled}
          onChange={(e) => set({ systemPrompt: e.target.value })}
          placeholder={options?.defaultPrompt}
          className="mt-2 w-full resize-y rounded border border-border bg-bg px-3 py-2.5 text-ui leading-relaxed text-text outline-none transition-colors placeholder:text-text-faint focus:border-border-strong disabled:opacity-40"
        />
        <p className="mt-2 text-ui text-text-faint">
          The brief it follows on every call. Left empty, a short friendly default is used.
        </p>
      </div>

      <Field
        label="First line"
        value={value.greeting ?? ""}
        onChange={(v) => set({ greeting: v })}
        placeholder="Hi, what can I help you with?"
        hint="What it says as soon as someone joins."
        disabled={disabled}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-ui text-text-muted" htmlFor="language">
            Language
          </label>
          <select
            id="language"
            value={value.language ?? "en"}
            disabled={disabled}
            onChange={(e) => set({ language: e.target.value })}
            className="mt-2 h-10 w-full rounded border border-border bg-bg px-3 text-ui text-text outline-none transition-colors focus:border-border-strong disabled:opacity-40"
          >
            {(options?.languages || [{ code: "en", label: "English" }]).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-ui text-text-faint">Drives speech in and out.</p>
        </div>

        <div>
          <label className="block text-ui text-text-muted" htmlFor="max-duration">
            Maximum call length
          </label>
          <select
            id="max-duration"
            value={value.maxCallSeconds ?? 1800}
            disabled={disabled}
            onChange={(e) => set({ maxCallSeconds: Number(e.target.value) })}
            className="mt-2 h-10 w-full rounded border border-border bg-bg px-3 text-ui text-text outline-none transition-colors focus:border-border-strong disabled:opacity-40"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-ui text-text-faint">Calls end automatically after this.</p>
        </div>
      </div>

      <div>
        <p className="text-ui text-text-muted">Tone</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TONES.map((tone) => {
            const active = (value.temperature ?? 0.6) === tone.value;
            return (
              <button
                key={tone.value}
                type="button"
                disabled={disabled}
                onClick={() => set({ temperature: tone.value })}
                className={`rounded border px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                  active ? "border-pink bg-pink-dim" : "border-border hover:border-border-strong"
                }`}
              >
                <span className="block text-ui">{tone.label}</span>
                <span className="block text-ui text-text-faint">{tone.hint}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-ui text-text-faint">
          Applies when we run the language model — vendors that host the conversation use their
          own.
        </p>
      </div>

      <Field
        label="Demeanour"
        value={value.motionPrompt ?? ""}
        onChange={(v) => set({ motionPrompt: v })}
        placeholder="a calm person listening"
        hint="How it moves, not what it says. Used by LemonSlice only."
        disabled={disabled}
      />
    </div>
  );
}
