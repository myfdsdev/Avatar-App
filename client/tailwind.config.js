/**
 * Tailwind reads the CSS variables from src/styles/tokens.css rather than
 * redefining them. Editing a colour there changes it everywhere, including in
 * plain CSS, with no second place to keep in sync.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        "surface-hover": "var(--surface-hover)",
        "surface-active": "var(--surface-active)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-faint": "var(--text-faint)",
        "text-inverse": "var(--text-inverse)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "border-faint": "var(--border-faint)",
        pink: "var(--pink)",
        "pink-soft": "var(--pink-soft)",
        "pink-dim": "var(--pink-dim)",
        green: "var(--green)",
        "green-dim": "var(--green-dim)",
        purple: "var(--purple)",
        blue: "var(--blue)",
        yellow: "var(--yellow)",
        orange: "var(--orange)",
        teal: "var(--teal)",
        red: "var(--red)",
        "red-dim": "var(--red-dim)",
        "red-line": "var(--red-line)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        label: ["var(--text-label)", { lineHeight: "1.4" }],
        sm: ["var(--text-sm)", { lineHeight: "1.5" }],
        ui: ["var(--text-ui)", { lineHeight: "1.5" }],
        body: ["var(--text-body)", { lineHeight: "var(--text-body-lh)" }],
        h3: ["var(--text-h3)", { lineHeight: "1.4" }],
        h2: ["var(--text-h2)", { lineHeight: "1.3" }],
        h1: ["var(--text-h1)", { lineHeight: "var(--text-h1-lh)" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        lg: "var(--shadow-lg)",
      },
      maxWidth: { container: "var(--container)" },
      spacing: { sidebar: "var(--sidebar-w)", gutter: "var(--gutter)" },
      transitionTimingFunction: { ease: "var(--ease)" },
    },
  },
  plugins: [],
};
