import clsx from "clsx";

/**
 * Rounded, quiet buttons.
 *
 * The primary is a solid pink pill; everything else is a translucent surface
 * with a lifted border, which is how LemonSlice treats secondary actions. No
 * offset shadows and no uppercase - that belonged to the previous visual
 * language.
 *
 * @param {object}  props
 * `inverse` is a light button for sitting on imagery, where pink would fight
 * the picture.
 *
 * @param {'primary'|'secondary'|'ghost'|'danger'|'inverse'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {React.ElementType} [props.as]  render as "a" or Link when needed
 */
export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  as: Tag = "button",
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded font-medium",
        "transition-colors duration-[var(--dur-fast)] ease-ease",
        "disabled:cursor-not-allowed disabled:opacity-40",
        SIZES[size],
        VARIANTS[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const SIZES = {
  sm: "h-8 px-3 text-ui",
  md: "h-10 px-4 text-ui",
  lg: "h-12 px-6 text-body",
};

const VARIANTS = {
  primary: "bg-pink text-text-inverse hover:bg-pink-soft",
  secondary: "bg-surface-active text-text border border-border-strong hover:bg-surface-3",
  ghost: "text-text-muted hover:bg-surface-hover hover:text-text",
  danger: "bg-red text-text hover:opacity-90",
  inverse: "bg-text text-text-inverse font-semibold hover:bg-white",
};
