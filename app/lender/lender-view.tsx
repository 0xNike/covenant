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

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDisclosure } from "@/lib/engine/disclosure-client";
import type { LenderDisclosure } from "@/lib/engine/types";
import {
  EngineStamp,
  FINANCIALS_BLOCK_HEIGHT,
  Metric,
  Panel,
  Row,
  Rows,
  VerdictBadge,
} from "@/app/components/covenant-ui";

function percentFromBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * how many polls in a row have to fail before the screen says anything.
 *
 * this view polls once a second, forever, for the whole length of a take. a
 * single dropped request, or the dev server rebuilding a route, would otherwise
 * throw a red banner onto the lender panel in the middle of the reveal, which is
 * the worst thirty seconds in the film to put an error on screen. three
 * consecutive failures is three seconds and means the server is genuinely gone,
 * which is worth saying. one is noise.
 *
 * the last good disclosure stays on screen throughout. it is still the last
 * thing the lender was told, and blanking it would be a lie of a different kind.
 */
const FAILURES_BEFORE_REPORTING = 3;

export default function LenderView({
  initial,
  embedded = false,
}: {
  initial: LenderDisclosure | null;
  embedded?: boolean;
}) {
  const [disclosure, setDisclosure] = useState<LenderDisclosure | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const failures = useRef(0);

  const poll = useCallback(async (signal: AbortSignal) => {
    try {
      const next = await fetchDisclosure(signal);
      failures.current = 0;
      setDisclosure(next);
      setError(null);
    } catch (e) {
      if (signal.aborted) return;
      failures.current += 1;
      if (failures.current < FAILURES_BEFORE_REPORTING) return;
      setError(
        `cannot reach the disclosure endpoint. ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
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
      // read by the css rule in app/globals.css that suppresses the site nav
      // inside the console's iframe. see app/components/site-nav.tsx.
      data-embedded={embedded ? "true" : "false"}
      className={`flex flex-col gap-4 font-mono text-sm ${
        embedded ? "p-4" : "mx-auto max-w-3xl px-6 py-10"
      }`}
    >
      {/*
        the console already labels this column "lender view" immediately above
        the iframe, so repeating the heading inside the frame is a duplicate that
        costs about four rems of height. that height is not free: it is what
        pushes the empty panel below out of line with the agent's filing form,
        and the two being at the same height is the entire reveal. shown when the
        page is opened on its own, where nothing else names it.
      */}
      {!embedded && (
        <header className="flex flex-col gap-1">
          <h1 className="text-base font-semibold">lender view</h1>
          <p className="text-zinc-500">
            the cash lender advancing against the note. served from /lender.
          </p>
        </header>
      )}

      {/*
        the absence.

        same component, same heading and same height as the agent's filing panel,
        so the two sit side by side as a matched pair and the eye compares them
        without being told to. nothing is blurred, masked or starred out. the
        panel names the category so a viewer knows what is missing, renders no
        field name and no value, and is otherwise empty.
      */}
      <Panel
        title="borrower financials"
        subtitle="private. the lender is not permitted to see these."
        accent="lender"
      >
        <div
          className={`flex ${FINANCIALS_BLOCK_HEIGHT} flex-col items-center justify-center gap-2 text-center`}
        >
          <p className="text-base text-zinc-400 dark:text-zinc-600">
            not sent to this page
          </p>
          <p className="max-w-sm text-zinc-400 dark:text-zinc-600">
            there is nothing here to uncover. no field, no value, and no request
            that would return one.
          </p>
        </div>
      </Panel>

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

      {/*
        stated on the screen rather than only in a comment, because a
        finance-literate judge will work it out in about ten seconds and it is
        far better that the application said it first. the haircut is a lossless
        function of net leverage over the published bounds, so disclosing the
        haircut discloses the ratio. the boundary this project claims is around
        the five financial figures, not around the ratio. see
        lib/engine/disclosure.ts for the arithmetic.
      */}
      <div className="flex flex-col gap-2 text-zinc-500">
        <p>
          this page makes one request, /api/engine/disclosure, once a second. its
          response is what you see above and nothing else. open the network tab
          and read it.
        </p>
        <p>
          the haircut is set from the borrower&apos;s leverage ratio against
          bounds published at issuance, so a lender holding the haircut and the
          verdict can recover that ratio. that is by design and it is what the
          lender is owed. the filing behind the ratio is five separate figures,
          none of which one ratio determines, and none of which reaches this
          page.
        </p>
      </div>
    </main>
  );
}
