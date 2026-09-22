import { useState } from "react";
import clsx from "clsx";

/**
 * Calls per day, as columns.
 *
 * One series, so one hue and no legend - the title names it. Columns are
 * capped at 24px with a 4px rounded top and a square baseline; gridlines are
 * hairlines. Each column is its own hover and focus target with a tooltip, and
 * the same numbers are one click away as a table, so nothing is hover-only.
 *
 * @param {{ days: Array<{ date: string, calls: number, minutes: number }>, timezone: string }} props
 */
export default function DailyChart({ days, timezone }) {
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(0, ...days.map((d) => d.calls));
  const { top, ticks } = scale(max);
  const total = days.reduce((sum, d) => sum + d.calls, 0);

  return (
    <figure>
      <figcaption className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">Calls per day</p>
          <p className="mt-0.5 text-ui text-text-muted">
            Last {days.length} days · {total.toLocaleString()} calls · {timezone}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="rounded-sm border border-border px-3 py-1.5 text-ui text-text-muted transition-colors hover:border-border-strong hover:text-text"
        >
          {asTable ? "Show chart" : "Show table"}
        </button>
      </figcaption>

      {asTable ? (
        <table className="mt-4 w-full text-ui">
          <thead>
            <tr className="text-text-faint">
              <th className="pb-2 text-left font-normal">Day</th>
              <th className="pb-2 text-right font-normal">Calls</th>
              <th className="pb-2 text-right font-normal">Minutes</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="py-2">{label(d.date, { weekday: "short" })}</td>
                <td className="py-2 text-right tabular-nums">{d.calls}</td>
                <td className="py-2 text-right tabular-nums">{d.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="mt-5 flex h-48 gap-3">
            {/* Y axis: clean integer ticks. */}
            <div className="relative w-8 shrink-0" aria-hidden>
              {ticks.map((t) => (
                <span
                  key={t}
                  style={{ bottom: `${(t / top) * 100}%` }}
                  className="absolute right-0 translate-y-1/2 text-label tabular-nums text-text-faint"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="relative flex-1">
              {ticks.map((t) => (
                <div
                  key={t}
                  aria-hidden
                  style={{ bottom: `${(t / top) * 100}%` }}
                  className="absolute inset-x-0 border-t border-border"
                />
              ))}

              <div className="absolute inset-0 flex items-end" role="list" aria-label="Calls per day">
                {days.map((d) => (
                  <Column key={d.date} day={d} top={top} />
                ))}
              </div>

              {total === 0 && (
                <p className="absolute inset-0 flex items-center justify-center text-ui text-text-faint">
                  No calls in this period
                </p>
              )}
            </div>
          </div>

          {/* X axis: every other day, so labels never collide. */}
          <div className="ml-11 mt-2 flex" aria-hidden>
            {days.map((d, i) => (
              <span key={d.date} className="flex-1 whitespace-nowrap text-center text-label text-text-faint">
                {(days.length - 1 - i) % 2 === 0 ? label(d.date) : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </figure>
  );
}

function Column({ day, top }) {
  const height = top ? (day.calls / top) * 100 : 0;
  const text = `${label(day.date, { weekday: "short" })}: ${day.calls} calls, ${day.minutes} minutes`;

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={text}
      className="group relative flex h-full flex-1 items-end justify-center outline-none"
    >
      <div
        style={{ height: `${height}%` }}
        className={clsx(
          "w-full max-w-[24px] rounded-t-[4px] bg-pink transition-opacity",
          "group-hover:opacity-80 group-focus-visible:opacity-80",
        )}
      />

      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-sm border border-border-strong bg-surface-3 px-3 py-2 shadow-lg group-hover:block group-focus-visible:block"
      >
        <p className="font-semibold">
          {day.calls} {day.calls === 1 ? "call" : "calls"}
        </p>
        <p className="text-label text-text-muted">
          {label(day.date, { weekday: "short" })} · {day.minutes} min
        </p>
      </div>
    </div>
  );
}

/** "22 Sep", from a YYYY-MM-DD already in the server's timezone. */
function label(ymd, extra = {}) {
  const [y, m, d] = ymd.split("-").map(Number);
  // Built at noon UTC and formatted in UTC, so no local offset can shift the day.
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...extra,
  });
}

/** A round top for the axis and its ticks - integers, since calls are counted. */
function scale(max) {
  const step = niceStep(Math.max(max, 4) / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

function niceStep(raw) {
  if (raw <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}
