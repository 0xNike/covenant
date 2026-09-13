// covenant. shared presentation for the two views.
//
// everything here is presentational and knows nothing about borrower financials.
// the lender view imports from this file, so this file must stay that way: no
// fixtures, no `EngineInputs`, no formatting helper that only an input needs.
// if something here ever takes an input, the lender bundle starts carrying code
// that knows their shape, which is a step in the wrong direction even before it
// carries a value.
//
// ---------------------------------------------------------------------------
// WHY THIS LIVES IN app/components AND NOT IN app/agent
// ---------------------------------------------------------------------------
//
// it used to sit in the agent's own directory, which meant
// app/lender/lender-view.tsx imported from there. apollo flagged it: it leaked nothing,
// but it read as the lender depending on the agent, and the rule above was a
// comment in a file whose location argued the opposite. a module both sides
// import is shared, so it sits in a neutral directory and neither side owns it.
//
// the move does not enforce the rule, and nothing in typescript can. what
// enforces it is the disclosure scan against a PRODUCTION build: fetch /lender,
// pull every chunk it loads, grep for the fixture values and for the field names
// of `EngineInputs`, and run the identical scan against /agent as a control
// that must return hits. a negative result without that control proves only that
// the search was broken. dev-mode chunk boundaries are not production chunk
// boundaries, so the scan has to run against `next build` output to mean
// anything. re-run it after any change to this file.

import { useEffect, useRef, useState } from "react";
import type { EngineDescriptor, CovenantStatus } from "@/lib/engine/types";

/**
 * the height of the borrower-financials block, on BOTH screens.
 *
 * the agent's filing form and the lender's empty panel are the same shape in the
 * same position, and that is the whole reveal: the eye compares two panels with
 * the same heading, one dense with numbers and one holding nothing. if they
 * drift apart by a row the comparison stops reading and the shot is just two
 * unrelated boxes.
 *
 * it is one exported constant rather than the same class typed twice, so a field
 * added to the filing form cannot silently desynchronise the pair. 22rem clears
 * the form's natural height (seven rows plus the fixture buttons, about 18rem)
 * so both sides sit at exactly this value.
 */
export const FINANCIALS_BLOCK_HEIGHT = "min-h-[22rem]";

/**
 * one class per state, and the three are not near neighbours. a viewer at 1.5x
 * with no sound has about two seconds, so pass, watch and breach are green,
 * amber and red, with different words and different weights.
 *
 * written out in full rather than composed from a colour name, because tailwind
 * only ships classes it can find as literal strings in the source.
 */
export function statusClasses(status: CovenantStatus): string {
  switch (status) {
    case "pass":
      return "border-emerald-600 text-emerald-700 dark:text-emerald-400";
    case "watch":
      return "border-amber-600 text-amber-700 dark:text-amber-400";
    case "breach":
      return "border-red-600 text-red-700 dark:text-red-400";
  }
}

/** the same three states, colour only, for text that is not inside a bordered box. */
export function statusTextClasses(status: CovenantStatus): string {
  switch (status) {
    case "pass":
      return "text-emerald-700 dark:text-emerald-400";
    case "watch":
      return "text-amber-700 dark:text-amber-400";
    case "breach":
      return "text-red-700 dark:text-red-400";
  }
}

export function Panel({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: "agent" | "lender";
  children: React.ReactNode;
}) {
  const border =
    accent === "lender"
      ? "border-sky-700 dark:border-sky-500"
      : accent === "agent"
        ? "border-zinc-900 dark:border-zinc-100"
        : "border-zinc-300 dark:border-zinc-700";
  return (
    <section className={`flex flex-col gap-3 border ${border} p-4`}>
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-zinc-500">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export function Rows({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">{children}</dl>
  );
}

export function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: CovenantStatus;
}) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className={tone ? statusTextClasses(tone) : ""}>{value}</dd>
    </>
  );
}

/**
 * true for a short beat after `value` changes, and false on first render.
 *
 * the lender's haircut moves because the agent clicked something in another
 * document, so there is no gesture on the lender's side to explain it. at 1.5x
 * with no sound a 4xl number swapping one set of digits for another is easy to
 * miss entirely. the flash gives the change an edge the eye catches.
 *
 * deliberately not triggered on mount: the first paint of a number is already an
 * arrival and does not need announcing, and flashing on mount would fire on
 * every navigation for no reason.
 */
function useChanged(value: string): boolean {
  const previous = useRef<string | null>(null);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const first = previous.current === null;
    const moved = !first && previous.current !== value;
    previous.current = value;
    if (!moved) return;
    setChanged(true);
    const id = setTimeout(() => setChanged(false), 1200);
    return () => clearTimeout(id);
  }, [value]);

  return changed;
}

/**
 * the numbers a viewer has to read from across a room. the haircut and the
 * advance rate are the only two the lender ever gets, so they are the only two
 * rendered at this size on either side.
 */
export function Metric({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: CovenantStatus;
}) {
  const changed = useChanged(value);
  return (
    <div
      className={`flex flex-col gap-1 border-l-4 pl-3 transition-colors duration-300 ${
        status ? statusClasses(status) : "border-zinc-400 dark:border-zinc-600"
      } ${changed ? "bg-yellow-200/70 dark:bg-yellow-300/25" : "bg-transparent"}`}
    >
      <span className="text-zinc-500">{label}</span>
      <span className="text-4xl leading-none font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

/**
 * pass, watch and breach at a size that survives a scrub at 1.5x.
 *
 * filled rather than outlined. an outlined badge reads as a label, a filled one
 * reads as a state, and the difference matters when a viewer has two seconds and
 * the whole point of the frame is which of three states the facility is in.
 */
export function VerdictBadge({ status }: { status: CovenantStatus }) {
  const label =
    status === "pass"
      ? "covenant pass"
      : status === "watch"
        ? "covenant watch"
        : "covenant breach";
  const fill =
    status === "pass"
      ? "border-emerald-600 bg-emerald-600 text-white"
      : status === "watch"
        ? "border-amber-500 bg-amber-500 text-black"
        : "border-red-600 bg-red-600 text-white";
  const changed = useChanged(status);
  return (
    <div
      className={`w-fit border-2 px-4 py-2 text-2xl font-semibold tracking-tight uppercase ${fill} ${
        changed ? "ring-4 ring-yellow-300 ring-offset-2" : ""
      }`}
    >
      {label}
    </div>
  );
}

/**
 * where the computation ran and what vouches for it, rendered from the result
 * rather than written into the page. when a CRE run populates the attestation
 * this line changes on its own and no component is edited.
 *
 * "none" is the honest word for a local service and it is printed in full.
 * nothing in this application calls the local engine an enclave.
 */
export function EngineStamp({ engine }: { engine: EngineDescriptor }) {
  const a = engine.attestation;
  return (
    <Rows>
      <Row label="engine" value={engine.label} />
      <Row
        label="attestation"
        value={
          a === null ? (
            <span className="text-zinc-500">
              none. this computation is not attested and did not run in an
              enclave.
            </span>
          ) : (
            <span>
              {a.detail}
              {a.simulated ? ", simulated" : ""}
            </span>
          )
        }
      />
    </Rows>
  );
}
