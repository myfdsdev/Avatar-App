import clsx from "clsx";
import Sidebar from "./Sidebar";
import { useUi } from "@/store/ui.store";

/**
 * Sidebar plus a scrolling content column.
 *
 * Signed-out routes render outside this, which is why it lives around the
 * authenticated routes rather than around the whole router.
 *
 * `wide` drops the reading-width container for pages built edge to edge, like
 * the dashboard's full-width hero. Everything else keeps the container.
 */
export default function AppShell({ children, wide = false }) {
  const collapsed = useUi((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div
        className={clsx(
          "transition-[padding] duration-200 ease-ease",
          collapsed ? "pl-[var(--sidebar-w-collapsed)]" : "pl-sidebar",
        )}
      >
        <main className={wide ? "px-5 pb-12 pt-4" : "mx-auto max-w-container px-gutter py-9"}>
          {children}
        </main>
      </div>
    </div>
  );
}
