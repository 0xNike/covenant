// covenant. the published run, held server side.
//
// the lender view is a separate document from the agent console, so the two
// cannot pass a value to each other in the browser. the agent publishes a run
// here and the lender reads the disclosure of it. this is the only shared state
// in the engine leg.
//
// ---------------------------------------------------------------------------
// WHAT THIS DELIBERATELY DOES NOT HOLD
// ---------------------------------------------------------------------------
//
// the borrower's financials. `EngineResult` does not contain them, this store
// holds `EngineResult` and nothing else, and the run route discards its request
// body once the engine has read it. so there is no endpoint that could serve
// the inputs, no cache that could be scraped for them, and nothing to leak if
// the disclosure endpoint were left open, which it is.
//
// that is a stronger claim than "the lender view does not render them", and it
// is the one the demo makes.
//
// in-memory and per-process, which is correct for a single-operator console on
// one machine. a real deployment would key this by facility and persist it. the
// interface below would not change.
//
// ---------------------------------------------------------------------------
// WHY THE VALUE HANGS OFF globalThis AND NOT A MODULE-LEVEL `let`
// ---------------------------------------------------------------------------
//
// next bundles route handlers and server components into separate module
// graphs. a plain `let` here is therefore not one variable, it is one per graph:
// POST /api/engine/run wrote to its copy and the /lender server component read
// its own, which was always null. the endpoint served the report correctly while
// the page it belongs to server-rendered "no covenant report published", and the
// only reason the screen ever filled in was the client poll arriving afterwards.
//
// that was measured on the running server, not assumed: /api/engine/disclosure
// returned a full disclosure at the same moment /lender rendered its empty
// state. a symbol on globalThis is one slot per process no matter how many times
// the module is instantiated, so the page and the endpoints now read the same
// run. the exported interface is unchanged and no caller was touched.

import type { EngineResult } from "./types";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/engine/store.ts is server side. importing it into a client component would ship the full engine result to the browser.",
  );
}

interface Slot {
  current: EngineResult | null;
}

// Symbol.for, so every module instance in the process resolves the same key.
const SLOT_KEY = Symbol.for("covenant.engine.publishedRun");

function slot(): Slot {
  const g = globalThis as unknown as Record<symbol, Slot | undefined>;
  const existing = g[SLOT_KEY];
  if (existing) return existing;
  const created: Slot = { current: null };
  g[SLOT_KEY] = created;
  return created;
}

/** replace the published run. the console publishes one run at a time. */
export function publishRun(result: EngineResult): void {
  slot().current = result;
}

/** the current published run, or null before the agent has run the engine. */
export function readPublishedRun(): EngineResult | null {
  return slot().current;
}

/** used by the console to withdraw a run, so the lender view goes back to empty. */
export function clearPublishedRun(): void {
  slot().current = null;
}
