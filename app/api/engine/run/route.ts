// covenant. run the engine.
//
// the only endpoint that ever sees the borrower's financials. it reads them out
// of the request body, hands them to whichever engine the registry resolves,
// keeps the result, and lets the body go. nothing writes the inputs to the
// store, to a log line, or to a response.
//
// there is no GET here that returns inputs, because there is nothing to return
// them from. the lender's endpoint is a different route and serves a different
// type, built by lib/engine/disclosure.ts.

import { NextResponse } from "next/server";
import { resolveEngine } from "@/lib/engine/registry";
import { clearPublishedRun, publishRun } from "@/lib/engine/store";
import { EngineInputError, type EngineInputs } from "@/lib/engine/types";

// the engine reads a clock and the store is per-request mutable state, so this
// must never be prerendered or cached.
export const dynamic = "force-dynamic";

function asInputs(raw: unknown): EngineInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number =>
    typeof v === "number" ? v : Number.parseFloat(String(v));
  return {
    borrower: String(r.borrower ?? ""),
    period: String(r.period ?? ""),
    revenue: num(r.revenue),
    ebitda: num(r.ebitda),
    totalDebt: num(r.totalDebt),
    cash: num(r.cash),
    interestExpense: num(r.interestExpense),
  };
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be json" }, { status: 400 });
  }

  const inputs = asInputs(
    (payload as { inputs?: unknown } | null)?.inputs ?? null,
  );
  if (!inputs) {
    return NextResponse.json(
      { error: "body must carry an inputs object" },
      { status: 400 },
    );
  }

  try {
    const engine = resolveEngine();
    const result = await engine.evaluate({ inputs });
    publishRun(result);
    // the response carries the result only. the inputs are not echoed, matching
    // what a TEE handler can actually return. see lib/engine/types.ts.
    return NextResponse.json({ result }, { status: 200 });
  } catch (e) {
    if (e instanceof EngineInputError) {
      return NextResponse.json(
        { error: "engine inputs rejected", problems: e.problems },
        { status: 400 },
      );
    }
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  clearPublishedRun();
  return NextResponse.json({ ok: true }, { status: 200 });
}
