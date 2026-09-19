import Sidebar from "./Sidebar";

/**
 * Sidebar plus a scrolling content column.
 *
 * Signed-out routes render outside this, which is why it lives around the
 * authenticated routes rather than around the whole router.
 */
export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div className="pl-sidebar">
        <main className="mx-auto max-w-container px-gutter py-12">{children}</main>
      </div>
    </div>
  );
}
