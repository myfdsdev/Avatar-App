import clsx from "clsx";

/**
 * A row of mutually exclusive options.
 *
 * A rounded pill track with a filled active segment - the same treatment the
 * sidebar uses for its active item, so selection reads consistently across the
 * app.
 *
 * @param {{value: string, onChange: (v: string) => void,
 *          options: Array<{value: string, label: string}>}} props
 */
export default function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            "rounded px-4 py-1.5 text-ui transition-colors",
            value === option.value
              ? "bg-surface-active text-text"
              : "text-text-muted hover:text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
