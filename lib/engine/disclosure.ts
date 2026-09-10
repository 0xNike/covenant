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
 * ---------------------------------------------------------------------------
 * WHAT THE LENDER CAN WORK OUT FROM THIS, STATED HONESTLY
 * ---------------------------------------------------------------------------
 *
 * an earlier version of this comment withheld `rate` on the ground that it is a
 * strictly invertible function of the KPI, "so handing the lender the rate hands
 * it the leverage". that reasoning was correct and the conclusion drawn from it
 * was not, because `haircutBps`, which this function does disclose, has exactly
 * the same property. apollo found it. the arithmetic, from `haircutBpsFor` in
 * ./kernel.ts against the constants in ./policy.ts:
 *
 *   above   = clamp(kpiX100 - 100, 0, 500)
 *   haircut = 1500 + floor(3500 * above / 500) + addon
 *           = 1500 + 7 * above + addon
 *
 * `above` is an integer, so the floor is exact and the multiplication is lossless.
 * `addon` is 0, 250 or 1000 and is fixed by the verdict, which is disclosed. the
 * clamp to [1000, 7500] never binds: the range actually reachable is
 * [1500, 6000]. so
 *
 *   kpiX100 = (haircut - 1500 - addon) / 7 + 100
 *
 * exactly, for all 501 leverage values in the published band. checked: pass with
 * 2200 bps gives 2.00x, breach with 4950 bps gives 4.50x, which are the two
 * fixtures. **the lender learns the borrower's net leverage exactly, the moment
 * the agent clicks run.**
 *
 * this is not fixed by withholding the haircut. the haircut is the number the
 * lender lends against and is the entire product. it is a wording defect, not a
 * structural one.
 *
 * so the claim this module actually supports, which is still the claim worth
 * making:
 *
 *   the lender learns the verdict, the haircut, and therefore the exact net
 *   leverage ratio. it does not learn revenue, EBITDA, total debt, cash or
 *   interest expense. recovering leverage yields one equation,
 *   (totalDebt - cash) / ebitda, in three unknowns, which does not determine any
 *   of them. revenue and interest expense enter only through the EBITDA margin
 *   and interest cover tests, and the verdict exposes those as inequalities
 *   against a published threshold, never as values.
 *
 * the boundary is around the financials, not around the KPI. see
 * `PROJECT_BRIEF.md` section 3 step 5 and `DECISIONS.md` D17, which already say
 * this and which the old comment here contradicted.
 *
 * ---------------------------------------------------------------------------
 * WHY EACH WITHHELD FIELD IS STILL WITHHELD
 * ---------------------------------------------------------------------------
 *
 *   tests   the individual observations are the borrower's leverage, interest
 *           cover and margin as values. the verdict reduces the last two to a
 *           pass or fail against a threshold the lender already agreed, which is
 *           strictly less than the ratios themselves.
 *   kpi     withheld as a value even though it is recoverable from the haircut.
 *           not disclosing it directly keeps this payload to what the facility
 *           actually needs, and a field that is present is read by every
 *           downstream consumer, while one that has to be reconstructed is not.
 *           this is hygiene, and it is deliberately NOT claimed as protection.
 *   rate    same shape as the haircut, and public in any case once
 *           `FixedRate.setRate` lands on chain. withheld here for the same
 *           hygiene reason and, again, not claimed as protection.
 *
 * ---------------------------------------------------------------------------
 * THE REST OF THE PAYLOAD, CHECKED FOR THE SAME DEFECT
 * ---------------------------------------------------------------------------
 *
 *   advanceRateBps  10000 - haircutBps. exactly redundant with the haircut, so
 *                   it opens no channel the haircut has not already opened.
 *   runId           FNV-1a over policyId, borrower, period, verdict, haircutBps
 *                   and advanceRateBps only. every input to it is disclosed
 *                   here, so it commits to nothing further and cannot be
 *                   searched for a borrower figure. see ./kernel.ts.
 *   computedAt      a clock reading. not a function of the inputs.
 *   policyId,
 *   engine          fixed strings describing the terms and the implementation.
 *   borrower,
 *   period          disclosed by design. the lender knows who it lends against.
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
