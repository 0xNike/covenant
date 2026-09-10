// covenant. the terms of the private credit note.
//
// this file is deliberately free of SDK imports so it can be read, reviewed and
// checked against chain state without running anything. every value here is set
// once, at issuance, and several of them silently kill a later block if wrong.
// see DECISIONS.md D10 and D11.
//
// ---------------------------------------------------------------------------
// F8. WHY THIS ISSUES AGAINST THE VARIABLE RATE CONFIG AND NOT CONFIG 4
// ---------------------------------------------------------------------------
//
// `Bond.createKpiLinkedRate` cannot work against the deployed factory. it ends
// at `RPCTransactionAdapter.ts:306`, which calls
// `factoryInstance["deployBondKpiLinkedRate"]`. that function exists only on
// `contracts/test/mocks/MockFactory.sol:100,173`. the real `Factory.sol` and
// `IFactory.sol` declare exactly four deploy entry points, and the shipped
// `@hashgraph/asset-tokenization-contracts@8.0.0` `Factory__factory` ABI
// confirms it carries only `deployBond`, `deployEquity`, `deployDepositToken`
// and `deployProxy`. the property is `undefined`, hence
// "TypeError: factoryInstance[deployMethod] is not a function".
//
// issuing config 4 through the one working entry point, `deployBond`, also
// fails, for two independent reasons verified live on resolver 0.0.9212226:
//
//   1. `Factory.sol:291` calls `IFixedRate(bond).initializeFixedRate(...)`
//      unconditionally. `initializeFixedRate` is ABSENT from config 4, which
//      carries `KpiLinkedRateFacet` in place of `FixedRateFacet`. unregistered
//      selector, the diamond fallback reverts.
//   2. `deployBond` never calls `initializeKpiLinkedRate`, so
//      `InitializerStorageWrapper.setOperationalStatus`
//      (`domain/core/InitializerStorageWrapper.sol`) finds a facet that is not
//      ready, returns false, and `Factory.sol:293` reverts on it.
//
// the remaining escape hatch, `deployProxy` plus manual initialisation, needs
// roughly 85 separate `initializeX` calls (`Factory.sol` `_deploySecurity` and
// its eight helpers), each a wallet signature. not viable.
//
// so config 2 is the only config the deployed factory can produce. what it
// costs and what it keeps is recorded in `CONFIG_2_CAPABILITY` below.

import type { CovenantConfig } from "@/lib/config";

/** seconds in three years, ignoring leap days. the stated tenor of the note. */
const THREE_YEARS_SECONDS = 3 * 365 * 24 * 60 * 60;

/** one week. the width of the KPI lookback window, `InterestRate.reportPeriod`. */
const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

/**
 * ascii hex of a three character currency code.
 * `FormatValidation.checkBytes3Format` at
 * `port/in/request/FormatValidation.ts:206-215` requires /^0x[a-fA-F0-9]{6}$/.
 *
 * this matches the ATS reference app's own `textToHex` helper
 * (`apps/ats/web/src/utils/format.ts:145-150`). note that the reference bond form
 * at `apps/ats/web/src/views/CreateBond/Components/StepReview.tsx:109` instead
 * builds the string as "0x" + charCodeAt(0) + charCodeAt(1) + charCodeAt(2),
 * concatenating decimal char codes as if they were hex digits, so "USD" becomes
 * 0x858368 rather than 0x555344. the two helpers in the same application disagree.
 * we use the ascii-correct one.
 */
function currencyToBytes3(code: string): string {
  if (code.length !== 3) throw new Error("currency code must be three characters");
  return (
    "0x" +
    [...code]
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * what config 2 can and cannot do, every entry verified live against resolver
 * 0.0.9212226 with `getFacetIdByConfigurationIdVersionAndSelector`, using the
 * exact selectors the SDK sends (taken from the shipped `IAsset__factory` ABI).
 *
 *   operation                      config2   config4
 *   issueByPartition               PRESENT   PRESENT
 *   transferByPartition            PRESENT   PRESENT
 *   grantKyc                       PRESENT   PRESENT
 *   setCoupon                      PRESENT   PRESENT
 *   createHoldByPartition          PRESENT   PRESENT
 *   releaseHoldByPartition         PRESENT   PRESENT
 *   executeHoldByPartition         PRESENT   PRESENT
 *   updateMaturityDate             PRESENT   PRESENT
 *   addProceedRecipient            PRESENT   PRESENT
 *   grantRole                      PRESENT   PRESENT
 *   setRate                        PRESENT   ABSENT
 *   addKpiData                     ABSENT    PRESENT
 *   initializeKpiLinkedRate        ABSENT    PRESENT
 *   setKpiLinkedRateInterestRate   ABSENT    PRESENT
 *   getKpiLinkedRateInterestRate   ABSENT    PRESENT
 *
 * so config 2 keeps issuance, compliance, coupon and all three hold verbs. it
 * loses the on-chain KPI interpolation and replaces it with `setRate`
 * (`facets/fixedRate/FixedRate.sol`, `onlyRole(ROLE_INTEREST_RATE_MANAGER)`),
 * exposed by the SDK at `port/in/interestRates/fixedRate/FixedRate.ts:25` with a
 * matching `getRate` reader at `:33`.
 */
export const CONFIG_2_CAPABILITY = {
  keeps: [
    "issueByPartition",
    "transferByPartition",
    "grantKyc",
    "setCoupon",
    "createHoldByPartition",
    "releaseHoldByPartition",
    "executeHoldByPartition",
    "updateMaturityDate",
    "addProceedRecipient",
    "grantRole",
    "setRate",
  ],
  loses: [
    "addKpiData",
    "initializeKpiLinkedRate",
    "setKpiLinkedRateInterestRate",
    "getKpiLinkedRateInterestRate",
  ],
} as const;

export const RATE_DECIMALS = 4;
export const IMPACT_DATA_DECIMALS = 2;
export const TOKEN_DECIMALS = 2;

/**
 * the KPI the engine reports: the borrower's net leverage ratio, net debt over
 * EBITDA, carried to two decimal places. higher leverage is worse credit, so a
 * higher impact value pulls the coupon up toward maxRate. that direction matches
 * `KpiLinkedRateLib._getIncreasedRate`
 * (`contracts/domain/asset/KpiLinkedRateLib.sol:167-180`), which raises the rate
 * when the summed impact exceeds the baseline.
 */
export const KPI_UNIT = "net leverage, net debt / EBITDA, two decimals";

/**
 * `InterestRate`, `contracts/facets/kpiLinkedRate/IKpiLinkedRate.sol:21-30`.
 * all rate values are scaled by 10 ** RATE_DECIMALS, so 800 is 8.00 percent.
 */
export const INTEREST_RATE = {
  maxRate: 1600, // 16.00 percent
  baseRate: 800, //  8.00 percent, the coupon at exactly the baseline leverage
  minRate: 400, //  4.00 percent
  startRate: 800, //  8.00 percent, applies to any coupon fixing before startPeriod
  missedPenalty: 200, //  2.00 percent added when no KPI report lands in the window
  reportPeriod: ONE_WEEK_SECONDS,
  rateDecimals: RATE_DECIMALS,
} as const;

/**
 * `ImpactData`, `contracts/facets/kpiLinkedRate/IKpiLinkedRate.sol:44-50`.
 * leverage values scaled by 10 ** IMPACT_DATA_DECIMALS, so 300 is 3.00x.
 * the on-chain invariant is strict: maxDeviationFloor < baseLine < maxDeviationCap.
 */
export const IMPACT_DATA = {
  maxDeviationCap: 600, // 6.00x leverage maps to maxRate
  baseLine: 300, // 3.00x leverage maps to baseRate
  maxDeviationFloor: 100, // 1.00x leverage maps to minRate
  impactDataDecimals: IMPACT_DATA_DECIMALS,
  adjustmentPrecision: 6, // factor = 10 ** 6 in the interpolation
} as const;

/**
 * the rate the contract will compute for a given summed impact value, replicated
 * from `KpiLinkedRateLib._getRateFromImpact`
 * (`contracts/domain/asset/KpiLinkedRateLib.sol:139-181`), integer arithmetic and
 * truncating division included. argus uses this to check the G4 claim by value
 * rather than by delta, per DECISIONS.md D11.
 */
export function expectedRateFromImpact(impact: number): number {
  const { maxRate, baseRate, minRate } = INTEREST_RATE;
  const { maxDeviationCap, baseLine, maxDeviationFloor, adjustmentPrecision } =
    IMPACT_DATA;
  const factor = 10 ** adjustmentPrecision;

  if (impact < baseLine) {
    let delta = Math.floor(
      (factor * (baseLine - impact)) / (baseLine - maxDeviationFloor),
    );
    if (delta > factor) delta = factor;
    return baseRate - Math.floor(((baseRate - minRate) * delta) / factor);
  }

  let delta = Math.floor(
    (factor * (impact - baseLine)) / (maxDeviationCap - baseLine),
  );
  if (delta > factor) delta = factor;
  return baseRate + Math.floor(((maxRate - baseRate) * delta) / factor);
}

/**
 * the rate the contract will compute when no KPI report lands in the window,
 * replicated from `KpiLinkedRateLib._getRateWhenNoReport`
 * (`contracts/domain/asset/KpiLinkedRateLib.sol:66-84`). on the first coupon
 * there is no previous rate, so the base is `baseRate`.
 */
export function expectedRateWhenNoReport(previousRate?: number): number {
  const base = previousRate ?? INTEREST_RATE.baseRate;
  return Math.min(base + INTEREST_RATE.missedPenalty, INTEREST_RATE.maxRate);
}

/**
 * the two KPI values block D posts, chosen so the reported path and the
 * missed-report path cannot be confused on screen or on the mirror node.
 *
 *   engine reports 2.00x leverage -> 6.00 percent
 *   engine reports 4.50x leverage -> 12.00 percent
 *   no report at all              -> 10.00 percent
 *
 * the collision to avoid is an impact of 375 (3.75x), which also produces
 * 10.00 percent and would make the two paths indistinguishable. neither
 * demo value is near it.
 */
export const DEMO_KPI_VALUES = {
  improved: 200, // 2.00x leverage, covenant headroom widened
  deteriorated: 450, // 4.50x leverage, covenant headroom narrowed
} as const;

export interface NoteTerms {
  name: string;
  symbol: string;
  isin: string;
  decimals: number;
  isWhiteList: boolean;
  erc20VotesActivated: boolean;
  isControllable: boolean;
  arePartitionsProtected: boolean;
  isMultiPartition: boolean;
  clearingActive: boolean;
  internalKycActivated: boolean;
  diamondOwnerAccount: string;
  currency: string;
  numberOfUnits: string;
  nominalValue: string;
  nominalValueDecimals: number;
  startingDate: string;
  maturityDate: string;
  regulationType: number;
  regulationSubType: number;
  isCountryControlListWhiteList: boolean;
  countries: string;
  info: string;
  configId: string;
  configVersion: number;
  maxRate: number;
  baseRate: number;
  minRate: number;
  startPeriod: number;
  startRate: number;
  missedPenalty: number;
  reportPeriod: number;
  rateDecimals: number;
  maxDeviationCap: number;
  baseLine: number;
  maxDeviationFloor: number;
  impactDataDecimals: number;
  adjustmentPrecision: number;
  proceedRecipientsIds: string[];
  proceedRecipientsData: string[];
}

export interface BuildTermsOptions {
  /** unix seconds. defaults to now. passed in so the value is testable. */
  now?: number;
  /** override the resolved config version. defaults to config.kpiLinkedRateConfigVersion ?? 1. */
  configVersion?: number;
}

export function buildNoteTerms(
  cfg: CovenantConfig,
  opts: BuildTermsOptions = {},
): NoteTerms {
  const now = opts.now ?? Math.floor(Date.now() / 1000);

  // startingDate is validated against Math.ceil(Date.now() / 1000) at submit
  // time (`CreateBondKpiLinkedRateRequest.ts:198-204`), and the user spends an
  // unknown number of seconds in the wallet before signing. a two minute cushion
  // keeps the value in the future across that delay.
  const startingDate = now + 120;
  const maturityDate = now + THREE_YEARS_SECONDS;

  // startPeriod is the moment the KPI-linked mechanism switches on. any coupon
  // whose fixingDate falls before it is priced at startRate unconditionally
  // (`KpiLinkedRateLib.sol:50-53`). we want every coupon in the demo to take the
  // KPI path, so this is set to the issuance moment, which is already in the
  // past by the time the transaction lands. there is no client-side validator on
  // this field, so nothing rejects a past timestamp here.
  const startPeriod = now;

  return {
    name: "Covenant KPI-Linked Private Credit Note 2029",
    symbol: "CVNT29",
    // twelve characters, the ISIN length, with a valid ISO 6166 check digit.
    // `Security.checkISIN` only bounds the length
    // (`domain/context/security/Security.ts:186-194`) and does not verify the
    // check digit, but `Factory.sol:283`'s `onlyValidISIN` does. we found that
    // out by paying for it: the first issuance used XS9999COV001, passed sdk
    // validation with zero errors and reverted on chain with
    // `WrongISINChecksum(string)` for 0.18855433 HBAR. filed as BUG.md B8. this
    // is a testnet instrument and the code is fictional, but the check digit is
    // real because the contract checks it.
    isin: "XS9999COV006",
    decimals: TOKEN_DECIMALS,

    // false puts the control list in blocklist mode, so the list blocks nobody by
    // default. with a whitelist, block B's transfer would fail the control list
    // before it ever reached the KYC check, and the compliance demo would be
    // showing the wrong rejection. KYC is the gate we are demonstrating.
    isWhiteList: false,

    erc20VotesActivated: false,

    // an agent on a private credit facility can force-transfer on an event of
    // default. `Controller.sol:31-46` requires `onlyControllable`, so this must
    // be true at issuance for that path to exist at all.
    isControllable: true,

    // protected partitions require EIP-712 signature assembly on every call
    // (`Hold.ts:106-131`). cut from scope per DECISIONS.md D15.
    arePartitionsProtected: false,

    // single partition. the SDK's plain transfer methods assume the default
    // partition `_PARTITION_ID_1` (`ValidationService.ts:195`).
    isMultiPartition: false,

    // MUST be false. `HoldByPartition.sol:50` carries `onlyClearingDisabled`.
    // clearing on means block E is dead and cannot be recovered without
    // reissuing. see DECISIONS.md D10.
    clearingActive: false,

    // MUST be true. `KycStorageWrapper.verifyKycStatus`
    // (`contracts/domain/core/KycStorageWrapper.sol:206-210`) short-circuits the
    // internal leg when this is false, and block B's blocked transfer would not
    // block. see DECISIONS.md D10.
    internalKycActivated: true,

    // the only RBAC entry the SDK writes at creation is _DEFAULT_ADMIN_ROLE for
    // this address (`SecurityDataBuilder.buildSecurityData`,
    // `domain/context/util/SecurityDataBuilder.ts:35-38`). every other role is a
    // separate grantRole transaction later.
    diamondOwnerAccount: cfg.accounts.issuer.id,

    currency: currencyToBytes3("USD"),

    // maxSupply, in base units. the reference app scales by decimals before
    // passing this (`StepReview.tsx:102`, `numberToExponential`). 1,000 notes at
    // two decimals is 100000.
    numberOfUnits: "100000",

    // 1000.00 USD face per note, so 1,000,000.00 USD total facility size.
    nominalValue: "100000",
    nominalValueDecimals: 2,

    startingDate: startingDate.toString(),
    maturityDate: maturityDate.toString(),

    // Reg D 506(c). `CheckRegulations.typeAndSubtype`
    // (`domain/context/factory/RegulationType.ts:72-82`) rejects type NONE
    // outright, so a regulation must be chosen. 506(c) carries
    // ACCREDITATION_REQUIRED and
    // VERIFICATION_INVESTORS_FINANCIAL_DOCUMENTS_REQUIRED
    // (`contracts/constants/regulation.sol:26-32`), which is the offering that
    // block B's KYC gate is actually enforcing. this data is metadata read back
    // by `getRegulationDetails`; it does not itself gate transfers.
    regulationType: 2, // REG_D
    regulationSubType: 2, // 506_C

    isCountryControlListWhiteList: false,
    countries: "",
    info: "",

    // config 4, the KPI-linked rate config. NEVER config 2, which carries no
    // KpisFacet and no KpiLinkedRateFacet. see DECISIONS.md D10.
    configId: cfg.kpiLinkedRateConfigId,
    configVersion: opts.configVersion ?? cfg.kpiLinkedRateConfigVersion ?? 1,

    ...INTEREST_RATE,
    startPeriod,
    ...IMPACT_DATA,

    // at least one project address, or every addKpiData call is silently ignored
    // rather than reverting (`KpiLinkedRateLib._collectImpactData`,
    // `contracts/domain/asset/KpiLinkedRateLib.sol:86-110`, which iterates only
    // the registered proceed recipients). the borrower's operating entity is the
    // issuer account here. this list is mutable after issuance via
    // `Bond.addProceedRecipient` (`port/in/bond/Bond.ts:391`), so the choice is
    // recoverable if the narrative wants a different address.
    proceedRecipientsIds: [cfg.accounts.issuer.evm],

    // the arrays must be equal length (`CreateBondKpiLinkedRateRequest.ts:241-252`)
    // and the empty string is mapped to "0x" by the RPC adapter
    // (`port/out/rpc/RPCTransactionAdapter.ts:304`). the validator skips empty
    // entries explicitly, so "" is the correct way to say "no attached data".
    proceedRecipientsData: [""],
  };
}

/**
 * the subset of `NoteTerms` that `CreateBondRequest`
 * (`port/in/request/bond/CreateBondRequest.ts`) actually accepts, pointed at the
 * config the deployed factory can deploy. `CreateBondRequest` carries no rate
 * fields at all: the factory sets the rate type to STANDARD and seeds a zero
 * fixed rate itself (`Factory.sol:290-291`), and the rate is set afterwards with
 * `FixedRate.setRate`.
 *
 * every parameter that block B, C or E depends on is carried over unchanged:
 * `clearingActive: false`, `internalKycActivated: true`, the proceed recipients
 * pair, and the regulation fields that the command handler requires despite
 * being marked optional.
 */
export type BondTerms = Omit<
  NoteTerms,
  | "maxRate"
  | "baseRate"
  | "minRate"
  | "startPeriod"
  | "startRate"
  | "missedPenalty"
  | "reportPeriod"
  | "rateDecimals"
  | "maxDeviationCap"
  | "baseLine"
  | "maxDeviationFloor"
  | "impactDataDecimals"
  | "adjustmentPrecision"
>;

export function buildBondTerms(
  cfg: CovenantConfig,
  opts: BuildTermsOptions = {},
): BondTerms {
  const {
    maxRate: _maxRate,
    baseRate: _baseRate,
    minRate: _minRate,
    startPeriod: _startPeriod,
    startRate: _startRate,
    missedPenalty: _missedPenalty,
    reportPeriod: _reportPeriod,
    rateDecimals: _rateDecimals,
    maxDeviationCap: _maxDeviationCap,
    baseLine: _baseLine,
    maxDeviationFloor: _maxDeviationFloor,
    impactDataDecimals: _impactDataDecimals,
    adjustmentPrecision: _adjustmentPrecision,
    ...rest
  } = buildNoteTerms(cfg, opts);

  return {
    ...rest,
    // the variable rate config, the only one `Factory.deployBond` can produce.
    // see the F8 note at the top of this file.
    configId: cfg.variableRateConfigId,
    configVersion: opts.configVersion ?? 1,
  };
}

/**
 * the rate the engine posts through `FixedRate.setRate` for a given KPI reading,
 * so the confidential engine's output still drives the coupon on chain. the
 * numbers are unchanged from the KPI-linked model above, they are just computed
 * off chain and posted rather than interpolated on chain.
 *
 * this function does NOT hide the KPI, and no copy anywhere may say it does.
 * see DECISIONS.md D17. the mapping is piecewise linear over bounds published at
 * issuance, and finer grained than the KPI it consumes: 400 rate steps across
 * 200 leverage steps, so inside the operating band every leverage value maps to
 * a distinct rate and the mapping is invertible. anyone holding the bounds
 * recovers the leverage from the rate the moment `FixedRate.setRate` lands. it
 * is non-invertible only outside the caps, where values clamp.
 *
 * the confidentiality boundary is around the borrower's **financials**, not the
 * KPI: revenue, EBITDA, total debt and interest expense never leave the engine.
 * that is the claim, and it is the only one that survives inspection.
 *
 * the value returned is the rate scaled by 10 ** RATE_DECIMALS, so "600" means
 * 6.00 percent. it is NOT what `SetRateRequest.rate` takes. see
 * `engineRateForSdk` in lib/ats/coupon.ts.
 */
export function rateForKpi(impact: number): {
  rate: string;
  rateDecimals: number;
} {
  return {
    rate: expectedRateFromImpact(impact).toString(),
    rateDecimals: RATE_DECIMALS,
  };
}
