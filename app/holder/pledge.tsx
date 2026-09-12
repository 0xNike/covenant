"use client";

// covenant. the note holder signs the collateral hold, on the holder's own page.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS, AND WHAT IT DELIBERATELY CANNOT DO
// ---------------------------------------------------------------------------
//
// an institution holding this note holds its own keys. the pledge is the one
// action that is theirs, so it belongs here and not only in the operator
// console. everything after the pledge belongs to somebody else.
//
// so this card creates a hold and nothing else. there is no release, no
// execute and no reclaim on this page, and there must never be. those three
// verbs are the escrow's, and the whole claim of this project is that the
// escrow is a separate party from the holder and from the agent. a holder page
// carrying a release button would say the opposite in the clearest possible
// way.
//
// ---------------------------------------------------------------------------
// THE TWO FIXED PARAMETERS
// ---------------------------------------------------------------------------
//
// `escrow` is the engine account and `to` is the lender account, both read from
// configuration by `buildHoldPlan`. neither is an input and neither may become
// one. a hold whose escrow the holder picks is not an arrangement a lender
// would advance against, and a hold whose destination the holder picks is not
// collateral. they are shown below as facts, with the accounts spelled out, so
// a viewer can read them off the screen and then check the same two fields
// against the token afterwards.
//
// ---------------------------------------------------------------------------
// THE WRONG SIGNER
// ---------------------------------------------------------------------------
//
// `createHoldByPartition` holds from `msg.sender`. there is no `from` anywhere
// in the path (`HoldByPartition.sol:60`, and see the note above
// `createCollateralHold`). a create signed by the wrong account is not an
// error: it is a valid hold over that account's notes, with no revert and no
// warning. `requireSigner` refuses to build it, and this card says so on screen
// before anyone reaches for the wallet.
//
// nothing here imports from lib/engine. this page is inside the disclosure
// boundary and is scanned by `npm run scan:disclosure`.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { hashscanTx, readConfig, type CovenantConfig } from "@/lib/config";
import { connectWallet } from "@/lib/ats/client";
import {
  buildHoldPlan,
  createCollateralHold,
  dryRunCreateHold,
  HOLD_MINUTES_DEFAULT,
  type CreatedHold,
  type DryRun,
  type HoldPlan,
} from "@/lib/ats/collateral";
import { Row, Rows } from "@/app/components/covenant-ui";

interface Party {
  id: string;
  evm: string;
  hashscan: string;
}

/** unwraps the whole error chain. the useful reason is usually the cause. */
function errorText(e: unknown): string {
  if (e instanceof Error) {
    const chain: string[] = [];
    let cur: unknown = e;
    while (cur instanceof Error) {
      chain.push(cur.message);
      cur = (cur as { cause?: unknown }).cause;
    }
    return chain.join(", caused by ");
  }
  return String(e);
}

type Injected = {
  request: (a: unknown) => Promise<unknown>;
  on?: (e: string, h: (v: string[]) => void) => void;
  removeListener?: (e: string, h: (v: string[]) => void) => void;
};

function injected(): Injected | undefined {
  return (globalThis as { ethereum?: Injected }).ethereum;
}

/**
 * the amount, as a string the token will accept.
 *
 * `holdStruct` calls `ethers.parseUnits(plan.amount, decimals)`, which throws on
 * a thousands separator and on more decimal places than the token carries. the
 * displayed figure is formatted for reading and is not this.
 */
function amountForChain(notes: number, decimals: number): string {
  return notes.toFixed(Math.max(0, Math.min(decimals, 18)));
}

export default function PledgeCard({
  token,
  holder,
  escrow,
  lender,
  notes,
  onPledged,
}: {
  token: { id: string; evm: string; decimals: number };
  holder: { id: string; evm: string };
  escrow: Party;
  lender: Party;
  /** the pledge size chosen above, in whole notes */
  notes: number;
  onPledged: () => void;
}) {
  // configuration is read here rather than on the server, because this is the
  // only part of the page that needs it. it throws when the environment is not
  // set up, and a throw in a client component takes the whole document down, so
  // the page keeps its position and loses only the ability to sign.
  const [cfg, cfgError] = useMemo((): [CovenantConfig | null, string | null] => {
    try {
      return [readConfig(), null];
    } catch (e) {
      return [null, errorText(e)];
    }
  }, []);

  /**
   * whether the browser has an injected wallet at all.
   *
   * an external fact that does not change during a session, so it is read
   * through `useSyncExternalStore` rather than copied into state by an effect.
   * the server snapshot is `true`, which makes the server render the connect
   * control; a browser without a wallet corrects that on hydration and says so
   * plainly. the position above never depends on either answer.
   */
  const hasWallet = useSyncExternalStore(
    () => () => {},
    () => injected() !== undefined,
    () => true,
  );
  /** the account the wallet is on right now, not the one connect was pressed on */
  const [liveAccount, setLiveAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "sign" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const [done, setDone] = useState<CreatedHold | null>(null);
  /**
   * whether `Network.connect` has run in this document.
   *
   * `eth_accounts` returning an account means the wallet has authorised this
   * origin at some point, which is not the same thing: the SDK keeps its own
   * network configuration and paired account and has neither until
   * `connectWallet` runs. a reload with MetaMask already authorised therefore
   * shows a connected account and a sign button over an uninitialised SDK, so
   * `onSign` pairs first rather than trusting the address on screen.
   */
  const [paired, setPaired] = useState(false);

  // the wallet can be switched at any moment, including between reading this
  // card and pressing the button, so the account is watched rather than read
  // once. this is the same listener block block E uses, for the same reason.
  useEffect(() => {
    const eth = injected();
    if (!eth) return;
    const apply = (accounts: string[]) => setLiveAccount(accounts[0] ?? null);
    eth
      .request({ method: "eth_accounts" })
      .then((a) => apply(a as string[]))
      .catch(() => setLiveAccount(null));
    eth.on?.("accountsChanged", apply);
    return () => eth.removeListener?.("accountsChanged", apply);
  }, []);

  const amount = amountForChain(notes, token.decimals);
  const positive = Number(amount) > 0;

  const plan = useMemo((): HoldPlan | null => {
    if (!cfg || !positive) return null;
    try {
      return buildHoldPlan(cfg, amount, HOLD_MINUTES_DEFAULT);
    } catch {
      return null;
    }
  }, [cfg, amount, positive]);

  const connectedRight =
    liveAccount !== null &&
    liveAccount.toLowerCase() === holder.evm.toLowerCase();

  const onConnect = useCallback(async () => {
    if (!cfg) return;
    setBusy("connect");
    setError(null);
    try {
      await connectWallet(cfg);
      setPaired(true);
      const eth = injected();
      const accounts = (await eth?.request({ method: "eth_accounts" })) as
        | string[]
        | undefined;
      setLiveAccount(accounts?.[0] ?? null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }, [cfg]);

  const onSign = useCallback(async () => {
    if (!cfg) return;
    setBusy("sign");
    setError(null);
    setDry(null);
    setPendingHash(null);
    // cleared rather than latched. a holder who pledges part of the position can
    // pledge the rest, and a success box from the previous hold standing over a
    // second attempt would name the wrong hold id.
    setDone(null);
    try {
      if (!paired) {
        await connectWallet(cfg);
        setPaired(true);
      }

      // rebuilt at the click. the expiry is relative to now, so a plan computed
      // when the page loaded is already short by however long it has been open.
      const fresh = buildHoldPlan(cfg, amount, HOLD_MINUTES_DEFAULT);

      // ask the token first, from the account that is actually connected. a
      // named revert here is a real refusal and costs nothing to find out; no
      // revert data at all is usually the relay, so that only warns.
      const check = await dryRunCreateHold(
        cfg,
        token.evm,
        fresh,
        token.decimals,
        liveAccount ?? fresh.holder.evm,
      );
      setDry(check);
      if (!check.ok && check.revert) {
        throw new Error(
          `the token refused this pledge before it was signed: ${check.revert.summary}`,
        );
      }

      const created = await createCollateralHold(
        cfg,
        token.id,
        token.evm,
        fresh,
        (h) => setPendingHash(h),
      );
      setDone(created);
      onPledged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }, [cfg, amount, token, liveAccount, paired, onPledged]);

  // ---------------------------------------------------------------------------

  // the two parameters a holder does not get to choose, stated as facts rather
  // than as prose. "fixed" is doing the work of a paragraph: it is on the row,
  // next to the account, where a viewer can read it off the screen and then
  // check the same field against the token afterwards.
  const fixed = (
    <Rows>
      <Row
        label="escrow"
        value={
          <>
            <a
              href={escrow.hashscan}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {escrow.id}
            </a>{" "}
            <span className="text-zinc-500">
              fixed, from configuration. not an input.
            </span>
          </>
        }
      />
      <Row
        label="destination"
        value={
          <>
            <a
              href={lender.hashscan}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {lender.id}
            </a>{" "}
            <span className="text-zinc-500">
              fixed, the lender. not an input.
            </span>
          </>
        }
      />
      <Row
        label="expiry"
        value={
          <>
            {HOLD_MINUTES_DEFAULT} minutes{" "}
            <span className="text-zinc-500">
              after that you reclaim. a pledge cannot strand the notes.
            </span>
          </>
        }
      />
      <Row
        label="call"
        value={
          positive ? (
            <>
              createHoldByPartition, partition 1, {amount} notes{" "}
              <span className="text-zinc-500">
                signed by {holder.id} in your wallet. no key is held here.
              </span>
            </>
          ) : (
            <span className="text-zinc-500">choose a size above</span>
          )
        }
      />
    </Rows>
  );

  const action = () => {
    if (cfg === null) {
      return (
        <p className="border border-amber-600 p-3 text-amber-700 dark:text-amber-400">
          signing is not available because the application is not configured:{" "}
          {cfgError}. everything above is read from the chain and is unaffected.
        </p>
      );
    }
    if (!hasWallet) {
      return (
        <p className="text-zinc-500">
          no browser wallet in this window, so nothing can be signed here. every
          figure above is read from the chain and needs none. to pledge, open
          this page with MetaMask on {holder.id}.
        </p>
      );
    }
    if (liveAccount === null) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void onConnect()}
            disabled={busy !== null}
            className="border-2 border-zinc-900 px-4 py-2 text-base font-semibold disabled:opacity-40 dark:border-zinc-100"
          >
            {busy === "connect" ? "connecting" : "connect wallet"}
          </button>
          <span className="text-zinc-500">
            to sign as {holder.id}. the page is complete without it.
          </span>
        </div>
      );
    }
    if (!connectedRight) {
      return (
        <div className="flex flex-col gap-2 border-2 border-red-600 p-3">
          <p className="font-semibold text-red-700 dark:text-red-400">
            wrong account. these notes belong to {holder.id}.
          </p>
          <p className="text-zinc-500">
            your wallet is on {liveAccount}. the token holds from whichever
            account signs and takes no sender parameter, so a signature from the
            wrong wallet would create a real hold over the wrong party&apos;s
            notes. nothing here will build that call.
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => void onSign()}
          disabled={busy !== null || !positive || plan === null}
          className="border-2 border-zinc-900 px-4 py-2 text-base font-semibold disabled:opacity-40 dark:border-zinc-100"
        >
          {busy === "sign"
            ? "waiting for the wallet"
            : positive
              ? `pledge ${amount} notes`
              : "nothing free to pledge"}
        </button>
        <span className="text-zinc-500">
          {busy === "sign" ? "check MetaMask" : "the next click opens MetaMask"}
        </span>
      </div>
    );
  };

  // no border and no heading of its own. this is the lower half of the card on
  // the holder's page, not a card sitting inside another one, and a second
  // frame around it was what made the action read as one more section rather
  // than as the thing the page is for.
  return (
    <div className="flex flex-col gap-4 border-t border-zinc-300 px-5 py-4 dark:border-zinc-700">
      {fixed}
      {action()}

      {dry && (
        <p
          className={
            "border px-2 py-1 " +
            (dry.ok
              ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
              : "border-amber-600 text-amber-700 dark:text-amber-400")
          }
        >
          asked the token first, from {dry.from}: {dry.summary}
        </p>
      )}

      {busy === "sign" && pendingHash && cfg && (
        <a
          className="break-all underline underline-offset-2"
          href={hashscanTx(cfg, pendingHash)}
          target="_blank"
          rel="noreferrer"
        >
          submitted, waiting for the receipt: {hashscanTx(cfg, pendingHash)}
        </a>
      )}

      {done && cfg && (
        <div className="flex flex-col gap-1 border-2 border-emerald-600 p-3">
          <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
            pledged. hold {done.holdId ?? "created"} over {done.plan.amount}{" "}
            notes.
          </p>
          <p>
            escrow {done.plan.escrow.id}, destination {done.plan.destination.id},
            expires {done.plan.expirationIso}.
          </p>
          {done.transactionId && (
            <a
              className="break-all underline underline-offset-2"
              href={hashscanTx(cfg, done.transactionId)}
              target="_blank"
              rel="noreferrer"
            >
              {hashscanTx(cfg, done.transactionId)}
            </a>
          )}
          {done.note && <p className="text-zinc-500">{done.note}</p>}
          <p className="text-zinc-500">
            what happens next is the escrow&apos;s, and there is no button for
            it here.
          </p>
        </div>
      )}

      {error && (
        <pre className="overflow-x-auto border border-red-600 p-3 whitespace-pre-wrap text-red-700 dark:text-red-400">
          {error}
        </pre>
      )}
    </div>
  );
}
