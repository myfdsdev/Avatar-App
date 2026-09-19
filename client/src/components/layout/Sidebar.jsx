import clsx from "clsx";
import { NavLink, useNavigate } from "react-router-dom";
import { authApi } from "@/services/auth.api";
import { useAuth } from "@/store/auth.store";

/**
 * Left navigation, grouped by concern.
 *
 * The grouping is Tavus's: the things you operate sit above the assets they are
 * built from, with account and reference material pushed to the bottom. The
 * look is LemonSlice's: rounded pills, a translucent active state, no rules
 * between items.
 *
 * Sections are data so adding a page is one line, and so the section a page
 * belongs to is stated rather than implied by where it happens to sit.
 *
 * Planned pages are listed and marked, not hidden: the shape of the product is
 * worth showing, but a link that goes nowhere is worse than one that says so.
 */
const SECTIONS = [
  {
    items: [{ to: "/", label: "Home", icon: HomeIcon, end: true }],
  },
  {
    title: "Avatar platform",
    items: [
      { to: "/avatars", label: "Avatars", icon: AvatarIcon },
      { to: "/conversations", label: "Conversations", icon: ChatIcon, soon: true },
      { to: "/analytics", label: "Usage", icon: ChartIcon },
    ],
  },
  {
    title: "Assets",
    items: [
      { to: "/studio", label: "Create", icon: PlusIcon },
      { to: "/personas", label: "Personas", icon: PersonaIcon, soon: true },
      { to: "/voices", label: "Voices", icon: VoiceIcon, soon: true },
    ],
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);

  const signOut = async () => {
    // Revoking server-side is best effort; the local session ends either way,
    // otherwise a network blip would leave someone stuck signed in.
    await authApi.logout().catch(() => {});
    clear();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col border-r border-border bg-bg">
      <div className="flex h-16 items-center gap-2 px-5">
        <span className="h-6 w-6 rounded bg-pink" aria-hidden />
        <span className="font-medium">Avatar App</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section, i) => (
          <div key={section.title || i} className={clsx(i > 0 && "mt-6")}>
            {section.title && (
              <p className="px-3 pb-2 text-label uppercase tracking-wide text-text-faint">
                {section.title}
              </p>
            )}
            {section.items.map(({ to, label, icon: Icon, end, soon }) =>
              soon ? (
                <span
                  key={to}
                  className="mb-0.5 flex cursor-default items-center gap-3 rounded px-3 py-2 text-ui text-text-faint"
                >
                  <Icon />
                  {label}
                  <span className="ml-auto rounded-full bg-surface-3 px-2 py-0.5 text-label">
                    Soon
                  </span>
                </span>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    clsx(
                      "mb-0.5 flex items-center gap-3 rounded px-3 py-2 text-ui transition-colors",
                      isActive
                        ? "bg-surface-active text-text"
                        : "text-text-muted hover:bg-surface-hover hover:text-text",
                    )
                  }
                >
                  <Icon />
                  {label}
                </NavLink>
              ),
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-label">
            {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ui">{user?.name || "Signed in"}</span>
            <span className="block truncate text-label text-text-faint">{user?.email}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-1 w-full rounded px-3 py-2 text-left text-ui text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

/* Inline so the sidebar carries no icon dependency for six glyphs. */
const stroke = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  className: "shrink-0",
};

function HomeIcon() {
  return (
    <svg {...stroke}>
      <path d="M2 6.5 8 2l6 4.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5Z" />
      <path d="M6 14V9h4v5" />
    </svg>
  );
}

function AvatarIcon() {
  return (
    <svg {...stroke}>
      <circle cx="8" cy="6" r="2.5" />
      <path d="M3 14c0-2.5 2.2-4 5-4s5 1.5 5 4" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg {...stroke}>
      <path d="M14 9.5a2 2 0 0 1-2 2H6l-3 2.5v-3H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...stroke}>
      <path d="M2 13h12" />
      <path d="M4.5 13V8M8 13V4m3.5 9V9.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...stroke}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function PersonaIcon() {
  return (
    <svg {...stroke}>
      <rect x="2.5" y="3" width="11" height="10" rx="2" />
      <path d="M5.5 6.5h5M5.5 9.5h3" />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg {...stroke}>
      <rect x="6" y="2" width="4" height="7" rx="2" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2" />
    </svg>
  );
}
