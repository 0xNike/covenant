// covenant. the one place that decides which engine implementation runs.
//
// this file is the entire swap surface for block F. adding a CRE-backed engine
// is a new file in ./providers and one more case in the switch below. no
// component, no route handler and no caller changes, because none of them names
// an implementation. they name `CovenantEngine`.
//
// the provider is read from the environment, not hardcoded, and it is a server
// side variable with no NEXT_PUBLIC_ prefix, so the choice never reaches the
// browser. the browser calls /api/engine/run and is told, in the result's
// descriptor, what actually ran. it is never in a position to assume.
//
// if the CRE timebox fails, nothing here is deleted. the variable stays unset,
// "local" stays the default, and the build loses nothing it already had.

import { createLocalEngine } from "./providers/local";
import type { CovenantEngine } from "./types";

export type EngineProviderId = "local";

const DEFAULT_PROVIDER: EngineProviderId = "local";

function readProviderId(): string {
  const raw = process.env.ENGINE_PROVIDER;
  if (!raw || raw.trim() === "") return DEFAULT_PROVIDER;
  return raw.trim();
}

// one instance per process. the engine holds no per-request state, and building
// it is free, but a single instance keeps the descriptor identity stable.
let cached: { id: string; engine: CovenantEngine } | null = null;

/**
 * resolve the configured engine. server side only.
 *
 * throws on an unknown provider rather than falling back to the local one. a
 * silent fallback would mean a run labelled as something it was not, and the
 * label is load-bearing in both views.
 */
export function resolveEngine(): CovenantEngine {
  const id = readProviderId();
  if (cached && cached.id === id) return cached.engine;

  let engine: CovenantEngine;
  switch (id) {
    case "local":
      engine = createLocalEngine();
      break;

    // block F lands here:
    // case "cre-simulation":
    //   engine = createCreSimulationEngine();
    //   break;

    default:
      throw new Error(
        `unknown ENGINE_PROVIDER "${id}". known providers: local.`,
      );
  }

  cached = { id, engine };
  return engine;
}
