// covenant. the note holder's position, read off chain, served as json.
//
// this endpoint exists so the chain reads stay on the server. `ethers`, the
// json-rpc relay url and the aggregated ATS abi are all server side, and the
// browser receives about two kilobytes of already-formatted strings. the holder
// view is therefore a small bundle that paints immediately and refreshes
// without a reload, which is what lets a collateral hold signed in the operator
// console appear on this page while both are on screen.
//
// everything it returns is public: balances, a rate, a maturity date and a list
// of transactions that are already on hashscan. there is no borrower figure in
// this response and no field name from `EngineInputs`. the haircut is served
// separately, by /api/engine/disclosure, through the same narrowing the lender
// gets. the two are not merged, here or anywhere.

import { NextResponse } from "next/server";
import { readHolderPosition } from "@/app/holder/read-position";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const envelope = await readHolderPosition({ fresh });
  return NextResponse.json(envelope, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
