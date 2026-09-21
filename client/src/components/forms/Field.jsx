/**
 * Labelled text input.
 *
 * Extracted because the sign-in form and the studio were growing their own
 * copies, and they had already drifted apart on spacing and focus colour.
 */
export default function Field({ label, hint, value, onChange, type = "text", id, ...rest }) {
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="mt-5 first:mt-0">
      <label className="block text-ui text-text-muted" htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-10 w-full rounded border border-border bg-bg px-3 text-ui text-text outline-none transition-colors placeholder:text-text-faint focus:border-border-strong disabled:opacity-40"
        {...rest}
      />
      {hint && <p className="mt-2 text-ui text-text-faint">{hint}</p>}
    </div>
  );
}
