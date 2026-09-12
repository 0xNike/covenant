"use client";

// covenant. the note holder's view.
//
// ---------------------------------------------------------------------------
// WHAT THIS PAGE IS
// ---------------------------------------------------------------------------
//
// one card: the position, the pledge, and the advance it raises. that card is
// the product and it is the first and only thing above the fold. everything
// else on this route is reference material and sits inside a disclosure the
// reader opens on purpose.
//
// this page was a thousand words of explanation with the action buried in the
// middle of it. the mechanism is not wrong and it has not been deleted, it has
// moved to README.md, which is where a judge reads an argument. an application
// shows a position and an action.
//
// it still reads end to end with no wallet. every figure comes live off the
// note on hedera testnet through /api/holder/position, and connecting a wallet
// only adds the ability to sign. if the connect control ever becomes a gate in
// front of the position, that is a regression.
//
// the one action a note holder owns is the pledge. `app/holder/pledge.tsx`
// carries it. release, execute and reclaim are the escrow's and are deliberately
// absent; see the header of that file.
//
// ---------------------------------------------------------------------------
// WHAT THIS PAGE MUST NOT CONTAIN, AND HOW THAT IS CHECKED
// ---------------------------------------------------------------------------
//
// it shows a haircut, so it is inside the disclosure boundary and it is scanned
// by `npm run scan:disclosure` alongside /lender, against a production build,
// with /engine as the control. the borrower's filing is not on this page, is
// not in its bundle, and is not in any request it makes: the haircut arrives
// through `fetchDisclosure`, the same narrowed object the lender gets, and the
// position arrives from a chain read that has never seen a financial statement.
//
// two consequences for anyone editing the copy below. do not name a field of
// `EngineInputs`, even in prose. and do not import anything from
// `lib/engine/fixtures` or `lib/engine/kernel`, however convenient, because the
// import alone puts the filing in this bundle whether or not it is rendered.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchDisclosure } from "@/lib/engine/disclosure-client";
import type { LenderDisclosure } from "@/lib/engine/types";
import {
  EngineStamp,
  Row,
  Rows,
  VerdictBadge,
  statusTextClasses,
} from "@/app/components/covenant-ui";
import PledgeCard from "./pledge";
import type { ChainTx, PositionEnvelope } from "./types";

const POSITION_INTERVAL_MS = 15_000;
const DISCLOSURE_INTERVAL_MS = 2_000;

function money(n: number): string {
  if (!Number.isFinite(n)) return "unreadable";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percentFromBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/** "2026-09-11T00:55:51Z" -> "2026-09-11 00:55 utc". dates are read, not parsed. */
function readable(isoString: string): string {
  if (!isoString || isoString === "not set") return "not set";
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(isoString);
  return m ? `${m[1]} ${m[2]} utc` : isoString;
}

function TxLink({ tx, label }: { tx: ChainTx | null; label?: string }) {
  if (!tx) return <span className="text-zinc-500">none</span>;
  return (
    <a
      href={tx.hashscan}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      {label ?? tx.call}
    </a>
  );
}

/**
 * a section the reader opens on purpose.
 *
 * the reference material on this route is real and a credit person will want
 * it, but none of it is the product, and putting it in front of the card was
 * what made this page read as documentation. closed by default, one line of
 * summary, no prose inside.
 */
function Fold({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="border border-zinc-300 dark:border-zinc-700">
      <summary className="cursor-pointer px-4 py-3 select-none">
        {title}
      </summary>
      <div className="flex flex-col gap-3 border-t border-zinc-300 px-4 py-4 dark:border-zinc-700">
        {children}
      </div>
    </details>
  );
}

export default function HolderView({
  initial,
  initialDisclosure,
}: {
  initial: PositionEnvelope;
  initialDisclosure: LenderDisclosure | null;
}) {
  const [envelope, setEnvelope] = useState<PositionEnvelope>(initial);
  const [disclosure, setDisclosure] = useState<LenderDisclosure | null>(
    initialDisclosure,
  );
  const [refreshing, setRefreshing] = useState(false);

  const position = envelope.ok ? envelope.position : null;

  // the pledge sizing. empty string means "not typed in yet", and the whole
  // free balance is the answer until someone says otherwise, because that is
  // what a holder raising against a position actually does first.
  const [pledgeInput, setPledgeInput] = useState<string>("");
  const free = position?.notes.freeValue ?? 0;
  const typed = pledgeInput.trim() === "" ? free : Number(pledgeInput);
  const pledge = Number.isFinite(typed) ? Math.min(Math.max(typed, 0), free) : 0;

  const loadPosition = useCallback(async (fresh: boolean) => {
    try {
      const res = await fetch(
        fresh ? "/api/holder/position?fresh=1" : "/api/holder/position",
        { cache: "no-store" },
      );
      if (!res.ok) return;
      setEnvelope((await res.json()) as PositionEnvelope);
    } catch {
      // leave the last good read on screen. a network blip is not news, and a
      // page that blanks itself every time a public relay hiccups is worse to
      // watch than one that is a few seconds stale.
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosition(true);
    setRefreshing(false);
  }, [loadPosition]);

  useEffect(() => {
    const id = setInterval(() => void loadPosition(false), POSITION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadPosition]);

  // the haircut moves because someone ran the engine in another document, so it
  // is polled fast. this endpoint reads one object out of server memory and
  // touches no chain, so two seconds costs nothing.
  const failures = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const poll = async () => {
      try {
        setDisclosure(await fetchDisclosure(controller.signal));
        failures.current = 0;
      } catch {
        failures.current += 1;
      }
    };
    void poll();
    const id = setInterval(() => void poll(), DISCLOSURE_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, []);

  if (!position) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-10 font-mono text-sm">
        <h1 className="text-base font-semibold">note holder</h1>
        <p className="border border-red-600 p-3 text-red-700 dark:text-red-400">
          {envelope.ok ? "no position" : envelope.error}
        </p>
      </main>
    );
  }

  const collateral = pledge * position.nominal.perNoteValue;
  const advanceRateBps = disclosure?.advanceRateBps ?? null;
  const advance =
    advanceRateBps === null ? null : (collateral * advanceRateBps) / 10000;
  const cover = advance === null ? null : collateral - advance;

  const live = position.holds.filter((h) => !h.expired);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-8 font-mono text-sm">
      {/* ================================================================ */}
      {/* the card. the position and the one action, before any scrolling. */}
      {/* ================================================================ */}
      <section className="flex flex-col border-2 border-zinc-900 dark:border-zinc-100">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-300 px-5 py-3 dark:border-zinc-700">
          <h1 className="text-base font-semibold">note holder</h1>
          <a
            href={position.holder.hashscan}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-500 underline underline-offset-2"
          >
            {position.holder.id}
          </a>
        </header>

        {/* the position, at the size it deserves */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 py-5">
          <div className="flex flex-col gap-1">
            <span className="text-zinc-500">notes held</span>
            <span className="text-5xl leading-none font-semibold tabular-nums">
              {position.notes.held}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <span className="text-zinc-500">face value</span>
            <span className="text-2xl leading-none tabular-nums">
              {position.nominal.held}
            </span>
            <span className="text-zinc-500 tabular-nums">
              {position.rate.percent} a year
            </span>
          </div>
        </div>

        {/* in, then out. 1px of page shows between the two panels. */}
        <div className="flex flex-col gap-px bg-zinc-300 dark:bg-zinc-700">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 bg-zinc-50 px-5 py-4 dark:bg-zinc-900">
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">pledge</span>
              <span className="flex items-baseline gap-2">
                <input
                  inputMode="decimal"
                  value={pledgeInput}
                  placeholder={money(free)}
                  onChange={(e) => setPledgeInput(e.target.value)}
                  className="w-52 border-b border-zinc-400 bg-transparent text-3xl tabular-nums outline-none dark:border-zinc-600"
                />
                <span className="text-zinc-500">notes</span>
              </span>
            </label>
            <div className="flex items-center gap-3 pb-1 text-zinc-500">
              <span className="tabular-nums">free {position.notes.free}</span>
              <button
                onClick={() => setPledgeInput("")}
                className="border border-zinc-400 px-2 py-0.5 dark:border-zinc-600"
              >
                all
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 bg-zinc-50 px-5 py-4 dark:bg-zinc-900">
            {disclosure === null ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-zinc-500">
                  no covenant report published
                </span>
                <Link
                  href="/engine"
                  className="border border-zinc-900 px-3 py-1 dark:border-zinc-100"
                >
                  run the engine
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500">receive</span>
                  <span className="text-3xl leading-none font-semibold tabular-nums">
                    {advance === null ? "unavailable" : money(advance)}
                  </span>
                  <span className="text-zinc-500 tabular-nums">
                    {percentFromBps(disclosure.advanceRateBps)} advance rate,{" "}
                    {percentFromBps(disclosure.haircutBps)} haircut held back
                    {cover === null ? "" : ` (${money(cover)})`}
                  </span>
                </div>
                <VerdictBadge status={disclosure.verdict} />
              </>
            )}
          </div>
        </div>

        {/* the terms of the hold, as labelled facts, and the signature */}
        <PledgeCard
          token={{
            id: position.token.id,
            evm: position.token.evm,
            decimals: position.token.decimals,
          }}
          holder={{ id: position.holder.id, evm: position.holder.evm }}
          escrow={position.parties.escrow}
          lender={position.parties.lender}
          notes={pledge}
          onPledged={() => void loadPosition(true)}
        />
      </section>

      {/*
        the boundary, once, the way /lender states it. a credit person works it
        out in ten seconds and it is far better that the page said it first.
      */}
      {disclosure && (
        <p className="text-zinc-500">
          the haircut is set from what the borrower owes against what it earns,
          against bounds published at issuance, so holding the haircut recovers
          that one ratio. the five figures behind the ratio reach neither this
          page nor the lender&apos;s.{" "}
          <Link href="/lender" className="underline underline-offset-2">
            the lender sees exactly this
          </Link>
          .
        </p>
      )}

      {live.length > 0 && (
        <div className="flex flex-col gap-3">
          {live.map((h) => (
            <div
              key={h.holdId}
              className="flex flex-col gap-2 border border-emerald-600 p-4"
            >
              <div className="text-base font-semibold">
                {h.amount} notes held, hold {h.holdId}
              </div>
              <Rows>
                <Row
                  label="escrow"
                  value={h.escrowLabel}
                  tone={h.escrowIsEngine ? "pass" : "breach"}
                />
                <Row
                  label="destination"
                  value={
                    h.destinationPinned ? h.destinationLabel : "not fixed"
                  }
                  tone={h.destinationIsLender ? "pass" : "breach"}
                />
                <Row label="expires" value={readable(h.expiryIso)} />
              </Rows>
            </div>
          ))}
        </div>
      )}

      {/* ================================================================ */}
      {/* below the fold. reference, opened on purpose.                    */}
      {/* ================================================================ */}
      <div className="mt-4 flex flex-col gap-2">
        <Fold title="the note">
          <Rows>
            <Row
              label="note"
              value={`${position.token.name} (${position.token.symbol})`}
            />
            <Row
              label="token"
              value={
                <a
                  href={position.token.hashscan}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {position.token.id}
                </a>
              }
            />
            <Row
              label="share of issue"
              value={`${position.notes.sharePercent} of ${position.token.totalSupply}`}
            />
            <Row label="face value each" value={position.nominal.perNote} />
            <Row label="under hold" value={position.notes.underHold} />
            <Row
              label="rate"
              value={
                <>
                  {position.rate.percent}, type {position.rate.typeLabel}, held
                  in the token&apos;s own storage and stamped onto every coupon
                  by the token.{" "}
                  <TxLink tx={position.rate.postedBy} label="setRate" />
                </>
              }
            />
            <Row
              label="coupon"
              value={
                position.coupon.entitlement === null ? (
                  "none declared"
                ) : (
                  <>
                    {position.coupon.entitlement} to{" "}
                    {readable(position.coupon.periodEndIso)} at{" "}
                    {position.coupon.ratePercent}, an entitlement the token
                    makes readable. settlement is a separate payment.{" "}
                    <TxLink
                      tx={position.coupon.declaredBy}
                      label="setCoupon"
                    />
                  </>
                )
              }
            />
            <Row
              label="maturity"
              value={
                <>
                  {readable(position.maturity.iso)}
                  {position.maturity.matured ? ", reached" : ", not reached"}
                  {position.maturity.changedBy && (
                    <>
                      , moved to compress a three year life into a demo.{" "}
                      <TxLink
                        tx={position.maturity.changedBy}
                        label="updateMaturityDate"
                      />
                    </>
                  )}
                </>
              }
            />
            <Row
              label="compliance"
              value={
                position.holder.onRegister ? (
                  <>
                    verified, so this account may hold and move the note.{" "}
                    <TxLink
                      tx={position.notes.arrivedBy}
                      label="transferByPartition"
                    />
                  </>
                ) : (
                  <span className="text-red-700 dark:text-red-400">
                    not verified. the token refuses transfers to it.
                  </span>
                )
              }
            />
            <Row
              label="read"
              value={
                <span className="flex flex-wrap items-center gap-2">
                  {readable(position.readAtIso)}
                  <button
                    onClick={() => void onRefresh()}
                    disabled={refreshing}
                    className="border border-zinc-400 px-2 py-0.5 disabled:opacity-50 dark:border-zinc-600"
                  >
                    {refreshing ? "reading" : "refresh"}
                  </button>
                </span>
              }
            />
          </Rows>
        </Fold>

        <Fold title="how a pledge ends">
          <Rows>
            <Row
              label="you repay"
              value={
                <>
                  releaseHoldByPartition, by the escrow. the hold lifts.{" "}
                  <TxLink tx={position.lifecycle.released} />
                </>
              }
            />
            <Row
              label="you default"
              value={
                <>
                  executeHoldByPartition, by the escrow. the held notes move to
                  the lender. <TxLink tx={position.lifecycle.executed} />
                </>
              }
            />
            <Row
              label="nobody acts"
              value={
                <>
                  reclaimHoldByPartition, by you, after the expiry.{" "}
                  <TxLink tx={position.lifecycle.reclaimed} />
                </>
              }
            />
            <Row
              label="the pledge"
              value={
                <TxLink
                  tx={position.lifecycle.pledged}
                  label="createHoldByPartition"
                />
              }
            />
          </Rows>
        </Fold>

        {disclosure && (
          <Fold title="the covenant report">
            <div className="flex flex-wrap items-center gap-4">
              <span
                className={`text-base font-semibold ${statusTextClasses(disclosure.verdict)}`}
              >
                {percentFromBps(disclosure.haircutBps)} haircut
              </span>
              <span className="tabular-nums">
                {percentFromBps(disclosure.advanceRateBps)} advance rate
              </span>
            </div>
            <Rows>
              <Row label="borrower" value={disclosure.borrower} />
              <Row label="period" value={disclosure.period} />
              <Row label="covenant terms" value={disclosure.policyId} />
              <Row label="run" value={disclosure.runId} />
            </Rows>
            <EngineStamp engine={disclosure.engine} />
          </Fold>
        )}

        <Fold title={`on chain, ${position.history.length} calls`}>
          <ol className="flex flex-col gap-1">
            {position.history.map((tx) => (
              <li key={tx.hash} className="flex flex-wrap gap-3">
                <span className="w-44 text-zinc-500">{readable(tx.atIso)}</span>
                <span className={tx.ok ? "" : "text-red-700 dark:text-red-400"}>
                  {tx.call}
                  {tx.ok ? "" : ", reverted"}
                </span>
                <a
                  href={tx.hashscan}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-500 underline underline-offset-2"
                >
                  {tx.hash.slice(0, 12)}
                </a>
              </li>
            ))}
          </ol>
        </Fold>
      </div>

      {position.warnings.length > 0 && (
        <details className="border border-amber-600 p-3">
          <summary className="cursor-pointer text-amber-700 dark:text-amber-400">
            {position.warnings.length} reads did not come back
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-zinc-500">
            {position.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
