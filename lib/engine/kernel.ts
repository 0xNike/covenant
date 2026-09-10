// covenant. the computation itself.
//
// pure. no network, no clock, no randomness, no environment, no imports outside
// this repository's own published terms. the same inputs produce the same
// output every time, which a judge can check on camera by running the same
// borrower twice and reading the same run id back.
//
// this is the function that moves inside `handlerInTee` at block F. nothing in
// it needs a browser, a server, a filesystem or a hedera connection, so it can
// be bundled into a CRE workflow unchanged. lib/ats/note-terms.ts, which it
// imports, is deliberately free of SDK imports for the same reason.
//
// the clock and the transport live in the provider (lib/engine/providers/), not
// here, so that this file stays checkable by inspection.
//
// arithmetic is integer throughout, with explicit truncating division, matching
// the style of `expectedRateFromImpact` in lib/ats/note-terms.ts which mirrors
// the on-chain library. floats are never compared and never accumulated.

import { IMPACT_DATA, rateForKpi, RATE_DECIMALS } from "@/lib/ats/note-terms";
import {
  COVENANT_POLICY,
  HAIRCUT_LEVERAGE_BOUNDS,
  type CovenantPolicy,
} from "./policy";
import {
  EngineInputError,
  type CovenantStatus,
  type CovenantTest,
  type EngineInputs,
} from "./types";

/** what the pure kernel produces. the provider adds the id, clock and descriptor. */
export interface Assessment {
  policyId: string;
  borrower: string;
  period: string;
  verdict: CovenantStatus;
  tests: CovenantTest[];
  kpiX100: number;
  kpiDisplay: string;
  rateValue: number;
  rateDecimals: number;
  rateDisplay: string;
  haircutBps: number;
  advanceRateBps: number;
}

const MONEY_FIELDS = [
  "revenue",
  "ebitda",
  "totalDebt",
  "cash",
  "interestExpense",
] as const;

/** whole dollars only. non-negative except EBITDA, which may be negative. */
export function validateInputs(inputs: EngineInputs): string[] {
  const problems: string[] = [];

  if (!inputs.borrower || inputs.borrower.trim() === "") {
    problems.push("borrower is required");
  }
  if (!inputs.period || inputs.period.trim() === "") {
    problems.push("period is required");
  }

  for (const field of MONEY_FIELDS) {
    const v = inputs[field];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      problems.push(`${field} must be a finite number`);
      continue;
    }
    if (!Number.isInteger(v)) {
      problems.push(`${field} must be whole dollars`);
      continue;
    }
    if (field !== "ebitda" && v < 0) {
      problems.push(`${field} must not be negative`);
    }
    // 1e12 dollars is a trillion. anything past it is a typo, and it is also
    // where integer arithmetic scaled by 10000 starts to approach
    // Number.MAX_SAFE_INTEGER.
    if (Math.abs(v) > 1e12) {
      problems.push(`${field} is out of range`);
    }
  }

  return problems;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function worst(statuses: CovenantStatus[]): CovenantStatus {
  if (statuses.includes("breach")) return "breach";
  if (statuses.includes("watch")) return "watch";
  return "pass";
}

/** e.g. 450 -> "4.50x" */
function asMultiple(x100: number): string {
  return `${(x100 / 100).toFixed(2)}x`;
}

/** e.g. 1350 -> "13.50%" */
function asPercentFromBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * FNV-1a, 32 bit, rendered as eight hex characters.
 *
 * this is an identifier, not a commitment. it is computed over the disclosed
 * fields only, deliberately: an id derived from the borrower's financials would
 * be a hash of a low-entropy secret handed to the party that is not allowed to
 * see it, and would be searchable in seconds. computed this way it commits to
 * nothing the lender does not already hold, while still being identical on both
 * screens for the same run. two runs that disclose exactly the same facts share
 * an id, which is the correct behaviour for an identifier over disclosed facts.
 */
function runIdOf(parts: string[]): string {
  let h = 0x811c9dc5;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * the deterministic run id for a set of disclosed facts. exported so the
 * provider composes it rather than reimplementing it, and so the lender view
 * and the agent view provably carry the same string.
 */
export function deterministicRunId(a: Assessment): string {
  return runIdOf([
    a.policyId,
    a.borrower,
    a.period,
    a.verdict,
    String(a.haircutBps),
    String(a.advanceRateBps),
  ]);
}

/**
 * net leverage: net debt over EBITDA, scaled by 100, truncated.
 *
 * when EBITDA is zero or negative the ratio is not defined. the engine does not
 * return "unknown" for it, because the lender still has to be told a haircut.
 * it reports the published cap, which is the worst leverage the rate curve
 * prices, and the covenant test says plainly why.
 */
function netLeverageX100(inputs: EngineInputs): {
  x100: number;
  measurable: boolean;
} {
  if (inputs.ebitda <= 0) {
    return { x100: HAIRCUT_LEVERAGE_BOUNDS.capX100, measurable: false };
  }
  const netDebt = inputs.totalDebt - inputs.cash;
  if (netDebt <= 0) return { x100: 0, measurable: true };
  return { x100: Math.floor((netDebt * 100) / inputs.ebitda), measurable: true };
}

/**
 * the haircut, linear in leverage between the two bounds published at issuance,
 * then widened for a watch or a breach and clamped to the agreed range.
 *
 * it keys off `IMPACT_DATA.maxDeviationFloor` and `maxDeviationCap`, the same
 * two numbers `expectedRateFromImpact` interpolates the coupon between, so the
 * rate and the haircut cannot drift apart.
 */
function haircutBpsFor(
  kpiX100: number,
  verdict: CovenantStatus,
  policy: CovenantPolicy,
): number {
  const { floorX100, capX100 } = HAIRCUT_LEVERAGE_BOUNDS;
  const span = capX100 - floorX100;
  const above = clamp(kpiX100 - floorX100, 0, span);

  let bps =
    policy.haircutAtFloorBps +
    Math.floor(((policy.haircutAtCapBps - policy.haircutAtFloorBps) * above) / span);

  if (verdict === "watch") bps += policy.watchAddOnBps;
  if (verdict === "breach") bps += policy.breachAddOnBps;

  return clamp(bps, policy.haircutMinBps, policy.haircutMaxBps);
}

/** a threshold with a `watchBandBps` cushion on the safe side of it. */
function watchThreshold(threshold: number, band: number, direction: "max" | "min"): number {
  const cushion = Math.floor((threshold * band) / 10000);
  return direction === "max" ? threshold - cushion : threshold + cushion;
}

/**
 * run the covenant tests and price the collateral.
 *
 * throws `EngineInputError` on unusable inputs rather than returning a verdict
 * computed from nonsense. a haircut is a number someone lends against.
 */
export function assess(
  inputs: EngineInputs,
  policy: CovenantPolicy = COVENANT_POLICY,
): Assessment {
  const problems = validateInputs(inputs);
  if (problems.length > 0) throw new EngineInputError(problems);

  const leverage = netLeverageX100(inputs);
  const tests: CovenantTest[] = [];

  // 1. leverage. the maintenance covenant, and the source of the KPI.
  const leverageWatchAt = watchThreshold(
    policy.netLeverageMaxX100,
    policy.watchBandBps,
    "max",
  );
  tests.push({
    id: "net-leverage",
    label: "net leverage",
    observed: leverage.measurable
      ? asMultiple(leverage.x100)
      : "not measurable, ebitda not positive",
    threshold: `${asMultiple(policy.netLeverageMaxX100)} or lower`,
    status: !leverage.measurable
      ? "breach"
      : leverage.x100 > policy.netLeverageMaxX100
        ? "breach"
        : leverage.x100 > leverageWatchAt
          ? "watch"
          : "pass",
  });

  // 2. interest cover. EBITDA over interest expense.
  const coverWatchAt = watchThreshold(
    policy.interestCoverMinX100,
    policy.watchBandBps,
    "min",
  );
  if (inputs.interestExpense <= 0) {
    tests.push({
      id: "interest-cover",
      label: "interest cover",
      observed: "no interest expense",
      threshold: `${asMultiple(policy.interestCoverMinX100)} or higher`,
      status: "pass",
    });
  } else if (inputs.ebitda <= 0) {
    tests.push({
      id: "interest-cover",
      label: "interest cover",
      observed: "not measurable, ebitda not positive",
      threshold: `${asMultiple(policy.interestCoverMinX100)} or higher`,
      status: "breach",
    });
  } else {
    const coverX100 = Math.floor((inputs.ebitda * 100) / inputs.interestExpense);
    tests.push({
      id: "interest-cover",
      label: "interest cover",
      observed: asMultiple(coverX100),
      threshold: `${asMultiple(policy.interestCoverMinX100)} or higher`,
      status:
        coverX100 < policy.interestCoverMinX100
          ? "breach"
          : coverX100 < coverWatchAt
            ? "watch"
            : "pass",
    });
  }

  // 3. EBITDA margin. the test revenue is load-bearing in.
  const marginWatchAt = watchThreshold(
    policy.ebitdaMarginMinBps,
    policy.watchBandBps,
    "min",
  );
  if (inputs.revenue <= 0) {
    tests.push({
      id: "ebitda-margin",
      label: "ebitda margin",
      observed: "not measurable, no revenue",
      threshold: `${asPercentFromBps(policy.ebitdaMarginMinBps)} or higher`,
      status: "breach",
    });
  } else {
    const marginBps = Math.floor((inputs.ebitda * 10000) / inputs.revenue);
    tests.push({
      id: "ebitda-margin",
      label: "ebitda margin",
      observed: asPercentFromBps(marginBps),
      threshold: `${asPercentFromBps(policy.ebitdaMarginMinBps)} or higher`,
      status:
        marginBps < policy.ebitdaMarginMinBps
          ? "breach"
          : marginBps < marginWatchAt
            ? "watch"
            : "pass",
    });
  }

  const verdict = worst(tests.map((t) => t.status));
  const haircutBps = haircutBpsFor(leverage.x100, verdict, policy);

  // the KPI to rate conversion is not reimplemented here. `rateForKpi` prices
  // against the bounds pinned at issuance in lib/ats/note-terms.ts, and it is
  // the same function gamma's `FixedRate.setRate` call reads from.
  const rate = rateForKpi(leverage.x100);

  return {
    policyId: policy.id,
    borrower: inputs.borrower.trim(),
    period: inputs.period.trim(),
    verdict,
    tests,
    kpiX100: leverage.x100,
    kpiDisplay: leverage.measurable
      ? asMultiple(leverage.x100)
      : `${asMultiple(leverage.x100)}, capped, ebitda not positive`,
    rateValue: Number.parseInt(rate.rate, 10),
    rateDecimals: rate.rateDecimals,
    // RATE_DECIMALS is 4, so the stored integer is the rate scaled by 10000 and
    // a percentage is that over 100. 600 is 6.00 percent.
    rateDisplay: `${(Number.parseInt(rate.rate, 10) / 100).toFixed(2)}%`,
    haircutBps,
    advanceRateBps: 10000 - haircutBps,
  };
}

/** re-exported so callers formatting a rate do not have to guess the scale. */
export { RATE_DECIMALS, IMPACT_DATA };

/** display helpers, exported so the two views render identical text. */
export const fmt = {
  multiple: asMultiple,
  percentFromBps: asPercentFromBps,
  /** whole dollars with thousands separators, e.g. 120000000 -> "120,000,000". */
  usd(v: number): string {
    const sign = v < 0 ? "-" : "";
    const digits = Math.abs(v).toString();
    return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },
};
