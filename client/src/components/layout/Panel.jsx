/**
 * The rounded, bordered panel a page sits in inside the shell - LemonSlice's
 * treatment for an avatar's own pages (its settings, its call).
 */
export default function Panel({ children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] rounded-xl border border-border bg-surface">{children}</div>
  );
}
