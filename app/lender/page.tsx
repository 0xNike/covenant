// covenant. the lender view, as its own route.
//
// this is a real page at its own url, not a panel inside the console. the
// console embeds it, but a judge can open /lender directly, view the source, and
// find no borrower figure in the served html, because this server component
// narrows the published run through `toLenderDisclosure` before it renders
// anything.
//
// the narrowing happens here rather than in the client component below it so the
// first paint is already correct. there is no moment where the full result is in
// the page and a component has not yet decided to hide part of it.

import { toLenderDisclosure } from "@/lib/engine/disclosure";
import { readPublishedRun } from "@/lib/engine/store";
import LenderView from "./lender-view";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "lender view" };

// reads mutable server state, so it must render per request.
export const dynamic = "force-dynamic";

export default async function LenderPage({
  searchParams,
}: PageProps<"/lender">) {
  const params = await searchParams;
  const embedded = params.embedded === "1";

  const run = readPublishedRun();
  const initial = run ? toLenderDisclosure(run) : null;

  return <LenderView initial={initial} embedded={embedded} />;
}
