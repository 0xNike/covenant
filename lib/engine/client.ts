// covenant. how the agent's console talks to the engine.
//
// the console does not import an engine implementation, it calls this. the
// implementation is resolved server side by lib/engine/registry.ts, so the
// browser never learns and never assumes which one ran: it is told, in the
// descriptor the result carries.
//
// this is the file that would have to change if the interface were wrong. it
// does not change for CRE. a CRE-backed run is the same POST, the same response
// shape, a longer wait and a populated attestation.
//
// the lender's side does not import this module. it imports
// lib/engine/disclosure-client.ts, which knows one endpoint and no input shape.

import { readError } from "./call-error";
import type { EngineInputs, EngineResult } from "./types";

export { EngineCallError } from "./call-error";

/**
 * run the engine over a set of borrower financials and publish the result for
 * the lender view to read.
 *
 * the inputs are in the request body and nowhere else. the server hands them to
 * the engine, keeps the result, and retains no copy of them. see
 * lib/engine/store.ts.
 */
export async function runEngine(inputs: EngineInputs): Promise<EngineResult> {
  const res = await fetch("/api/engine/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inputs }),
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as { result: EngineResult };
  return body.result;
}

/** withdraw the published run, so the lender view returns to empty. */
export async function withdrawRun(): Promise<void> {
  const res = await fetch("/api/engine/run", {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
}
