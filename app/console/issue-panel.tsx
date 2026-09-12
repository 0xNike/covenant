"use client";

// covenant, the issuance console. connect a wallet, issue the note, show what
// happened.
//
// deliberately minimal. this proves the chain path.

import { Fragment, useCallback, useMemo, useState } from "react";
import { hashscanContract, hashscanTx, readConfig } from "@/lib/config";
import { buildBondTerms, buildNoteTerms } from "@/lib/ats/note-terms";
import {
  connectWallet,
  issueNote,
  type ConnectResult,
  type IssueResult,
} from "@/lib/ats/client";
import {
  readTokenDiagnostics,
  type TokenDiagnostics,
} from "@/lib/ats/diagnostics";

function errorText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

export default function IssuePanel() {
  const cfg = useMemo(() => readConfig(), []);

  // startingDate, maturityDate and startPeriod all derive from the clock, and
  // the real values are the ones `issueNote` reads at the moment of signing.
  // building the preview against now = 0 keeps this render deterministic, so
  // the server pass and hydration agree. the three time fields are labelled
  // rather than shown, and the issued terms below carry the real values.
  const previewTerms = useMemo(() => buildNoteTerms(cfg, { now: 0 }), [cfg]);
  // what `issueNote` actually sends. `buildBondTerms` drops every rate field and
  // repoints configId, so the panel must show this, not `previewTerms`, when it
  // claims to be showing the request.
  const sentTerms = useMemo(() => buildBondTerms(cfg, { now: 0 }), [cfg]);

  const [busy, setBusy] = useState<null | "connect" | "issue" | "read">(null);
  const [wallet, setWallet] = useState<ConnectResult | null>(null);
  const [issued, setIssued] = useState<IssueResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [readTarget, setReadTarget] = useState("");
  const [diagnostics, setDiagnostics] = useState<TokenDiagnostics | null>(null);

  const append = useCallback((line: string) => {
    setLog((prev) => [
      ...prev,
      `${new Date().toISOString().slice(11, 19)}  ${line}`,
    ]);
  }, []);

  const onConnect = useCallback(async () => {
    setBusy("connect");
    setError(null);
    try {
      append("Network.init, then Network.connect with SupportedWallets.METAMASK");
      const res = await connectWallet(cfg);
      setWallet(res);
      append(`connected ${res.accountId} on ${res.network}`);
      append(
        `factory ${res.factoryAddress || "(empty)"} resolver ${res.resolverAddress || "(empty)"}`,
      );
    } catch (e) {
      setError(errorText(e));
      append("connect failed");
    } finally {
      setBusy(null);
    }
  }, [cfg, append]);

  const onIssue = useCallback(async () => {
    setBusy("issue");
    setError(null);
    try {
      append("Bond.create against config " + sentTerms.configId);
      append("sign in the wallet now");
      const res = await issueNote(cfg);
      setIssued(res);
      // seed the read-back field so the operator does not have to copy an
      // address between two boxes on the same page.
      setReadTarget(res.securityEvmAddress || res.securityId);
      append(`issued. transaction ${res.transactionId}`);
      append(`security ${res.securityId || "(none returned)"}`);
    } catch (e) {
      setError(errorText(e));
      append("issue failed");
    } finally {
      setBusy(null);
    }
  }, [cfg, append, sentTerms.configId]);

  const onRead = useCallback(async () => {
    setBusy("read");
    setError(null);
    try {
      append(`reading rate configuration off chain from ${readTarget}`);
      const d = await readTokenDiagnostics(cfg, readTarget);
      setDiagnostics(d);
      append(
        `config ${d.configLabel} v${d.configVersion}, operational ${d.operational}, rate type ${d.couponRateTypeLabel}`,
      );
      if (d.kpiLinkedRate) {
        append(
          d.kpiLinkedRate.allMatch
            ? "kpi rate model read back and every field matches note-terms.ts"
            : "kpi rate model read back but fields DIFFER from note-terms.ts",
        );
      }
    } catch (e) {
      setError(errorText(e));
      append("read back failed");
    } finally {
      setBusy(null);
    }
  }, [cfg, append, readTarget]);

  const issuerConnected =
    wallet !== null &&
    wallet.accountId.trim() === cfg.accounts.issuer.id.trim();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 font-mono text-sm">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-semibold">covenant, issuance</h1>
        <p className="text-zinc-500">
          issue the kpi-linked private credit note on hedera {cfg.network}
        </p>
      </header>

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">1. connect</h2>
        <p className="text-zinc-500">
          the wallet must be on hedera testnet and pointed at the issuer account{" "}
          <b>{cfg.accounts.issuer.id}</b> ({cfg.accounts.issuer.evm})
        </p>
        <button
          onClick={onConnect}
          disabled={busy !== null}
          className="w-fit border border-zinc-900 px-3 py-1 disabled:opacity-40 dark:border-zinc-100"
        >
          {busy === "connect" ? "connecting..." : "connect wallet"}
        </button>
        {wallet && (
          <dl className="grid grid-cols-[10rem_1fr] gap-x-3">
            <dt className="text-zinc-500">account</dt>
            <dd>
              {wallet.accountId} {wallet.evmAddress}
            </dd>
            <dt className="text-zinc-500">network</dt>
            <dd>{wallet.network}</dd>
            <dt className="text-zinc-500">factory</dt>
            <dd>{wallet.factoryAddress || "(empty)"}</dd>
            <dt className="text-zinc-500">resolver</dt>
            <dd>{wallet.resolverAddress || "(empty)"}</dd>
          </dl>
        )}
        {wallet && !issuerConnected && (
          <p className="border border-amber-600 p-2 text-amber-700 dark:text-amber-400">
            connected account is not the issuer {cfg.accounts.issuer.id}. the
            note would be issued with the wrong diamond owner and every later
            role grant would have to come from that account instead. switch
            accounts in the wallet and connect again.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">2. issue</h2>
        <p className="text-zinc-500">
          Bond.create against config{" "}
          <b className="break-all">{sentTerms.configId}</b>. one wallet
          signature.
        </p>
        <p className="text-zinc-500">
          not Bond.createKpiLinkedRate. that entry point calls
          deployBondKpiLinkedRate on the factory, which exists only on
          MockFactory.sol. see the F8 note in lib/ats/note-terms.ts. the rate
          model below is therefore not written by this transaction.
        </p>
        <button
          onClick={onIssue}
          disabled={busy !== null || wallet === null}
          className="w-fit border border-zinc-900 px-3 py-1 disabled:opacity-40 dark:border-zinc-100"
        >
          {busy === "issue" ? "waiting for signature..." : "issue the note"}
        </button>
      </section>

      {issued && (
        <section className="flex flex-col gap-2 border border-emerald-600 p-4">
          <h2 className="font-semibold text-emerald-700 dark:text-emerald-400">
            issued
          </h2>
          <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-zinc-500">transaction id</dt>
            <dd className="break-all">{issued.transactionId}</dd>
            <dt className="text-zinc-500">hashscan</dt>
            <dd className="break-all">
              <a
                className="underline"
                target="_blank"
                rel="noreferrer"
                href={hashscanTx(cfg, issued.transactionId)}
              >
                {hashscanTx(cfg, issued.transactionId)}
              </a>
            </dd>
            <dt className="text-zinc-500">security id</dt>
            <dd className="break-all">{issued.securityId || "(none returned)"}</dd>
            <dt className="text-zinc-500">security evm</dt>
            <dd className="break-all">{issued.securityEvmAddress || "-"}</dd>
            {issued.securityId && (
              <>
                <dt className="text-zinc-500">contract</dt>
                <dd className="break-all">
                  <a
                    className="underline"
                    target="_blank"
                    rel="noreferrer"
                    href={hashscanContract(cfg, issued.securityId)}
                  >
                    {hashscanContract(cfg, issued.securityId)}
                  </a>
                </dd>
              </>
            )}
          </dl>

          <h3 className="mt-2 font-semibold">read back off chain</h3>
          <p className="text-zinc-500">
            what the token reports, not what we sent. clearingActive must be
            false or the hold verbs are unreachable. internalKycActivated must be
            true or the token will not refuse a transfer to an unverified party.
          </p>
          <dl className="grid grid-cols-[14rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-zinc-500">name / symbol / isin</dt>
            <dd>
              {issued.onChain.name} / {issued.onChain.symbol} /{" "}
              {issued.onChain.isin}
            </dd>
            <dt className="text-zinc-500">decimals</dt>
            <dd>{String(issued.onChain.decimals)}</dd>
            <dt className="text-zinc-500">clearingActive</dt>
            <dd>{String(issued.onChain.clearingActive)}</dd>
            <dt className="text-zinc-500">internalKycActivated</dt>
            <dd>{String(issued.onChain.internalKycActivated)}</dd>
            <dt className="text-zinc-500">isControllable</dt>
            <dd>{String(issued.onChain.isControllable)}</dd>
            <dt className="text-zinc-500">isMultiPartition</dt>
            <dd>{String(issued.onChain.isMultiPartition)}</dd>
            <dt className="text-zinc-500">maxSupply</dt>
            <dd>{issued.onChain.maxSupply}</dd>
          </dl>
        </section>
      )}

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">3. read the rate configuration back</h2>
        <p className="text-zinc-500">
          view calls over the json-rpc relay. no wallet, no signature. this
          reports the active configuration id, whether the token is operational,
          the coupon rate type, facet readiness, and the kpi rate model if the
          active configuration carries KpiLinkedRateFacet.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={readTarget}
            onChange={(e) => setReadTarget(e.target.value)}
            placeholder="0x... or 0.0.x"
            className="w-80 border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
          />
          <button
            onClick={onRead}
            disabled={busy !== null || readTarget.trim() === ""}
            className="border border-zinc-900 px-3 py-1 disabled:opacity-40 dark:border-zinc-100"
          >
            {busy === "read" ? "reading..." : "read back"}
          </button>
        </div>

        {diagnostics && (
          <div className="flex flex-col gap-2">
            <dl className="grid grid-cols-[14rem_1fr] gap-x-3 gap-y-1">
              <dt className="text-zinc-500">active config</dt>
              <dd className="break-all">
                {diagnostics.configLabel} v{diagnostics.configVersion}
                <br />
                {diagnostics.configId}
              </dd>
              <dt className="text-zinc-500">operational</dt>
              <dd>
                {String(diagnostics.operational)} (status{" "}
                {diagnostics.operationalStatus})
              </dd>
              <dt className="text-zinc-500">coupon rate type</dt>
              <dd>
                {diagnostics.couponRateTypeLabel} ({diagnostics.couponRateType})
              </dd>
              {diagnostics.fixedRate && (
                <>
                  <dt className="text-zinc-500">fixed rate</dt>
                  <dd>
                    {diagnostics.fixedRate.rate} at{" "}
                    {diagnostics.fixedRate.rateDecimals} decimals
                  </dd>
                </>
              )}
              {diagnostics.proceedRecipientsCount !== undefined && (
                <>
                  <dt className="text-zinc-500">proceed recipients</dt>
                  <dd>{diagnostics.proceedRecipientsCount}</dd>
                </>
              )}
            </dl>

            <h3 className="mt-1 font-semibold">facet readiness</h3>
            <p className="text-zinc-500">
              1 is ready. 0 means the facet was never initialised on this token,
              so setOperationalStatus would refuse the configuration it belongs
              to.
            </p>
            <dl className="grid grid-cols-[20rem_1fr] gap-x-3">
              {diagnostics.facets.map((f) => (
                <Fragment key={f.key}>
                  <dt className="text-zinc-500">{f.name}</dt>
                  <dd>{f.status}</dd>
                </Fragment>
              ))}
            </dl>

            {diagnostics.kpiLinkedRate && (
              <>
                <h3
                  className={
                    "mt-1 font-semibold " +
                    (diagnostics.kpiLinkedRate.allMatch
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-700 dark:text-red-400")
                  }
                >
                  kpi rate model on chain{" "}
                  {diagnostics.kpiLinkedRate.allMatch
                    ? "matches note-terms.ts"
                    : "DIFFERS from note-terms.ts"}
                </h3>
                <dl className="grid grid-cols-[14rem_1fr_1fr] gap-x-3">
                  <dt className="text-zinc-500">field</dt>
                  <dd className="text-zinc-500">expected</dd>
                  <dd className="text-zinc-500">on chain</dd>
                  {diagnostics.kpiLinkedRate.checks.map((c) => (
                    <Fragment key={c.field}>
                      <dt
                        className={c.ok ? "" : "text-red-700 dark:text-red-400"}
                      >
                        {c.field}
                      </dt>
                      <dd>{c.expected}</dd>
                      <dd>{c.actual}</dd>
                    </Fragment>
                  ))}
                </dl>
              </>
            )}

            {diagnostics.notes.length > 0 && (
              <>
                <h3 className="mt-1 font-semibold">notes</h3>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all text-zinc-600 dark:text-zinc-400">
                  {diagnostics.notes.join("\n\n")}
                </pre>
              </>
            )}
          </div>
        )}
      </section>

      {error && (
        <section className="flex flex-col gap-2 border border-red-600 p-4">
          <h2 className="font-semibold text-red-700 dark:text-red-400">error</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all">
            {error}
          </pre>
        </section>
      )}

      <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">the pinned parameters</h2>
        <p className="text-zinc-500">
          the first group is written by the issuance transaction. the second is
          the rate model, which Bond.create cannot carry and which is therefore
          not on chain after issuance.
        </p>
        <dl className="grid grid-cols-[14rem_1fr] gap-x-3 gap-y-1">
          <dt className="text-zinc-500">configId sent</dt>
          <dd className="break-all">
            {sentTerms.configId}
            <span className="text-zinc-500">
              {" "}
              (the only config Factory.deployBond can complete)
            </span>
          </dd>
          <dt className="text-zinc-500">configVersion</dt>
          <dd>{sentTerms.configVersion}</dd>
          <dt className="text-zinc-500">clearingActive</dt>
          <dd>
            {String(sentTerms.clearingActive)}
            <span className="text-zinc-500">
              {" "}
              (must be false, or createHoldByPartition is unreachable)
            </span>
          </dd>
          <dt className="text-zinc-500">internalKycActivated</dt>
          <dd>
            {String(sentTerms.internalKycActivated)}
            <span className="text-zinc-500">
              {" "}
              (must be true, or kyc does not gate transfers)
            </span>
          </dd>
          <dt className="text-zinc-500">isControllable</dt>
          <dd>{String(sentTerms.isControllable)}</dd>
          <dt className="text-zinc-500">isWhiteList</dt>
          <dd>{String(sentTerms.isWhiteList)}</dd>
          <dt className="text-zinc-500">regulation</dt>
          <dd>
            type {sentTerms.regulationType}, sub-type{" "}
            {sentTerms.regulationSubType} (reg d 506(c))
          </dd>
          <dt className="text-zinc-500">diamondOwnerAccount</dt>
          <dd className="break-all">{sentTerms.diamondOwnerAccount}</dd>
          <dt className="text-zinc-500">proceedRecipientsIds</dt>
          <dd className="break-all">
            {sentTerms.proceedRecipientsIds.join(", ")}
          </dd>
        </dl>

        <h3 className="mt-2 font-semibold">
          rate model, not written by issuance
        </h3>
        <dl className="grid grid-cols-[14rem_1fr] gap-x-3 gap-y-1">
          <dt className="text-zinc-500">target configId</dt>
          <dd className="break-all">{previewTerms.configId}</dd>
          <dt className="text-zinc-500">missedPenalty</dt>
          <dd>
            {previewTerms.missedPenalty} ({previewTerms.missedPenalty / 100}
            {"%"} at {previewTerms.rateDecimals} rate decimals)
          </dd>
          <dt className="text-zinc-500">baseLine</dt>
          <dd>
            {previewTerms.baseLine} ({previewTerms.baseLine / 100}x leverage)
          </dd>
          <dt className="text-zinc-500">min / base / max rate</dt>
          <dd>
            {previewTerms.minRate} / {previewTerms.baseRate} /{" "}
            {previewTerms.maxRate}
          </dd>
          <dt className="text-zinc-500">deviation floor / cap</dt>
          <dd>
            {previewTerms.maxDeviationFloor} / {previewTerms.maxDeviationCap}
          </dd>
        </dl>
      </section>

      {log.length > 0 && (
        <section className="flex flex-col gap-2 border border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="font-semibold">log</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-zinc-600 dark:text-zinc-400">
            {log.join("\n")}
          </pre>
        </section>
      )}

      <details className="border border-zinc-300 p-4 dark:border-zinc-700">
        <summary className="cursor-pointer font-semibold">
          full CreateBondRequest payload
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(
            issued?.terms ?? {
              ...sentTerms,
              startingDate: "read from the clock when you click issue",
              maturityDate: "read from the clock when you click issue",
            },
            null,
            2,
          )}
        </pre>
      </details>
    </main>
  );
}
