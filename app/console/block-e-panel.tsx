"use client";

// covenant, the collateral hold console.
//
// two holds over the same instrument. hold A is released, hold B is executed.
// the escrow is the engine account on both, and the destination is pinned to the
// lender on both, so the only thing that differs between them is the engine's
// decision. that is the whole claim, and the read-back panel at the bottom is
// where a viewer can check it against the token rather than against our copy.
//
// this panel needs two account switches partway through, which no other panel
// does. every step below names the account that must sign it, refuses to build a
// transaction from any other, and asks the token itself, by eth_call from the
// live account, what would happen before anything is signed.
//
// every state change goes through lib/ats/collateral.ts. every read goes through
// lib/ats/diagnostics.ts and touches no wallet.

import { useCallback, useEffect, useMemo, useState } from "react";
import { hashscanTx, readConfig, type CovenantConfig } from "@/lib/config";
import { connectWallet, type ConnectResult } from "@/lib/ats/client";
import { readNoteTokenRef } from "@/lib/ats/token-ref";
import {
  readHoldDiagnostics,
  type HoldDiagnostics,
  type HoldReadBack,
} from "@/lib/ats/diagnostics";
import {
  buildHoldPlan,
  createCollateralHold,
  dryRunCreateHold,
  dryRunExecuteHold,
  dryRunReleaseHold,
  executeCollateralHold,
  reclaimCollateralHold,
  releaseCollateralHold,
  HOLD_MINUTES_DEFAULT,
  type DryRun,
  type HoldPlan,
} from "@/lib/ats/collateral";

type StepId = "createA" | "releaseA" | "createB" | "executeB" | "reclaim";

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

/** the two outcomes this block exists to make visible, side by side. */
function OutcomeCard({
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
    title === "released"
      ? "border-sky-700 bg-sky-700 text-white"
      : "border-red-600 bg-red-600 text-white";
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

/**
 * the escrow and destination of one hold, read off the token.
 *
 * this is the collateral hold gate, so it is a card and not a table row. `escrow_` is
 * the engine and `destination_` is the lender, both returned by
 * `getHoldForByPartition`, neither taken from our own state.
 */
function HoldProof({ hold, cfg }: { hold: HoldReadBack; cfg: CovenantConfig }) {
  const row = (
    label: string,
    value: string,
    resolved: string,
    ok: boolean,
    expected: string,
  ) => (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-2">
      <span className="text-zinc-500">{label}</span>
      <span className={ok ? "" : "text-red-600 dark:text-red-400"}>
        <span className="break-all">{value}</span>
        <br />
        <span className="text-zinc-500">
          {resolved}
          {ok ? "" : ` — expected ${expected}`}
        </span>
      </span>
    </div>
  );
  return (
    <div
      className={
        "flex flex-col gap-2 border-2 p-4 " +
        (hold.escrowIsEngine && hold.destinationIsLender
          ? "border-emerald-600"
          : "border-red-600")
      }
    >
      <h3 className="font-semibold">
        hold {hold.holdId}, {hold.holderLabel}, {hold.amount} notes
        {hold.expired ? " — EXPIRED" : ""}
      </h3>
      {row(
        "escrow",
        hold.escrow,
        hold.escrowLabel,
        hold.escrowIsEngine,
        `the engine ${cfg.accounts.engine.id}`,
      )}
      {row(
        "destination",
        hold.destination,
        hold.destinationPinned ? hold.destinationLabel : "unpinned, any recipient",
        hold.destinationIsLender,
        `the lender ${cfg.accounts.lender.id}`,
      )}
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <span className="text-zinc-500">expires</span>
        <span>
          {hold.expirationIso} ({Math.round(hold.secondsToExpiry / 60)} minutes
          from now)
        </span>
        <span className="text-zinc-500">data</span>
        <span className="break-all">
          {hold.data === "0x" ? "0x, the SDK hardcodes it" : hold.data}
        </span>
        <span className="text-zinc-500">origin</span>
        <span>
          {hold.thirdPartyTypeLabel}, the holder created it over its own balance
        </span>
      </div>
    </div>
  );
}

export default function BlockEPanel() {
  const cfg = useMemo(() => readConfig(), []);
  const envToken = useMemo(() => readNoteTokenRef(), []);

  const [tokenId, setTokenId] = useState(envToken?.id ?? "");
  const [tokenEvm, setTokenEvm] = useState(envToken?.evm ?? "");
  const [amount, setAmount] = useState("100");
  const [minutes, setMinutes] = useState(String(HOLD_MINUTES_DEFAULT));

  const [wallet, setWallet] = useState<ConnectResult | null>(null);
  const [busy, setBusy] = useState<StepId | "connect" | "read" | null>(null);
  const [results, setResults] = useState<Partial<Record<StepId, StepResult>>>({});
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [diag, setDiag] = useState<HoldDiagnostics | null>(null);
  const [dry, setDry] = useState<Partial<Record<StepId, DryRun>>>({});
  const [holdA, setHoldA] = useState<number | null>(null);
  const [holdB, setHoldB] = useState<number | null>(null);
  const [reclaimId, setReclaimId] = useState("");
  /** the account the wallet is on right now, not the one connect was pressed on */
  const [liveAccount, setLiveAccount] = useState<string | null>(null);
  const [pendingHash, setPendingHash] = useState<Partial<Record<StepId, string>>>({});

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
      { label: "engine / escrow", ...cfg.accounts.engine },
    ],
    [cfg],
  );

  const ready = tokenId.trim().length > 0 && tokenEvm.trim().length > 0;

  /**
   * the parameters of both holds.
   *
   * built fresh at every use rather than held in a memo, because the expiry is
   * relative to now. a plan computed when the page loaded is stale by however
   * long the console has been open, and this is the one field where staleness is
   * fatal in both directions: an expiry already passed is refused at creation,
   * and an expiry that looks fine on screen but was computed an hour ago leaves
   * less working time than the number says. `plan` below is the preview, kept in
   * state so the screen shows what the last build produced; every dry run and
   * every create rebuilds it first.
   */
  const buildPlan = useCallback(
    (): HoldPlan => buildHoldPlan(cfg, amount, Number(minutes)),
    [cfg, amount, minutes],
  );
  /**
   * bumped whenever the console does anything, so the preview below re-derives
   * its expiry from the current clock rather than from page load.
   */
  const [planTick, setPlanTick] = useState(0);
  const plan = useMemo((): HoldPlan | null => {
    void planTick;
    try {
      return buildPlan();
    } catch {
      return null;
    }
  }, [buildPlan, planTick]);

  /**
   * the plan used to release or execute a hold that already exists.
   *
   * `HoldPlan.expirationSeconds` is not sent by either call: release and execute
   * address an existing hold by (partition, holder, id) and the expiry is
   * already on chain. so a typo in the expiry box must not be able to block the
   * two steps this block exists for, and this falls back to the default window
   * rather than throwing.
   */
  const resolvePlan = useCallback((): HoldPlan => {
    try {
      return buildPlan();
    } catch {
      return buildHoldPlan(cfg, amount, HOLD_MINUTES_DEFAULT);
    }
  }, [buildPlan, cfg, amount]);

  const record = useCallback((id: StepId, r: StepResult) => {
    setResults((p) => ({ ...p, [id]: r }));
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenEvm.trim()) return null;
    const d = await readHoldDiagnostics(cfg, tokenEvm, watched, [
      { label: "note holder", ...cfg.accounts.holder },
      { label: "issuer / agent", ...cfg.accounts.issuer },
    ]);
    setDiag(d);

    // the dry runs are issued from the LIVE account, deliberately. asking the
    // token what would happen from the account we intend to use proves nothing
    // about the account that is actually connected, and the account that is
    // actually connected is the risk in this block.
    const from = liveAccount ?? cfg.accounts.holder.evm;
    let p: HoldPlan | null = null;
    try {
      p = buildPlan();
      setPlanTick((t) => t + 1);
    } catch (e) {
      append(`the hold parameters are not valid: ${errorText(e)}`);
    }
    if (p) {
      try {
        const create = await dryRunCreateHold(cfg, tokenEvm, p, d.decimals, from);
        setDry((prev) => ({ ...prev, createA: create, createB: create }));
        append(create.summary);
      } catch (e) {
        append(`create dry run failed: ${errorText(e)}`);
      }
      if (holdA !== null) {
        const rel = await dryRunReleaseHold(
          cfg,
          tokenEvm,
          cfg.accounts.holder.evm,
          holdA,
          p.amount,
          d.decimals,
          from,
        );
        setDry((prev) => ({ ...prev, releaseA: rel }));
        append(rel.summary);
      }
      if (holdB !== null) {
        const exe = await dryRunExecuteHold(
          cfg,
          tokenEvm,
          cfg.accounts.holder.evm,
          holdB,
          cfg.accounts.lender.evm,
          p.amount,
          d.decimals,
          from,
        );
        setDry((prev) => ({ ...prev, executeB: exe }));
        append(exe.summary);
      }
    }
    return d;
  }, [cfg, tokenEvm, watched, liveAccount, buildPlan, holdA, holdB, append]);

  // the read-back is NOT inside the same try as the transaction. same reasoning
  // as in the compliance panel: a rejected read is a warning about the screen,
  // never a verdict
  // about the chain, and it must not overwrite a landed transaction's hash.
  const run = useCallback(
    async (id: StepId, fn: () => Promise<StepResult>) => {
      setBusy(id);
      setError(null);
      setPendingHash((p) => ({ ...p, [id]: undefined }));
      let landed = false;
      try {
        const r = await fn();
        record(id, r);
        r.lines.forEach(append);
        landed = true;
      } catch (e) {
        const text = errorText(e);
        setError(text);
        setResults((p) => ({ ...p, [id]: { ...p[id], ok: false, lines: [text] } }));
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
    [record, append, refresh],
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

  const stepCreate = (id: "createA" | "createB", setId: (n: number | null) => void) =>
    run(id, async () => {
      // rebuilt here, at the click, so the expiry is measured from the moment of
      // signing rather than from whenever the console last rendered.
      const plan = buildPlan();
      setPlanTick((t) => t + 1);
      const r = await createCollateralHold(cfg, tokenId, tokenEvm, plan, (h) =>
        setPendingHash((p) => ({ ...p, [id]: h })),
      );
      setId(r.holdId);
      return {
        ok: true,
        hash: r.transactionId,
        lines: [
          `hold ${r.holdId ?? "(id unread)"} created over ${plan.amount} notes of ${plan.holder.id}`,
          `escrow ${plan.escrow.id} ${plan.escrow.evm}`,
          `destination ${plan.destination.id} ${plan.destination.evm}`,
          `expires ${plan.expirationIso}`,
          ...(r.note ? [r.note] : []),
        ],
      };
    });

  const stepRelease = () =>
    run("releaseA", async () => {
      const plan = resolvePlan();
      if (holdA === null) throw new Error("hold A has no id yet. create it first.");
      const r = await releaseCollateralHold(cfg, tokenId, tokenEvm, plan, holdA, (h) =>
        setPendingHash((p) => ({ ...p, releaseA: h })),
      );
      return {
        ok: r.success,
        hash: r.hash,
        lines: [
          r.success
            ? `hold ${holdA} released. the notes are back with ${plan.holder.id}.`
            : `release refused on chain: ${r.revert?.summary ?? "no reason returned"}`,
          ...(r.note ? [r.note] : []),
        ],
      };
    });

  const stepExecute = () =>
    run("executeB", async () => {
      const plan = resolvePlan();
      if (holdB === null) throw new Error("hold B has no id yet. create it first.");
      const r = await executeCollateralHold(cfg, tokenId, tokenEvm, plan, holdB, (h) =>
        setPendingHash((p) => ({ ...p, executeB: h })),
      );
      return {
        ok: r.success,
        hash: r.hash,
        lines: [
          r.success
            ? `hold ${holdB} executed. ${plan.amount} notes moved from ${plan.holder.id} to the lender ${plan.destination.id}, by the escrow ${plan.escrow.id}.`
            : `execute refused on chain: ${r.revert?.summary ?? "no reason returned"}`,
          ...(r.note ? [r.note] : []),
        ],
      };
    });

  const stepReclaim = () =>
    run("reclaim", async () => {
      const id = Number.parseInt(reclaimId, 10);
      if (!Number.isFinite(id)) throw new Error("enter the hold id to reclaim");
      const r = await reclaimCollateralHold(
        cfg,
        tokenId,
        tokenEvm,
        cfg.accounts.holder,
        id,
        liveAccount ?? cfg.accounts.holder.evm,
        (h) => setPendingHash((p) => ({ ...p, reclaim: h })),
      );
      return {
        ok: r.success,
        hash: r.hash,
        lines: [
          r.success
            ? `hold ${id} reclaimed to ${cfg.accounts.holder.id}`
            : `reclaim refused: ${r.revert?.summary ?? "no reason returned"}`,
        ],
      };
    });

  // ---------------------------------------------------------------------------
  // rendering
  // ---------------------------------------------------------------------------

  const step = (
    id: StepId,
    n: string,
    title: string,
    signer: { label: string; id: string; evm: string },
    body: React.ReactNode,
    label: string,
    action: () => void,
    disabled = false,
  ) => {
    const r = results[id];
    const live = pendingHash[id];
    const d = dry[id];
    const connectedRight =
      liveAccount !== null && liveAccount.toLowerCase() === signer.evm.toLowerCase();
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
          {r?.ok && <span className="text-emerald-700 dark:text-emerald-400">done</span>}
        </h3>
        <p className="text-zinc-500">
          signed by the {signer.label} <b>{signer.id}</b> ({signer.evm}). say the
          account out loud before confirming.
        </p>
        <div className="text-zinc-500">{body}</div>
        {liveAccount && !connectedRight && (
          <p className="border-2 border-red-600 bg-red-600 px-2 py-1 font-semibold text-white">
            wrong account. the wallet is on {liveAccount}. this step must be
            signed by the {signer.label} {signer.evm}, and it will refuse to
            build a transaction until you switch.
          </p>
        )}
        {d && (
          <p
            className={
              "border px-2 py-1 " +
              (d.ok
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "border-amber-600 text-amber-700 dark:text-amber-400")
            }
          >
            dry run, eth_call from {d.from}: {d.summary}
          </p>
        )}
        <button
          onClick={action}
          disabled={busy !== null || !ready || disabled}
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

  const unmet = diag?.prerequisites.filter((p) => !p.ok) ?? [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10 font-mono text-sm">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-semibold">covenant, collateral hold</h1>
        <p className="text-zinc-500">
          the note holder pledges the note twice, naming the confidential engine
          as escrow and the lender as the only permitted destination. the engine
          releases one and executes the other. hedera {cfg.network}.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <OutcomeCard
          cfg={cfg}
          state={results.releaseA?.ok ? "live" : "idle"}
          title="released"
          line={`hold A, ${amount} notes returned to the note holder`}
          detail={`the borrower repaid. released by the escrow ${cfg.accounts.engine.id}, not by the agent.`}
          link={results.releaseA?.hash}
        />
        <OutcomeCard
          cfg={cfg}
          state={results.executeB?.ok ? "live" : "idle"}
          title="executed"
          line={`hold B, ${amount} notes moved to the lender ${cfg.accounts.lender.id}`}
          detail={`the covenant breached. executed by the escrow ${cfg.accounts.engine.id}, on a number the lender never saw.`}
          link={results.executeB?.hash}
        />
      </div>

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">the note, the amount and the window</h2>
        {!envToken && (
          <p className="border border-amber-600 p-2 text-amber-700 dark:text-amber-400">
            NEXT_PUBLIC_NOTE_TOKEN_ID and NEXT_PUBLIC_NOTE_TOKEN_EVM are not set.
            type the note below for this session.
          </p>
        )}
        <div className="grid grid-cols-[9rem_1fr] items-center gap-2">
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
          <label className="text-zinc-500">hold, notes</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-40 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <label className="text-zinc-500">expiry, minutes</label>
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-40 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
        </div>
        <p className="text-zinc-500">
          expiry ends both outcomes, not one: past it, release and execute both
          revert HoldExpirationReached and only reclaim works. 10 to 180
          minutes, long enough to complete both holds and short enough that a
          mistake heals itself.
        </p>
        {plan ? (
          <p>
            escrow <b>{plan.escrow.id}</b> {plan.escrow.evm}, destination{" "}
            <b>{plan.destination.id}</b> {plan.destination.evm}, expires{" "}
            {plan.expirationIso}
          </p>
        ) : (
          <p className="text-red-600 dark:text-red-400">
            the expiry is outside the permitted window. nothing can be signed.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">0. connect</h2>
        <p className="text-zinc-500">
          this block switches accounts twice. the note holder{" "}
          <b>{cfg.accounts.holder.id}</b> creates both holds. the engine{" "}
          <b>{cfg.accounts.engine.id}</b> releases one and executes the other. the
          issuer signs nothing here.
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
      </section>

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">prerequisites</h2>
        <p className="text-zinc-500">
          the on-chain checks run in a fixed order and KYC is checked before
          the escrow, so one missing grant hides every other problem until it is
          fixed. check all of them before signing anything.
        </p>
        {!diag && <p className="text-zinc-500">read state off chain to populate this.</p>}
        {diag && (
          <>
            <ul className="flex flex-col gap-1">
              {diag.prerequisites.map((p) => (
                <li key={p.name} className="grid grid-cols-[5rem_1fr] gap-2">
                  <span
                    className={
                      p.ok
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "font-semibold text-red-600 dark:text-red-400"
                    }
                  >
                    {p.ok ? "ok" : "MISSING"}
                  </span>
                  <span>
                    {p.name}
                    <br />
                    <span className="text-zinc-500">{p.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {unmet.length > 0 && (
              <p className="border-2 border-red-600 px-2 py-1 font-semibold text-red-600 dark:text-red-400">
                {unmet.length} prerequisite{unmet.length === 1 ? "" : "s"} unmet.
                createHoldByPartition and executeHoldByPartition revert until
                every one is green. KYC is granted on the compliance panel.
              </p>
            )}
            <table className="w-full text-left">
              <thead className="text-zinc-500">
                <tr>
                  <th>account</th>
                  <th>available</th>
                  <th>held</th>
                  <th>holds</th>
                  <th>kyc</th>
                </tr>
              </thead>
              <tbody>
                {diag.accounts.map((a) => (
                  <tr key={a.evm}>
                    <td>
                      {a.label} {a.accountId}
                    </td>
                    <td>{a.available}</td>
                    <td>{a.held}</td>
                    <td>{a.holdIds.join(", ") || "-"}</td>
                    <td
                      className={
                        a.kycStatus === 1
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {a.kycStatusLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <h2 className="font-semibold">hold A. the borrower repays.</h2>

      {step(
        "createA",
        "A1",
        "create hold A",
        { label: "note holder", ...cfg.accounts.holder },
        <>
          createHoldByPartition over {amount} notes, escrow{" "}
          {cfg.accounts.engine.id}, destination pinned to the lender{" "}
          {cfg.accounts.lender.id}. the contract holds from msg.sender and takes
          no from parameter, so the connected account IS the pledging account.
        </>,
        "create hold A",
        () => stepCreate("createA", setHoldA),
        holdA !== null,
      )}

      {step(
        "releaseA",
        "A2",
        "release hold A",
        { label: "engine / escrow", ...cfg.accounts.engine },
        <>
          the borrower repaid, so the collateral goes back. only the escrow may
          call this: HoldStorageWrapper reverts IsNotEscrow for anyone else, and
          the SDK does not pre-check it, so a wrong account costs a real
          signature.
        </>,
        "release hold A",
        stepRelease,
        holdA === null,
      )}

      <h2 className="font-semibold">hold B. the covenant breaches.</h2>

      {step(
        "createB",
        "B1",
        "create hold B",
        { label: "note holder", ...cfg.accounts.holder },
        <>
          identical parameters to hold A. same escrow, same pinned destination,
          same amount. the only thing that will differ is what the engine decides.
        </>,
        "create hold B",
        () => stepCreate("createB", setHoldB),
        holdB !== null,
      )}

      {step(
        "executeB",
        "B2",
        "execute hold B",
        { label: "engine / escrow", ...cfg.accounts.engine },
        <>
          the collateral moves to the lender {cfg.accounts.lender.id}, and it can
          move nowhere else: the destination was pinned when the hold was
          created, and executing to any other address reverts
          InvalidDestinationAddress. the escrow decides between this and release,
          and the escrow is not the agent.
        </>,
        "execute hold B",
        stepExecute,
        holdB === null,
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">
          state read back off chain. escrow and destination, from the token.
        </h2>
        <p className="text-zinc-500">
          getHoldForByPartition, an eth_call, no wallet. these two fields are the
          checkable form of the whole arrangement: the engine holds the decision
          and the lender is the only place the collateral can go.
        </p>
        {diag?.holds.length === 0 && (
          <p className="text-zinc-500">no holds on this token yet.</p>
        )}
        {diag?.holds.map((h) => (
          <HoldProof key={`${h.holderEvm}-${h.holdId}`} hold={h} cfg={cfg} />
        ))}
      </section>

      <section className="flex flex-col gap-2 border border-amber-600 p-4">
        <h2 className="font-semibold text-amber-700 dark:text-amber-400">
          recovery only. not part of the normal sequence.
        </h2>
        <p className="text-zinc-500">
          reclaim is the one hold verb with no escrow check: past expiry, anyone
          can return the notes to the holder. it exists here because a hold
          created with a wrong escrow cannot be released or executed by anybody,
          and this is the only way it ever comes back. it works only after the
          hold has expired, and reverts HoldExpirationNotReached before that.
        </p>
        <div className="flex items-center gap-2">
          <label className="text-zinc-500">hold id</label>
          <input
            value={reclaimId}
            onChange={(e) => setReclaimId(e.target.value)}
            className="w-24 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <button
            onClick={stepReclaim}
            disabled={busy !== null || !ready}
            className="w-fit border border-amber-600 px-3 py-1 disabled:opacity-40"
          >
            {busy === "reclaim" ? "waiting..." : "reclaim an expired hold"}
          </button>
        </div>
        {results.reclaim && (
          <pre className="overflow-x-auto whitespace-pre-wrap break-all">
            {results.reclaim.lines.join("\n")}
          </pre>
        )}
      </section>

      {error && (
        <section className="border border-red-600 p-4">
          <h2 className="font-semibold text-red-600 dark:text-red-400">error</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all">{error}</pre>
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

      {diag && diag.notes.length > 0 && (
        <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="font-semibold">reads that did not return</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-zinc-600 dark:text-zinc-400">
            {diag.notes.join("\n")}
          </pre>
        </section>
      )}
    </main>
  );
}
