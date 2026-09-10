"use client";

// covenant block C. the rate and coupon leg.
//
// the sequence this file exists to perform, in the only order that is safe:
//
//   1. grant ROLE_INTEREST_RATE_MANAGER and ROLE_CORPORATE_ACTION to the issuer
//   2. setCouponRateType(FIXED)          <- before the first coupon, never after
//   3. FixedRate.setRate(engine output)  <- the engine's number, role gated
//   4. setCoupon with the pending triplet, and the TOKEN stamps the rate
//   5. updateMaturityDate, to compress a three year lifecycle into a demo
//
// there is no private key anywhere in this file. every state change below is
// signed by a human clicking the browser wallet. see DECISIONS.md D3.
//
// -----------------------------------------------------------------------------
// why FIXED, and why the order is not negotiable
// -----------------------------------------------------------------------------
// the token is live on RateType.STANDARD, which is what `Factory.deployBond`
// hardcodes. read back off chain on 10 sep 2026: `getCouponRateType()` returns 1.
//
// under STANDARD, `CouponRateDispatch.validateAndStamp`
// (`contracts/domain/asset/coupon/CouponRateDispatch.sol:96-99`) requires the
// caller to supply a rate already marked SET and stores whatever it is handed.
// there is no rate mechanism on that path, only a struct field, and our console
// would be typing a number into it.
//
// under FIXED (`:85-90`) the token **reverts with `InterestRateIsFixed()` if the
// caller supplies any rate at all**, reads the rate from its own storage, and
// stamps the coupon itself. the only way a rate reaches that storage is
// `FixedRate.setRate` (`contracts/facets/fixedRate/FixedRate.sol:29-36`), a
// separate role-gated transaction whose entire payload is the engine's output.
// that is the difference between our application writing a number and the
// protocol applying one.
//
// the switch must happen before the first `setCoupon`. `InterestRate.sol:38`
// carries a maintainer TODO saying they do not know whether changing the type
// after coupons exist is safe. nothing on chain blocks a late switch, but
// `CouponRateDispatch.resolveRate` (`:43-54`) dispatches on the rate type in
// storage **at read time**, not on any per-coupon record of the type in force
// when the coupon was scheduled, so any coupon still PENDING at the moment of a
// switch silently resolves under the new type. we switch first and never find
// out. see DECISIONS.md D16.
//
// -----------------------------------------------------------------------------
// what ATS does NOT do, and must never be implied on screen
// -----------------------------------------------------------------------------
// the coupon facet contains no transfer. `ICoupon.sol` declares four writers:
// `setCoupon`, `cancelCoupon`, `forceCancelCoupon`, `initializeCoupon`. there is
// no `pay`. `getCouponFor` and `getCouponAmountFor` are `view`. so ATS declares
// the coupon, snapshots the register at the record date and makes each holder's
// entitlement readable; it does not move value. the settlement leg is a separate
// transfer we perform ourselves, and it lives in lib/ats/coupon-settlement.ts
// with its own warning attached.

import { ethers } from "ethers";
import type { CovenantConfig } from "@/lib/config";
import { toEvmAddress } from "@/lib/ats/diagnostics";
import { decodeRevert } from "@/lib/ats/revert";
import {
  findRecentResult,
  readContractResult,
  requireSigner,
  type TxResult,
} from "@/lib/ats/compliance";
import type { ScaledValue } from "@/lib/engine/types";

type Sdk = typeof import("@hashgraph/asset-tokenization-sdk");

let sdkPromise: Promise<Sdk> | null = null;

function loadSdk(): Promise<Sdk> {
  if (!sdkPromise) {
    sdkPromise = import("@hashgraph/asset-tokenization-sdk");
  }
  return sdkPromise;
}

/** `IInterestRate.RateType`, `contracts/facets/interestRate/IInterestRate.sol:24-29`. */
export const RATE_TYPE = {
  NONE: 0,
  STANDARD: 1,
  FIXED: 2,
  KPI_LINKED: 3,
} as const;

/** `ICouponTypes.RateCalculationStatus`, `contracts/facets/coupon/ICouponTypes.sol:20-23`. */
export const RATE_STATUS = { PENDING: 0, SET: 1 } as const;

/**
 * roles block C needs, `contracts/constants/roles.sol` lines 35, 56 and 72.
 *
 * every one of these was confirmed **by the deployed contract itself**, not by
 * reading a table: an `eth_call` of each operation from the issuer reverts with
 * `AccountHasNoRole(0x56a4...c742, <hash>)` naming exactly the hash below. see
 * the block C dry run.
 *
 * MATURITY_MANAGER is missing from the SDK's `SecurityRole` enum, which has 34
 * members and carries `_MATURITY_REDEEMER_ROLE` but nothing for this one. that
 * is BUG.md B7, and it bites harder than filed: `ApplyRolesRequest.roles` is
 * validated by `FormatValidation.checkRole()`
 * (`port/in/request/FormatValidation.ts:104-112`), which checks **membership of
 * the enum**, so a role the enum does not name cannot go through `applyRoles` at
 * all. `RoleRequest.role` is validated by `checkBytes32Format()` (`:196-205`),
 * a shape check, so the same role goes through `grantRole` unharmed. two sibling
 * requests validate the same field by two different rules, and only one of them
 * can reach a role that exists on chain.
 */
export const ROLES_C = {
  /** setCouponRateType and setRate */
  INTEREST_RATE_MANAGER:
    "0xfa80c71f8de1628faf2c0e9bd02c2f4a3da1f16823b75e61e84b90164a07b4a4",
  /** setCoupon and cancelCoupon. NOT the interest rate role. Coupon.sol:60 */
  CORPORATE_ACTION:
    "0xa1acfc499025c99f55059195e6276f639d34a18aad7b8121b9192b7f438c55cd",
  /** updateMaturityDate. absent from the SDK enum, pass the hex */
  MATURITY_MANAGER:
    "0xc20b7fd7efe1a2c9f69003a21c2c55c79ef84e16252b62599246ff01f6207314",
} as const;

/**
 * gas limits. every value below except one is the constant the SDK itself
 * passes for the same call, `packages/ats/sdk/src/core/Constants.ts`.
 */
export const GAS_C = {
  /** Constants.ts:38, used at RPCTransactionAdapter.ts:408 */
  GRANT_ROLES: 2_000_000,
  /** Constants.ts:166, RPCTransactionAdapter.setRate */
  SET_RATE: 7_000_000,
  /** Constants.ts:59, RPCTransactionAdapter.setCoupon */
  SET_COUPON: 7_000_000,
  /** Constants.ts:90 */
  UPDATE_MATURITY_DATE: 7_000_000,
  /**
   * Constants.ts:67. the SDK's `triggerPendingScheduledSnapshots`
   * (`RPCTransactionAdapter.ts:799-808`) calls exactly
   * `triggerPendingScheduledCrossOrderedTasks` with this constant, so it is the
   * upstream figure for this function even though we reach it ourselves.
   */
  TRIGGER_SCHEDULED_TASKS: 7_000_000,
  /**
   * **not an upstream figure.** `grep SET_COUPON_RATE_TYPE core/Constants.ts`
   * returns nothing, because the SDK never calls `setCouponRateType` from
   * anywhere in `src`. this reuses `GAS.SET_RATE`, the comparable operation on
   * the same storage. say so wherever this number is reported.
   */
  SET_COUPON_RATE_TYPE: 7_000_000,
} as const;

/**
 * the calls this file makes directly rather than through the SDK.
 *
 * these come from `IAsset__factory` in `@hashgraph/asset-tokenization-contracts`
 * rather than hand-written fragments. `IAsset.sol:281` inherits `IInterestRate`
 * alongside `ICoupon` and `IFixedRate`, and the SDK itself reaches every coupon
 * and rate method through `IAsset__factory.connect(...)`, so the aggregated ABI
 * the SDK already uses **contains** `setCouponRateType`. it is simply never
 * called from `src`. the package is a transitive dependency of the SDK and is
 * already installed.
 */
async function assetContract(
  address: string,
  runner: ethers.ContractRunner,
): Promise<ethers.Contract> {
  const { IAsset__factory } = await import(
    "@hashgraph/asset-tokenization-contracts"
  );
  // the shipped ABI, through a plain `ethers.Contract`, rather than
  // `IAsset__factory.connect(address, signer)`.
  //
  // the typed factory does not compile in this application and the reason is
  // worth recording. `@hashgraph/asset-tokenization-contracts` is
  // `"type": "commonjs"`, so its typechain declarations resolve `ethers` under
  // the `require` condition to `ethers/lib.commonjs`, while this application
  // resolves the same import under `bundler` resolution to `ethers/lib.esm`.
  // ethers ships a separate declaration set for each and its classes carry
  // private fields, so the two `Network` types are nominally incompatible and
  // `connect(address, signer)` fails with TS2345 on a `JsonRpcSigner` that is
  // the correct runtime object. the ABI is the part we needed from the package
  // anyway: the point was not hand-writing a fragment for a function the SDK
  // never calls.
  return new ethers.Contract(address, IAsset__factory.abi, runner);
}

export type { TxResult };

// -----------------------------------------------------------------------------
// the engine's rate, converted for the SDK. read this before touching setRate.
// -----------------------------------------------------------------------------

/**
 * converts the engine's scaled rate into the pair `SetRateRequest` wants.
 *
 * **this conversion is not cosmetic and getting it wrong is a hundredfold
 * error.** the engine reports `{ value: 600, decimals: 4 }`, meaning 600 scaled
 * by 10^4, which is 0.06, which is 6.00 percent. `rateForKpi` in
 * lib/ats/note-terms.ts returns the same scaled integer as a string.
 *
 * `SetRateRequest.rate` is **not** that integer. `SetRateCommandHandler.ts:42`
 * builds `BigDecimal.fromString(rate, rateDecimals)` and the adapter sends
 * `rate.toBigInt()`, which is `parseUnits(rate, rateDecimals)`. verified against
 * the installed build, not inferred:
 *
 *   BigDecimal.fromString("0.06", 4).toBigInt() === 600n     <- what we want
 *   BigDecimal.fromString("600",  4).toBigInt() === 6000000n <- 600.0000, not 6%
 *
 * so the request field is the decimal fraction and `rateDecimals` is its scale.
 * passing the engine's integer straight through would post a rate of 60000
 * percent and the token would stamp it into every coupon without complaint:
 * `FixedRate.setRate` takes a raw uint256 and neither the contract nor
 * `checkNumber({min: 0})` has any upper bound.
 *
 * the on-chain meaning is fixed by `_calculateCouponAmount`
 * (`CouponStorageWrapper.sol:560-585`): the payable amount is
 * `balance * nominal * rate * period / (10 ** (decimals + rateDecimals) * 365 days)`,
 * so `rate / 10 ** rateDecimals` is the annual fraction of nominal. 600 at 4
 * decimals is 6 percent per annum.
 */
export function engineRateForSdk(rate: ScaledValue): {
  rate: string;
  rateDecimals: number;
  /** what will land in storage, for the read-back assertion */
  expectedOnChainRate: string;
} {
  if (!Number.isInteger(rate.value) || rate.value < 0) {
    throw new Error(
      `the engine returned a rate this code will not post: ${rate.value}. ` +
        "it must be a non-negative integer already scaled by its own decimals.",
    );
  }
  return {
    rate: ethers.formatUnits(BigInt(rate.value), rate.decimals),
    rateDecimals: rate.decimals,
    expectedOnChainRate: String(rate.value),
  };
}

/** 600 at 4 decimals reads as "6.00%". */
export function ratePercent(raw: string | number | bigint, decimals: number): string {
  const v = Number(ethers.formatUnits(BigInt(raw), decimals)) * 100;
  return `${v.toFixed(2)}%`;
}

// -----------------------------------------------------------------------------
// step 1 and 2. the roles
// -----------------------------------------------------------------------------

/**
 * grants the interest rate and corporate action roles in one transaction.
 *
 * both are members of the SDK's `SecurityRole` enum, so `applyRoles` accepts
 * them and one signature covers both. the issuer holds DEFAULT_ADMIN_ROLE,
 * which administers each, and `applyRoles` skips a role the account already has
 * (`AccessControlStorageWrapper.sol:179`), so repeating this is harmless.
 */
export async function grantRateRoles(
  securityId: string,
  targetId: string,
  expectedSignerEvm: string,
): Promise<{ transactionId: string }> {
  await requireSigner(expectedSignerEvm);
  const { Role, ApplyRolesRequest } = await loadSdk();
  const roles = [ROLES_C.INTEREST_RATE_MANAGER, ROLES_C.CORPORATE_ACTION];
  const res = await Role.applyRoles(
    new ApplyRolesRequest({
      securityId,
      targetId,
      roles: [...roles],
      actives: roles.map(() => true),
    }),
  );
  return { transactionId: res.transactionId };
}

/**
 * grants ROLE_MATURITY_MANAGER, on its own, as a raw hex literal.
 *
 * it cannot travel with the two above. see the note on `ROLES_C`: `applyRoles`
 * validates each role against the `SecurityRole` enum and this role is not in
 * it, so `applyRoles` rejects it client side before any transaction exists.
 * `grantRole` validates the same field as a bytes32 shape and accepts it.
 */
export async function grantMaturityRole(
  securityId: string,
  targetId: string,
  expectedSignerEvm: string,
): Promise<{ transactionId: string }> {
  await requireSigner(expectedSignerEvm);
  const { Role, RoleRequest } = await loadSdk();
  const res = await Role.grantRole(
    new RoleRequest({
      securityId,
      targetId,
      role: ROLES_C.MATURITY_MANAGER,
    }),
  );
  return { transactionId: res.transactionId };
}

// -----------------------------------------------------------------------------
// step 3. the rate type
// -----------------------------------------------------------------------------

/**
 * switches the token from STANDARD to FIXED.
 *
 * a direct call, because the SDK has none. `grep -rln "setCouponRateType"
 * packages/ats/sdk/src/` returns zero matches and `grep -rn "InterestRateFacet"`
 * returns zero matches: there is no port, no command, no query anywhere in the
 * SDK source that touches this facet's writer surface, even though the ABI it
 * already uses carries the function. the same precedent as `grantKyc` in
 * DECISIONS.md D18.
 *
 * on-chain guards, `InterestRate.sol:36-42`: `onlyOperational`, `onlyActivated`,
 * `onlyRole(ROLE_INTEREST_RATE_MANAGER)`, `onlyValidRateType` (which rejects
 * NONE). the token reads operational and activated, and reaching the role check
 * in a dry run is itself proof of that: the modifiers run in the order written.
 */
export async function setCouponRateTypeFixed(
  cfg: CovenantConfig,
  tokenEvm: string,
  onHash?: (hash: string) => void,
): Promise<TxResult> {
  const signer = await requireSigner(cfg.accounts.issuer.evm);
  const token = await assetContract(toEvmAddress(tokenEvm), signer);
  const tx = await token.setCouponRateType(RATE_TYPE.FIXED, {
    gasLimit: GAS_C.SET_COUPON_RATE_TYPE,
  });
  onHash?.(tx.hash);
  const receipt = await tx.wait();
  return {
    hash: tx.hash,
    success: receipt?.status === 1,
    note: "gas limit reused from GAS.SET_RATE. the SDK ships no constant for this call.",
  };
}

// -----------------------------------------------------------------------------
// step 4. the engine's rate
// -----------------------------------------------------------------------------

export interface PostedRate {
  transactionId: string;
  /** exactly what was handed to the SDK */
  sent: { rate: string; rateDecimals: number };
  /** the integer this should leave in storage, for the read-back */
  expectedOnChainRate: string;
}

/**
 * posts the confidential engine's output as the token's fixed rate.
 *
 * this transaction is the whole rate leg. its payload is not a number a person
 * typed, it is `EngineResult.rate`, produced by the engine from borrower
 * financials the lender never sees, converted for the SDK by `engineRateForSdk`
 * and by nothing else.
 *
 * `SetRateCommandHandler` checks pause and checks
 * `SecurityRole._INTEREST_RATE_MANAGER_ROLE` client side before submitting
 * (`:34-40`), so a missing role fails fast with a readable SDK error instead of
 * a bare revert. that is the one place in this leg where the SDK is ahead of a
 * raw call.
 */
export async function postEngineRate(
  securityId: string,
  rate: ScaledValue,
  expectedSignerEvm: string,
): Promise<PostedRate> {
  await requireSigner(expectedSignerEvm);
  const converted = engineRateForSdk(rate);
  const { FixedRate, SetRateRequest } = await loadSdk();
  const res = await FixedRate.setRate(
    new SetRateRequest({
      securityId,
      rate: converted.rate,
      rateDecimals: converted.rateDecimals,
    }),
  );
  return {
    transactionId: res.transactionId,
    sent: { rate: converted.rate, rateDecimals: converted.rateDecimals },
    expectedOnChainRate: converted.expectedOnChainRate,
  };
}

// -----------------------------------------------------------------------------
// step 5. the coupon
// -----------------------------------------------------------------------------

export interface CouponWindow {
  /** holders of record are fixed at this instant, and a snapshot is scheduled for it */
  recordTimestamp: string;
  /** the payment date. must be >= recordTimestamp and >= fixingTimestamp */
  executionTimestamp: string;
  /** accrual period start. may be in the past, nothing validates it */
  startTimestamp: string;
  /** accrual period end. must be <= the security's maturity date */
  endTimestamp: string;
  /** rate fixing date. must be non-zero and <= executionTimestamp */
  fixingTimestamp: string;
}

export interface CouponWindowOptions {
  /** seconds. length of the accrual period, ending now. */
  accrualSeconds: number;
  /** seconds from now to the record date */
  recordInSeconds: number;
  /** seconds from now to the execution date */
  executionInSeconds: number;
}

/**
 * builds the coupon window for a compressed demo.
 *
 * the accrual period is real and ends now: it is the quarter the engine just
 * read a filing for. what is compressed is the administration, the record date
 * a minute out and the payment date two minutes out, so a viewer sees holders of
 * record fixed and the entitlement become readable inside the demo. nothing here
 * pretends a quarter elapsed on camera.
 *
 * `startTimestamp` being in the past is deliberate and permitted:
 * `Coupon.setCoupon`'s `onlyValidTimestamp` is applied to `recordDate` and
 * `fixingDate` only (`Coupon.sol:65-66`), and `SetCouponRequest` has no
 * validator for `startTimestamp` at all. it is read only as the lower bound
 * inside the `endTimestamp` validator closure, so a malformed value there is
 * caught by nothing and surfaces as a NaN comparison or an on-chain revert.
 */
export function buildCouponWindow(
  nowSeconds: number,
  opts: CouponWindowOptions,
): CouponWindow {
  const record = nowSeconds + opts.recordInSeconds;
  return {
    startTimestamp: String(nowSeconds - opts.accrualSeconds),
    endTimestamp: String(nowSeconds),
    recordTimestamp: String(record),
    fixingTimestamp: String(record),
    executionTimestamp: String(nowSeconds + opts.executionInSeconds),
  };
}

/**
 * every guard `setCoupon` applies, checked before a signature is asked for.
 *
 * the on-chain modifiers run in a fixed order and the first failure masks the
 * rest, so a dry run tells you about one problem at a time and each round trip
 * costs a signature. these are cheap and they are all of them:
 *
 * - `checkDates(first, second)` reverts `WrongDates` when `second < first`
 *   (`DatesValidation.sol:11-22`), applied to (start, end), (record, execution)
 *   and (fixing, execution). equality is allowed, contrary to what "must be
 *   before" would suggest
 * - `checkTimestamp(t)` reverts `InvalidTimestamp` when `t == 0`, applied to
 *   recordDate and fixingDate
 * - `checkEndDateAgainstMaturity` (`CouponStorageWrapper.sol:183-188`) requires
 *   `endDate <= maturityDate` whenever maturity is non-zero. **the SDK request
 *   has no maturity field and no client-side check for this**, so a coupon past
 *   maturity passes SDK validation and pays gas to be refused
 * - `SetCouponRequest` additionally requires `recordTimestamp >= now` at the
 *   moment the request object is constructed
 */
export function checkCouponWindow(
  w: CouponWindow,
  state: { nowSeconds: number; maturityDate: number; couponRateType: number },
): string[] {
  const n = (v: string) => Number.parseInt(v, 10);
  const problems: string[] = [];

  for (const [field, value] of Object.entries(w)) {
    if (!Number.isFinite(n(value))) {
      problems.push(`${field} is not a timestamp: "${value}"`);
    }
  }
  if (problems.length > 0) return problems;

  if (n(w.endTimestamp) < n(w.startTimestamp)) {
    problems.push("endTimestamp is before startTimestamp, WrongDates");
  }
  if (n(w.executionTimestamp) < n(w.recordTimestamp)) {
    problems.push("executionTimestamp is before recordTimestamp, WrongDates");
  }
  if (n(w.executionTimestamp) < n(w.fixingTimestamp)) {
    problems.push("executionTimestamp is before fixingTimestamp, WrongDates");
  }
  if (n(w.recordTimestamp) === 0) problems.push("recordTimestamp is zero, InvalidTimestamp");
  if (n(w.fixingTimestamp) === 0) problems.push("fixingTimestamp is zero, InvalidTimestamp");
  if (n(w.recordTimestamp) < state.nowSeconds) {
    problems.push(
      "recordTimestamp is in the past. the contract would accept it, the SDK request will not.",
    );
  }
  if (state.maturityDate !== 0 && n(w.endTimestamp) > state.maturityDate) {
    problems.push(
      `endTimestamp ${w.endTimestamp} is past the maturity date ${state.maturityDate}. ` +
        "nothing client side checks this and the token will refuse it.",
    );
  }
  if (state.couponRateType !== RATE_TYPE.FIXED) {
    problems.push(
      `the coupon rate type is ${state.couponRateType}, not FIXED (2). under STANDARD the ` +
        "token would reject the pending triplet with InterestRateIsStandard, and switching " +
        "the type after this coupon exists is the thing DECISIONS.md D16 forbids.",
    );
  }
  return problems;
}

export interface DeclaredCoupon {
  /** one-indexed coupon id as reported by the SDK, or read back off chain */
  couponId: number | null;
  transactionId: string;
  /** what was sent, so the pending triplet is on the record */
  sent: CouponWindow & { rate: "0"; rateStatus: 0 };
  note?: string;
}

/**
 * declares the coupon, supplying no rate at all.
 *
 * `rate: "0"` and `rateStatus: 0` are the pending triplet, and they are the
 * point of the whole leg. `CouponRateDispatch.validateAndStamp` under FIXED
 * requires `rateStatus == PENDING && rate == 0 && rateDecimals == 0`
 * (`_isPendingRate`, `CouponRateDispatch.sol:110-115`) and reverts
 * `InterestRateIsFixed()` on anything else, then stamps rate and decimals from
 * `InterestRateStorageWrapper.getRate()` and marks the coupon SET.
 *
 * the third element of the triplet has no field in the request.
 * `SetCouponRequest` carries `rate` and no `rateDecimals`; the decimals are
 * derived from the string by `BigDecimal.fromString(rate)` inside the command
 * handler. `"0"` derives 0, which is why the string must be exactly that.
 * verified against the installed build:
 * `BigDecimal.fromString("0").decimals === 0` and `.toBigInt() === 0n`.
 *
 * so: we ask for a coupon and name no rate. the token supplies the rate, from
 * the storage slot only the engine's transaction writes to.
 */
export async function declareCoupon(
  cfg: CovenantConfig,
  securityId: string,
  tokenEvm: string,
  window: CouponWindow,
  expectedSignerEvm: string,
): Promise<DeclaredCoupon> {
  await requireSigner(expectedSignerEvm);
  const { Coupon, SetCouponRequest } = await loadSdk();

  const submittedAt = Math.floor(Date.now() / 1000) - 5;
  const before = await readCouponCount(cfg, tokenEvm);

  try {
    const res = await Coupon.setCoupon(
      new SetCouponRequest({
        securityId,
        // the pending triplet. see the note above before changing either value.
        rate: "0",
        rateStatus: RATE_STATUS.PENDING,
        ...window,
      }),
    );
    return {
      couponId: res.payload,
      transactionId: res.transactionId,
      sent: { ...window, rate: "0", rateStatus: 0 },
    };
  } catch (e) {
    // the SDK parses the coupon id out of the CouponSet event after the
    // transaction lands (`SetCouponCommandHandler.ts:44-50`). a failure there
    // throws over a coupon that already exists on chain, so before reporting a
    // failure, ask the token.
    const after = await readCouponCount(cfg, tokenEvm);
    if (after > before) {
      const hash = await findRecentResult(
        cfg,
        expectedSignerEvm,
        toEvmAddress(tokenEvm),
        submittedAt,
      );
      return {
        couponId: after,
        transactionId: hash ?? "",
        sent: { ...window, rate: "0", rateStatus: 0 },
        note:
          "the SDK threw, but the coupon count went from " +
          `${before} to ${after}, so the transaction landed. the SDK error was: ` +
          (e instanceof Error ? `${e.name}: ${e.message}` : String(e)),
      };
    }
    throw e;
  }
}

const COUNT_ABI = ["function getCouponCount() view returns (uint256)"];

async function readCouponCount(
  cfg: CovenantConfig,
  tokenEvm: string,
): Promise<number> {
  const provider = new ethers.JsonRpcProvider(cfg.rpcNode, undefined, {
    staticNetwork: true,
  });
  const token = new ethers.Contract(toEvmAddress(tokenEvm), COUNT_ABI, provider);
  return Number(await token.getCouponCount());
}

// -----------------------------------------------------------------------------
// step 6. the record date arrives
// -----------------------------------------------------------------------------

/**
 * drains the scheduled task queue, which takes the coupon's snapshot.
 *
 * `setCoupon` does not snapshot anything. `CouponStorageWrapper.initCoupon`
 * (`:127-139`) queues a task at the record date
 * (`addScheduledCrossOrderedTask(recordDate, SCHEDULED_TASK_TYPE_SNAPSHOT)`),
 * and the queue is drained by the next state-mutating call, not by a clock. so
 * until some transaction touches the token after the record date, the coupon
 * carries `snapshotId == 0` and `getCouponHolders` falls back to reading the
 * **current** register rather than the register as at the record date
 * (`CouponStorageWrapper.sol:356-369`).
 *
 * this call is that transaction, and nothing else. it needs no role, only
 * `onlyOperational`, `onlyActivated`, `onlyUnpaused`
 * (`ScheduledCrossOrderedTasks.sol:32-40`), and it returns how many tasks it
 * ran.
 *
 * it is not exposed in `port/in`. `triggerPendingScheduledSnapshots` exists on
 * every transaction adapter (`RPCTransactionAdapter.ts:799-808`, and the three
 * Hedera adapters) and is reachable from no command, no query and no port, so
 * the SDK ships transport for an operation its public surface cannot invoke.
 */
export async function triggerScheduledTasks(
  cfg: CovenantConfig,
  tokenEvm: string,
  expectedSignerEvm: string,
  onHash?: (hash: string) => void,
): Promise<TxResult & { tasksRun: number | null }> {
  const signer = await requireSigner(expectedSignerEvm);
  const token = await assetContract(toEvmAddress(tokenEvm), signer);

  // read the return value first, over eth_call, because a transaction receipt
  // does not carry it
  let tasksRun: number | null = null;
  try {
    tasksRun = Number(
      await token.triggerPendingScheduledCrossOrderedTasks.staticCall(),
    );
  } catch {
    // the static call is a convenience. the transaction below is the claim.
  }

  const tx = await token.triggerPendingScheduledCrossOrderedTasks({
    gasLimit: GAS_C.TRIGGER_SCHEDULED_TASKS,
  });
  onHash?.(tx.hash);
  const receipt = await tx.wait();
  return {
    hash: tx.hash,
    success: receipt?.status === 1,
    tasksRun,
    note:
      tasksRun === null
        ? "task count unread"
        : `${tasksRun} scheduled task${tasksRun === 1 ? "" : "s"} were due`,
  };
}

// -----------------------------------------------------------------------------
// step 7. compressing the lifecycle
// -----------------------------------------------------------------------------

/**
 * moves the maturity date, including backwards, which is the only direction we
 * want.
 *
 * the note was issued with a maturity three years out, and the demo is five
 * minutes. **this cannot go through the SDK.**
 * `UpdateMaturityDateCommandHandler.ts:31` calls
 * `ValidationService.checkMaturityDate` (`:357-364`), which throws
 * `OperationNotAllowed("The maturity date cannot be earlier or equal than the
 * current one")` before building a transaction. the contract has no such rule:
 * `MaturityDateStorageWrapper.checkValidMaturityDate` (`:56-60`) checks only
 * `newDate > block.timestamp`, and `IMaturity.sol`'s natspec claims the
 * stronger rule the contract does not enforce. that is BUG.md B9, and this is
 * the call that depends on it.
 *
 * what compression does and does not affect, checked rather than assumed. a
 * repository-wide grep for maturity guards returns exactly two consumers:
 * `onlyMaturityReached` on `fullRedeemAtMaturity`, and
 * `checkEndDateAgainstMaturity` inside `setCoupon`. transfers, holds and
 * coupons already declared are untouched. so compressing after the coupon is
 * declared is safe, and compressing before it means the coupon's `endTimestamp`
 * must fit inside the new, shorter life.
 */
export async function compressMaturity(
  cfg: CovenantConfig,
  tokenEvm: string,
  newMaturitySeconds: number,
  onHash?: (hash: string) => void,
): Promise<TxResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (newMaturitySeconds <= nowSeconds) {
    throw new Error(
      `maturity ${newMaturitySeconds} is not in the future. ` +
        "MaturityDateStorageWrapper.checkValidMaturityDate would revert with MaturityDateInvalid.",
    );
  }
  const signer = await requireSigner(cfg.accounts.issuer.evm);
  const token = await assetContract(toEvmAddress(tokenEvm), signer);
  const tx = await token.updateMaturityDate(newMaturitySeconds, {
    gasLimit: GAS_C.UPDATE_MATURITY_DATE,
  });
  onHash?.(tx.hash);
  const receipt = await tx.wait();
  return {
    hash: tx.hash,
    success: receipt?.status === 1,
    note: "sent directly. the SDK refuses to move a maturity date earlier, the contract does not.",
  };
}

// -----------------------------------------------------------------------------
// shared. what the chain said about a transaction
// -----------------------------------------------------------------------------

/**
 * the mirror node's verdict on a hash, with any revert decoded. used to turn a
 * failed step into a citable record rather than a browser exception.
 */
export async function explainTransaction(
  cfg: CovenantConfig,
  hash: string,
): Promise<{ status: string; result: string; revert: string | null }> {
  const record = await readContractResult(cfg, hash);
  return {
    status: record?.status ?? "",
    result: record?.result ?? "",
    revert: decodeRevert(record?.errorMessage)?.summary ?? null,
  };
}
