// covenant. the credit agreement's published terms, as the engine applies them.
//
// these are terms of the facility, agreed between the lender and the borrower
// and published at issuance. they are not deployment configuration, so they do
// not come from .env: an operator changing a maintenance covenant by editing an
// environment variable is exactly the arrangement this project replaces. the
// network, the resolver, the factory and the four accounts are configuration and
// they do live in .env, in lib/config.ts.
//
// the leverage bounds the haircut interpolates between are NOT redeclared here.
// they are `IMPACT_DATA` in lib/ats/note-terms.ts, the same bounds that were
// pinned at issuance and that `rateForKpi` prices against. one set of published
// bounds drives both the coupon rate and the haircut, which is what makes the
// two numbers on screen consistent rather than merely adjacent.
//
// under CRE this file is compiled into the workflow binary and is therefore
// visible, not confidential. that is correct and matches the template's own
// statement of what a TEE hides: "the logic is not confidential, the data is"
// (specs/04 section 4). the lender is entitled to know the covenant it agreed.

import { IMPACT_DATA } from "@/lib/ats/note-terms";

export interface CovenantPolicy {
  /** stable id, shown to both parties so they can agree on which terms ran. */
  id: string;
  /** maintenance covenant, net leverage, scaled by 100. 400 is 4.00x. */
  netLeverageMaxX100: number;
  /** maintenance covenant, interest cover, scaled by 100. 250 is 2.50x. */
  interestCoverMinX100: number;
  /** maintenance covenant, EBITDA margin, in basis points. 1000 is 10.00 percent. */
  ebitdaMarginMinBps: number;
  /**
   * headroom band. a test inside this fraction of its threshold is a watch
   * rather than a pass. 1000 is 10.00 percent of the threshold value.
   */
  watchBandBps: number;
  /** haircut at the published leverage floor, `IMPACT_DATA.maxDeviationFloor`. */
  haircutAtFloorBps: number;
  /** haircut at the published leverage cap, `IMPACT_DATA.maxDeviationCap`. */
  haircutAtCapBps: number;
  /** added when the facility is on watch. */
  watchAddOnBps: number;
  /** added when any covenant is breached. */
  breachAddOnBps: number;
  /** the haircut never goes below this, however good the credit looks. */
  haircutMinBps: number;
  /** or above this, however bad. */
  haircutMaxBps: number;
}

/**
 * the terms of the covenant facility.
 *
 * the leverage covenant sits at 4.00x, above the 3.00x baseline the coupon
 * prices from (`IMPACT_DATA.baseLine`) and below the 6.00x cap. so a borrower
 * can drift off baseline, and pay more for it, before it breaches anything.
 * that gap is what makes the rate and the verdict two different statements
 * rather than one restated twice.
 */
export const COVENANT_POLICY: CovenantPolicy = {
  id: "cvnt-policy-1",

  netLeverageMaxX100: 400, // 4.00x
  interestCoverMinX100: 250, // 2.50x
  ebitdaMarginMinBps: 1000, // 10.00 percent

  watchBandBps: 1000, // 10.00 percent of the threshold

  // 15.00 percent haircut at 1.00x leverage, 50.00 percent at 6.00x, linear
  // between. an 85 percent advance against a performing private credit note and
  // a 50 percent advance against a stressed one is the range this market
  // actually trades in, and it is a long way from the ~2 percent a treasury
  // takes. that difference is the reason for the asset class choice in
  // PROJECT_BRIEF.md section 4.
  haircutAtFloorBps: 1500,
  haircutAtCapBps: 5000,

  watchAddOnBps: 250,
  breachAddOnBps: 1000,

  haircutMinBps: 1000,
  haircutMaxBps: 7500,
};

/** the leverage bounds the haircut interpolates between. imported, never redeclared. */
export const HAIRCUT_LEVERAGE_BOUNDS = {
  floorX100: IMPACT_DATA.maxDeviationFloor,
  capX100: IMPACT_DATA.maxDeviationCap,
} as const;
