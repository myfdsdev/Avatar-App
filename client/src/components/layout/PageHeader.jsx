/**
 * Title, optional description, optional right-hand action.
 *
 * Every page starts the same way, so this is a component rather than a repeated
 * flex row that slowly drifts out of alignment across pages.
 */
export default function PageHeader({ title, description, action }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-6">
      <div>
        <h1>{title}</h1>
        {description && <p className="mt-1.5 text-text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
