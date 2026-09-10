// covenant. the lender's only client code.
//
// this module is the entire engine surface the lender's bundle is allowed to
// carry. one function, one endpoint, one return type, and that type has no field
// for a borrower figure.
//
// it is separate from lib/engine/client.ts on purpose. that module holds
// `runEngine`, which names `EngineInputs` and posts to /api/engine/run. sharing
// one module between the two views meant the lender's bundle carried the agent's
// call as dead code: no borrower value in it, but the shape of the inputs and the
// path that accepts them, sitting in a file served to the wrong counterparty.
// there is no reason for the lender to ship either, and the split makes the claim
// on camera exact rather than nearly true. a judge can read this file in full and
// see the whole of what the lender's side can do.

import { readError } from "./call-error";
import type { LenderDisclosure } from "./types";

/**
 * the lender's only call. the response body is the whole of what the lender
 * receives, which is the point a judge should check in the network tab.
 */
export async function fetchDisclosure(
  signal?: AbortSignal,
): Promise<LenderDisclosure | null> {
  const res = await fetch("/api/engine/disclosure", {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as { disclosure: LenderDisclosure | null };
  return body.disclosure;
}
