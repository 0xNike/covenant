// covenant. shared presentation for the two views.
//
// everything here is presentational and knows nothing about borrower financials.
// the lender view imports from this file, so this file must stay that way: no
// fixtures, no `EngineInputs`, no formatting helper that only an input needs.
// if something here ever takes an input, the lender bundle starts carrying code
// that knows their shape, which is a step in the wrong direction even before it
// carries a value.

import type { EngineDescriptor, CovenantStatus } from "@/lib/engine/types";

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
  return (
    <div
      className={`flex flex-col gap-1 border-l-4 pl-3 ${
        status ? statusClasses(status) : "border-zinc-400 dark:border-zinc-600"
      }`}
    >
      <span className="text-zinc-500">{label}</span>
      <span className="text-4xl leading-none font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function VerdictBadge({ status }: { status: CovenantStatus }) {
  const label =
    status === "pass"
      ? "covenant pass"
      : status === "watch"
        ? "covenant watch"
        : "covenant breach";
  return (
    <div
      className={`w-fit border-2 px-4 py-2 text-2xl font-semibold ${statusClasses(status)}`}
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
