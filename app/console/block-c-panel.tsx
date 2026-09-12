"use client";

// covenant, the rate and coupon console.
//
// what this screen has to make legible, in order:
//
//   the token is on STANDARD, where a caller hands it any rate it likes
//   we switch it to FIXED, where it refuses a caller-supplied rate outright
//   the engine's output is written to the token's rate storage, role gated
//   a coupon is declared naming NO rate, and the token stamps its own
//   the record date passes, the snapshot fires, entitlements become readable
//   the agent pays, and that payment is not an ATS operation
//
// every state change goes through lib/ats/coupon.ts or
// lib/ats/coupon-settlement.ts. every read goes through lib/ats/diagnostics.ts
// and touches no wallet.

import { useCallback, useEffect, useMemo, useState } from "react";
import { hashscanTx, readConfig, type CovenantConfig } from "@/lib/config";
import { connectWallet, type ConnectResult } from "@/lib/ats/client";
import { readNoteTokenRef } from "@/lib/ats/token-ref";
import {
  readCouponDiagnostics,
  type CouponDiagnostics,
} from "@/lib/ats/diagnostics";
import {
  buildCouponWindow,
  checkCouponWindow,
  compressMaturity,
  declareCoupon,
  engineRateForSdk,
  grantMaturityRole,
  grantRateRoles,
  offerRateAndBeRefused,
  postEngineRate,
  RATE_TYPE,
  setCouponRateTypeFixed,
  triggerScheduledTasks,
  type CouponWindow,
  type RateRefusal,
} from "@/lib/ats/coupon";
import {
  buildSettlements,
  payCouponsInHbar,
  type SettlementResult,
} from "@/lib/ats/coupon-settlement";
import { runEngine } from "@/lib/engine/client";
import { FIXTURES } from "@/lib/engine/fixtures";
import type { EngineResult } from "@/lib/engine/types";

type StepId =
  | "rateRoles"
  | "rateType"
  | "engine"
  | "postRate"
  | "refusal"
  | "coupon"
  | "trigger"
  | "maturityRole"
  | "maturity"
  | "settle";

interface StepResult {
  ok: boolean;
  hash?: string;
  lines: string[];
}

function errorText(e: unknown): string {
  if (e instanceof Error) {
    const chain: string[] = [];
    let cur: unknown = e;
    while (cur instanceof Error) {
      chain.push(`${cur.name}: ${cur.message}`);
      cur = (cur as { cause?: unknown }).cause;
    }
    return chain.join("\n  caused by ");
  }
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-";
  const neg = seconds < 0;
  const s = Math.abs(Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const body =
    h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m`
      : `${m}m ${String(sec).padStart(2, "0")}s`;
  return neg ? `${body} ago` : body;
}

function iso(t: number): string {
  return t ? new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19) : "-";
}

/** the three states this block exists to make visible. */
function VerdictCard({
  state,
  title,
  line,
  detail,
  link,
  cfg,
}: {
  state: "idle" | "live";
  title: string;
  line: string;
  detail?: string;
  link?: string;
  cfg: CovenantConfig;
}) {
  const palette =
    title === "protocol owned"
      ? "border-sky-700 bg-sky-700 text-white"
      : title === "engine priced"
        ? "border-violet-700 bg-violet-700 text-white"
        : "border-emerald-600 bg-emerald-600 text-white";
  const idle =
    "border-zinc-300 bg-transparent text-zinc-400 dark:border-zinc-700 dark:text-zinc-600";
  return (
    <div
      className={`flex flex-col gap-1 border-2 px-5 py-4 ${state === "live" ? palette : idle}`}
    >
      <div className="text-3xl font-bold tracking-tight uppercase">{title}</div>
      <div className="text-base">{line}</div>
      {state === "live" && detail && (
        <div className="text-sm break-all opacity-90">{detail}</div>
      )}
      {state === "live" && link && (
        <a
          className="text-sm break-all underline opacity-90"
          href={hashscanTx(cfg, link)}
          target="_blank"
          rel="noreferrer"
        >
          {hashscanTx(cfg, link)}
        </a>
      )}
    </div>
  );
}

export default function BlockCPanel() {
  const cfg = useMemo(() => readConfig(), []);
  const envToken = useMemo(() => readNoteTokenRef(), []);

  const [tokenId, setTokenId] = useState(envToken?.id ?? "");
  const [tokenEvm, setTokenEvm] = useState(envToken?.evm ?? "");

  // the coupon window, in seconds, so the whole thing is one place to look
  const [accrualDays, setAccrualDays] = useState("90");
  const [recordInSeconds, setRecordInSeconds] = useState("60");
  const [executionInSeconds, setExecutionInSeconds] = useState("120");
  const [maturityMinutes, setMaturityMinutes] = useState("10");
  const [settlementScale, setSettlementScale] = useState("1000");

  const [fixtureId, setFixtureId] = useState(FIXTURES[0]?.id ?? "");
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);

  const [wallet, setWallet] = useState<ConnectResult | null>(null);
  const [liveAccount, setLiveAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState<StepId | "connect" | "read" | null>(null);
  const [results, setResults] = useState<Partial<Record<StepId, StepResult>>>({});
  const [pendingHash, setPendingHash] = useState<Partial<Record<StepId, string>>>({});
  const [settlements, setSettlements] = useState<SettlementResult[]>([]);
  const [refusal, setRefusal] = useState<RateRefusal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [diag, setDiag] = useState<CouponDiagnostics | null>(null);
  // seconds since the epoch, ticking. zero until the first effect runs: reading
  // the clock during render is not idempotent and the react compiler rejects it.
  const [tick, setTick] = useState(0);

  // a countdown is the only thing on this screen that has to move on its own.
  useEffect(() => {
    const now = () => setTick(Math.floor(Date.now() / 1000));
    now();
    const t = setInterval(now, 1000);
    return () => clearInterval(t);
  }, []);

  // the wallet as it is now, not as it was at connect time. as in the
  // compliance panel.
  useEffect(() => {
    const eth = (
      globalThis as {
        ethereum?: {
          request: (a: unknown) => Promise<unknown>;
          on?: (e: string, h: (v: string[]) => void) => void;
          removeListener?: (e: string, h: (v: string[]) => void) => void;
        };
      }
    ).ethereum;
    if (!eth) return;
    const apply = (accounts: string[]) => setLiveAccount(accounts[0] ?? null);
    eth
      .request({ method: "eth_accounts" })
      .then((a) => apply(a as string[]))
      .catch(() => setLiveAccount(null));
    eth.on?.("accountsChanged", apply);
    return () => eth.removeListener?.("accountsChanged", apply);
  }, []);

  const append = useCallback((line: string) => {
    setLog((p) => [...p, `${new Date().toISOString().slice(11, 19)}  ${line}`]);
  }, []);

  const watched = useMemo(
    () => [
      { label: "issuer / agent", ...cfg.accounts.issuer },
      { label: "note holder", ...cfg.accounts.holder },
      { label: "lender", ...cfg.accounts.lender },
    ],
    [cfg],
  );

  const refresh = useCallback(async () => {
    if (!tokenEvm.trim()) return null;
    const d = await readCouponDiagnostics(cfg, tokenEvm, watched);
    setDiag(d);
    return d;
  }, [cfg, tokenEvm, watched]);

  /**
   * the read-back is deliberately outside the transaction's try. a rejected read
   * is a warning about the screen, never a verdict about the chain: when it lived
   * inside, one 429 from the relay overwrote a landed transaction with a failure
   * and took its HashScan link with it.
   */
  const run = useCallback(
    async (id: StepId, fn: () => Promise<StepResult>) => {
      setBusy(id);
      setError(null);
      setPendingHash((p) => ({ ...p, [id]: undefined }));
      let landed = false;
      try {
        const r = await fn();
        setResults((p) => ({ ...p, [id]: r }));
        r.lines.forEach(append);
        landed = true;
      } catch (e) {
        const text = errorText(e);
        setError(text);
        // merge, never replace. an earlier landed hash is evidence.
        setResults((p) => ({
          ...p,
          [id]: { ...p[id], ok: false, lines: [text] },
        }));
        append(`${id} failed`);
      } finally {
        setBusy(null);
      }
      if (landed) {
        try {
          await refresh();
        } catch (e) {
          append(`read-back failed, the transaction is unaffected: ${errorText(e)}`);
        }
      }
    },
    [append, refresh],
  );

  const onConnect = useCallback(async () => {
    setBusy("connect");
    setError(null);
    try {
      const res = await connectWallet(cfg);
      setWallet(res);
      append(`connected ${res.accountId} on ${res.network}`);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }, [cfg, append, refresh]);

  const onRead = useCallback(async () => {
    setBusy("read");
    setError(null);
    try {
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  // ---------------------------------------------------------------------------
  // the steps
  // ---------------------------------------------------------------------------

  const stepRateRoles = () =>
    run("rateRoles", async () => {
      const r = await grantRateRoles(
        tokenId,
        cfg.accounts.issuer.id,
        cfg.accounts.issuer.evm,
      );
      return {
        ok: true,
        hash: r.transactionId,
        lines: [
          `interest rate manager and corporate action granted to the issuer. ${r.transactionId}`,
        ],
      };
    });

  const stepRateType = () =>
    run("rateType", async () => {
      const d = await refresh();
      if (!d) throw new Error("could not read the token before switching the rate type");
      if (d.couponRateType === RATE_TYPE.FIXED) {
        return { ok: true, lines: ["already FIXED. nothing to do."] };
      }
      if (d.couponCount > 0) {
        throw new Error(
          `this token already carries ${d.couponCount} coupon(s) and the rate type is ` +
            `${d.couponRateTypeLabel}. switching now is exactly what DECISIONS.md D16 ` +
            "forbids: CouponRateDispatch.resolveRate dispatches on the rate type in " +
            "storage at read time, so any coupon still PENDING would silently resolve " +
            "under the new type. refusing.",
        );
      }
      const r = await setCouponRateTypeFixed(cfg, tokenEvm, (h) =>
        setPendingHash((p) => ({ ...p, rateType: h })),
      );
      return {
        ok: r.success,
        hash: r.hash,
        lines: [
          r.success
            ? "coupon rate type is FIXED. the token will now refuse any caller-supplied rate."
            : "the switch did not land.",
          r.note ?? "",
        ].filter(Boolean),
      };
    });

  const stepEngine = () =>
    run("engine", async () => {
      const fixture = FIXTURES.find((f) => f.id === fixtureId);
      if (!fixture) throw new Error("pick a filing first");
      const result = await runEngine(fixture.inputs);
      setEngineResult(result);
      const converted = engineRateForSdk(result.rate);
      return {
        ok: true,
        lines: [
          `engine run ${result.runId} on ${result.engine.label}`,
          `verdict ${result.verdict}, kpi ${result.kpi.display}, rate ${result.rate.display}`,
          `will post rate "${converted.rate}" at ${converted.rateDecimals} decimals, ` +
            `which reaches storage as ${converted.expectedOnChainRate}`,
        ],
      };
    });

  const stepPostRate = () =>
    run("postRate", async () => {
      if (!engineResult) throw new Error("run the engine first. this step posts its output, nothing else.");
      const r = await postEngineRate(
        tokenId,
        engineResult.rate,
        cfg.accounts.issuer.evm,
      );
      return {
        ok: true,
        hash: r.transactionId,
        lines: [
          `posted the engine's rate: ${r.sent.rate} at ${r.sent.rateDecimals} decimals`,
          `expecting ${r.expectedOnChainRate} in the token's rate storage`,
          r.transactionId,
        ],
      };
    });

  /**
   * read only. no wallet, no signature, no gas, no state change.
   *
   * the same eth_call twice: once with a rate we attached ourselves, once with
   * the pending triplet. the first is refused by name, the second simulates
   * cleanly, and the only difference between them is the rate.
   */
  const stepRefusal = () =>
    run("refusal", async () => {
      const now = Math.floor(Date.now() / 1000);
      const window = buildCouponWindow(now, {
        accrualSeconds: Number(accrualDays) * 86400,
        recordInSeconds: Number(recordInSeconds),
        executionInSeconds: Number(executionInSeconds),
      });
      const r = await offerRateAndBeRefused(cfg, tokenEvm, window);
      setRefusal(r);
      return {
        ok: r.refused && r.revert?.name === "InterestRateIsFixed()",
        lines: r.lines,
      };
    });

  const stepCoupon = () =>
    run("coupon", async () => {
      const d = await refresh();
      if (!d) throw new Error("could not read the token before declaring the coupon");
      const now = Math.floor(Date.now() / 1000);
      const window = buildCouponWindow(now, {
        accrualSeconds: Number(accrualDays) * 86400,
        recordInSeconds: Number(recordInSeconds),
        executionInSeconds: Number(executionInSeconds),
      });
      const problems = checkCouponWindow(window, {
        nowSeconds: now,
        maturityDate: d.maturityDate,
        couponRateType: d.couponRateType,
      });
      if (problems.length > 0) {
        throw new Error(
          "refusing to ask for a signature on a coupon the token would reject:\n  " +
            problems.join("\n  "),
        );
      }
      if (d.fixedRate && d.fixedRate.raw === "0") {
        throw new Error(
          "the token's rate storage is still 0, so the token would stamp a zero rate onto " +
            "this coupon and it would be valid and worthless. post the engine's rate first.",
        );
      }
      const r = await declareCoupon(
        cfg,
        tokenId,
        tokenEvm,
        window,
        cfg.accounts.issuer.evm,
      );
      return {
        ok: true,
        hash: r.transactionId,
        lines: [
          `coupon ${r.couponId ?? "?"} declared with rate "0" and rateStatus PENDING`,
          `record ${iso(Number(window.recordTimestamp))}, execution ${iso(Number(window.executionTimestamp))}`,
          `accrual ${iso(Number(window.startTimestamp))} to ${iso(Number(window.endTimestamp))}`,
          r.note ?? "",
        ].filter(Boolean),
      };
    });

  const stepTrigger = () =>
    run("trigger", async () => {
      const r = await triggerScheduledTasks(
        cfg,
        tokenEvm,
        cfg.accounts.issuer.evm,
        (h) => setPendingHash((p) => ({ ...p, trigger: h })),
      );
      return {
        ok: r.success,
        hash: r.hash,
        lines: [
          r.success ? "scheduled task queue drained" : "the trigger did not land",
          r.note ?? "",
        ].filter(Boolean),
      };
    });

  const stepMaturityRole = () =>
    run("maturityRole", async () => {
      const r = await grantMaturityRole(
        tokenId,
        cfg.accounts.issuer.id,
        cfg.accounts.issuer.evm,
      );
      return {
        ok: true,
        hash: r.transactionId,
        lines: [
          `maturity manager granted, by raw hex because the SDK enum has no name for it. ${r.transactionId}`,
        ],
      };
    });

  const stepMaturity = () =>
    run("maturity", async () => {
      const target =
        Math.floor(Date.now() / 1000) + Number(maturityMinutes) * 60;
      const r = await compressMaturity(cfg, tokenEvm, target, (h) =>
        setPendingHash((p) => ({ ...p, maturity: h })),
      );
      return {
        ok: r.success,
        hash: r.hash,
        lines: [
          r.success
            ? `maturity moved to ${iso(target)}, ${maturityMinutes} minutes out`
            : "the maturity update did not land",
          r.note ?? "",
        ].filter(Boolean),
      };
    });

  const stepSettle = () =>
    run("settle", async () => {
      const d = await refresh();
      const coupon = d?.coupons[d.coupons.length - 1];
      if (!coupon) throw new Error("there is no coupon to pay");
      if (!coupon.recordDateReached) {
        throw new Error(
          `the record date is ${clock(coupon.recordDate - Math.floor(Date.now() / 1000))} away. ` +
            "entitlements are zero until it passes and there is nothing to pay.",
        );
      }
      // the entitlement rows cover the parties this console watches. if the
      // register at the record date contains anyone else, paying only the
      // watched rows would be a partial payment presented as a complete one.
      const watchedEvms = new Set(
        coupon.entitlements.map((e) => e.evm.toLowerCase()),
      );
      const uncovered = coupon.holdersOfRecord.filter(
        (h) => !watchedEvms.has(h.toLowerCase()),
      );
      if (uncovered.length > 0) {
        throw new Error(
          "the register at the record date contains holders this console does not " +
            `watch, so it cannot pay them: ${uncovered.join(", ")}. refusing rather ` +
            "than paying some of the holders and calling it the coupon run.",
        );
      }
      const built = buildSettlements(
        coupon.entitlements
          .filter((e) => e.numerator !== "0")
          .map((e) => ({
            label: e.label,
            evm: e.evm,
            numerator: e.numerator,
            denominator: e.denominator,
          })),
        cfg.accounts.issuer.evm,
        Number(settlementScale),
      );
      const payable = built.filter((s) => !s.isSelf);
      if (payable.length === 0) {
        throw new Error(
          "no holder of record other than the paying account has a non-zero entitlement.",
        );
      }
      const paid = await payCouponsInHbar(cfg, built, (h, label) => {
        setPendingHash((p) => ({ ...p, settle: h }));
        append(`paying ${label}, submitted ${h}`);
      });
      setSettlements(paid);
      return {
        ok: paid.every((p) => p.success),
        hash: paid[0]?.hash,
        lines: paid.map(
          (p) =>
            `${p.label}: ${p.hbar} HBAR ${p.success ? "settled" : "failed"} ${p.hash}`,
        ),
      };
    });

  // ---------------------------------------------------------------------------

  const ready = tokenId.trim() !== "" && tokenEvm.trim() !== "";
  const issuerConnected =
    liveAccount !== null &&
    liveAccount.toLowerCase() === cfg.accounts.issuer.evm.toLowerCase();
  const wrongAccount = liveAccount !== null && !issuerConnected;

  const isFixed = diag?.couponRateType === RATE_TYPE.FIXED;
  const rateInStorage = diag?.fixedRate && diag.fixedRate.raw !== "0" ? diag.fixedRate : null;
  const latest = diag?.coupons[diag.coupons.length - 1] ?? null;
  // a non-zero rate in storage says nothing about where the rate came from. the
  // card may only go live when the integer in storage is the integer this
  // session's engine run produced, the same test the stamped card applies below.
  const storedRateIsEngineRate =
    rateInStorage !== null &&
    engineResult !== null &&
    rateInStorage.raw === String(engineResult.rate.value) &&
    rateInStorage.decimals === engineResult.rate.decimals;
  // the issuer's own entitlement, which is real, is displayed, and is never
  // paid: payCouponsInHbar skips self (`coupon-settlement.ts:134`). without
  // saying so, one small payment beside a much larger total reads as a partial
  // settlement.
  const issuerRow =
    latest?.entitlements.find(
      (e) => e.evm.toLowerCase() === cfg.accounts.issuer.evm.toLowerCase(),
    ) ?? null;
  const stampedMatchesEngine =
    latest !== null &&
    engineResult !== null &&
    latest.rate === String(engineResult.rate.value) &&
    latest.rateDecimals === engineResult.rate.decimals;

  const previewWindow: CouponWindow = buildCouponWindow(tick, {
    accrualSeconds: Number(accrualDays) * 86400,
    recordInSeconds: Number(recordInSeconds),
    executionInSeconds: Number(executionInSeconds),
  });

  const step = (
    id: StepId,
    n: string,
    title: string,
    body: React.ReactNode,
    action: () => void,
    label: string,
    disabled = false,
    needsWallet = true,
  ) => {
    const r = results[id];
    const live = pendingHash[id];
    const blocked = needsWallet && wrongAccount;
    return (
      <section
        className={
          "flex flex-col gap-2 border p-4 " +
          (r?.ok
            ? "border-emerald-600"
            : r
              ? "border-red-600"
              : "border-zinc-300 dark:border-zinc-700")
        }
      >
        <h3 className="font-semibold">
          {n}. {title}{" "}
          {r?.ok && (
            <span className="text-emerald-700 dark:text-emerald-400">done</span>
          )}
        </h3>
        <div className="text-zinc-500">{body}</div>
        {blocked && (
          <p className="border-2 border-red-600 bg-red-600 px-2 py-1 font-semibold text-white">
            wrong account. the wallet is on {liveAccount}. this step must be
            signed by the issuer {cfg.accounts.issuer.evm} and will refuse.
          </p>
        )}
        <button
          onClick={action}
          disabled={busy !== null || !ready || disabled || blocked}
          className="w-fit border border-zinc-900 px-3 py-1 disabled:opacity-40 dark:border-zinc-100"
        >
          {busy === id ? "waiting..." : label}
        </button>
        {busy === id && live && (
          <a
            className="break-all underline"
            href={hashscanTx(cfg, live)}
            target="_blank"
            rel="noreferrer"
          >
            submitted, receipt pending: {hashscanTx(cfg, live)}
          </a>
        )}
        {r && (
          <div className="flex flex-col gap-1">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all text-zinc-700 dark:text-zinc-300">
              {r.lines.join("\n")}
            </pre>
            {r.hash && (
              <a
                className="break-all underline"
                href={hashscanTx(cfg, r.hash)}
                target="_blank"
                rel="noreferrer"
              >
                {hashscanTx(cfg, r.hash)}
              </a>
            )}
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10 font-mono text-sm">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-semibold">covenant, rate and coupon</h1>
        <p className="text-zinc-500">
          the token stops accepting a rate from its caller, the confidential
          engine&apos;s output becomes the token&apos;s own rate, and the token
          stamps that rate onto a coupon we declared without naming one. hedera{" "}
          {cfg.network}.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <VerdictCard
          cfg={cfg}
          state={isFixed ? "live" : "idle"}
          title="protocol owned"
          line="coupon rate type is FIXED"
          detail="the token now reverts with InterestRateIsFixed() if a caller supplies any rate at all"
          link={results.rateType?.hash}
        />
        <VerdictCard
          cfg={cfg}
          state={storedRateIsEngineRate ? "live" : "idle"}
          title="engine priced"
          line={
            storedRateIsEngineRate
              ? `${rateInStorage?.percent} in the token's rate storage, and it is the engine's number`
              : rateInStorage
                ? `${rateInStorage.percent} is in rate storage, but no engine run in this session produced it`
                : "the engine's rate is not on chain yet"
          }
          detail={
            engineResult
              ? `run ${engineResult.runId}, ${engineResult.engine.label}, kpi ${engineResult.kpi.display}`
              : undefined
          }
          link={results.postRate?.hash}
        />
        <VerdictCard
          cfg={cfg}
          state={latest && latest.rateStatusLabel === "SET" ? "live" : "idle"}
          title="stamped"
          line={
            latest
              ? `coupon ${latest.couponId} carries ${latest.ratePercent}, status ${latest.rateStatusLabel}`
              : "no coupon declared yet"
          }
          detail={
            stampedMatchesEngine
              ? "we sent rate 0 and rateStatus PENDING. this rate came from the token's own storage."
              : latest
                ? "compare against the engine's rate below before claiming anything"
                : undefined
          }
          link={results.coupon?.hash}
        />
      </div>

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">the note and the window</h2>
        {!envToken && (
          <p className="border border-amber-600 p-2 text-amber-700 dark:text-amber-400">
            NEXT_PUBLIC_NOTE_TOKEN_ID and NEXT_PUBLIC_NOTE_TOKEN_EVM are not set.
            copy them from .env.example, or type the note below for this session.
          </p>
        )}
        <div className="grid grid-cols-[13rem_1fr] items-center gap-2">
          <label className="text-zinc-500">token id</label>
          <input
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="0.0.x"
            className="border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <label className="text-zinc-500">token evm</label>
          <input
            value={tokenEvm}
            onChange={(e) => setTokenEvm(e.target.value)}
            placeholder="0x..."
            className="border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <label className="text-zinc-500">accrual period, days</label>
          <input
            value={accrualDays}
            onChange={(e) => setAccrualDays(e.target.value)}
            className="w-40 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <label className="text-zinc-500">record date, seconds out</label>
          <input
            value={recordInSeconds}
            onChange={(e) => setRecordInSeconds(e.target.value)}
            className="w-40 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <label className="text-zinc-500">payment date, seconds out</label>
          <input
            value={executionInSeconds}
            onChange={(e) => setExecutionInSeconds(e.target.value)}
            className="w-40 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <label className="text-zinc-500">new maturity, minutes out</label>
          <input
            value={maturityMinutes}
            onChange={(e) => setMaturityMinutes(e.target.value)}
            className="w-40 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <label className="text-zinc-500">settlement scale</label>
          <input
            value={settlementScale}
            onChange={(e) => setSettlementScale(e.target.value)}
            className="w-40 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
        </div>
        <p className="text-zinc-500">
          the accrual window is backdated a full quarter, {accrualDays} days
          ending now, so the entitlement is the size a real quarterly coupon
          would be. the note itself is one day old, so that window sits before
          the note existed. the record date {recordInSeconds}s out and the
          payment date {executionInSeconds}s out are compressed for the same
          reason: the register is fixed and the entitlement becomes readable
          inside a single session.
        </p>
        <p className="text-zinc-500">
          this window is not the reporting period of the filing the engine read.
          the filing&apos;s period is an engine input, shown on the engine step.
          the two are separate things and the console does not equate them.
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
          {[
            `accrual   ${iso(Number(previewWindow.startTimestamp))} to ${iso(Number(previewWindow.endTimestamp))}`,
            `record    ${iso(Number(previewWindow.recordTimestamp))}`,
            `fixing    ${iso(Number(previewWindow.fixingTimestamp))}`,
            `payment   ${iso(Number(previewWindow.executionTimestamp))}`,
          ].join("\n")}
        </pre>
      </section>

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">0. connect</h2>
        <p className="text-zinc-500">
          every step in this block is signed by the issuer{" "}
          <b>{cfg.accounts.issuer.id}</b> ({cfg.accounts.issuer.evm}). the note
          holder and the lender never sign here. every step, SDK or raw, reads
          the live signer immediately before building a transaction and refuses
          on a mismatch.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConnect}
            disabled={busy !== null}
            className="w-fit border border-zinc-900 px-3 py-1 disabled:opacity-40 dark:border-zinc-100"
          >
            {busy === "connect" ? "connecting..." : "connect wallet"}
          </button>
          <button
            onClick={onRead}
            disabled={busy !== null || !ready}
            className="w-fit border border-zinc-900 px-3 py-1 disabled:opacity-40 dark:border-zinc-100"
          >
            {busy === "read" ? "reading..." : "read state off chain"}
          </button>
        </div>
        {wallet && (
          <p>
            {wallet.accountId} {wallet.evmAddress} on {wallet.network}
          </p>
        )}
        {liveAccount && <p>wallet is on {liveAccount} right now</p>}
        {wrongAccount && (
          <p className="border-2 border-red-600 bg-red-600 px-2 py-1 font-semibold text-white">
            the wallet is on {liveAccount}, not the issuer{" "}
            {cfg.accounts.issuer.evm}. every step below is disabled until you
            switch.
          </p>
        )}
      </section>

      {step(
        "rateRoles",
        "1",
        "grant the interest rate and corporate action roles",
        <>
          one transaction, both roles. ROLE_INTEREST_RATE_MANAGER for
          setCouponRateType and setRate, ROLE_CORPORATE_ACTION for setCoupon,
          which is a different role and a common mistake. the deployed token
          named both hashes itself, in AccountHasNoRole reverts, during the block
          C dry run.
        </>,
        stepRateRoles,
        "apply the two roles",
        Boolean(results.rateRoles?.ok),
      )}

      {step(
        "rateType",
        "2",
        "switch the coupon rate type to FIXED",
        <>
          the token is on STANDARD, which is what Factory.deployBond hardcodes.
          on STANDARD the caller hands the token a rate and the token stores
          whatever it is handed. on FIXED the token refuses a caller-supplied
          rate and reads its own storage. this must happen before the first
          coupon: InterestRate.sol:38 carries a maintainer TODO admitting they do
          not know whether a later switch is safe, and this step refuses to run
          if a coupon already exists.
        </>,
        stepRateType,
        "set rate type to FIXED",
        isFixed,
      )}

      {step(
        "engine",
        "3",
        "run the confidential engine over a borrower filing",
        <>
          no chain, no wallet, no signature. the borrower&apos;s financials go
          into the engine and a rate comes out. the financials do not come back
          out and are not in the response.
          <div className="mt-2 flex flex-col gap-1">
            {FIXTURES.map((f) => (
              <label key={f.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fixture"
                  checked={fixtureId === f.id}
                  onChange={() => setFixtureId(f.id)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </>,
        stepEngine,
        "run the engine",
        false,
        false,
      )}

      {step(
        "postRate",
        "4",
        "post the engine's rate to the token",
        <>
          FixedRate.setRate, role gated, and its entire payload is the engine
          output from step 3. this step refuses to run without one, because a
          rate typed by a person is the thing this whole block exists to avoid.
          the engine reports the rate as an integer scaled by its own decimals
          and the SDK wants the decimal fraction, so the conversion is done in
          one place, engineRateForSdk, with the two BigDecimal results that prove
          which is which.
        </>,
        stepPostRate,
        "post the rate",
        !engineResult,
      )}

      {step(
        "refusal",
        "4b",
        "offer the token a rate it did not ask for, and watch it refuse",
        <>
          an eth_call of setCoupon carrying rate 6 at 2 decimals marked SET,
          which is a rate we chose rather than one the token owns. no signature,
          no gas, no state. under FIXED the token checks the triplet before it
          checks anything about the coupon and reverts InterestRateIsFixed(),
          and the decoded revert is printed below. the identical call with the
          pending triplet is simulated straight after and passes, so the window,
          the role and the token state are ruled out and the rate is the only
          difference between them.
        </>,
        stepRefusal,
        "offer a rate and read the refusal",
        !isFixed,
        false,
      )}

      {refusal && (
        <section
          className={
            "flex flex-col gap-2 border-2 p-4 " +
            (refusal.revert?.name === "InterestRateIsFixed()"
              ? "border-red-600"
              : "border-amber-600")
          }
        >
          <h2 className="text-2xl font-bold tracking-tight uppercase">
            the token refused our rate
          </h2>
          <p className="text-zinc-500">
            offered rate {refusal.offered.rate} at{" "}
            {refusal.offered.rateDecimals} decimals, rateStatus SET. answered by
            the deployed token over eth_call, from{" "}
            {cfg.accounts.issuer.evm}.
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-lg font-semibold">
            {refusal.revert?.summary ??
              (refusal.refused
                ? "reverted, revert data unreadable"
                : "not refused")}
          </pre>
          {refusal.revert?.raw && (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all text-zinc-500">
              revert data {refusal.revert.raw}
            </pre>
          )}
          <p className="text-zinc-500">
            {refusal.pendingAccepted === true
              ? "the identical call with rate 0 and rateStatus PENDING simulates cleanly. the rate is the only difference."
              : refusal.pendingAccepted === false
                ? "the control call also reverted, so this cannot be read as a rate refusal on its own. see the log."
                : "control call not run."}
          </p>
        </section>
      )}

      {step(
        "coupon",
        "5",
        "declare the coupon, naming no rate",
        <>
          rate &quot;0&quot;, rateStatus PENDING. that triplet is the whole
          point: CouponRateDispatch requires rate, rateDecimals and rateStatus to
          all be zero under FIXED and reverts InterestRateIsFixed() on anything
          else, then stamps the rate from the token&apos;s own storage. every
          on-chain date guard is checked here first, including endDate against
          maturity, which the SDK does not check and which costs gas to discover.
        </>,
        stepCoupon,
        "declare the coupon",
      )}

      {step(
        "trigger",
        "6",
        "drain the scheduled task queue at the record date",
        <>
          setCoupon queues a snapshot at the record date, and the queue is
          drained by the next state-mutating call rather than by a clock. until
          something drains it the coupon carries snapshotId 0 and the holder list
          is read live instead of as at the record date. this call is that
          transaction and nothing else. it needs no role.
          {latest && (
            <div className="mt-1">
              record date is{" "}
              <b>
                {latest.recordDate < tick
                  ? `${clock(tick - latest.recordDate)} past`
                  : `${clock(latest.recordDate - tick)} away`}
              </b>
              , snapshotId {latest.snapshotId}
            </div>
          )}
        </>,
        stepTrigger,
        "trigger scheduled tasks",
      )}

      {step(
        "maturityRole",
        "7",
        "grant the maturity manager role",
        <>
          on its own, as a raw hex literal, because it cannot travel with the
          other two. ROLE_MATURITY_MANAGER is missing from the SDK&apos;s
          SecurityRole enum and applyRoles validates each role against that enum,
          so applyRoles rejects it before any transaction exists. grantRole
          validates the same field as a bytes32 shape and accepts it. BUG.md B7.
        </>,
        stepMaturityRole,
        "grant maturity manager",
        Boolean(results.maturityRole?.ok),
      )}

      {step(
        "maturity",
        "8",
        "compress the lifecycle",
        <>
          the note matures in {diag ? clock(diag.secondsToMaturity) : "three years"}.
          this moves it to {maturityMinutes} minutes out. it cannot go through
          the SDK: ValidationService.checkMaturityDate refuses any date earlier
          than the current one, client side, while the contract checks only that
          the date is in the future. BUG.md B9. maturity gates exactly two
          things, redemption at maturity and a coupon&apos;s end date, so
          compressing after the coupon is declared touches nothing else.
        </>,
        stepMaturity,
        "compress maturity",
      )}

      {step(
        "settle",
        "9",
        "pay the holders of record",
        <>
          <b>this step is not an ATS operation.</b> the coupon facet has no
          transfer: getCouponFor and getCouponAmountFor are view functions that
          compute what each holder is owed, and ICoupon declares no payment
          method at all. so ATS fixes the register and publishes the entitlement,
          and the agent pays it. these are plain value transfers signed by the
          agent, one per holder. the entitlement is denominated in the
          note&apos;s currency. testnet has no such instrument and we deploy no
          contracts, so we settle in HBAR at a stated demo scale of 1 per{" "}
          {settlementScale} of entitlement. it is not an exchange rate. the
          issuer holds the unsold notes and does not pay itself, so its
          entitlement appears in the table above and is not settled.
        </>,
        stepSettle,
        "pay the coupon",
      )}

      {(latest || engineResult) && (
        <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="font-semibold">
            what we sent, and what the token stamped
          </h2>
          <p className="text-zinc-500">
            the claim of this block is not that a transaction landed. it is that
            the rate on the coupon is the engine&apos;s rate and that the token
            put it there. these are the three values that show it.
          </p>
          <dl className="grid grid-cols-[18rem_1fr] gap-x-3">
            <dt className="text-zinc-500">engine output</dt>
            <dd>
              {engineResult
                ? `${engineResult.rate.display}, raw ${engineResult.rate.value} at ${engineResult.rate.decimals} decimals`
                : "no engine run in this session"}
            </dd>
            <dt className="text-zinc-500">what we sent with the coupon</dt>
            <dd>rate &quot;0&quot;, rateDecimals 0, rateStatus PENDING</dd>
            <dt className="text-zinc-500">token rate storage, getRate()</dt>
            <dd>
              {diag?.fixedRate
                ? `${diag.fixedRate.raw} at ${diag.fixedRate.decimals} decimals, ${diag.fixedRate.percent}`
                : "unreadable"}
            </dd>
            <dt className="text-zinc-500">stamped on the coupon</dt>
            <dd>
              {latest
                ? `${latest.rate} at ${latest.rateDecimals} decimals, ${latest.ratePercent}, status ${latest.rateStatusLabel}`
                : "no coupon yet"}
            </dd>
            <dt className="text-zinc-500">match</dt>
            <dd
              className={
                stampedMatchesEngine
                  ? "font-semibold text-emerald-700 dark:text-emerald-400"
                  : "text-zinc-500"
              }
            >
              {stampedMatchesEngine
                ? "the stamped rate equals the engine's rate, to the raw integer and the decimals"
                : "not yet comparable"}
            </dd>
          </dl>
        </section>
      )}

      {diag && (
        <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="font-semibold">state read back off chain</h2>
          <dl className="grid grid-cols-[18rem_1fr] gap-x-3">
            <dt className="text-zinc-500">coupon rate type</dt>
            <dd
              className={
                isFixed ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""
              }
            >
              {diag.couponRateTypeLabel} ({diag.couponRateType})
            </dd>
            <dt className="text-zinc-500">rate storage</dt>
            <dd>
              {diag.fixedRate
                ? `${diag.fixedRate.percent}, raw ${diag.fixedRate.raw} at ${diag.fixedRate.decimals} decimals`
                : "unreadable"}
            </dd>
            <dt className="text-zinc-500">coupons</dt>
            <dd>{diag.couponCount}</dd>
            <dt className="text-zinc-500">supply</dt>
            <dd>
              {diag.totalSupply} notes at {diag.nominalValue} nominal each
            </dd>
            <dt className="text-zinc-500">maturity</dt>
            <dd>
              {iso(diag.maturityDate)}, {clock(diag.maturityDate - tick)} out
            </dd>
            <dt className="text-zinc-500">scheduled tasks queued</dt>
            <dd>
              {diag.scheduledTaskCount}
              {diag.scheduledTaskTimestamps.length > 0 &&
                ` (next at ${iso(diag.scheduledTaskTimestamps[0])})`}
            </dd>
            <dt className="text-zinc-500">paused / deactivated</dt>
            <dd>
              {String(diag.paused)} / {String(diag.deactivated)}
            </dd>
            <dt className="text-zinc-500">issuer roles</dt>
            <dd>
              {diag.issuerRoles
                .filter((r) => r.held)
                .map((r) => r.name)
                .join(", ") || "none"}
            </dd>
          </dl>

          {diag.coupons.map((c) => (
            <div key={c.couponId} className="mt-2 border-t border-zinc-300 pt-2 dark:border-zinc-700">
              <h3 className="font-semibold">
                coupon {c.couponId}, {c.ratePercent}, {c.rateStatusLabel}
                {c.isDisabled && " (cancelled)"}
              </h3>
              <pre className="overflow-x-auto whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                {[
                  `accrual   ${iso(c.startDate)} to ${iso(c.endDate)}`,
                  `record    ${iso(c.recordDate)}  ${c.recordDateReached ? "reached" : `${clock(c.recordDate - tick)} away`}`,
                  `payment   ${iso(c.executionDate)}`,
                  `snapshot  ${c.snapshotId === "0" ? "0, not taken yet, holders read live" : c.snapshotId}`,
                  `holders   ${c.totalHolders} of record`,
                ].join("\n")}
              </pre>
              <table className="mt-1 w-full text-left">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="pr-3">holder</th>
                    <th className="pr-3">notes</th>
                    <th className="pr-3">entitlement</th>
                    <th className="pr-3">as ATS returns it</th>
                  </tr>
                </thead>
                <tbody>
                  {c.entitlements.map((e) => (
                    <tr key={e.evm} className="align-top">
                      <td className="pr-3">{e.label}</td>
                      <td className="pr-3">{e.balance}</td>
                      <td className="pr-3">{e.amount}</td>
                      <td className="pr-3 break-all text-zinc-500">
                        {e.numerator} / {e.denominator}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {diag.notes.length > 0 && (
            <>
              <h3 className="mt-1 font-semibold">notes</h3>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all text-zinc-600 dark:text-zinc-400">
                {diag.notes.join("\n")}
              </pre>
            </>
          )}
        </section>
      )}

      {settlements.length > 0 && (
        <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="font-semibold">
            settlement, performed by the agent and not by ATS
          </h2>
          <p className="text-zinc-500">
            plain value transfers from {cfg.accounts.issuer.id}. the entitlement
            is denominated in the note&apos;s currency. testnet has no such
            instrument and we deploy no contracts, so we settle in HBAR at a
            stated demo scale of 1 per {settlementScale} of entitlement. it is
            not an exchange rate.
          </p>
          <p className="text-zinc-500">
            {issuerRow
              ? `the issuer holds ${issuerRow.balance} of the ${diag?.totalSupply ?? "?"} notes and does not pay itself. the entitlement on those notes, ${issuerRow.amount}, is shown above and is not settled.`
              : "the issuer does not pay itself. any entitlement on notes the issuer still holds is shown above and is not settled."}
          </p>
          {settlements.map((s) => (
            <div key={s.evm} className="flex flex-col">
              <span>
                {s.label}: {s.hbar} HBAR, {s.success ? "settled" : "failed"}
              </span>
              {s.hash && (
                <a
                  className="break-all underline"
                  href={hashscanTx(cfg, s.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {hashscanTx(cfg, s.hash)}
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      {error && (
        <section className="flex flex-col gap-2 border border-red-600 p-4">
          <h2 className="font-semibold text-red-700 dark:text-red-400">error</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all">
            {error}
          </pre>
        </section>
      )}

      {log.length > 0 && (
        <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="font-semibold">log</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-zinc-600 dark:text-zinc-400">
            {log.join("\n")}
          </pre>
        </section>
      )}

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">what ATS does here, and what it does not</h2>
        <p className="text-zinc-500">
          it does: refuse a caller-supplied rate once the type is FIXED, hold the
          rate in storage only a role-gated transaction can write, stamp that
          rate onto every coupon itself, schedule a snapshot at the record date,
          and publish each holder&apos;s entitlement as a recomputable fraction
          of nominal.
        </p>
        <p className="text-zinc-500">
          it does not: move any value. ICoupon declares setCoupon, cancelCoupon,
          forceCancelCoupon and initializeCoupon, and no payment method.
          getCouponFor and getCouponAmountFor are view functions. step 9 is our
          own transfer and the console labels it as one.
        </p>
        <p className="text-zinc-500">
          the KPI-linked rate mechanism, addKpiData and KpiLinkedRateFacet, is
          not on this token and could not be: config 4 is registered in the
          deployed resolver and reachable by no path. BUG.md B1. so the
          conversion from a KPI reading to a rate happens off chain, in the
          engine, against bounds published at issuance, and the rate reaches the
          token through setRate.
        </p>
      </section>
    </main>
  );
}
