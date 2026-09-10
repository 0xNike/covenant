"use client";

// covenant. the agent's console for the confidential engine.
//
// the agent of the facility sees everything: the borrower's filing goes in here,
// and the covenant verdict, the KPI and the rate come back. that is correct and
// it is the point of the comparison. the agent is inside the information wall.
// the lender is not.
//
// the lender view on the right is an iframe of /lender, a separate document with
// its own render, its own bundle and its own request. it is not a second copy of
// this component with fields hidden, and it does not receive anything from this
// component. that is what makes the empty region on it mean something: there is
// no path by which a borrower figure could reach it.
//
// the view control never navigates. both views are on screen at once by default,
// so there is nothing to click between them on camera. "lender only" unmounts
// this side rather than hiding it, so the shot has no borrower figure anywhere
// in the document, not even out of frame.

import { Fragment, useCallback, useMemo, useState } from "react";
import { runEngine, withdrawRun, EngineCallError } from "@/lib/engine/client";
import { EMPTY_INPUTS, FIXTURES } from "@/lib/engine/fixtures";
import type { EngineInputs, EngineResult } from "@/lib/engine/types";
import { COVENANT_POLICY } from "@/lib/engine/policy";
import {
  EngineStamp,
  FINANCIALS_BLOCK_HEIGHT,
  Metric,
  Panel,
  Row,
  Rows,
  VerdictBadge,
  statusTextClasses,
} from "@/app/components/covenant-ui";

type Mode = "both" | "agent" | "lender";

type FormState = Record<keyof EngineInputs, string>;

const MONEY_FIELDS: {
  key: keyof EngineInputs;
  label: string;
  hint: string;
}[] = [
  { key: "revenue", label: "revenue", hint: "trailing twelve months, usd" },
  { key: "ebitda", label: "ebitda", hint: "trailing twelve months, usd" },
  { key: "totalDebt", label: "total debt", hint: "period end, usd" },
  { key: "cash", label: "cash", hint: "period end, usd" },
  {
    key: "interestExpense",
    label: "interest expense",
    hint: "trailing twelve months, usd",
  },
];

function toForm(inputs: EngineInputs): FormState {
  return {
    borrower: inputs.borrower,
    period: inputs.period,
    revenue: String(inputs.revenue),
    ebitda: String(inputs.ebitda),
    totalDebt: String(inputs.totalDebt),
    cash: String(inputs.cash),
    interestExpense: String(inputs.interestExpense),
  };
}

function fromForm(form: FormState): EngineInputs {
  const num = (s: string): number => {
    const t = s.replace(/[,\s]/g, "").trim();
    return t === "" ? Number.NaN : Number(t);
  };
  return {
    borrower: form.borrower,
    period: form.period,
    revenue: num(form.revenue),
    ebitda: num(form.ebitda),
    totalDebt: num(form.totalDebt),
    cash: num(form.cash),
    interestExpense: num(form.interestExpense),
  };
}

function percentFromBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export default function AgentConsole() {
  const [mode, setMode] = useState<Mode>("both");
  const [form, setForm] = useState<FormState>(() =>
    toForm(FIXTURES[0].inputs),
  );
  const [result, setResult] = useState<EngineResult | null>(null);
  const [busy, setBusy] = useState<null | "run" | "withdraw">(null);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const set = useCallback((key: keyof EngineInputs, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onLoad = useCallback((inputs: EngineInputs) => {
    setForm(toForm(inputs));
    setError(null);
    setProblems([]);
  }, []);

  const onRun = useCallback(async () => {
    setBusy("run");
    setError(null);
    setProblems([]);
    try {
      const next = await runEngine(fromForm(form));
      setResult(next);
    } catch (e) {
      if (e instanceof EngineCallError) {
        setError(e.message);
        setProblems(e.problems);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(null);
    }
  }, [form]);

  const onWithdraw = useCallback(async () => {
    setBusy("withdraw");
    setError(null);
    try {
      await withdrawRun();
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const gridClass = useMemo(() => {
    if (mode === "both") return "grid gap-6 lg:grid-cols-2";
    return "grid gap-6 grid-cols-1";
  }, [mode]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 font-mono text-sm">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-semibold">
            covenant, confidential engine
          </h1>
          <p className="text-zinc-500">
            the borrower&apos;s filing goes in on the left. the lender, on the
            right, is advancing cash against a covenant it is not permitted to
            inspect.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["both", "agent", "lender"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`border px-3 py-1 ${
                mode === m
                  ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-400 dark:border-zinc-600"
              }`}
            >
              {m === "both" ? "both views" : `${m} only`}
            </button>
          ))}
        </div>
      </header>

      <div className={gridClass}>
        {mode !== "lender" && (
          <div className="flex flex-col gap-4">
            <div className="border-b-2 border-zinc-900 pb-1 text-base font-semibold dark:border-zinc-100">
              agent view
            </div>

            <Panel
              title="borrower financials"
              subtitle="private. supplied by the borrower under the credit agreement."
              accent="agent"
            >
              {/*
                same height as the lender's empty panel of the same name, from
                the same constant, so the pair reads as one comparison rather
                than two boxes that happen to be adjacent. see
                FINANCIALS_BLOCK_HEIGHT in @/app/components/covenant-ui.
              */}
              <div className={`flex ${FINANCIALS_BLOCK_HEIGHT} flex-col gap-3`}>
                <div className="flex flex-wrap gap-2">
                  {FIXTURES.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onLoad(f.inputs)}
                      disabled={busy !== null}
                      className="border border-zinc-400 px-2 py-1 disabled:opacity-40 dark:border-zinc-600"
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    onClick={() => onLoad(EMPTY_INPUTS)}
                    disabled={busy !== null}
                    className="border border-zinc-400 px-2 py-1 disabled:opacity-40 dark:border-zinc-600"
                  >
                    clear
                  </button>
                </div>

                <div className="grid grid-cols-[9rem_1fr] items-center gap-x-3 gap-y-2">
                  <label className="text-zinc-500" htmlFor="borrower">
                    borrower
                  </label>
                  <input
                    id="borrower"
                    value={form.borrower}
                    onChange={(e) => set("borrower", e.target.value)}
                    className="w-full border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
                  />
                  <label className="text-zinc-500" htmlFor="period">
                    period
                  </label>
                  <input
                    id="period"
                    value={form.period}
                    onChange={(e) => set("period", e.target.value)}
                    className="w-full border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
                  />
                  {MONEY_FIELDS.map((f) => (
                    <ValueField
                      key={f.key}
                      id={f.key}
                      label={f.label}
                      hint={f.hint}
                      value={form[f.key]}
                      onChange={(v) => set(f.key, v)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onRun}
                  disabled={busy !== null}
                  className="border border-zinc-900 px-3 py-1 disabled:opacity-40 dark:border-zinc-100"
                >
                  {busy === "run" ? "running..." : "run the engine"}
                </button>
                <button
                  onClick={onWithdraw}
                  disabled={busy !== null || result === null}
                  className="border border-zinc-400 px-3 py-1 disabled:opacity-40 dark:border-zinc-600"
                >
                  withdraw the report
                </button>
              </div>

              <p className="text-zinc-500">
                these figures are sent to /api/engine/run and nowhere else. the
                server hands them to the engine and keeps only the result, so
                there is no endpoint that can return them.
              </p>
            </Panel>

            {(error || problems.length > 0) && (
              <div className="border border-red-600 p-3 text-red-700 dark:text-red-400">
                <p>{error}</p>
                {problems.length > 0 && (
                  <ul className="mt-1 list-inside list-disc">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Panel
              title="engine output"
              subtitle="everything the engine returned"
              accent="agent"
            >
              {result === null ? (
                <p className="text-zinc-500">
                  no run yet. load a filing and run the engine.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <VerdictBadge status={result.verdict} />

                  <div className="flex flex-wrap gap-8">
                    <Metric
                      label="net leverage"
                      value={result.kpi.display}
                      status={result.verdict}
                    />
                    <Metric
                      label="coupon rate"
                      value={result.rate.display}
                      status={result.verdict}
                    />
                    <Metric
                      label="haircut"
                      value={percentFromBps(result.haircutBps)}
                      status={result.verdict}
                    />
                    <Metric
                      label="advance rate"
                      value={percentFromBps(result.advanceRateBps)}
                      status={result.verdict}
                    />
                  </div>

                  <div className="grid grid-cols-[9rem_9rem_11rem_1fr] gap-x-3 gap-y-1">
                    <span className="text-zinc-500">covenant</span>
                    <span className="text-zinc-500">observed</span>
                    <span className="text-zinc-500">threshold</span>
                    <span className="text-zinc-500">status</span>
                    {result.tests.map((t) => (
                      <Fragment key={t.id}>
                        <span>{t.label}</span>
                        <span className="tabular-nums">{t.observed}</span>
                        <span className="tabular-nums text-zinc-500">
                          {t.threshold}
                        </span>
                        <span className={statusTextClasses(t.status)}>
                          {t.status}
                        </span>
                      </Fragment>
                    ))}
                  </div>

                  <Rows>
                    <Row label="borrower" value={result.borrower} />
                    <Row label="period" value={result.period} />
                    <Row label="covenant terms" value={result.policyId} />
                    <Row label="run" value={result.runId} />
                    <Row label="computed" value={result.computedAt} />
                    <Row
                      label="post as rate"
                      value={`${result.rate.value} at ${result.rate.decimals} decimals, through FixedRate.setRate`}
                    />
                  </Rows>

                  <EngineStamp engine={result.engine} />
                </div>
              )}
            </Panel>

            <Panel
              title="the covenant, as published"
              subtitle="terms of the facility, not settings. the lender agreed these and can read them."
            >
              <Rows>
                <Row label="terms id" value={COVENANT_POLICY.id} />
                <Row
                  label="net leverage"
                  value={`${(COVENANT_POLICY.netLeverageMaxX100 / 100).toFixed(2)}x or lower`}
                />
                <Row
                  label="interest cover"
                  value={`${(COVENANT_POLICY.interestCoverMinX100 / 100).toFixed(2)}x or higher`}
                />
                <Row
                  label="ebitda margin"
                  value={`${(COVENANT_POLICY.ebitdaMarginMinBps / 100).toFixed(2)}% or higher`}
                />
                <Row
                  label="haircut"
                  value={`${percentFromBps(COVENANT_POLICY.haircutAtFloorBps)} at 1.00x leverage, ${percentFromBps(COVENANT_POLICY.haircutAtCapBps)} at 6.00x, linear between`}
                />
                <Row
                  label="widened by"
                  value={`${percentFromBps(COVENANT_POLICY.watchAddOnBps)} on watch, ${percentFromBps(COVENANT_POLICY.breachAddOnBps)} on breach`}
                />
              </Rows>
            </Panel>
          </div>
        )}

        <div className={`flex flex-col gap-4 ${mode === "agent" ? "hidden" : ""}`}>
          <div className="flex items-end justify-between gap-3 border-b-2 border-sky-700 pb-1 dark:border-sky-500">
            <span className="text-base font-semibold">lender view</span>
            <a
              className="text-zinc-500 underline"
              href="/lender"
              target="_blank"
              rel="noreferrer"
            >
              open /lender in its own window
            </a>
          </div>
          {/*
            tall enough that the lender's whole document fits without the iframe
            growing its own scrollbar.

            at 44rem it did not: the lender view runs to roughly 63rem, so the
            covenant report was clipped mid-panel and the frame scrolled
            independently of the page. on camera that reads as a broken embed,
            and it puts the haircut, which is the number the lender lends
            against, below an inner fold that the viewer cannot see being
            scrolled to. the page scrolls, the frame does not.
          */}
          <iframe
            title="lender view"
            src="/lender?embedded=1"
            className="min-h-[64rem] w-full border border-sky-700 dark:border-sky-500"
          />
          <p className="text-zinc-500">
            a separate document, rendered by /lender. it is not this page with
            fields hidden. it never receives the borrower&apos;s figures, so
            there is nothing in its source, its bundle or its network traffic to
            find.
          </p>
        </div>
      </div>
    </main>
  );
}

function ValueField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <label className="text-zinc-500" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        {/*
          a size up from the surrounding text and tabular, on purpose. these five
          numbers are what the reveal is about, so they have to register as a
          block of figures at 1.5x, and the lender's empty panel only lands if
          the thing it is empty of was conspicuous a moment earlier.
        */}
        <input
          id={id}
          value={value}
          inputMode="numeric"
          onChange={(e) => onChange(e.target.value)}
          className="w-52 border border-zinc-400 bg-transparent px-2 py-1 text-right text-base font-semibold tabular-nums dark:border-zinc-600"
        />
        <span className="text-zinc-500">{hint}</span>
      </div>
    </>
  );
}
