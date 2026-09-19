import clsx from "clsx";

/**
 * The surface everything sits on.
 *
 * Replaces the earlier WindowCard, which drew a retro window frame with a title
 * strip and square corners. This is LemonSlice's treatment instead: rounded,
 * a single lifted border, depth from the surface stack rather than shadow.
 *
 * @param {object} props
 * @param {string} [props.title]     small heading inside the card
 * @param {React.ReactNode} [props.action]  right-aligned control beside the title
 * @param {boolean} [props.flush]    drop padding, for media that fills the card
 * @param {boolean} [props.hover]    lift on hover, for cards that are links
 */
export default function Card({
  title,
  action,
  flush = false,
  hover = false,
  className,
  children,
  ...rest
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-border bg-surface",
        flush ? "overflow-hidden" : "p-5",
        hover && "transition-colors duration-[var(--dur-fast)] hover:border-border-strong",
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <div className={clsx("flex items-center justify-between gap-3", flush && "px-5 pt-5")}>
          {title ? <h3 className="text-ui text-text-muted">{title}</h3> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
