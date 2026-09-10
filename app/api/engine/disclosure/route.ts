// covenant. what the lender receives.
//
// this response body is the demo. open the network tab on the lender view and
// this is the only request it makes and the whole of what comes back: a run id,
// a timestamp, who and which period, a verdict, a haircut and an advance rate.
// the borrower's revenue, EBITDA and debt are not withheld here, they are not
// available here. the store holds an `EngineResult`, which never contained
// them, and `toLenderDisclosure` narrows even that.
//
// the endpoint is deliberately unauthenticated. an access check would be the
// obvious way to protect this, and it would be the weaker one: it would mean the
// data existed and something was standing in front of it. nothing stands in
// front of this, because there is nothing behind it to stand in front of.

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
