"use client";

// covenant block B. the compliance console.
//
// the whole point of this screen is that a viewer can tell blocked from granted
// from permitted at a glance, so the three verdict cards at the top are large,
// high contrast, and stay on screen. everything else is the working area.
//
// every state change goes through lib/ats/compliance.ts. every read goes
// through lib/ats/diagnostics.ts and touches no wallet.

import { useCallback, useEffect, useMemo, useState } from "react";
import { hashscanTx, readConfig, type CovenantConfig } from "@/lib/config";
import { connectWallet, type ConnectResult } from "@/lib/ats/client";
import { readNoteTokenRef } from "@/lib/ats/token-ref";
import {
  readComplianceDiagnostics,
  readTransferPreflight,
  type ComplianceDiagnostics,
  type TransferPreflight,
} from "@/lib/ats/diagnostics";
import {
  addCredentialIssuer,
  attemptTransfer,
  forceTransferOnChain,
  grantComplianceRoles,
  grantInternalKyc,
  issueNotes,
} from "@/lib/ats/compliance";

type StepId =
  | "roles"
  | "issuer"
  | "kycIssuer"
  | "issue"
  | "blocked"
  | "forced"
  | "kycHolder"
  | "kycLender"
  | "permitted";

interface StepResult {
  ok: boolean;
  /** the ethereum transaction hash, when the step produced one */
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

/** the three states the whole block exists to make visible. */
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
    title === "blocked"
      ? "border-red-600 bg-red-600 text-white"
      : title === "granted"
        ? "border-amber-500 bg-amber-500 text-black"
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

export default function BlockBPanel() {
  const cfg = useMemo(() => readConfig(), []);
  const envToken = useMemo(() => readNoteTokenRef(), []);

  const [tokenId, setTokenId] = useState(envToken?.id ?? "");
  const [tokenEvm, setTokenEvm] = useState(envToken?.evm ?? "");
  const [issueAmount, setIssueAmount] = useState("1000");
  const [transferAmount, setTransferAmount] = useState("250");

  const [wallet, setWallet] = useState<ConnectResult | null>(null);
  const [busy, setBusy] = useState<StepId | "connect" | "read" | null>(null);
  const [results, setResults] = useState<Partial<Record<StepId, StepResult>>>({});
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [diag, setDiag] = useState<ComplianceDiagnostics | null>(null);
  const [preflight, setPreflight] = useState<TransferPreflight | null>(null);
  /**
   * the account the wallet is on right now, not the one it was on when connect
   * was pressed. the SDK repairs its own account on `accountsChanged`
   * (`MetamaskService.ts:151-162`) and signs as whoever is selected; react state
   * captured at connect time would leave a reassuring banner on screen while the
   * next signature came from someone else.
   */
  const [liveAccount, setLiveAccount] = useState<string | null>(null);
  /**
   * transaction hashes as soon as the wallet returns them, before the receipt.
   * the receipt is ten to thirty seconds behind on this network and the link
   * works immediately, so the step shows a live HashScan link while it waits
   * rather than the word "waiting".
   */
  const [pendingHash, setPendingHash] = useState<Partial<Record<StepId, string>>>({});

  useEffect(() => {
    const eth = (globalThis as { ethereum?: { request: (a: unknown) => Promise<unknown>; on?: (e: string, h: (v: string[]) => void) => void; removeListener?: (e: string, h: (v: string[]) => void) => void } }).ethereum;
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

  const record = useCallback((id: StepId, r: StepResult) => {
    setResults((p) => ({ ...p, [id]: r }));
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenEvm.trim()) return;
    const d = await readComplianceDiagnostics(cfg, tokenEvm, watched);
    setDiag(d);
    const p = await readTransferPreflight(
      cfg,
      tokenEvm,
      { label: "issuer", evm: cfg.accounts.issuer.evm },
      { label: "holder", evm: cfg.accounts.holder.evm },
      transferAmount,
      d.decimals,
    );
    setPreflight(p);
    append(p.summary);
    return d;
  }, [cfg, tokenEvm, watched, transferAmount, append]);

  // the read-back is NOT inside the same try as the transaction, deliberately.
  // `refresh` issues a few dozen contract calls against a public relay and any
  // one of them can 429. when it lived inside the try, a rejected read
  // overwrote a successful step with `{ok:false}` and no hash, so a transaction
  // that had already landed on chain painted red and its HashScan link vanished.
  // the three verdict cards key off `results.X.ok`, so all three went dark with
  // it. a failed read is a warning about the screen, never a verdict about the
  // chain.
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
        // merge rather than replace. if an earlier attempt of this step landed,
        // its hash is evidence and must survive a later failure.
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

  const stepRoles = () =>
    run("roles", async () => {
      const r = await grantComplianceRoles(
        tokenId,
        cfg.accounts.issuer.id,
        cfg.accounts.issuer.evm,
      );
      return {
        ok: true,
        hash: r.transactionId,
        lines: [`roles applied. ${r.transactionId}`],
      };
    });

  const stepIssuer = () =>
    run("issuer", async () => {
      const r = await addCredentialIssuer(
        tokenId,
        cfg.accounts.issuer.id,
        cfg.accounts.issuer.evm,
      );
      return {
        ok: true,
        hash: r.transactionId,
        lines: [`credential issuer registered. ${r.transactionId}`],
      };
    });

  const stepKyc = (id: StepId, who: { label: string; id: string; evm: string }) =>
    run(id, async () => {
      const r = await grantInternalKyc(cfg, tokenEvm, who.evm, {}, (h) =>
        setPendingHash((p) => ({ ...p, [id]: h })),
      );
      return {
        ok: r.success,
        hash: r.hash,
        lines: [`kyc granted to ${who.label} ${who.id}. ${r.hash}`],
      };
    });

  const stepIssue = () =>
    run("issue", async () => {
      const r = await issueNotes(
        tokenId,
        cfg.accounts.issuer.id,
        issueAmount,
        cfg.accounts.issuer.evm,
      );
      return {
        ok: true,
        hash: r.transactionId,
        lines: [`issued ${issueAmount} notes to the issuer. ${r.transactionId}`],
      };
    });

  const stepBlocked = () =>
    run("blocked", async () => {
      const d = await readComplianceDiagnostics(cfg, tokenEvm, watched);
      const pre = await readTransferPreflight(
        cfg,
        tokenEvm,
        { label: "issuer", evm: cfg.accounts.issuer.evm },
        { label: "holder", evm: cfg.accounts.holder.evm },
        transferAmount,
        d.decimals,
      );
      const res = await attemptTransfer(
        tokenId,
        cfg.accounts.holder.id,
        transferAmount,
        cfg.accounts.issuer.evm,
      );
      if (!res.blocked) {
        return {
          ok: false,
          hash: res.transactionId,
          lines: [
            "the transfer was NOT blocked. the holder is already verified, so this",
            "is not the blocked-transfer evidence. revoke and retry, or re-read the state.",
          ],
        };
      }
      return {
        ok: true,
        lines: [
          `canTransferByPartition: ${pre.summary}`,
          `SDK refused before submitting: ${res.errorMessage}`,
        ],
      };
    });

  const stepForced = () =>
    run("forced", async () => {
      const d = await readComplianceDiagnostics(cfg, tokenEvm, watched);
      const r = await forceTransferOnChain(
        cfg,
        tokenEvm,
        cfg.accounts.issuer.evm,
        cfg.accounts.holder.evm,
        transferAmount,
        d.decimals,
        (h) => setPendingHash((p) => ({ ...p, forced: h })),
      );
      return {
        ok: !r.success,
        hash: r.hash,
        lines: [
          r.success
            ? "the forced transfer SUCCEEDED. it was not refused on chain."
            : `refused on chain: ${r.revert?.summary ?? "no revert data on the record"}`,
          `${r.hash} (${r.note})`,
        ],
      };
    });

  const stepPermitted = () =>
    run("permitted", async () => {
      const res = await attemptTransfer(
        tokenId,
        cfg.accounts.holder.id,
        transferAmount,
        cfg.accounts.issuer.evm,
      );
      if (res.blocked) {
        return {
          ok: false,
          lines: [`still blocked: ${res.errorMessage}`],
        };
      }
      return {
        ok: true,
        hash: res.transactionId,
        lines: [
          `transferred ${transferAmount} notes to the holder. ${res.transactionId}`,
        ],
      };
    });

  // ---------------------------------------------------------------------------

  // read off the live wallet, not off the value captured at connect time.
  const issuerConnected =
    liveAccount !== null &&
    liveAccount.toLowerCase() === cfg.accounts.issuer.evm.toLowerCase();
  const ready = tokenId.trim() !== "" && tokenEvm.trim() !== "";

  const blocked = results.blocked?.ok || results.forced?.ok;
  const granted = Boolean(results.kycHolder?.ok && results.kycLender?.ok);
  const permitted = Boolean(results.permitted?.ok);

  const holderRow = diag?.accounts.find((a) => a.label === "note holder");
  const lenderRow = diag?.accounts.find((a) => a.label === "lender");

  const step = (
    id: StepId,
    n: string,
    title: string,
    body: React.ReactNode,
    action: () => void,
    label: string,
    disabled = false,
  ) => {
    const r = results[id];
    const live = pendingHash[id];
    const wrongAccount = liveAccount !== null && !issuerConnected;
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
        {wrongAccount && (
          <p className="border-2 border-red-600 bg-red-600 px-2 py-1 font-semibold text-white">
            wrong account. the wallet is on {liveAccount}. this step must be
            signed by the issuer {cfg.accounts.issuer.evm} and will refuse.
          </p>
        )}
        <button
          onClick={action}
          disabled={busy !== null || !ready || disabled || wrongAccount}
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
        <h1 className="text-base font-semibold">covenant, block B</h1>
        <p className="text-zinc-500">
          the token refuses a transfer to an unverified party, kyc is granted,
          the same transfer settles. hedera {cfg.network}.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <VerdictCard
          cfg={cfg}
          state={blocked ? "live" : "idle"}
          title="blocked"
          line={`transfer of ${transferAmount} notes to the note holder refused`}
          detail={
            results.forced?.lines[0] ??
            preflight?.reason?.summary ??
            "InvalidKycStatus()"
          }
          link={results.forced?.hash}
        />
        <VerdictCard
          cfg={cfg}
          state={granted ? "live" : "idle"}
          title="granted"
          line="kyc granted to the note holder and the lender"
          detail={`${cfg.accounts.holder.id} and ${cfg.accounts.lender.id}, internal kyc registry`}
          link={results.kycHolder?.hash}
        />
        <VerdictCard
          cfg={cfg}
          state={permitted ? "live" : "idle"}
          title="permitted"
          line={`the same transfer of ${transferAmount} notes settles`}
          detail={
            holderRow
              ? `note holder balance ${holderRow.balance}`
              : "same call, same amount, same accounts"
          }
          link={results.permitted?.hash}
        />
      </div>

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">the note and the amounts</h2>
        {!envToken && (
          <p className="border border-amber-600 p-2 text-amber-700 dark:text-amber-400">
            NEXT_PUBLIC_NOTE_TOKEN_ID and NEXT_PUBLIC_NOTE_TOKEN_EVM are not set.
            copy them from .env.example, or type the note below for this session.
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
          <label className="text-zinc-500">issue, notes</label>
          <input
            value={issueAmount}
            onChange={(e) => setIssueAmount(e.target.value)}
            className="w-40 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <label className="text-zinc-500">transfer, notes</label>
          <input
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            className="w-40 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">0. connect</h2>
        <p className="text-zinc-500">
          every step in this block is signed by the issuer{" "}
          <b>{cfg.accounts.issuer.id}</b> ({cfg.accounts.issuer.evm}). the note
          holder and the lender never sign here.
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
        {liveAccount && !issuerConnected && (
          <p className="border border-amber-600 p-2 text-amber-700 dark:text-amber-400">
            the wallet is on {liveAccount}, not the issuer{" "}
            {cfg.accounts.issuer.evm}. every step below, SDK or raw, reads the
            live signer and refuses to build a transaction until you switch.
          </p>
        )}
      </section>

      {step(
        "roles",
        "1",
        "grant the issuer the three roles this block needs",
        <>
          one transaction. AccessControl.applyRoles with SSI_MANAGER, KYC and
          ISSUER. the issuer holds DEFAULT_ADMIN_ROLE, which administers all
          three. safe to repeat: applyRoles skips a role the account already has.
        </>,
        stepRoles,
        "apply roles",
      )}

      {step(
        "issuer",
        "2",
        "register the issuer as an accepted credential issuer",
        <>
          SsiManagement.addIssuer. without it, getKycStatusFor returns
          NOT_GRANTED for every account no matter what was written, because
          KycStorageWrapper.sol:126 checks the record&apos;s issuer against this
          list.
        </>,
        stepIssuer,
        "add credential issuer",
        Boolean(results.issuer?.ok),
      )}

      {step(
        "kycIssuer",
        "3",
        "grant kyc to the issuer",
        <>
          the token has a max supply and no supply. minting is next, and
          Mint.sol:48 carries onlyIdentifiedAddresses on the destination, so the
          issuer must be verified before it can receive its own notes. run once:
          Kyc.sol:74 refuses a second grant to an account that already has one.
        </>,
        () => stepKyc("kycIssuer", { label: "issuer", ...cfg.accounts.issuer }),
        "grant kyc to the issuer",
        Boolean(results.kycIssuer?.ok),
      )}

      {step(
        "issue",
        "4",
        `issue ${issueAmount} notes to the issuer`,
        <>
          Security.issue. Factory.deployBond wrote the cap, not the supply, so
          totalSupply is zero until this runs and there is nothing to transfer.
        </>,
        stepIssue,
        "issue the notes",
        Boolean(results.issue?.ok),
      )}

      {step(
        "blocked",
        "5",
        "attempt the transfer to the unverified note holder",
        <>
          no signature. the SDK asks the token first and refuses to submit:
          TransferCommandHandler.ts:42 runs checkCanTransfer before
          handler.transfer. the eth_call answer is captured alongside the thrown
          error, so the claim rests on the token, not on our exception.
        </>,
        stepBlocked,
        "attempt the blocked transfer",
      )}

      {step(
        "forced",
        "6",
        "send the same transfer anyway, so the refusal is on chain",
        <>
          one signature, and it is expected to fail. identical calldata to the
          SDK&apos;s, gas supplied explicitly so nothing estimates it away. the
          wallet will warn that it is likely to fail. that is the point. confirm
          it.
        </>,
        stepForced,
        "force it on chain",
      )}

      {step(
        "kycHolder",
        "7",
        "grant kyc to the note holder",
        <>
          the internal kyc registry on the token itself,{" "}
          {cfg.accounts.holder.id}. run once: Kyc.sol:74 refuses a second grant.
        </>,
        () => stepKyc("kycHolder", { label: "note holder", ...cfg.accounts.holder }),
        "grant kyc to the note holder",
        Boolean(results.kycHolder?.ok),
      )}

      {step(
        "kycLender",
        "8",
        "grant kyc to the lender",
        <>
          not optional and not cosmetic. HoldByPartition.sol:118-119 puts
          onlyIdentifiedAddresses and onlyCompliant on
          executeHoldByPartition, so an unverified lender means block E reverts
          at the moment everything else is already green.
        </>,
        () => stepKyc("kycLender", { label: "lender", ...cfg.accounts.lender }),
        "grant kyc to the lender",
        Boolean(results.kycLender?.ok),
      )}

      {step(
        "permitted",
        "9",
        `transfer ${transferAmount} notes to the note holder`,
        <>
          the same call as step 5, same amount, same accounts. this time the
          token permits it.
        </>,
        stepPermitted,
        "transfer again",
      )}

      {preflight && (
        <section
          className={
            "flex flex-col gap-1 border p-4 " +
            (preflight.allowed ? "border-emerald-600" : "border-red-600")
          }
        >
          <h2 className="font-semibold">
            the token&apos;s own answer, canTransferByPartition
          </h2>
          <p className="text-zinc-500">
            an eth_call against the deployed diamond. no wallet, no transaction.
          </p>
          <p className="text-base">{preflight.summary}</p>
          {preflight.reason && (
            <p className="break-all text-zinc-500">
              reason word {preflight.reason.raw}
            </p>
          )}
        </section>
      )}

      {diag && (
        <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="font-semibold">state read back off chain</h2>
          <dl className="grid grid-cols-[16rem_1fr] gap-x-3">
            <dt className="text-zinc-500">supply</dt>
            <dd>
              {diag.totalSupply} of {diag.maxSupply} notes
            </dd>
            <dt className="text-zinc-500">internalKycActivated</dt>
            <dd>{String(diag.internalKycActivated)}</dd>
            <dt className="text-zinc-500">external kyc lists</dt>
            <dd>
              {diag.externalKycListsCount}
              {diag.externalKycListsCount === 0 &&
                " (so the external leg passes vacuously and internal kyc is the gate)"}
            </dd>
            <dt className="text-zinc-500">credential issuers</dt>
            <dd>{diag.credentialIssuerCount}</dd>
            <dt className="text-zinc-500">accounts with kyc granted</dt>
            <dd>{diag.kycGrantedCount}</dd>
            <dt className="text-zinc-500">paused / deactivated</dt>
            <dd>
              {String(diag.paused)} / {String(diag.deactivated)}
            </dd>
          </dl>

          <h3 className="mt-2 font-semibold">per account</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-zinc-500">
                <tr>
                  <th className="pr-3">account</th>
                  <th className="pr-3">kyc</th>
                  <th className="pr-3">external</th>
                  <th className="pr-3">balance</th>
                  <th className="pr-3">roles</th>
                </tr>
              </thead>
              <tbody>
                {diag.accounts.map((a) => (
                  <tr key={a.evm} className="align-top">
                    <td className="pr-3">
                      {a.label}
                      <br />
                      <span className="text-zinc-500">{a.accountId}</span>
                    </td>
                    <td
                      className={
                        "pr-3 font-semibold " +
                        (a.kycStatusLabel === "GRANTED"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-700 dark:text-red-400")
                      }
                    >
                      {a.kycStatusLabel}
                      {a.kycRecord && !a.kycRecord.issuerStillRegistered && (
                        <>
                          <br />
                          <span className="text-amber-600">
                            record issuer no longer registered
                          </span>
                        </>
                      )}
                    </td>
                    <td className="pr-3">{String(a.externallyGranted)}</td>
                    <td className="pr-3">{a.balance}</td>
                    <td className="pr-3">
                      {a.roles
                        .filter((r) => r.held)
                        .map((r) => r.name)
                        .join(", ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
        <h2 className="font-semibold">what gates this transfer</h2>
        <p className="text-zinc-500">
          KycStorageWrapper.sol:206-210. internal kyc, only when
          internalKycActivated is true, AND every registered external kyc list.
          the two are ANDed. this note carries internalKycActivated true and zero
          external lists, so the internal registry is the whole gate and an
          external-list grant on its own would not move it.
        </p>
        <p className="text-zinc-500">
          the grant goes straight to the deployed Kyc facet rather than through
          the SDK. GrantKycCommandHandler.ts:34-42 requires a genuine Terminal3
          verifiable credential; Kyc.sol:59-81 requires none, it takes a plain
          string. the credential requirement is entirely client side, and we do
          not claim to have issued a verifiable credential.
        </p>
        {lenderRow && (
          <p className="text-zinc-500">
            lender kyc is {lenderRow.kycStatusLabel}. block E&apos;s
            executeHoldByPartition needs it GRANTED.
          </p>
        )}
      </section>
    </main>
  );
}
