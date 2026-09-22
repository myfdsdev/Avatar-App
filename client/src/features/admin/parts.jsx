import clsx from "clsx";
import Card from "@/components/common/Card";

/**
 * A stat tile: a label, a value, and one line of context under it. `live`
 * adds the green Live pill, the same one the Usage page uses.
 */
export function Stat({ label, value, detail, live = false }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-ui text-text-muted">{label}</p>
        {live && <span className="rounded-full bg-green-dim px-2.5 py-1 text-label text-green">Live</span>}
      </div>
      <p className="mt-2 text-h2 font-semibold">{value}</p>
      {detail && <p className="mt-1 text-ui text-text-faint">{detail}</p>}
    </Card>
  );
}

export function Th({ children, align = "left" }) {
  return (
    <th className={clsx("pb-2 font-normal", align === "right" ? "text-right" : "text-left")}>{children}</th>
  );
}
