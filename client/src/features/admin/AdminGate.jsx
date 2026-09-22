import { useIsAdmin } from "./useIsAdmin";

/**
 * Shows admin pages to admins only. The server refuses non-admins anyway;
 * this just says so plainly instead of rendering a page of 403 errors.
 */
export default function AdminGate({ children }) {
  const { isAdmin, isLoading } = useIsAdmin();

  if (isLoading) return <p className="text-text-muted">Checking access…</p>;
  if (!isAdmin) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-h2">No access</h1>
        <p className="mt-2 text-text-muted">The admin area is for platform admins only.</p>
      </div>
    );
  }
  return children;
}
