"use client";

// covenant block E. the collateral hold.
//
// two holds over the same instrument, resolved in opposite directions:
//
//   hold A   create -> release      the borrower repays, the collateral goes back
//   hold B   create -> execute      the borrower defaults, the collateral moves
//                                   to the lender
//
// release and execute are mutually exclusive outcomes of one hold, so one hold
// cannot show both. two holds cost one extra signature and make the claim
// legible: the same escrow, holding two identical instruments, chooses
// differently. see DECISIONS.md D15.
//
// there is no private key anywhere in this file. every state change below is
// signed by a human clicking the browser wallet. see DECISIONS.md D3.
//
// -----------------------------------------------------------------------------
// the two fields the whole thesis rests on, and why both are set deliberately
// -----------------------------------------------------------------------------
// `escrow` is the engine account 0.0.10445014, never the issuer/agent. the
// escrow is the only address that may release or execute
// (`HoldStorageWrapper.isEscrow`, `contracts/domain/asset/HoldStorageWrapper.sol:826-828`,
// enforced at `:1095` and `:1124`, reverting `IsNotEscrow()`), and it is fixed
// at creation: there is no reassign-escrow call anywhere in
// `port/in/security/hold/Hold.ts`. if the agent were the escrow, the agent would
// decide release versus execute, which is the arrangement PROJECT_BRIEF.md
// section 4 says we replace. see DECISIONS.md D5.
//
// `to` is pinned to the lender at creation, and that is not decoration.
// `HoldStorageWrapper._validateExecuteHold` (`:1086-1088`) skips the destination
// check entirely when `hold.to == address(0)`:
//
//   if (holdData.hold.to != address(0) && _to != holdData.hold.to)
//       revert IHoldTypes.InvalidDestinationAddress(holdData.hold.to, _to);
//
// so an unpinned hold lets the escrow send the collateral anywhere. pinning it
// leaves the escrow exactly two choices, release or execute, which is precisely
// the decision we claim the engine makes and nothing more. both values are read
// back off chain by `readHoldDiagnostics` in lib/ats/diagnostics.ts.
//
// -----------------------------------------------------------------------------
// four traps in this leg, all from source, all designed around rather than
// discovered
// -----------------------------------------------------------------------------
// 1. `createHoldByPartition` holds from `msg.sender` and has no `from`
//    parameter (`contracts/facets/holdByPartition/HoldByPartition.sol:60`,
//    `HoldOps.createHoldByPartition(_partition, EvmAccessors.getMsgSender(), ...)`).
//    the SDK compounds it: `CreateHoldByPartitionCommandHandler.ts:50` validates
//    the balance of `accountService.getCurrentAccount()`, whoever the wallet is
//    on. so creating a hold with the wallet on the issuer produces a perfectly
//    valid hold over the ISSUER's notes and quietly destroys the tri-party
//    story. every write here is guarded by `requireSigner`, and the dry run
//    below re-asks the token from the live account before anything is signed.
//
// 2. expiry kills both outcomes, not one. `HoldExpirationReached` blocks release
//    AND execute (`:1091` and `:1120`), while creation only requires
//    `expirationTimestamp >= now`
//    (`LockStorageWrapper.requireValidExpirationTimestamp`, `:352-355`). a short
//    expiry therefore passes validation and leaves the hold dead minutes later.
//    `buildHoldExpiry` refuses anything outside 10 to 180 minutes: long enough to
//    film, short enough that a mistake self-heals through
//    `reclaimHoldByPartition`, which needs no escrow, only expiry.
//
// 3. these are checked only at execute, never at create: the token holder's and
//    the destination's KYC (`onlyIdentifiedAddresses(tokenHolder, _to)` and
//    `onlyCompliant(0, _to, false)`, `HoldByPartition.sol:118-119`), the pinned
//    destination, and the holder's control-list status. block B step 8 grants the
//    lender KYC. `holdPrerequisites` surfaces all of it before the money shot
//    rather than during it. confirmed on chain: an eth_call of
//    `executeHoldByPartition` today reverts `InvalidKycStatus` naming the note
//    holder, before it ever reaches the hold-id check.
//
// 4. a wrong escrow is unrecoverable. `IsNotEscrow` on both release and execute,
//    and the escrow cannot be changed. the hold is stuck until expiry, then
//    anyone may reclaim it. that is the real reason for trap 2's window.

import { ethers } from "ethers";
import type { CovenantConfig } from "@/lib/config";
import { toEvmAddress } from "@/lib/ats/diagnostics";
import { decodeRevert, type DecodedRevert } from "@/lib/ats/revert";
import {
  extractHash,
  findRecentResult,
  PARTITION_1,
  readContractResult,
  requireSigner,
  type TxResult,
} from "@/lib/ats/compliance";

type Sdk = typeof import("@hashgraph/asset-tokenization-sdk");

let sdkPromise: Promise<Sdk> | null = null;

function loadSdk(): Promise<Sdk> {
  if (!sdkPromise) {
    sdkPromise = import("@hashgraph/asset-tokenization-sdk");
  }
  return sdkPromise;
}

export type { TxResult };

/**
 * gas limits, `packages/ats/sdk/src/core/Constants.ts`. every value is the
 * constant the SDK itself passes for the same call, cited by line. none of these
 * is invented.
 */
export const GAS_E = {
  /** Constants.ts:92, GAS.CREATE_HOLD, used at RPCTransactionAdapter.ts:1023 */
  CREATE_HOLD: 7_000_000,
  /** Constants.ts:96, GAS.RELEASE_HOLD, RPCTransactionAdapter.ts:1142 */
  RELEASE_HOLD: 7_000_000,
  /** Constants.ts:86, GAS.EXECUTE_HOLD_BY_PARTITION, RPCTransactionAdapter.ts:1190 */
  EXECUTE_HOLD: 7_000_000,
  /** Constants.ts:97, GAS.RECLAIM_HOLD, RPCTransactionAdapter.ts:1164 */
  RECLAIM_HOLD: 7_000_000,
} as const;

/**
 * the aggregated ABI the SDK itself calls every hold method through
 * (`RPCTransactionAdapter.ts:1020`, `IAsset__factory.connect(...)`). used here
 * only for `eth_call` dry runs and for decoding revert data: every write goes
 * through the SDK.
 *
 * the typed factory does not compile in this application; the ABI does. the
 * reason is recorded at the top of lib/ats/coupon.ts and is a module resolution
 * conflict between the contracts package's commonjs ethers typings and ours, not
 * a runtime problem.
 */
async function assetAbi(): Promise<ethers.InterfaceAbi> {
  const { IAsset__factory } = await import(
    "@hashgraph/asset-tokenization-contracts"
  );
  return IAsset__factory.abi as unknown as ethers.InterfaceAbi;
}

let ifacePromise: Promise<ethers.Interface> | null = null;

async function assetIface(): Promise<ethers.Interface> {
  if (!ifacePromise) {
    ifacePromise = assetAbi().then((abi) => new ethers.Interface(abi));
  }
  return ifacePromise;
}

function rpc(cfg: CovenantConfig): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(cfg.rpcNode, undefined, {
    staticNetwork: true,
  });
}

// -----------------------------------------------------------------------------
// the hold plan. every parameter of both holds, in one object, built once
// -----------------------------------------------------------------------------

export interface HoldPlan {
  /** whole notes, the string the SDK request takes */
  amount: string;
  /** the pledging account. MUST be the account that signs the create */
  holder: { id: string; evm: string };
  /** Hold.escrow. the engine account, never the issuer */
  escrow: { id: string; evm: string };
  /** Hold.to. pinned to the lender at creation */
  destination: { id: string; evm: string };
  /** unix seconds */
  expirationSeconds: number;
  /**
   * exactly the string handed to `CreateHoldByPartitionRequest.expirationDate`.
   * ten digits, seconds. see the note on `buildHoldExpiry`.
   */
  expirationRequest: string;
  expirationIso: string;
  minutes: number;
}

export const HOLD_MINUTES_MIN = 10;
export const HOLD_MINUTES_MAX = 180;
export const HOLD_MINUTES_DEFAULT = 45;

/**
 * builds the expiry, in seconds, as a ten digit string.
 *
 * **the form of this string matters and the SDK does not tell you so.**
 * `CreateHoldByPartitionCommandHandler.ts:58` sends
 * `BigDecimal.fromString(expirationDate.substring(0, 10))`, while the request
 * object validated `parseInt(val)` against `Math.ceil(Date.now() / 1000)`
 * (`CreateHoldByPartition.ts:36-38`). the two see different numbers unless the
 * caller happens to pass seconds:
 *
 *   "1789042800"      10 digits, seconds  -> validated as seconds, sent as seconds
 *   "1789042800000"   13 digits, millis   -> validated as a year-58690 timestamp,
 *                                            silently truncated to the right
 *                                            seconds value before sending
 *   "2026-09-10T..."  an ISO string       -> parseInt gives NaN, the substring is
 *                                            garbage, and the value validated is
 *                                            not the value sent
 *
 * we pass seconds, deliberately, so the number the validator checked and the
 * number the contract stores are the same number.
 *
 * the window is bounded on purpose. `HoldExpirationReached` blocks release and
 * execute alike, so too short kills the demo, and a hold created with a wrong
 * escrow cannot be undone before expiry, so too long locks the notes for the
 * rest of the build. see trap 2 and trap 4 in the header.
 */
export function buildHoldExpiry(
  minutes: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): { expirationSeconds: number; expirationRequest: string; expirationIso: string } {
  if (!Number.isFinite(minutes) || minutes < HOLD_MINUTES_MIN || minutes > HOLD_MINUTES_MAX) {
    throw new Error(
      `hold expiry of ${minutes} minutes refused. use ${HOLD_MINUTES_MIN} to ${HOLD_MINUTES_MAX}. ` +
        "shorter and the hold dies before it can be released or executed; longer and a hold " +
        "created with the wrong escrow stays locked until it expires.",
    );
  }
  const expirationSeconds = nowSeconds + Math.round(minutes * 60);
  return {
    expirationSeconds,
    // ten digits until 2286. the substring the SDK takes is a no-op on this.
    expirationRequest: String(expirationSeconds),
    expirationIso: new Date(expirationSeconds * 1000).toISOString(),
  };
}

/**
 * the parameters of both holds. identical except for how each is resolved, which
 * is the point: the engine sees two identical instruments and chooses
 * differently.
 */
export function buildHoldPlan(
  cfg: CovenantConfig,
  amount: string,
  minutes: number = HOLD_MINUTES_DEFAULT,
  nowSeconds?: number,
): HoldPlan {
  const expiry = buildHoldExpiry(minutes, nowSeconds);
  if (
    cfg.accounts.engine.evm.toLowerCase() === cfg.accounts.issuer.evm.toLowerCase()
  ) {
    throw new Error(
      "the configured engine account is the issuer account. the escrow must be a " +
        "different account or the agent decides release versus execute. see DECISIONS.md D5.",
    );
  }
  return {
    amount,
    holder: cfg.accounts.holder,
    escrow: cfg.accounts.engine,
    destination: cfg.accounts.lender,
    minutes,
    ...expiry,
  };
}

// -----------------------------------------------------------------------------
// dry runs. every write in this file can be asked of the token before it is sent
// -----------------------------------------------------------------------------

export interface DryRun {
  /** the call, for the console and the evidence trail */
  call: string;
  /** the account the eth_call was made from. this is the account that must sign */
  from: string;
  ok: boolean;
  /** decoded revert, when the token refused */
  revert: DecodedRevert | null;
  /** the decoded return values, when it did not */
  returns: string[];
  summary: string;
}

/**
 * pulls revert data out of an ethers `CALL_EXCEPTION`.
 *
 * the hedera relay nests it differently depending on the failure, so this walks
 * the likely keys and falls back to the first long hex string it finds. this is
 * the eth_call sibling of `extractHash` in lib/ats/compliance.ts, which does the
 * same job for a transaction hash on a reverted send.
 */
function revertDataOf(e: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): string | null => {
    if (v === null || v === undefined || depth > 8) return null;
    if (typeof v === "string") {
      return /^0x[0-9a-fA-F]{8,}$/.test(v) ? v : null;
    }
    if (typeof v !== "object" || seen.has(v)) return null;
    seen.add(v);
    for (const key of ["data", "error", "info", "body", "value", "cause", "revert"]) {
      const found = walk((v as Record<string, unknown>)[key], depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(e, 0);
}

/**
 * decodes revert data against every error in the aggregated ATS ABI first, and
 * falls back to lib/ats/revert.ts's selector table.
 *
 * the ABI is the complete list for this diamond, so a hold error we did not
 * anticipate still comes back named rather than as a bare selector. the fallback
 * stays because the table carries the compliance errors that reach us as a
 * bytes32 reason word rather than as revert data.
 */
export async function decodeHoldRevert(
  data: string | null | undefined,
): Promise<DecodedRevert | null> {
  if (!data || !data.startsWith("0x") || data.length < 10) return null;
  const iface = await assetIface();
  try {
    const parsed = iface.parseError(data);
    if (parsed) {
      const args = parsed.args.map((a) => String(a));
      return {
        raw: data,
        selector: data.slice(0, 10).toLowerCase(),
        name: `${parsed.name}(${parsed.fragment.inputs.map((i) => i.type).join(",")})`,
        args,
        summary: args.length
          ? `${parsed.name}(${args.join(", ")})`
          : `${parsed.name}()`,
      };
    }
  } catch {
    // not an error in this ABI. the table below still knows the compliance set.
  }
  return decodeRevert(data);
}

async function dryRun(
  cfg: CovenantConfig,
  tokenEvm: string,
  fromEvm: string,
  fn: string,
  args: unknown[],
  label: string,
): Promise<DryRun> {
  const iface = await assetIface();
  const provider = rpc(cfg);
  const from = toEvmAddress(fromEvm);
  const data = iface.encodeFunctionData(fn, args);
  try {
    const res = await provider.call({ to: toEvmAddress(tokenEvm), from, data });
    const out = iface.decodeFunctionResult(fn, res);
    return {
      call: label,
      from,
      ok: true,
      revert: null,
      returns: out.map((v) => String(v)),
      summary: `${label} would succeed from ${from}${
        out.length ? `, returning ${out.map((v) => String(v)).join(", ")}` : ""
      }`,
    };
  } catch (e) {
    const decoded = await decodeHoldRevert(revertDataOf(e));
    return {
      call: label,
      from,
      ok: false,
      revert: decoded,
      returns: [],
      summary: `${label} would revert from ${from}: ${
        decoded?.summary ?? "no revert data returned"
      }`,
    };
  }
}

/**
 * the hold struct exactly as the SDK builds it (`RPCTransactionAdapter.ts:1011-1017`),
 * with one difference that is stated rather than hidden: `data` is a parameter
 * here and a hardcoded `"0x"` there. see `HOLD_DATA_NOTE`.
 */
function holdStruct(plan: HoldPlan, decimals: number, data = "0x") {
  return {
    amount: ethers.parseUnits(plan.amount, decimals),
    expirationTimestamp: BigInt(plan.expirationSeconds),
    escrow: toEvmAddress(plan.escrow.evm),
    to: toEvmAddress(plan.destination.evm),
    data,
  };
}

function holdIdentifier(holderEvm: string, holdId: number) {
  return {
    partition: PARTITION_1,
    tokenHolder: toEvmAddress(holderEvm),
    holdId: BigInt(holdId),
  };
}

/**
 * asks the token whether this hold could be created, from the account that would
 * sign it.
 *
 * pass the LIVE connected account as `fromEvm`, not the account the step is
 * meant to use. the point is to catch a wrong-account create before a signature
 * is spent on it: `createHoldByPartition` takes no `from`, so a create signed by
 * the issuer succeeds and holds the issuer's notes.
 */
export function dryRunCreateHold(
  cfg: CovenantConfig,
  tokenEvm: string,
  plan: HoldPlan,
  decimals: number,
  fromEvm: string,
  data = "0x",
): Promise<DryRun> {
  return dryRun(
    cfg,
    tokenEvm,
    fromEvm,
    "createHoldByPartition",
    [PARTITION_1, holdStruct(plan, decimals, data)],
    `createHoldByPartition ${plan.amount} notes, escrow ${plan.escrow.id}, to ${plan.destination.id}`,
  );
}

export function dryRunReleaseHold(
  cfg: CovenantConfig,
  tokenEvm: string,
  holderEvm: string,
  holdId: number,
  amount: string,
  decimals: number,
  fromEvm: string,
): Promise<DryRun> {
  return dryRun(
    cfg,
    tokenEvm,
    fromEvm,
    "releaseHoldByPartition",
    [holdIdentifier(holderEvm, holdId), ethers.parseUnits(amount, decimals)],
    `releaseHoldByPartition hold ${holdId}, ${amount} notes`,
  );
}

export function dryRunExecuteHold(
  cfg: CovenantConfig,
  tokenEvm: string,
  holderEvm: string,
  holdId: number,
  toEvm: string,
  amount: string,
  decimals: number,
  fromEvm: string,
): Promise<DryRun> {
  return dryRun(
    cfg,
    tokenEvm,
    fromEvm,
    "executeHoldByPartition",
    [
      holdIdentifier(holderEvm, holdId),
      toEvmAddress(toEvm),
      ethers.parseUnits(amount, decimals),
    ],
    `executeHoldByPartition hold ${holdId}, ${amount} notes to ${toEvm}`,
  );
}

export function dryRunReclaimHold(
  cfg: CovenantConfig,
  tokenEvm: string,
  holderEvm: string,
  holdId: number,
  fromEvm: string,
): Promise<DryRun> {
  return dryRun(
    cfg,
    tokenEvm,
    fromEvm,
    "reclaimHoldByPartition",
    [holdIdentifier(holderEvm, holdId)],
    `reclaimHoldByPartition hold ${holdId}`,
  );
}

// -----------------------------------------------------------------------------
// the writes. all three go through the SDK, all three are account guarded
// -----------------------------------------------------------------------------

/**
 * recovers a hash for a write the SDK threw on.
 *
 * `RPCTransactionResponseAdapter.manageResponse` (`port/out/response/RPCTransactionResponseAdapter.ts:28-38`)
 * catches everything `response.wait()` throws and rethrows a
 * `TransactionResponseError` whose `transactionId` is
 * `(error as {transactionHash?: string}).transactionHash`. ethers frequently does
 * not set that field on a reverted call, so a hold that reverted on chain
 * surfaces as an exception with no hash and no HashScan link, which is the one
 * thing this block cannot afford: a reverted execute IS evidence, and evidence
 * without a link is an anecdote.
 *
 * so we look in three places, in order: the SDK error's own transaction id, any
 * 32 byte hex the relay left in the error, and finally the mirror node's record
 * of this sender's recent calls to this contract. the mirror node is the
 * authority on whether it reached the chain, not the relay's error shape. this
 * is the same recovery `forceTransferOnChain` uses in lib/ats/compliance.ts.
 */
async function recoverFailedWrite(
  cfg: CovenantConfig,
  tokenEvm: string,
  signerEvm: string,
  submittedAt: number,
  e: unknown,
  onHash?: (hash: string) => void,
): Promise<TxResult> {
  const fromSdk = (e as { transactionId?: string })?.transactionId;
  let hash: string | null =
    typeof fromSdk === "string" && fromSdk.startsWith("0x") ? fromSdk : null;
  let note = "hash reported by the SDK error";

  if (!hash) {
    hash = extractHash(e);
    if (hash) note = "hash recovered from the relay error";
  }
  if (!hash) {
    hash = await findRecentResult(
      cfg,
      signerEvm,
      toEvmAddress(tokenEvm),
      submittedAt,
    );
    if (hash) note = "hash recovered from the mirror node by sender and timestamp";
  }
  if (!hash) throw e;

  onHash?.(hash);
  const record = await readContractResult(cfg, hash);
  return {
    hash,
    success: record?.status === "0x1",
    revert: (await decodeHoldRevert(record?.errorMessage)) ?? null,
    note: record?.result ? `${record.result}, ${note}` : note,
  };
}

export interface CreatedHold {
  /** the hold id, per (partition, holder). one-indexed, assigned on chain */
  holdId: number | null;
  transactionId: string;
  plan: HoldPlan;
  note?: string;
}

/**
 * creates the hold. **signed by the note holder and nobody else.**
 *
 * `createHoldByPartition` has no `from` parameter: the contract holds from
 * `EvmAccessors.getMsgSender()` (`HoldByPartition.sol:60`). so the account
 * connected at the moment of signing IS the pledging account, and a create
 * signed by the issuer produces a valid hold over the wrong balance with no
 * error anywhere. `requireSigner` refuses first, and the console dry-runs the
 * same call from the live account before enabling the button.
 *
 * the hold id comes back through the SDK by an indirect route worth knowing
 * about: the adapter passes no event name
 * (`RPCTransactionAdapter.ts:1019-1024`), so `manageResponse` returns the
 * receipt status rather than the `HeldByPartition` event args, `res.response?.holdId`
 * is undefined, and `CreateHoldByPartitionCommandHandler.ts:62-68` falls through
 * to `TransactionService.getTransactionResult`, which reads the mirror node's
 * `call_result` and parses word 1 of 2 as the id. that is a mirror node round
 * trip with a 15 second timeout, so it can throw over a hold that exists. when it
 * does, `readHoldIds` asks the token directly.
 */
export async function createCollateralHold(
  cfg: CovenantConfig,
  securityId: string,
  tokenEvm: string,
  plan: HoldPlan,
  onHash?: (hash: string) => void,
): Promise<CreatedHold> {
  await requireSigner(plan.holder.evm);
  const { Security, CreateHoldByPartitionRequest } = await loadSdk();

  const before = await readHoldIds(cfg, tokenEvm, plan.holder.evm);
  const submittedAt = Math.floor(Date.now() / 1000) - 5;

  try {
    const res = await Security.createHoldByPartition(
      new CreateHoldByPartitionRequest({
        securityId,
        partitionId: PARTITION_1,
        amount: plan.amount,
        escrowId: plan.escrow.id,
        targetId: plan.destination.id,
        // seconds, ten digits. see buildHoldExpiry before changing this.
        expirationDate: plan.expirationRequest,
      }),
    );
    if (res.transactionId) onHash?.(res.transactionId);
    return { holdId: res.payload, transactionId: res.transactionId, plan };
  } catch (e) {
    // the id parse can throw over a hold that landed. ask the token before
    // reporting a failure.
    const after = await readHoldIds(cfg, tokenEvm, plan.holder.evm);
    const fresh = after.filter((id) => !before.includes(id));
    if (fresh.length > 0) {
      const hash = await findRecentResult(
        cfg,
        plan.holder.evm,
        toEvmAddress(tokenEvm),
        submittedAt,
      );
      if (hash) onHash?.(hash);
      return {
        holdId: Math.max(...fresh),
        transactionId: hash ?? "",
        plan,
        note:
          `the SDK threw, but hold ${Math.max(...fresh)} exists on chain for ` +
          `${plan.holder.id}, so the transaction landed. the SDK error was: ` +
          (e instanceof Error ? `${e.name}: ${e.message}` : String(e)),
      };
    }
    const failed = await recoverFailedWrite(
      cfg,
      tokenEvm,
      plan.holder.evm,
      submittedAt,
      e,
      onHash,
    );
    throw new Error(
      `createHoldByPartition failed. ${failed.revert?.summary ?? "no revert reason"}. ` +
        `transaction ${failed.hash} (${failed.note ?? ""})`,
    );
  }
}

/**
 * releases the hold. the repayment path. **signed by the escrow, the engine
 * account.**
 *
 * `_validateNonReclaimHold` (`HoldStorageWrapper.sol:1118-1124`) reverts
 * `HoldExpirationReached()` past expiry and `IsNotEscrow()` for any caller that
 * is not the recorded escrow. neither is pre-checked by the SDK: the release
 * command handler checks pause, decimals and hold balance only
 * (`ReleaseHoldByPartitionCommandHandler.ts:42-46`). so a wrong account here
 * costs a real signature and a real reverted transaction.
 *
 * `targetId` on the request is the TOKEN HOLDER, not a recipient. the adapter
 * puts it in `HoldIdentifier.tokenHolder` (`RPCTransactionAdapter.ts:1132-1136`)
 * and released notes go back to that holder's available balance. the field name
 * reads like a destination and is not one.
 */
export async function releaseCollateralHold(
  cfg: CovenantConfig,
  securityId: string,
  tokenEvm: string,
  plan: HoldPlan,
  holdId: number,
  onHash?: (hash: string) => void,
): Promise<TxResult & { transactionId: string }> {
  await requireSigner(plan.escrow.evm);
  const { Security, ReleaseHoldByPartitionRequest } = await loadSdk();
  const submittedAt = Math.floor(Date.now() / 1000) - 5;

  try {
    const res = await Security.releaseHoldByPartition(
      new ReleaseHoldByPartitionRequest({
        securityId,
        partitionId: PARTITION_1,
        // the holder whose hold this is, not a recipient. see the note above.
        targetId: plan.holder.id,
        holdId,
        amount: plan.amount,
      }),
    );
    if (res.transactionId) onHash?.(res.transactionId);
    return {
      hash: res.transactionId,
      transactionId: res.transactionId,
      success: res.payload,
      note: `hold ${holdId} released, ${plan.amount} notes back to ${plan.holder.id}`,
    };
  } catch (e) {
    const failed = await recoverFailedWrite(
      cfg,
      tokenEvm,
      plan.escrow.evm,
      submittedAt,
      e,
      onHash,
    );
    return { ...failed, transactionId: failed.hash };
  }
}

/**
 * executes the hold. the default path, and the strongest single shot in the
 * video. **signed by the escrow, the engine account.**
 *
 * on chain this is `HoldByPartition.executeHoldByPartition`
 * (`:107-129`, modifiers `:112-120`), and the modifier order decides which error you see first:
 * `onlyOperational`, `onlyActivated`, `onlyUnpaused`,
 * `onlyDefaultPartitionWithSinglePartition`,
 * `onlyIdentifiedAddresses(tokenHolder, _to)`, `onlyCompliant(0, _to, false)`,
 * `onlyValidHoldId`, and only then the escrow and destination checks inside
 * `_validateExecuteHold`. so a missing KYC grant on the lender masks everything
 * else, including a wrong escrow. the dry run runs the identical call before the
 * button is enabled.
 *
 * the SDK does pre-check KYC here, unlike release:
 * `ExecuteHoldByPartitionCommandHandler.ts:51` runs
 * `checkKycAddresses(securityId, [sourceId, targetId], GRANTED)`. it does not
 * pre-check the escrow, which is the one that costs a signature.
 */
export async function executeCollateralHold(
  cfg: CovenantConfig,
  securityId: string,
  tokenEvm: string,
  plan: HoldPlan,
  holdId: number,
  onHash?: (hash: string) => void,
): Promise<TxResult & { transactionId: string }> {
  await requireSigner(plan.escrow.evm);
  const { Security, ExecuteHoldByPartitionRequest } = await loadSdk();
  const submittedAt = Math.floor(Date.now() / 1000) - 5;

  try {
    const res = await Security.executeHoldByPartition(
      new ExecuteHoldByPartitionRequest({
        securityId,
        partitionId: PARTITION_1,
        sourceId: plan.holder.id,
        targetId: plan.destination.id,
        holdId,
        amount: plan.amount,
      }),
    );
    if (res.transactionId) onHash?.(res.transactionId);
    return {
      hash: res.transactionId,
      transactionId: res.transactionId,
      success: res.payload,
      note:
        `hold ${holdId} executed, ${plan.amount} notes from ${plan.holder.id} ` +
        `to ${plan.destination.id}, by the escrow ${plan.escrow.id}`,
    };
  } catch (e) {
    const failed = await recoverFailedWrite(
      cfg,
      tokenEvm,
      plan.escrow.evm,
      submittedAt,
      e,
      onHash,
    );
    return { ...failed, transactionId: failed.hash };
  }
}

/**
 * reclaims an expired hold. **recovery only, not a demo step.**
 *
 * this is the escape hatch trap 2's expiry window exists for. reclaim is the one
 * hold verb with no escrow check: `_validateReclaimHold`
 * (`HoldStorageWrapper.sol:1105-1107`) tests expiry and nothing else, so once a
 * hold has expired anyone can return the notes to the holder. it is what makes a
 * hold created with a wrong escrow recoverable at all, and it is why the expiry
 * is minutes rather than years.
 *
 * it is deliberately not part of the block E sequence and should not appear in
 * the video.
 */
export async function reclaimCollateralHold(
  cfg: CovenantConfig,
  securityId: string,
  tokenEvm: string,
  holder: { id: string; evm: string },
  holdId: number,
  expectedSignerEvm: string,
  onHash?: (hash: string) => void,
): Promise<TxResult & { transactionId: string }> {
  await requireSigner(expectedSignerEvm);
  const { Security, ReclaimHoldByPartitionRequest } = await loadSdk();
  const submittedAt = Math.floor(Date.now() / 1000) - 5;

  try {
    const res = await Security.reclaimHoldByPartition(
      new ReclaimHoldByPartitionRequest({
        securityId,
        partitionId: PARTITION_1,
        targetId: holder.id,
        holdId,
      }),
    );
    if (res.transactionId) onHash?.(res.transactionId);
    return {
      hash: res.transactionId,
      transactionId: res.transactionId,
      success: res.payload,
      note: `hold ${holdId} reclaimed to ${holder.id}`,
    };
  } catch (e) {
    const failed = await recoverFailedWrite(
      cfg,
      tokenEvm,
      expectedSignerEvm,
      submittedAt,
      e,
      onHash,
    );
    return { ...failed, transactionId: failed.hash };
  }
}

// -----------------------------------------------------------------------------
// helpers the console needs
// -----------------------------------------------------------------------------

const HOLD_IDS_ABI = [
  "function getHoldsIdForByPartition(bytes32 partition, address tokenHolder, uint256 pageIndex, uint256 pageLength) view returns (uint256[])",
];

/** the live hold ids for a holder, read straight off chain. */
export async function readHoldIds(
  cfg: CovenantConfig,
  tokenEvm: string,
  holderEvm: string,
): Promise<number[]> {
  const token = new ethers.Contract(
    toEvmAddress(tokenEvm),
    HOLD_IDS_ABI,
    rpc(cfg),
  );
  const ids: bigint[] = await token.getHoldsIdForByPartition(
    PARTITION_1,
    toEvmAddress(holderEvm),
    0,
    50,
  );
  return ids.map((i) => Number(i));
}

/**
 * `Hold.data` is not reachable through the SDK.
 *
 * `RPCTransactionAdapter.ts:1016` hardcodes `data: "0x"` on the hold struct it
 * builds, and there is no field for it on `CreateHoldByPartitionRequest`
 * (`port/in/request/security/operations/hold/CreateHoldByPartition.ts:8-13`:
 * securityId, partitionId, amount, escrowId, targetId, expirationDate, and
 * nothing else). the same hardcoded `"0x"` appears on every create variant,
 * `:1045`, `:1074` and the protected path.
 *
 * it IS reachable by a direct call. the contract takes the full struct
 * (`HoldByPartition.sol:40-43`), `_storeHold` persists it verbatim
 * (`HoldStorageWrapper.sol:922-926`, `HoldData(holdId_, _hold, ...)`), and
 * `getHoldForByPartition` returns `data_` as its fifth value. confirmed by
 * eth_call against the deployed token: a create carrying a 32 byte value in
 * `Hold.data` reaches exactly the same point in the contract as one carrying
 * `"0x"`.
 *
 * so a hash commitment to the engine's output in `Hold.data` is possible, and it
 * costs leaving the SDK for that one call. we do not do it: it would replace an
 * SDK path with our own calldata for the single most load-bearing transaction in
 * the demo, to add a commitment nothing on chain verifies. stated here so the
 * choice is on the record rather than implied.
 */
export const HOLD_DATA_NOTE =
  "Hold.data is hardcoded to 0x by the SDK adapter (RPCTransactionAdapter.ts:1016) " +
  "and has no request field. it is reachable only by a direct ethers call. we send 0x.";
