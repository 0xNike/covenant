// covenant. the counterparty boundary, as a function.
//
// this is the second of the two boundaries described in lib/engine/types.ts. it
// is not the enclave boundary. it decides what one counterparty is entitled to
// see of another's covenant report, and it holds whether or not the engine
// behind it is a real TEE.
//
// it is a function and not a component prop, and not a css class, and not a
// component choosing which rows to render, for one reason: a view that receives
// the whole result and renders half of it has still received the whole result.
// the other half is then sitting in the page source, in the RSC payload, or in
// a network response, and anyone with a browser can read it. building the
// disclosure explicitly, field by field, on the server, means there is no copy
// of the borrower's figures anywhere on the lender's side to find.
//
// written as an explicit construction rather than a destructuring omission on
// purpose. `const { tests, kpi, rate, ...rest } = result` would silently
// disclose any field added to `EngineResult` later. this way a new field is
// undisclosed until someone writes a line to disclose it, and that line is a
// diff a reviewer can see.

import type { EngineResult, LenderDisclosure } from "./types";

/**
 * narrow a full engine result to what the lender receives.
 *
 * withheld, and each for a stated reason:
 *   tests   the individual covenant observations restate the borrower's
 *           leverage, interest cover and margin in ratio form.
 *   kpi     net leverage is the borrower's figure, not the lender's.
 *   rate    the coupon rate is a strictly invertible function of the KPI over
 *           the bounds published at issuance, so handing the lender the rate
 *           hands it the leverage. it is withheld here for that reason. note
 *           that the same rate is public once `FixedRate.setRate` lands on
 *           chain, which is a property of the on-chain leg and not something
 *           this function can undo. see the note in the report to hermes.
 */
export function toLenderDisclosure(result: EngineResult): LenderDisclosure {
  return {
    runId: result.runId,
    computedAt: result.computedAt,
    engine: result.engine,
    policyId: result.policyId,
    borrower: result.borrower,
    period: result.period,
    verdict: result.verdict,
    haircutBps: result.haircutBps,
    advanceRateBps: result.advanceRateBps,
  };
}
