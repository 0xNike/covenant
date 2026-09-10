"use client";

// covenant. the cash lender's screen.
//
// this component is typed against `LenderDisclosure`, not `EngineResult`. it
// could not render the borrower's revenue if someone asked it to, because the
// type it receives has no field for it and the endpoint it reads has no field
// for it either.
//
// the empty region near the top is not a styling accident and it is not a
// placeholder. it is the space the borrower's financials occupy on the agent's
// screen, left as it is here. not blurred, not masked, not greyed out. absent.
//
// one request, /api/engine/disclosure, and its whole response is on the screen.

import { useCallback, useEffect, useState } from "react";
import { fetchDisclosure } from "@/lib/engine/disclosure-client";
import type { LenderDisclosure } from "@/lib/engine/types";
import { EngineStamp, Metric, Panel, Row, Rows, VerdictBadge } from "@/app/engine/ui";

function percentFromBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export default function LenderView({
  initial,
  embedded = false,
}: {
  initial: LenderDisclosure | null;
  embedded?: boolean;
}) {
  const [disclosure, setDisclosure] = useState<LenderDisclosure | null>(initial);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async (signal: AbortSignal) => {
    try {
      const next = await fetchDisclosure(signal);
      setDisclosure(next);
      setError(null);
    } catch (e) {
      if (signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // the agent runs the engine in another document. polling is how this one finds
  // out, and it is why the two views can be shown one after the other with no
  // reload and nothing to click.
  //
  // the effect only subscribes. it does not call the endpoint once on mount as
  // well, because the value for the first paint already arrived: the server
  // component above narrowed the published run and passed it in as `initial`.
  // calling setState in the effect body to fetch a value we were already handed
  // is a cascading render for nothing, and react-hooks/set-state-in-effect is
  // right to reject it.
  //
  // one second, so the lender's number moves while the agent's click is still on
  // screen. the two views are filmed in one take and a longer gap reads as a bug.
  useEffect(() => {
    const controller = new AbortController();
    const id = setInterval(() => void poll(controller.signal), 1000);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [poll]);

  return (
    <main
      className={`flex flex-col gap-4 font-mono text-sm ${
        embedded ? "p-4" : "mx-auto max-w-3xl px-6 py-10"
      }`}
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-semibold">lender view</h1>
        <p className="text-zinc-500">
          the cash lender advancing against the note. served from /lender.
        </p>
      </header>

      {/*
        the absence. this region sits where the borrower financials sit on the
        agent's screen, at the same height, and holds nothing.
      */}
      <section className="flex min-h-56 flex-col justify-end border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <p className="text-zinc-500">
          the borrower&apos;s financials are not on this page. they were never
          sent to it.
        </p>
      </section>

      <Panel
        title="covenant report"
        subtitle="everything this view receives, in full"
        accent="lender"
      >
        {disclosure === null ? (
          <p className="text-zinc-500">
            no covenant report published. the agent has not run the engine yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <VerdictBadge status={disclosure.verdict} />

            <div className="flex flex-wrap gap-8">
              <Metric
                label="haircut"
                value={percentFromBps(disclosure.haircutBps)}
                status={disclosure.verdict}
              />
              <Metric
                label="advance rate"
                value={percentFromBps(disclosure.advanceRateBps)}
                status={disclosure.verdict}
              />
            </div>

            <Rows>
              <Row label="borrower" value={disclosure.borrower} />
              <Row label="period" value={disclosure.period} />
              <Row label="covenant terms" value={disclosure.policyId} />
              <Row label="run" value={disclosure.runId} />
              <Row label="computed" value={disclosure.computedAt} />
            </Rows>

            <EngineStamp engine={disclosure.engine} />
          </div>
        )}
      </Panel>

      {error && (
        <p className="border border-red-600 p-2 text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <p className="text-zinc-500">
        this page makes one request, /api/engine/disclosure, once a second. its
        response is what you see above and nothing else. open the network tab and
        read it.
      </p>
    </main>
  );
}
