// covenant. what the lender receives.
//
// this response body is the demo. open the network tab on the lender view and
// this is the only request it makes and the whole of what comes back: a run id,
// a timestamp, who and which period, a verdict, a haircut and an advance rate.
// the borrower's revenue, EBITDA and debt are not withheld here, they are not
// available here. the store holds an `EngineResult`, which never contained
// them, and `toLenderDisclosure` narrows even that.
//
// ---------------------------------------------------------------------------
// DO NOT ADD AUTHENTICATION TO THIS ENDPOINT
// ---------------------------------------------------------------------------
//
// it is deliberately unauthenticated. an access check is the obvious way to
// protect it and it is the weaker one: a guard means the data exists and
// something is standing in front of it. nothing stands in front of this, because
// there is nothing behind it to stand in front of. the borrower's figures are
// not withheld here, they are not reachable from here, and that is a stronger
// property than any check this route could perform.
//
// adding a guard would not make the application safer. it would replace a claim
// a judge can verify by opening the network tab with one they would have to take
// on trust, and it would invite the reading that the payload is sensitive.
//
// the claim is enforced by `scripts/scan-disclosure.mjs`, not by this route.
// if you believe this endpoint needs protecting, read that script and
// scripts/README.md first.

import { NextResponse } from "next/server";
import { toLenderDisclosure } from "@/lib/engine/disclosure";
import { readPublishedRun } from "@/lib/engine/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const run = readPublishedRun();
  return NextResponse.json(
    { disclosure: run ? toLenderDisclosure(run) : null },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
