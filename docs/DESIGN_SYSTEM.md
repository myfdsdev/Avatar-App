# Design system

LemonSlice's visual language, arranged in a sidebar dashboard.

Source of truth is `client/src/styles/tokens.css`. `tailwind.config.js` maps
those variables into utilities rather than redefining them, so there is exactly
one place to change a value.

Review it running at `/_design`.

## Two references, two jobs

**LemonSlice** supplies the look: a warm near-black surface stack, generous
corner radii, borders that are lifted rather than drawn, soft low shadows, and
Inter for everything including headings.

**Tavus's dashboard** supplies only the structure: a left sidebar grouped by
concern - what you operate above the assets it is built from, account and
reference material at the bottom - and a hero-led home page.

An earlier revision took Tavus's *visual* language too: square corners, hard 1px
rules, offset shadows, a display serif and uppercase mono labels. That was
replaced wholesale. If you find a sharp corner or a serif heading, it is a
leftover.

## Principles

1. **Rounded throughout.** 14px is the workhorse; cards go to 20px, the hero to
   28px. Nothing is square.
2. **Depth from surfaces, not shadow.** `--bg` → `--surface` → `--surface-2` →
   `--surface-3`. Shadows are soft and rarely needed.
3. **One family.** Inter for body and headings alike, weight 500 for headings.
   Geist Mono only for ids, metrics and the occasional section eyebrow.
4. **Quiet by default.** Secondary actions are translucent surfaces; pink is
   reserved for the one primary action on a screen.

## Type scale

| Role | Size | Line height | Weight |
|---|---|---|---|
| h1 | 36px | 1.25 | 500 |
| h2 | 24px | 1.3 | 500 |
| h3 | 18px | 1.4 | 500 |
| Body | 16px | 1.5 | 400 |
| UI | 14px | 1.5 | 400 / 500 |
| Label | 12px | 1.4 | 400 |

Headings carry `letter-spacing: -0.01em`. Loose leading is deliberate - this is
not a tight display face.

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0A0A0A` | page |
| `--surface` | `#141414` | cards, sidebar items |
| `--surface-2` / `--surface-3` | `#1C1C1C` / `#242424` | media wells, pills |
| `--surface-hover` / `--surface-active` | white at 4% / 8% | hover and selected states |
| `--text` | `#F4F3F0` | primary text |
| `--text-muted` | `#A3A3A3` | secondary text |
| `--text-faint` | `rgba(244,243,240,.5)` | hints, non-essential only |
| `--border` / `--border-strong` | `#242424` / `#343434` | card and control edges |
| `--pink` | `#F97583` | the primary action |
| `--green` | `#38F261` | live and positive states |
| `--purple` / `--blue` / `--yellow` | | categorical accents |

On black a border reads as a highlight, so borders are lifted, not darkened.
`*-dim` variants (pink, green at ~12%) back selected and status pills.

## Shape and space

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 10px | badges, inputs |
| `--radius` | 14px | buttons, nav items |
| `--radius-lg` | 20px | cards |
| `--radius-xl` | 28px | hero |
| `--container` | 1400px | content max width |
| `--gutter` | 48px | page side padding |
| `--sidebar-w` | 232px | |

The gutter is large on purpose and must not shrink below ~48px: below the
container width `mx-auto` has no margin to give, so the gutter is the only thing
keeping the page heading off the sidebar. At 40px it was getting clipped.

## Components

**`AppShell` + `Sidebar`** - fixed sidebar and a scrolling content column.
The sidebar has small uppercase section labels (Explore, Create, Assets, My
work), a collapse toggle beside the logo that shrinks it to icons
(`--sidebar-w-collapsed`, remembered per browser), and the account as a card at
the bottom whose menu holds Sign out. Only pages that exist are listed.
`AppShell wide` drops the container for
edge-to-edge pages. The call room renders outside the shell; a call wants the
window.

**Dashboard (`Home`)** - a wide hero carousel (a create slide, then one per
callable avatar), then horizontally scrolling shelves (`.scroll-row`) of 5:7
cards: Templates, which open the avatar creator pre-filled, and My avatars.
Shelf cards follow LemonSlice's avatar grid - the picture fills the card, the
name sits top-left over a shade, no caption underneath, and hovering darkens
the card and shows one round action (green "Start call", pink "Use
template").

**`AvatarCard`** - an avatar in "My avatars", on the dashboard shelf and the
Avatars page alike: name and "Last edited …" top-left, the ⋯ menu (share,
delete) top-right, and on hover a green Start call in the middle and a
Settings bar along the bottom. A talking clip plays while hovered. On touch
screens the controls are always shown.

**`AvatarCreator`** - the only way to create an avatar: a full-window page at
`/studio`, outside the shell. The face fills the middle at full height with a
tool bar under it; the right panel only picks the character - a Female/Male
toggle that filters the library below it - with "Create avatar" pinned to its
foot. Every Create action links to it, and creating lands on the avatar page.

**`AvatarDetail`** - one avatar at `/avatars/:id`, modelled on LemonSlice's
agent page: a rounded panel, the name with a rename pencil, Chat / Settings as
a segmented control and a menu (share, delete). Settings are sections - a
label with a coloured round icon (`orange`, `teal`, `purple` tokens) over a
card of rows - and save as they change; the header shows "Saving…/Saved".

**`PageHeader`** - title, description, optional action. Every page starts the
same way.

**`Card`** - rounded surface with one border. `flush` drops padding for media
that fills it; `hover` lifts the border for cards that are links.

**`Button`** - `primary` (pink), `secondary` (translucent surface with border),
`ghost`, `danger`, `inverse` (light, for sitting on imagery like the hero). Sizes `sm` / `md` / `lg`. Renders as any element via `as`.

**`Modal`** - portalled dialog. Closes on Escape and on a backdrop click that
both starts and ends on the backdrop, locks page scroll, and returns focus to
whatever opened it.

**`Field`**, **`Segmented`** - the shared text input and the pill-track option
row used for the studio's source switch.

**`MediaPreview`** - renders an image or a video depending on the URL, and falls
back to a label instead of a broken-image icon.

## Adding a component

Read tokens, never hex. If a value is missing, add a token rather than a literal.
Keep corners rounded and pink rare - those two rules carry most of the look.
