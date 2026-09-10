// covenant. the engine as a plain local service.
//
// this is the whole implementation. it wraps the pure kernel with the two things
// the kernel deliberately does not have: a clock, and a description of where the
// computation ran.
//
// the label is exact on purpose. this runs in the next.js server process on the
// same machine as the console. it is not an enclave, it is not attested, and no
// string in this file or in any component that renders it says otherwise.
// `attestation: null` is not a placeholder waiting to be filled in with
// something optimistic, it is the correct value for what this is.
//
// at block F a sibling file in this directory implements the same interface by
// running the same kernel inside a chainlink CRE workflow registered with
// `handlerInTee`, and returns a descriptor whose attestation is populated. the
// registry picks between them. nothing above the registry changes. see
// lib/engine/registry.ts.

import { assess, deterministicRunId } from "../kernel";
import { COVENANT_POLICY, type CovenantPolicy } from "../policy";
import type {
  CovenantEngine,
  EngineDescriptor,
  EngineRequest,
  EngineResult,
} from "../types";

export const LOCAL_ENGINE_DESCRIPTOR: EngineDescriptor = {
  id: "local-service",
  label: "local service, in process",
  // nothing vouches for this execution. see the note above.
  attestation: null,
};

export interface LocalEngineOptions {
  policy?: CovenantPolicy;
  /** injectable clock, so a test or a replay can pin the timestamp. */
  now?: () => Date;
}

export function createLocalEngine(
  options: LocalEngineOptions = {},
): CovenantEngine {
  const policy = options.policy ?? COVENANT_POLICY;
  const now = options.now ?? (() => new Date());

  return {
    descriptor: LOCAL_ENGINE_DESCRIPTOR,

    // async with nothing to await. the CRE implementation has plenty to await,
    // and callers must already be written for that, so this returns a promise
    // today rather than becoming one later.
    async evaluate(request: EngineRequest): Promise<EngineResult> {
      const a = assess(request.inputs, policy);

      return {
        runId: deterministicRunId(a),
        computedAt: now().toISOString(),
        engine: LOCAL_ENGINE_DESCRIPTOR,
        policyId: a.policyId,
        borrower: a.borrower,
        period: a.period,
        verdict: a.verdict,
        tests: a.tests,
        kpi: {
          name: "net leverage, net debt / ebitda",
          value: a.kpiX100,
          decimals: 2,
          display: a.kpiDisplay,
        },
        rate: {
          value: a.rateValue,
          decimals: a.rateDecimals,
          display: a.rateDisplay,
        },
        haircutBps: a.haircutBps,
        advanceRateBps: a.advanceRateBps,
      };
    },
  };
}
