// covenant. the confidential engine's public surface.
//
// this file is the contract between the engine and everything that calls it.
// it is deliberately free of react, next, the ATS sdk and any transport. read
// it on its own and you should be able to say exactly what enters the engine,
// what leaves it, and what the lender is allowed to see.
//
// ---------------------------------------------------------------------------
// WHY THIS SHAPE AND NOT A SIMPLER ONE
// ---------------------------------------------------------------------------
//
// at block F the local implementation is replaced by a chainlink CRE workflow
// registered with `handlerInTee`. that swap must not touch a single caller.
// five properties buy that, and each one is here for that reason alone:
//
//  1. `evaluate` is async. the CRE handler signature is
//     `(runtime, triggerOutput) => Promise<CreSerializable<TResult>> |
//     CreSerializable<TResult>` (`@chainlink/cre-sdk@1.18.0`,
//     `dist/sdk/workflow.d.ts:16`, quoted in specs/04 section 1). the local
//     engine has nothing to await, and returns a promise anyway, so no caller
//     learns the difference.
//
//  2. inputs go in, and are NOT echoed back out. inside a TEE handler only the
//     values you deliberately carry across `runtime.usingTheDons()` survive
//     (specs/04 section 4, step 6). an interface that returned its own inputs
//     would be unimplementable there. this one returns the result only.
//
//  3. every field below is a string, a number, a boolean, an array or a plain
//     object. no Date, no BigInt, no class instance. `TResult` is constrained
//     to `CreSerializable<TResult>` at the same declaration site, and a Date or
//     a BigInt does not satisfy it. timestamps are ISO strings for that reason.
//
//  4. `EngineDescriptor.attestation` already exists and is already `null`. the
//     views render whatever is in it. when a CRE run produces a real one there
//     is somewhere for it to land and no component changes.
//
//  5. the split between `EngineResult` and `LenderDisclosure` is a second
//     boundary, downstream of the enclave, and it is enforced by a function
//     rather than by a component choosing not to render something. see
//     lib/engine/disclosure.ts.
//
// ---------------------------------------------------------------------------
// THE TWO BOUNDARIES, WHICH ARE NOT THE SAME BOUNDARY
// ---------------------------------------------------------------------------
//
//   borrower financials --[ boundary 1: the engine ]--> EngineResult
//   EngineResult        --[ boundary 2: counterparty ]--> LenderDisclosure
//
// boundary 1 is what CRE would make hardware-isolated and attested. today it is
// a process boundary on one machine and nothing more, and no copy anywhere in
// this application may call it an enclave until that is true.
//
// boundary 2 is a disclosure rule between two counterparties. it holds whether
// or not boundary 1 is a real TEE, and it is the one the lender view depends on.

/**
 * the borrower's private financials. every figure is whole US dollars, integer,
 * so the arithmetic downstream is exact and repeatable. trailing twelve months
 * for the flow figures, period end for the balance figures.
 *
 * this type crosses into the engine and never comes back out. nothing in
 * `EngineResult` is derived from it closely enough to reconstruct it.
 */
export interface EngineInputs {
  /** the operating company. not confidential, the lender knows who it lends against. */
  borrower: string;
  /** reporting period label, e.g. "FY26 Q2". not confidential. */
  period: string;
  /** revenue, trailing twelve months. */
  revenue: number;
  /** EBITDA, trailing twelve months. may be zero or negative. */
  ebitda: number;
  /** total debt at period end. */
  totalDebt: number;
  /** cash and equivalents at period end. */
  cash: number;
  /** interest expense, trailing twelve months. */
  interestExpense: number;
}

/** the three states a covenant test, and the facility as a whole, can be in. */
export type CovenantStatus = "pass" | "watch" | "breach";

/**
 * one covenant test. `observed` and `threshold` are pre-formatted by the engine
 * so the agent view and any later report render the same text from the same
 * source, rather than each re-deriving it and drifting.
 */
export interface CovenantTest {
  id: string;
  label: string;
  observed: string;
  threshold: string;
  status: CovenantStatus;
}

/** a scaled integer with the decimals it is scaled by, and its display form. */
export interface ScaledValue {
  value: number;
  decimals: number;
  display: string;
}

/**
 * what, if anything, vouches for the execution. `null` means nothing does, which
 * is the honest value for a local service and the value it carries today.
 */
export interface EngineAttestation {
  /** e.g. "cre-cli-simulation", "aws-nitro". */
  kind: string;
  /** one line a judge can read, e.g. "aws nitro, us-west-2". */
  detail: string;
  /** true when the enclave was simulated rather than real. never quietly false. */
  simulated: boolean;
}

/**
 * which implementation produced a result and where it ran. carried in the result
 * and rendered by both views, so the label on screen always matches the code
 * that actually ran and cannot be left stale by hand.
 */
export interface EngineDescriptor {
  /** stable machine id, e.g. "local-service". */
  id: string;
  /** short lowercase phrase naming where it ran. must be literally true. */
  label: string;
  attestation: EngineAttestation | null;
}

/**
 * everything that leaves the engine. under CRE this is exactly the value that
 * would be carried across `runtime.usingTheDons()` and nothing else.
 */
export interface EngineResult {
  /**
   * deterministic. derived from the disclosed fields only, so the same inputs
   * produce the same run id twice, and the id commits to nothing the lender
   * does not already hold. see lib/engine/kernel.ts.
   */
  runId: string;
  /** ISO 8601 string. the one field that is not a function of the inputs. */
  computedAt: string;
  engine: EngineDescriptor;
  /** which published covenant policy was applied. */
  policyId: string;
  borrower: string;
  period: string;
  /** the facility-level verdict. worst of the individual tests. */
  verdict: CovenantStatus;
  /** the individual tests. agent tier. not disclosed to the lender. */
  tests: CovenantTest[];
  /** net leverage, net debt over EBITDA, scaled by 100. agent tier. */
  kpi: ScaledValue & { name: string };
  /**
   * the coupon rate this KPI implies under the bounds published at issuance.
   * computed by `rateForKpi` in lib/ats/note-terms.ts, not re-derived here.
   * agent tier: the agent posts it with `FixedRate.setRate`.
   */
  rate: ScaledValue;
  /** collateral haircut in basis points. disclosed. */
  haircutBps: number;
  /** 10000 minus the haircut. disclosed. the number the lender lends against. */
  advanceRateBps: number;
}

/**
 * what the lender receives. this is the whole payload, there is no second
 * request and no expanded variant. produced only by `toLenderDisclosure`.
 */
export interface LenderDisclosure {
  runId: string;
  computedAt: string;
  engine: EngineDescriptor;
  policyId: string;
  borrower: string;
  period: string;
  verdict: CovenantStatus;
  haircutBps: number;
  advanceRateBps: number;
}

/** the request envelope. an object rather than a bare argument so a later field cannot break callers. */
export interface EngineRequest {
  inputs: EngineInputs;
}

/**
 * the engine. one method, and a descriptor that describes the implementation
 * behind it. a CRE-backed implementation satisfies this without any caller
 * knowing, which is the entire point of the file.
 */
export interface CovenantEngine {
  readonly descriptor: EngineDescriptor;
  evaluate(request: EngineRequest): Promise<EngineResult>;
}

/** thrown when the inputs are not usable. carries every problem, not the first. */
export class EngineInputError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`engine inputs rejected: ${problems.join("; ")}`);
    this.name = "EngineInputError";
    this.problems = problems;
  }
}
