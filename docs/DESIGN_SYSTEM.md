# Design system

Tavus's visual language, rendered on LemonSlice's near-black palette.

Source of truth is `client/src/styles/tokens.css`. `tailwind.config.js` maps
those variables into utilities rather than redefining them, so there is exactly
one place to change a colour.

Review it running at `/_design`.

## The two references

**Tavus** contributes structure. Its defining trait is sharpness: every corner
is square, every edge is a hard 1px rule, and shadows are offset blocks with
zero blur. Display type is a high-contrast serif set at line-height exactly 1.0
with one or two words italicised. Labels are uppercase and monospaced. Content
sits inside retro window frames with a title strip.

**LemonSlice** contributes the palette: `#0A0A0A` rather than pure black, and
`#F4F3F0` rather than pure white. Both are slightly warm, which keeps large dark
areas from looking blue.

The combination works because Tavus's accent hues were chosen to sit on cream at
high contrast, and they read louder still on black.

## Invariants

Three rules carry the identity. Breaking any one makes it look like a generic
dark dashboard:

1. **`border-radius: 0` everywhere.** Enforced globally in `globals.css` and by
   restricting Tailwind's radius scale. `rounded-full` survives only for status
   dots and avatar crops.
2. **Shadows are offset, never blurred.** `--shadow-hard` is `3px 3px 0 #000`.
   No glows, no soft elevation.
3. **Labels are uppercase mono.** Buttons, card title strips and section
   eyebrows all use `.label-mono`. Sentence-case UI text is Inter.

## Fonts

Tavus licenses all three of its families commercially and they cannot be
redistributed. These are the closest freely licensed equivalents:

| Tavus | Role | Replacement | Why |
|---|---|---|---|
| Suisse Intl | body, UI | **Inter** | same neo-grotesque class; LemonSlice also uses it |
| PerfectlyNineties | display | **Instrument Serif** | high-contrast editorial serif with a true italic |
| FK Raster Grotesk Compact | micro-labels | **Geist Mono** | technical uppercase feel; LemonSlice also uses it |

Only `fonts.css` changes if the originals are licensed later.

## Type scale

| Role | Family | Size | Line height |
|---|---|---|---|
| Display | Instrument Serif 400 | `clamp(40px, 6vw, 78px)` | **1.0** |
| Display accent | Instrument Serif *italic* | inherit | inherit |
| H2 | Instrument Serif 400 | `clamp(32px, 4.5vw, 62px)` | 1.0 |
| Body | Inter 400 | 19.6px | 1.5 |
| UI | Inter 500 | 14px | 1.4 |
| Label | Geist Mono 400 uppercase | 12.5px | 1.0, +0.02em |

Line-height 1.0 on display is deliberate and is much of the character. Do not
loosen it.

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0A0A0A` | page |
| `--surface` | `#141414` | cards |
| `--surface-2` / `--surface-3` | `#1C1C1C` / `#242424` | hover, nested fills |
| `--text` | `#F4F3F0` | primary text |
| `--text-muted` | `#A3A3A3` | secondary text |
| `--text-faint` | `rgba(244,243,240,.5)` | non-essential only |
| `--border` | `#2E2E2E` | card and divider rules |
| `--border-strong` | `#4A4A4A` | interactive edges |
| `--pink` | `#FF6183` | primary action, active state |
| `--green` | `#38F261` | positive, live indicators |
| `--lavender` / `--yellow` | `#D0C9ED` / `#FFF130` | categorical accents |

On black, borders must be lifted rather than darkened - Tavus's `#140206` edge
becomes `#2E2E2E`.

### Contrast

| Pair | Ratio | WCAG AA |
|---|---|---|
| `--text` on `--bg` | ~18:1 | passes |
| `--text-muted` on `--bg` | ~8:1 | passes |
| `--text-inverse` on `--pink` | ~9:1 | passes |
| `--text-inverse` on `--green` | ~13:1 | passes |
| `--text-faint` on `--bg` | ~4.3:1 | large text only |

`--text-faint` is restricted to decorative and non-essential text.

## Components

**`Button`** (`components/common/Button.jsx`)
Square, 1px border, uppercase mono. `lg` is 21/18px padding, `sm` is 18/11px.
Variants: `primary` (pink), `success` (green), `danger`, `ghost`. Hover shifts
-3px on both axes and drops `--shadow-hard`; active returns to rest. Renders as
any element via `as`, for router links.

**`WindowCard`** (`components/common/WindowCard.jsx`)
The retro window frame, and the most reused component in the app - avatar tiles,
the call surface, studio steps, analytics panels. Props: `label` for the title
strip, `actions` for its right side, `dots` for the two circles, `inset` for the
recessed shadow, `flush` to drop body padding when video or an image fills it.

**`NavBar`** (`components/layout/NavBar.jsx`)
One bordered bar divided into square segments by 1px rules, each label preceded
by a small filled block that turns pink when active.

## Adding a component

Read tokens, never hex. If a value is missing, add a token rather than a literal.
Use `.label-mono` for any uppercase label. Keep corners square and shadows
unblurred - those two rules are the whole look.
