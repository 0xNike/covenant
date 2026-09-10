// covenant. two borrower filings, fixed.
//
// typing seven numbers into a form on camera is thirty seconds of nothing. these
// two load with one click and produce exactly the values the rest of the build
// is pinned to.
//
// they are chosen so `assess` returns net leverage 2.00x and 4.50x exactly,
// which are `DEMO_KPI_VALUES.improved` and `DEMO_KPI_VALUES.deteriorated` in
// lib/ats/note-terms.ts. those map through `rateForKpi` to 6.00 percent and
// 12.00 percent, the two rates gamma posts with `FixedRate.setRate`. so the
// number on the engine screen and the number in the transaction are the same
// number, and neither was typed by hand.
//
// the arithmetic, so it can be checked without running anything:
//
//   improved      net debt 45,000,000 - 5,000,000 = 40,000,000
//                 40,000,000 / 20,000,000 EBITDA  = 2.00x    -> 6.00 percent
//                 margin  20,000,000 / 120,000,000 = 16.66 percent, pass
//                 cover   20,000,000 /   6,000,000 =  3.33x,        pass
//                 verdict pass, haircut 22.00 percent, advance 78.00 percent
//
//   deteriorated  net debt 76,000,000 - 4,000,000 = 72,000,000
//                 72,000,000 / 16,000,000 EBITDA  = 4.50x    -> 12.00 percent
//                 margin  16,000,000 / 118,000,000 = 13.55 percent, pass
//                 cover   16,000,000 /   6,800,000 =  2.35x,        breach
//                 leverage 4.50x against a 4.00x covenant,          breach
//                 verdict breach, haircut 49.50 percent, advance 50.50 percent
//
// 78.00 against 50.50 is the difference a viewer has to read in two seconds, and
// it is the difference a lender would actually price between those two filings.

import type { EngineInputs } from "./types";

export interface Fixture {
  id: string;
  label: string;
  inputs: EngineInputs;
}

export const FIXTURES: Fixture[] = [
  {
    id: "improved",
    label: "q2 filing, covenant headroom",
    inputs: {
      borrower: "Meridian Industrial Holdings",
      period: "FY26 Q2",
      revenue: 120_000_000,
      ebitda: 20_000_000,
      totalDebt: 45_000_000,
      cash: 5_000_000,
      interestExpense: 6_000_000,
    },
  },
  {
    id: "deteriorated",
    label: "q3 filing, covenant breached",
    inputs: {
      borrower: "Meridian Industrial Holdings",
      period: "FY26 Q3",
      revenue: 118_000_000,
      ebitda: 16_000_000,
      totalDebt: 76_000_000,
      cash: 4_000_000,
      interestExpense: 6_800_000,
    },
  },
];

export const EMPTY_INPUTS: EngineInputs = {
  borrower: "",
  period: "",
  revenue: 0,
  ebitda: 0,
  totalDebt: 0,
  cash: 0,
  interestExpense: 0,
};
