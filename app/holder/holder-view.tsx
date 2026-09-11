"use client";

// covenant. the note holder's view.
//
// ---------------------------------------------------------------------------
// WHO THIS IS FOR, AND WHY IT IS READ ONLY
// ---------------------------------------------------------------------------
//
// the operator console is a build harness, organised by the order we built
// things in, and it assumes the person at the keyboard holds the issuer's
// MetaMask account. this page assumes the opposite: someone who has never seen
// this project, has no account on the register, and has three minutes.
//
// so it signs nothing and asks for no wallet. every figure is read live off the
// note on hedera testnet, through /api/holder/position, and a visitor who
// copies .env.example to .env.local and runs the dev server sees the real
// position of a real account on a real token with no further setup. an
// interactive pledge button would be worse than useless here: the pledge is
// signed by the note holder's account, a visitor does not hold that key, and
// `requireSigner` would refuse it. a button that cannot work is a lie told in
// the most expensive place to tell one.
//
// what the page does instead is name the exact call, its parameters and where
// it is signed, and then read the note's own history to say whether it has
// happened. when the collateral hold is signed in the operator console this
// page fills in on its own, because nothing about the outcome is written here.
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
  Metric,
  Panel,
  Row,
  Rows,
  VerdictBadge,
} from "@/app/components/covenant-ui";
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
  if (!tx) return <span className="text-zinc-500">no transaction</span>;
  return (
    <a
      href={tx.hashscan}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      {label ?? tx.call} on hashscan
    </a>
  );
}

/**
 * one of the three ways a pledge ends, with whether it has happened.
 *
 * drawn as a row of three rather than as prose because the point is that all
 * three are real calls on the same token and exactly one of them will run. a
 * paragraph makes them read as a description of a system; three boxes make them
 * read as three outcomes with a state each.
 */
function Outcome({
  title,
  call,
  who,
  what,
  tx,
  pending,
}: {
  title: string;
  call: string;
  who: string;
  what: string;
  tx: ChainTx | null;
  pending: string;
}) {
  return (
    <div className="flex flex-1 basis-64 flex-col gap-2 border border-zinc-300 p-3 dark:border-zinc-700">
      <div className="text-base font-semibold">{title}</div>
      <div className="text-zinc-500">{call}</div>
      <p>{what}</p>
      <p className="text-zinc-500">signed by {who}.</p>
      {tx ? (
        <div className="border border-emerald-600 px-2 py-1 text-emerald-700 dark:text-emerald-400">
          done. <TxLink tx={tx} label="see it" />
        </div>
      ) : (
        <div className="border border-zinc-300 px-2 py-1 text-zinc-500 dark:border-zinc-700">
          {pending}
        </div>
      )}
    </div>
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
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-10 font-mono text-sm">
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
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8 font-mono text-sm">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-semibold">note holder</h1>
          <p className="text-zinc-500">
            everything below is read live from hedera {position.network}. this
            page signs nothing and needs no wallet.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-zinc-500">
          <a
            href={position.holder.hashscan}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {position.holder.id}
          </a>
          <div className="flex items-center gap-2">
            <span>read {readable(position.readAtIso)}</span>
            <button
              onClick={() => void onRefresh()}
              disabled={refreshing}
              className="border border-zinc-400 px-2 py-0.5 disabled:opacity-50 dark:border-zinc-600"
            >
              {refreshing ? "reading" : "refresh"}
            </button>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      <Panel
        title="what i hold"
        subtitle={`${position.token.name} (${position.token.symbol})`}
      >
        <div className="flex flex-wrap gap-8">
          <Metric label="notes held" value={position.notes.held} />
          <Metric label="nominal" value={position.nominal.held} />
          <Metric label="rate on the note" value={position.rate.percent} />
        </div>

        <Rows>
          <Row
            label="share of issue"
            value={`${position.notes.sharePercent} of ${position.token.totalSupply} in issue`}
          />
          <Row
            label="nominal each"
            value={`${position.nominal.perNote}, so ${position.notes.held} notes are ${position.nominal.held} of claim`}
          />
          <Row
            label="how it pays"
            value={
              <>
                {position.rate.percent} a year, rate type {position.rate.typeLabel}.
                the token holds this rate in its own storage and stamps it onto
                every coupon itself, refusing any rate a caller supplies. posted
                by <TxLink tx={position.rate.postedBy} label="setRate" />
              </>
            }
          />
          <Row
            label="paid so far"
            value={
              position.coupon.entitlement === null ? (
                <span className="text-zinc-500">no coupon declared yet</span>
              ) : (
                <>
                  {position.coupon.entitlement} for the period to{" "}
                  {readable(position.coupon.periodEndIso)}, at{" "}
                  {position.coupon.ratePercent}.{" "}
                  declared by{" "}
                  <TxLink tx={position.coupon.declaredBy} label="setCoupon" />
                  <span className="block text-zinc-500">
                    the token fixes the register at the record date and makes the
                    entitlement readable. it moves no value. settlement is a
                    separate payment by the agent.
                  </span>
                </>
              )
            }
          />
          <Row
            label="maturity"
            value={
              <>
                {readable(position.maturity.iso)}
                {position.maturity.matured ? ", reached" : ", not yet reached"}
                {position.maturity.changedBy && (
                  <span className="block text-zinc-500">
                    the date was moved after issuance to compress a three year
                    life into a demo. the name still carries the original tenor.
                    moved by{" "}
                    <TxLink
                      tx={position.maturity.changedBy}
                      label="updateMaturityDate"
                    />
                  </span>
                )}
              </>
            }
          />
          <Row
            label="register"
            value={
              position.holder.onRegister ? (
                <>
                  this account is verified on the token&apos;s register, so it may
                  hold and move the note.{" "}
                  they arrived by{" "}
                  <TxLink
                    tx={position.notes.arrivedBy}
                    label="transferByPartition"
                  />
                </>
              ) : (
                <span className="text-red-700 dark:text-red-400">
                  this account is not verified on the register. the token refuses
                  transfers to it.
                </span>
              )
            }
          />
          <Row
            label="the note"
            value={
              <a
                href={position.token.hashscan}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {position.token.id} on hashscan
              </a>
            }
          />
        </Rows>
      </Panel>

      {/* ---------------------------------------------------------------- */}
      <Panel
        title="raise an advance against this note"
        subtitle="the lender advances against the note as collateral, at a rate it did not set and cannot check"
      >
        {disclosure === null ? (
          <div className="flex flex-col gap-2">
            <p className="text-zinc-500">
              no covenant report has been published to this server. the terms
              below cannot be shown until the engine has run.
            </p>
            <p className="text-zinc-500">
              the {position.rate.percent} on this note came from an earlier run
              and is already on chain.{" "}
              <TxLink tx={position.rate.postedBy} label="that transaction" /> is
              the evidence of it.
            </p>
            <Link
              href="/engine"
              className="w-fit border border-zinc-900 px-3 py-1 dark:border-zinc-100"
            >
              run the engine
            </Link>
          </div>
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

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-zinc-500">notes to pledge</span>
                <input
                  inputMode="decimal"
                  value={pledgeInput}
                  placeholder={money(free)}
                  onChange={(e) => setPledgeInput(e.target.value)}
                  className="w-40 border border-zinc-400 bg-transparent px-2 py-1 tabular-nums dark:border-zinc-600"
                />
              </label>
              <button
                onClick={() => setPledgeInput("")}
                className="border border-zinc-400 px-3 py-1 dark:border-zinc-600"
              >
                all {money(free)}
              </button>
              <span className="pb-1 text-zinc-500">
                free to pledge: {position.notes.free}. under hold:{" "}
                {position.notes.underHold}.
              </span>
            </div>

            <Rows>
              <Row label="collateral" value={`${money(collateral)} nominal`} />
              <Row
                label="advance"
                value={
                  <span className="text-base font-semibold">
                    {advance === null ? "unavailable" : money(advance)}
                  </span>
                }
              />
              <Row
                label="held back"
                value={`${cover === null ? "unavailable" : money(cover)}, the haircut. the lender's cover if this defaults.`}
              />
            </Rows>

            <div className="flex flex-col gap-2 border-l-4 border-zinc-400 pl-3 dark:border-zinc-600">
              <p>
                the haircut is set by the covenant engine from the borrower&apos;s
                financial statements. you do not see those statements and neither
                does the lender. the verdict and the haircut are the whole of what
                leaves the engine.
              </p>
              <p className="text-zinc-500">
                stated plainly, because it is the first thing a credit person will
                work out: the haircut is a published function of the borrower&apos;s
                leverage ratio, so anyone holding it can recover that ratio. that
                is deliberate and it is what a lender is owed. the filing behind
                the ratio is five separate figures and one ratio does not
                determine any of them.
              </p>
            </div>

            <Rows>
              <Row label="borrower" value={disclosure.borrower} />
              <Row label="period" value={disclosure.period} />
              <Row label="covenant terms" value={disclosure.policyId} />
              <Row label="run" value={disclosure.runId} />
            </Rows>
            <EngineStamp engine={disclosure.engine} />
            <p className="text-zinc-500">
              the lender is shown exactly this and nothing more.{" "}
              <Link href="/lender" className="underline underline-offset-2">
                their view is at /lender
              </Link>
              .
            </p>
          </div>
        )}
      </Panel>

      {/* ---------------------------------------------------------------- */}
      <Panel
        title="the pledge"
        subtitle="what actually happens to the notes when you raise against them"
      >
        <div className="flex flex-col gap-2">
          <p>
            the notes stay in your account. they are not transferred to the
            lender, not wrapped, and not sent anywhere. the token marks part of
            your balance as held.
          </p>
          <p>
            while they are held you cannot move them, and neither can the lender.
            one named third party, the escrow, decides what happens to them.
          </p>
        </div>

        <Rows>
          <Row
            label="escrow"
            value={
              <>
                <a
                  href={position.parties.escrow.hashscan}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {position.parties.escrow.id}
                </a>
                , the covenant engine. the only account that may release the notes
                back to you or move them to the lender.
                <span className="block text-zinc-500">
                  it is not the agent. the agent that issued this note, granted
                  the register and declared the coupon is{" "}
                  {position.parties.agent.id}, and it has no say in this outcome.
                  that separation is the point of the arrangement.
                </span>
              </>
            }
          />
          <Row
            label="destination"
            value={
              <>
                <a
                  href={position.parties.lender.hashscan}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {position.parties.lender.id}
                </a>
                , the lender. fixed when the pledge is created, so the escrow
                cannot send the collateral anywhere else.
              </>
            }
          />
          <Row
            label="the call"
            value={
              <>
                createHoldByPartition, partition 1, {money(pledge)} notes, escrow{" "}
                {position.parties.escrow.id}, destination{" "}
                {position.parties.lender.id}, with an expiry.
                <span className="block text-zinc-500">
                  signed by this account in MetaMask. there is no key anywhere in
                  this application and nothing on this page can sign for you.
                </span>
              </>
            }
          />
        </Rows>

        {live.length === 0 ? (
          <div className="flex flex-col gap-2 border border-zinc-300 p-3 dark:border-zinc-700">
            <p className="text-base">
              {position.lifecycle.pledged
                ? "no notes are held right now."
                : "nothing is pledged on this note yet."}
            </p>
            <p className="text-zinc-500">
              {position.notes.free} notes are free to move.{" "}
              {position.lifecycle.pledged
                ? "a pledge has been created on this note and is no longer open. how it ended is below."
                : "when a pledge is signed it appears here, read back off the token, without this page being changed."}
            </p>
            <Link
              href="/"
              className="w-fit border border-zinc-400 px-3 py-1 dark:border-zinc-600"
            >
              the pledge is signed in the operator console
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {live.map((h) => (
              <div
                key={h.holdId}
                className="flex flex-col gap-2 border border-emerald-600 p-3"
              >
                <div className="text-base font-semibold">
                  {h.amount} notes held, hold {h.holdId}
                </div>
                <Rows>
                  <Row label="escrow" value={h.escrowLabel} tone={h.escrowIsEngine ? "pass" : "breach"} />
                  <Row
                    label="destination"
                    value={h.destinationPinned ? h.destinationLabel : "not fixed, the escrow may send anywhere"}
                    tone={h.destinationIsLender ? "pass" : "breach"}
                  />
                  <Row label="expires" value={readable(h.expiryIso)} />
                </Rows>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ---------------------------------------------------------------- */}
      <Panel
        title="how this ends"
        subtitle="three outcomes, three real calls on this token, exactly one of them runs"
      >
        <div className="flex flex-wrap gap-3">
          <Outcome
            title="you repay"
            call="releaseHoldByPartition"
            who="the escrow"
            what="the hold is lifted and the notes are free again. they never left your account."
            tx={position.lifecycle.released}
            pending="not yet"
          />
          <Outcome
            title="you default"
            call="executeHoldByPartition"
            who="the escrow"
            what="the held notes move to the lender. the amount that moves was set by the haircut, which the lender never saw the inputs to."
            tx={position.lifecycle.executed}
            pending="not yet"
          />
          <Outcome
            title="nobody acts"
            call="reclaimHoldByPartition"
            who="you"
            what="after the expiry both calls above revert. the hold lapses and you take the notes back."
            tx={position.lifecycle.reclaimed}
            pending="not yet"
          />
        </div>
        <p className="text-zinc-500">
          the pledge itself:{" "}
          {position.lifecycle.pledged ? (
            <TxLink tx={position.lifecycle.pledged} label="createHoldByPartition" />
          ) : (
            "not created yet"
          )}
          .
        </p>
      </Panel>

      {/* ---------------------------------------------------------------- */}
      <Panel
        title="on chain"
        subtitle={`every call ever made against this note, ${position.history.length} of them, read from the mirror node`}
      >
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
        {position.history.length === 0 && (
          <p className="text-zinc-500">no history came back from the mirror node.</p>
        )}
      </Panel>

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
