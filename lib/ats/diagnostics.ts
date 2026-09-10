// covenant. read the token's rate configuration back off chain.
//
// none of this is exposed by the ATS SDK. `port/in` has no reader for the
// diamond's active configuration id, no reader for the coupon rate type, no
// reader for facet readiness, and no reader for the KPI-linked rate model.
// `port/in/interestRates/fixedRate/FixedRate.ts:33` exposes `getRate` and that
// is the whole of the SDK's rate surface. so every read below is a direct
// `eth_call` against the deployed diamond.
//
// these are all view calls over the configured json-rpc relay. no wallet, no
// signature, no state change. safe to run at any time against any token.
//
// every selector used here was resolved live against the deployed resolver
// 0.0.9212226 with `getFacetIdByConfigurationIdVersionAndSelector`, for both
// config 2 and config 4, so a call that reverts with `FunctionNotFound` here
// means the token is on a configuration that genuinely does not carry the
// facet, not that the selector is wrong.

import { ethers } from "ethers";
import type { CovenantConfig } from "@/lib/config";
import { IMPACT_DATA, INTEREST_RATE } from "@/lib/ats/note-terms";
import { decodeRevert, type DecodedRevert } from "@/lib/ats/revert";

/**
 * resolver keys, `contracts/facets/**\/I*.sol`. facet readiness is stored per
 * key per version in `InitializerStorageWrapper.facetVersionStatus`
 * (`contracts/domain/core/InitializerStorageWrapper.sol`), and
 * `setOperationalStatus` requires status 1 on every key in the active
 * configuration before the token is operational.
 */
export const RESOLVER_KEYS = {
  fixedRate:
    "0x82f13d957a7f7af45723926c5ca1a184f2d667df5221c37434ce37278a9af521",
  kpiLinkedRate:
    "0x47cd76ae576f0ec85f1abfc652d614750caefe22a465bef2c859f6cb32a89593",
  kpis: "0xc0b75e6f4facfa630926f9653b857eeb3547c604941b210701f53f3b17521743",
  proceedRecipients:
    "0x63388aa198df5944c611b8fcbfd32945c57864f7125a5f95069040087d2b0bb7",
  proceedRecipientsKpiLinkedRate:
    "0x0e3f0300490c976e8984dcc9a9d086f30a32e8112eea1fd40457bd63404feb42",
  scheduledTasks:
    "0x53ea769a267213f8e35c975a0dba3d7d8d73163d53f804c2ac6ea37d6c47c082",
  scheduledTasksKpiLinkedRate:
    "0x93bfe3f155b9757d312214a75d3bcd8c8c84967e4a8cbaafdbdc40ea1ce2fd4c",
} as const;

/** `IInterestRate.RateType`, `contracts/facets/interestRate/IInterestRate.sol:25-30`. */
export const RATE_TYPE_LABELS = [
  "NONE",
  "STANDARD",
  "FIXED",
  "KPI_LINKED",
] as const;

const CONFIG_LABELS: Record<string, string> = {
  "0x0000000000000000000000000000000000000000000000000000000000000001":
    "equity (1)",
  "0x0000000000000000000000000000000000000000000000000000000000000002":
    "bond variable rate (2)",
  "0x0000000000000000000000000000000000000000000000000000000000000003":
    "bond fixed rate (3)",
  "0x0000000000000000000000000000000000000000000000000000000000000004":
    "bond kpi-linked rate (4)",
};

const DIAMOND_ABI = [
  // DiamondCut, `contracts/infrastructure/diamond/DiamondCut.sol:45`
  "function getConfigInfo() view returns (address resolver_, bytes32 configurationId_, uint256 version_)",
  // InterestRateFacet, `contracts/facets/interestRate/InterestRate.sol:45`
  "function getCouponRateType() view returns (uint8)",
  // InitializerFacet, `contracts/facets/initializer/IInitializer.sol:119,129,142`
  "function getOperationalStatus(bytes32 configId, uint256 versionId) view returns (uint256)",
  "function getFacetVersionStatus(bytes32 facetId, uint256 versionId) view returns (uint256)",
  "function getMaxInitializerFacetIndex() view returns (uint256)",
  // KpiLinkedRateFacet, config 4 only. `contracts/facets/kpiLinkedRate/IKpiLinkedRate.sol:91,95`
  "function getKpiLinkedRateInterestRate() view returns (tuple(uint256 maxRate, uint256 baseRate, uint256 minRate, uint256 startPeriod, uint256 startRate, uint256 missedPenalty, uint256 reportPeriod, uint8 rateDecimals))",
  "function getKpiLinkedRateImpactData() view returns (tuple(uint256 maxDeviationCap, uint256 baseLine, uint256 maxDeviationFloor, uint8 impactDataDecimals, uint256 adjustmentPrecision))",
  // FixedRateFacet, config 2 only. `contracts/facets/fixedRate/IFixedRate.sol`
  "function getRate() view returns (uint256 rate_, uint8 decimals_)",
  // ProceedRecipients, both configs
  "function getProceedRecipientsCount() view returns (uint256)",
];

/**
 * accepts either an evm address or a hedera id in `shard.realm.num` form and
 * returns the evm address. hedera contract ids map to the long-zero evm address
 * by hex-encoding the entity number, which is what the mirror node reports for
 * every contract created through the factory.
 */
export function toEvmAddress(idOrAddress: string): string {
  const v = idOrAddress.trim();
  if (v.startsWith("0x")) return ethers.getAddress(v);
  const parts = v.split(".");
  if (parts.length !== 3) {
    throw new Error(`not an evm address or a hedera id: "${idOrAddress}"`);
  }
  const num = BigInt(parts[2]);
  return ethers.getAddress("0x" + num.toString(16).padStart(40, "0"));
}

export interface FieldCheck {
  field: string;
  expected: string;
  actual: string;
  ok: boolean;
}

export interface FacetReadiness {
  name: string;
  key: string;
  /** 0 = never initialised, 1 = ready, >1 = initialisation in progress */
  status: number;
}

export interface TokenDiagnostics {
  evmAddress: string;
  resolver: string;
  configId: string;
  configLabel: string;
  configVersion: number;
  /** 0 = not started, 1 = operational, >1 = partial, resume index + 1 */
  operationalStatus: number;
  operational: boolean;
  couponRateType: number;
  couponRateTypeLabel: string;
  facets: FacetReadiness[];
  /** present only when the active configuration carries KpiLinkedRateFacet */
  kpiLinkedRate?: {
    interestRate: Record<string, string>;
    impactData: Record<string, string>;
    checks: FieldCheck[];
    allMatch: boolean;
  };
  /** present only when the active configuration carries FixedRateFacet */
  fixedRate?: { rate: string; rateDecimals: number };
  proceedRecipientsCount?: number;
  /** calls that reverted, with the reason. an absent facet shows up here. */
  notes: string[];
}

/**
 * every read in this file goes through here.
 *
 * `staticNetwork` stops ethers issuing an `eth_chainId` before each call to
 * re-detect a network that cannot change. on a public relay that is one extra
 * round trip per call and one more chance of a 429, and the whole console is
 * read-heavy.
 */
function rpc(cfg: CovenantConfig): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(cfg.rpcNode, undefined, {
    staticNetwork: true,
  });
}

/**
 * a read that is allowed to fail. returns the fallback and files the reason,
 * rather than rejecting and taking the whole diagnostic with it.
 *
 * this exists because an unguarded read in the middle of a diagnostic is not a
 * diagnostic, it is a coin flip: one 429 from the relay and the caller sees an
 * exception where it expected state.
 */
async function attempt<T>(
  notes: string[],
  label: string,
  fallback: T,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    notes.push(`${label} failed: ${reason(e)}`);
    return fallback;
  }
}

function reason(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const anyE = e as { shortMessage?: string; message?: string };
    return anyE.shortMessage ?? anyE.message ?? String(e);
  }
  return String(e);
}

/**
 * reads the whole rate configuration off chain and compares it against the
 * terms in `lib/ats/note-terms.ts`. the comparison is by value, not by
 * presence: a token that reports a baseLine of 0 has not been initialised even
 * though the read succeeded.
 */
export async function readTokenDiagnostics(
  cfg: CovenantConfig,
  idOrAddress: string,
): Promise<TokenDiagnostics> {
  const evmAddress = toEvmAddress(idOrAddress);
  const provider = rpc(cfg);
  const token = new ethers.Contract(evmAddress, DIAMOND_ABI, provider);
  const notes: string[] = [];

  const info = await token.getConfigInfo();
  const configId: string = info[1];
  const configVersion = Number(info[2]);

  const operationalStatus = Number(
    await token.getOperationalStatus(configId, configVersion),
  );

  let couponRateType = -1;
  try {
    couponRateType = Number(await token.getCouponRateType());
  } catch (e) {
    notes.push(`getCouponRateType reverted: ${reason(e)}`);
  }

  const facets: FacetReadiness[] = [];
  for (const [name, key] of Object.entries(RESOLVER_KEYS)) {
    try {
      facets.push({
        name,
        key,
        status: Number(await token.getFacetVersionStatus(key, 1)),
      });
    } catch (e) {
      notes.push(`getFacetVersionStatus(${name}) reverted: ${reason(e)}`);
    }
  }

  const out: TokenDiagnostics = {
    evmAddress,
    resolver: info[0],
    configId,
    configLabel: CONFIG_LABELS[configId.toLowerCase()] ?? "unknown",
    configVersion,
    operationalStatus,
    operational: operationalStatus === 1,
    couponRateType,
    couponRateTypeLabel: RATE_TYPE_LABELS[couponRateType] ?? "unreadable",
    facets,
    notes,
  };

  try {
    const ir = await token.getKpiLinkedRateInterestRate();
    const id = await token.getKpiLinkedRateImpactData();

    const interestRate: Record<string, string> = {
      maxRate: ir.maxRate.toString(),
      baseRate: ir.baseRate.toString(),
      minRate: ir.minRate.toString(),
      startPeriod: ir.startPeriod.toString(),
      startRate: ir.startRate.toString(),
      missedPenalty: ir.missedPenalty.toString(),
      reportPeriod: ir.reportPeriod.toString(),
      rateDecimals: ir.rateDecimals.toString(),
    };
    const impactData: Record<string, string> = {
      maxDeviationCap: id.maxDeviationCap.toString(),
      baseLine: id.baseLine.toString(),
      maxDeviationFloor: id.maxDeviationFloor.toString(),
      impactDataDecimals: id.impactDataDecimals.toString(),
      adjustmentPrecision: id.adjustmentPrecision.toString(),
    };

    // startPeriod is derived from the clock at issuance, so it is checked for
    // presence rather than against a fixed value.
    const checks: FieldCheck[] = [
      ...Object.entries(INTEREST_RATE).map(([field, expected]) => ({
        field,
        expected: String(expected),
        actual: interestRate[field] ?? "(absent)",
        ok: interestRate[field] === String(expected),
      })),
      {
        field: "startPeriod",
        expected: "> 0, set from the clock at initialisation",
        actual: interestRate.startPeriod,
        ok: interestRate.startPeriod !== "0",
      },
      ...Object.entries(IMPACT_DATA).map(([field, expected]) => ({
        field,
        expected: String(expected),
        actual: impactData[field] ?? "(absent)",
        ok: impactData[field] === String(expected),
      })),
    ];

    out.kpiLinkedRate = {
      interestRate,
      impactData,
      checks,
      allMatch: checks.every((c) => c.ok),
    };
  } catch (e) {
    notes.push(
      `KPI-linked rate not readable on this token: ${reason(e)}. ` +
        `expected when the active configuration is not ${
          CONFIG_LABELS[
            "0x0000000000000000000000000000000000000000000000000000000000000004"
          ]
        }.`,
    );
  }

  try {
    const r = await token.getRate();
    out.fixedRate = { rate: r[0].toString(), rateDecimals: Number(r[1]) };
  } catch (e) {
    notes.push(`fixed rate not readable on this token: ${reason(e)}`);
  }

  try {
    out.proceedRecipientsCount = Number(await token.getProceedRecipientsCount());
  } catch (e) {
    notes.push(`getProceedRecipientsCount reverted: ${reason(e)}`);
  }

  return out;
}

// -----------------------------------------------------------------------------
// block B. compliance diagnostics
// -----------------------------------------------------------------------------
//
// same discipline as the rate diagnostics above: view calls over the configured
// json-rpc relay, no wallet, no signature, no state change. this is the read-back
// that lets argus check the compliance claim without re-running anything, and it
// is what the console renders after every block B step.
//
// every selector below was resolved live against the deployed resolver
// `getFacetIdByConfigurationIdVersionAndSelector(0x..02, 1, selector)` and came
// back non-zero, so a revert here means state, not a missing facet.

const COMPLIANCE_ABI = [
  // Kyc facet, contracts/facets/kyc/IKyc.sol
  "function getKycStatusFor(address) view returns (uint8)",
  "function getKycFor(address) view returns (tuple(uint256 validFrom, uint256 validTo, string vcId, address issuer, uint8 status))",
  "function getKycAccountsCount(uint8) view returns (uint256)",
  "function isInternalKycActivated() view returns (bool)",
  // ExternalKycListManagement facet
  "function getExternalKycListsCount() view returns (uint256)",
  "function isExternallyGranted(address, uint8) view returns (bool)",
  // SsiManagement facet, contracts/facets/ssiManagement/ISsiManagement.sol:110
  "function isIssuer(address) view returns (bool)",
  "function getIssuerListCount() view returns (uint256)",
  // AccessControl facet
  "function hasRole(bytes32, address) view returns (bool)",
  // balances
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function getMaxSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function balanceOfByPartition(bytes32, address) view returns (uint256)",
  "function partitionsOf(address) view returns (bytes32[])",
  // ComplianceByPartition facet, contracts/facets/complianceByPartition/IComplianceByPartition.sol:45-52
  "function canTransferByPartition(address,address,bytes32,uint256,bytes,bytes) view returns (bool status, bytes1 code, bytes32 reason)",
  // state flags
  "function paused() view returns (bool)",
  "function isDeactivated() view returns (bool)",
];

const PARTITION_1_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

/**
 * the roles block B touches. hashes from the SDK's own
 * `domain/context/security/SecurityRole.ts:6-40`, copied because `SecurityRole`
 * is not reachable from the published package's single `"."` export.
 */
const WATCHED_ROLES: { name: string; id: string }[] = [
  {
    name: "DEFAULT_ADMIN",
    id: "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    name: "ISSUER",
    id: "0x5eeaf5602c75bf26e73b5206d0bd6ee82f621166255e5fd73cc06bc7bd84a95f",
  },
  {
    name: "SSI_MANAGER",
    id: "0x3120494a82251fe85b0403877539486dbfcf0f94c20741a3229cfad31f625ee1",
  },
  {
    name: "KYC",
    id: "0x754f499f9fdfbb089d12bdec817a6863d593d8a3ea7f546c00a5cafd20957bfc",
  },
];

export interface AccountCompliance {
  label: string;
  accountId: string;
  evm: string;
  /** 0 NOT_GRANTED, 1 GRANTED. -1 when the read reverted. */
  kycStatus: number;
  kycStatusLabel: "NOT_GRANTED" | "GRANTED" | "unreadable";
  /** the stored KYC record, present once a grant has landed */
  kycRecord?: {
    validFrom: string;
    validTo: string;
    vcId: string;
    issuer: string;
    status: number;
    /** false when the record exists but its issuer is no longer registered */
    issuerStillRegistered: boolean;
  };
  /** every registered external KYC list reports GRANTED for this account */
  externallyGranted: boolean;
  /** registered as an accepted credential issuer on this security */
  isCredentialIssuer: boolean;
  roles: { name: string; held: boolean }[];
  /** whole-note balance, already scaled by the token's decimals */
  balance: string;
  balanceByPartition1: string;
  partitions: string[];
}

export interface TransferPreflight {
  fromLabel: string;
  toLabel: string;
  amount: string;
  /** what `canTransferByPartition` returned */
  allowed: boolean;
  /** EIP-1066 status byte. 0x01 is the only value the SDK accepts. */
  statusCode: string;
  reason: DecodedRevert | null;
  /** one line for the console */
  summary: string;
}

export interface ComplianceDiagnostics {
  evmAddress: string;
  decimals: number;
  totalSupply: string;
  maxSupply: string;
  internalKycActivated: boolean;
  externalKycListsCount: number;
  credentialIssuerCount: number;
  kycGrantedCount: number;
  paused: boolean;
  deactivated: boolean;
  accounts: AccountCompliance[];
  notes: string[];
}

function units(raw: bigint, decimals: number): string {
  return ethers.formatUnits(raw, decimals);
}

/**
 * reads the whole compliance picture for a token and a set of accounts.
 *
 * the two KYC legs are reported separately and deliberately.
 * `KycStorageWrapper.verifyKycStatus`
 * (`contracts/domain/core/KycStorageWrapper.sol:206-210`) ANDs them: internal
 * KYC, only when `internalKycActivated`, and every registered external list.
 * showing one leg would let a reader assume the other passed.
 *
 * `issuerStillRegistered` matters more than it looks.
 * `KycStorageWrapper.getKycStatusFor:126` returns NOT_GRANTED when
 * `isIssuer(record.issuer)` is false, so removing a credential issuer silently
 * un-grants every account it ever granted.
 */
export async function readComplianceDiagnostics(
  cfg: CovenantConfig,
  idOrAddress: string,
  accounts: { label: string; id: string; evm: string }[],
): Promise<ComplianceDiagnostics> {
  const evmAddress = toEvmAddress(idOrAddress);
  const provider = rpc(cfg);
  const token = new ethers.Contract(evmAddress, COMPLIANCE_ABI, provider);
  const notes: string[] = [];

  // every read below is issued in parallel and every one of them is guarded.
  // sequentially this was 54 calls and about twenty seconds against the public
  // relay, and any single rejection propagated out of the function. neither is
  // acceptable in a step the console runs after every transaction.
  const [
    decimalsRaw,
    internalKycActivated,
    externalKycListsCount,
    credentialIssuerCount,
    paused,
    deactivated,
    kycGrantedCount,
    totalSupplyRaw,
    maxSupplyRaw,
  ] = await Promise.all([
    attempt(notes, "decimals()", BigInt(0), async () => await token.decimals()),
    attempt(notes, "isInternalKycActivated()", false, async () => await token.isInternalKycActivated()),
    attempt(notes, "getExternalKycListsCount()", BigInt(0), async () => await token.getExternalKycListsCount()),
    attempt(notes, "getIssuerListCount()", BigInt(0), async () => await token.getIssuerListCount()),
    attempt(notes, "paused()", false, async () => await token.paused()),
    attempt(notes, "isDeactivated()", false, async () => await token.isDeactivated()),
    attempt(notes, "getKycAccountsCount(GRANTED)", BigInt(0), async () => await token.getKycAccountsCount(1)),
    attempt(notes, "totalSupply()", BigInt(0), async () => await token.totalSupply()),
    attempt(notes, "getMaxSupply()", BigInt(0), async () => await token.getMaxSupply()),
  ]);

  const decimals = Number(decimalsRaw);

  const out: AccountCompliance[] = await Promise.all(
    accounts.map(async (a): Promise<AccountCompliance> => {
      const evm = toEvmAddress(a.evm);
      const [
        kycStatusRaw,
        rawRecord,
        externallyGranted,
        isCredentialIssuer,
        balanceRaw,
        partitionBalanceRaw,
        partitions,
        roles,
      ] = await Promise.all([
        attempt(notes, `getKycStatusFor(${a.label})`, BigInt(-1), async () => await token.getKycStatusFor(evm)),
        attempt(notes, `getKycFor(${a.label})`, null, async () => await token.getKycFor(evm)),
        attempt(notes, `isExternallyGranted(${a.label})`, true, async () => await token.isExternallyGranted(evm, 1)),
        attempt(notes, `isIssuer(${a.label})`, false, async () => await token.isIssuer(evm)),
        attempt(notes, `balanceOf(${a.label})`, BigInt(0), async () => await token.balanceOf(evm)),
        attempt(notes, `balanceOfByPartition(${a.label})`, BigInt(0), async () =>
          await token.balanceOfByPartition(PARTITION_1_ID, evm),
        ),
        attempt(notes, `partitionsOf(${a.label})`, [] as string[], async () => await token.partitionsOf(evm)),
        Promise.all(
          WATCHED_ROLES.map(async (r) => ({
            name: r.name,
            held: await attempt(notes, `hasRole(${r.name}, ${a.label})`, false, async () =>
              await token.hasRole(r.id, evm),
            ),
          })),
        ),
      ]);

      let kycRecord: AccountCompliance["kycRecord"];
      if (rawRecord && rawRecord.issuer !== ethers.ZeroAddress) {
        kycRecord = {
          validFrom: rawRecord.validFrom.toString(),
          validTo: rawRecord.validTo.toString(),
          vcId: rawRecord.vcId,
          issuer: rawRecord.issuer,
          status: Number(rawRecord.status),
          issuerStillRegistered: await attempt(
            notes,
            `isIssuer(record issuer of ${a.label})`,
            false,
            async () => await token.isIssuer(rawRecord.issuer),
          ),
        };
      }

      const kycStatus = Number(kycStatusRaw);
      return {
        label: a.label,
        accountId: a.id,
        evm,
        kycStatus,
        kycStatusLabel:
          kycStatus === 1 ? "GRANTED" : kycStatus === 0 ? "NOT_GRANTED" : "unreadable",
        kycRecord,
        externallyGranted,
        isCredentialIssuer,
        roles,
        balance: units(balanceRaw, decimals),
        balanceByPartition1: units(partitionBalanceRaw, decimals),
        partitions: (partitions as string[]).map((x) => x),
      };
    }),
  );

  return {
    evmAddress,
    decimals,
    totalSupply: units(totalSupplyRaw, decimals),
    maxSupply: units(maxSupplyRaw, decimals),
    internalKycActivated,
    externalKycListsCount: Number(externalKycListsCount),
    credentialIssuerCount: Number(credentialIssuerCount),
    kycGrantedCount: Number(kycGrantedCount),
    paused,
    deactivated,
    accounts: out,
    notes,
  };
}

/**
 * asks the token whether a given transfer would be permitted, without sending
 * one.
 *
 * this is the exact query the SDK runs before it will submit a transfer:
 * `ValidationService.checkCanTransfer` (`app/service/validation/ValidationService.ts:180-203`)
 * issues a `CanTransferByPartitionQuery` and throws unless the status byte is
 * `0x01`. running it ourselves is what turns "our code threw an exception" into
 * "the token said no", because the answer comes from the deployed contract.
 *
 * the returned `reason` is a bytes32 carrying the blocking error's selector
 * left-aligned (`ComplianceByPartition.sol:43`), decoded by lib/ats/revert.ts.
 */
export async function readTransferPreflight(
  cfg: CovenantConfig,
  idOrAddress: string,
  from: { label: string; evm: string },
  to: { label: string; evm: string },
  amount: string,
  decimals: number,
): Promise<TransferPreflight> {
  const provider = rpc(cfg);
  const token = new ethers.Contract(
    toEvmAddress(idOrAddress),
    COMPLIANCE_ABI,
    provider,
  );

  const value = ethers.parseUnits(amount, decimals);
  const res = await token.canTransferByPartition(
    toEvmAddress(from.evm),
    toEvmAddress(to.evm),
    PARTITION_1_ID,
    value,
    "0x",
    "0x",
  );

  const allowed: boolean = res[0];
  const statusCode: string = res[1];
  const decoded = decodeRevert(res[2]);

  return {
    fromLabel: from.label,
    toLabel: to.label,
    amount,
    allowed,
    statusCode,
    reason: allowed ? null : decoded,
    summary: allowed
      ? `the token would permit ${amount} from ${from.label} to ${to.label}`
      : `the token would refuse ${amount} from ${from.label} to ${to.label}: ` +
        `${decoded?.summary ?? "no reason returned"} (EIP-1066 ${statusCode})`,
  };
}

// -----------------------------------------------------------------------------
// block C. rate and coupon diagnostics
// -----------------------------------------------------------------------------
//
// same discipline as everything above: view calls over the configured json-rpc
// relay, no wallet, no signature, no state change, every call guarded and issued
// in parallel.
//
// this is the read-back that carries the block C claim, and the claim is not
// "we sent a transaction". it is: the rate the token stamped into the coupon is
// the rate the engine produced, and the token stamped it, not us. that needs
// three values side by side, and they are all here: the rate in the token's own
// storage, the rate recorded on the coupon, and the triplet we actually sent.

const COUPON_ABI = [
  // InterestRateFacet
  "function getCouponRateType() view returns (uint8)",
  // FixedRateFacet
  "function getRate() view returns (uint256 rate_, uint8 decimals_)",
  // CouponFacet, contracts/facets/coupon/ICoupon.sol
  "function getCouponCount() view returns (uint256)",
  "function getCoupon(uint256 couponID) view returns (((uint256 recordDate, uint256 executionDate, uint256 startDate, uint256 endDate, uint256 fixingDate, uint256 rate, uint8 rateDecimals, uint8 rateStatus) coupon, uint256 snapshotId) registeredCoupon_, bool isDisabled_)",
  "function getCouponAmountFor(uint256 couponID, address account) view returns ((uint256 numerator, uint256 denominator, bool recordDateReached) couponAmountFor_)",
  // CouponSecurityHoldersFacet. present on config 2, confirmed live: the call
  // reverts WrongIndexForAction on a missing coupon, not FunctionNotFound.
  "function getCouponHolders(uint256 couponID, uint256 pageIndex, uint256 pageLength) view returns (address[])",
  "function getTotalCouponHolders(uint256 couponID) view returns (uint256)",
  // MaturityFacet
  "function getMaturityDate() view returns (uint256)",
  // NominalValue
  "function getNominalValue() view returns (uint256)",
  "function getNominalValueDecimals() view returns (uint8)",
  // ScheduledCrossOrderedTasksFacet
  "function scheduledCrossOrderedTaskCount() view returns (uint256)",
  "function getScheduledCrossOrderedTasks(uint256 pageIndex, uint256 pageLength) view returns ((uint256 scheduledTimestamp, bytes data)[])",
  // shared
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function hasRole(bytes32, address) view returns (bool)",
  "function paused() view returns (bool)",
  "function isDeactivated() view returns (bool)",
];

/**
 * the three roles block C needs, plus the admin that grants them. hashes from
 * `contracts/constants/roles.sol` lines 35, 56 and 72, and each one confirmed by
 * the deployed contract naming it in an `AccountHasNoRole` revert during the
 * block C dry run.
 */
const RATE_ROLES: { name: string; id: string }[] = [
  {
    name: "DEFAULT_ADMIN",
    id: "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    name: "INTEREST_RATE_MANAGER",
    id: "0xfa80c71f8de1628faf2c0e9bd02c2f4a3da1f16823b75e61e84b90164a07b4a4",
  },
  {
    name: "CORPORATE_ACTION",
    id: "0xa1acfc499025c99f55059195e6276f639d34a18aad7b8121b9192b7f438c55cd",
  },
  {
    name: "MATURITY_MANAGER",
    id: "0xc20b7fd7efe1a2c9f69003a21c2c55c79ef84e16252b62599246ff01f6207314",
  },
];

export const RATE_STATUS_LABELS = ["PENDING", "SET"] as const;

export interface CouponEntitlement {
  label: string;
  evm: string;
  /** whole notes held at the record date, as the coupon read them */
  balance: string;
  /** exactly the pair `getCouponAmountFor` returned */
  numerator: string;
  denominator: string;
  /** the fraction as a decimal, in the note's nominal currency */
  amount: string;
  recordDateReached: boolean;
}

export interface CouponRecord {
  couponId: number;
  recordDate: number;
  executionDate: number;
  startDate: number;
  endDate: number;
  fixingDate: number;
  /** the rate as stored on the coupon. under FIXED the token wrote this */
  rate: string;
  rateDecimals: number;
  rateStatus: number;
  rateStatusLabel: string;
  ratePercent: string;
  /** 0 means the scheduled snapshot has not been drained yet */
  snapshotId: string;
  isDisabled: boolean;
  recordDateReached: boolean;
  /** holders as at the record date, empty before it */
  holdersOfRecord: string[];
  totalHolders: number;
  entitlements: CouponEntitlement[];
}

export interface CouponDiagnostics {
  evmAddress: string;
  decimals: number;
  totalSupply: string;
  nominalValue: string;
  nominalValueDecimals: number;
  /** 0 NONE, 1 STANDARD, 2 FIXED, 3 KPI_LINKED */
  couponRateType: number;
  couponRateTypeLabel: string;
  /** the rate in the token's own storage. what a FIXED coupon gets stamped with */
  fixedRate: { raw: string; decimals: number; percent: string } | null;
  couponCount: number;
  maturityDate: number;
  maturityIso: string;
  secondsToMaturity: number;
  scheduledTaskCount: number;
  scheduledTaskTimestamps: number[];
  paused: boolean;
  deactivated: boolean;
  /** roles held by the account that must sign block C */
  issuerRoles: { name: string; held: boolean }[];
  coupons: CouponRecord[];
  nowSeconds: number;
  notes: string[];
}

/** 600 at 4 decimals reads as "6.00%". */
function asPercent(raw: bigint, decimals: number): string {
  const v = Number(ethers.formatUnits(raw, decimals)) * 100;
  return `${v.toFixed(2)}%`;
}

/** integer arithmetic. the numerator and denominator are uint256. */
function asDecimal(numerator: bigint, denominator: bigint, dp = 6): string {
  if (denominator === BigInt(0)) return "0";
  const scale = BigInt(10) ** BigInt(dp);
  return ethers.formatUnits((numerator * scale) / denominator, dp);
}

/**
 * reads the whole rate and coupon picture for a token.
 *
 * `accounts` are the parties the console watches. every one of them gets an
 * entitlement row per coupon whether or not it holds anything, because a zero
 * entitlement for a party that should have one is exactly the failure this
 * screen has to make visible.
 */
export async function readCouponDiagnostics(
  cfg: CovenantConfig,
  idOrAddress: string,
  accounts: { label: string; id: string; evm: string }[],
): Promise<CouponDiagnostics> {
  const evmAddress = toEvmAddress(idOrAddress);
  const provider = rpc(cfg);
  const token = new ethers.Contract(evmAddress, COUPON_ABI, provider);
  const notes: string[] = [];

  const [
    decimalsRaw,
    totalSupplyRaw,
    nominalValueRaw,
    nominalValueDecimalsRaw,
    rateTypeRaw,
    ratePair,
    couponCountRaw,
    maturityRaw,
    taskCountRaw,
    tasks,
    paused,
    deactivated,
    issuerRoles,
  ] = await Promise.all([
    attempt(notes, "decimals()", BigInt(0), async () => await token.decimals()),
    attempt(notes, "totalSupply()", BigInt(0), async () => await token.totalSupply()),
    attempt(notes, "getNominalValue()", BigInt(0), async () => await token.getNominalValue()),
    attempt(notes, "getNominalValueDecimals()", BigInt(0), async () => await token.getNominalValueDecimals()),
    attempt(notes, "getCouponRateType()", BigInt(-1), async () => await token.getCouponRateType()),
    attempt(notes, "getRate()", null, async () => await token.getRate()),
    attempt(notes, "getCouponCount()", BigInt(0), async () => await token.getCouponCount()),
    attempt(notes, "getMaturityDate()", BigInt(0), async () => await token.getMaturityDate()),
    attempt(notes, "scheduledCrossOrderedTaskCount()", BigInt(0), async () =>
      await token.scheduledCrossOrderedTaskCount(),
    ),
    attempt(notes, "getScheduledCrossOrderedTasks()", [] as { scheduledTimestamp: bigint }[], async () =>
      await token.getScheduledCrossOrderedTasks(0, 20),
    ),
    attempt(notes, "paused()", false, async () => await token.paused()),
    attempt(notes, "isDeactivated()", false, async () => await token.isDeactivated()),
    Promise.all(
      RATE_ROLES.map(async (r) => ({
        name: r.name,
        held: await attempt(notes, `hasRole(${r.name}, issuer)`, false, async () =>
          await token.hasRole(r.id, toEvmAddress(cfg.accounts.issuer.evm)),
        ),
      })),
    ),
  ]);

  const decimals = Number(decimalsRaw);
  const couponCount = Number(couponCountRaw);
  const maturityDate = Number(maturityRaw);
  const nowSeconds = Math.floor(Date.now() / 1000);

  const coupons: CouponRecord[] = await Promise.all(
    Array.from({ length: couponCount }, (_, i) => i + 1).map(
      async (couponId): Promise<CouponRecord> => {
        const raw = await attempt(notes, `getCoupon(${couponId})`, null, async () =>
          await token.getCoupon(couponId),
        );
        const c = raw?.[0]?.coupon;
        const recordDate = c ? Number(c.recordDate) : 0;
        const recordDateReached = recordDate !== 0 && recordDate < nowSeconds;

        const [holdersOfRecord, totalHolders, entitlements] = await Promise.all([
          attempt(notes, `getCouponHolders(${couponId})`, [] as string[], async () =>
            await token.getCouponHolders(couponId, 0, 50),
          ),
          attempt(notes, `getTotalCouponHolders(${couponId})`, BigInt(0), async () =>
            await token.getTotalCouponHolders(couponId),
          ),
          Promise.all(
            accounts.map(async (a): Promise<CouponEntitlement> => {
              const evm = toEvmAddress(a.evm);
              const [amountPair, balanceRaw] = await Promise.all([
                attempt(notes, `getCouponAmountFor(${couponId}, ${a.label})`, null, async () =>
                  await token.getCouponAmountFor(couponId, evm),
                ),
                attempt(notes, `balanceOf(${a.label})`, BigInt(0), async () =>
                  await token.balanceOf(evm),
                ),
              ]);
              const numerator = amountPair ? BigInt(amountPair.numerator) : BigInt(0);
              const denominator = amountPair ? BigInt(amountPair.denominator) : BigInt(0);
              return {
                label: a.label,
                evm,
                balance: ethers.formatUnits(balanceRaw, decimals),
                numerator: numerator.toString(),
                denominator: denominator.toString(),
                amount: asDecimal(numerator, denominator),
                recordDateReached: Boolean(amountPair?.recordDateReached),
              };
            }),
          ),
        ]);

        return {
          couponId,
          recordDate,
          executionDate: c ? Number(c.executionDate) : 0,
          startDate: c ? Number(c.startDate) : 0,
          endDate: c ? Number(c.endDate) : 0,
          fixingDate: c ? Number(c.fixingDate) : 0,
          rate: c ? c.rate.toString() : "0",
          rateDecimals: c ? Number(c.rateDecimals) : 0,
          rateStatus: c ? Number(c.rateStatus) : 0,
          rateStatusLabel: c
            ? (RATE_STATUS_LABELS[Number(c.rateStatus)] ?? "unreadable")
            : "unreadable",
          ratePercent: c ? asPercent(BigInt(c.rate), Number(c.rateDecimals)) : "0.00%",
          snapshotId: raw ? String(raw[0].snapshotId) : "0",
          isDisabled: Boolean(raw?.[1]),
          recordDateReached,
          holdersOfRecord: (holdersOfRecord as string[]).map((h) => h),
          totalHolders: Number(totalHolders),
          entitlements,
        };
      },
    ),
  );

  return {
    evmAddress,
    decimals,
    totalSupply: ethers.formatUnits(totalSupplyRaw, decimals),
    nominalValue: ethers.formatUnits(nominalValueRaw, Number(nominalValueDecimalsRaw)),
    nominalValueDecimals: Number(nominalValueDecimalsRaw),
    couponRateType: Number(rateTypeRaw),
    couponRateTypeLabel: RATE_TYPE_LABELS[Number(rateTypeRaw)] ?? "unreadable",
    fixedRate: ratePair
      ? {
          raw: ratePair[0].toString(),
          decimals: Number(ratePair[1]),
          percent: asPercent(BigInt(ratePair[0]), Number(ratePair[1])),
        }
      : null,
    couponCount,
    maturityDate,
    maturityIso: maturityDate ? new Date(maturityDate * 1000).toISOString() : "",
    secondsToMaturity: maturityDate ? maturityDate - nowSeconds : 0,
    scheduledTaskCount: Number(taskCountRaw),
    scheduledTaskTimestamps: (tasks as { scheduledTimestamp: bigint }[]).map((t) =>
      Number(t.scheduledTimestamp),
    ),
    paused,
    deactivated,
    issuerRoles,
    coupons,
    nowSeconds,
    notes,
  };
}

// -----------------------------------------------------------------------------
// block E. collateral hold diagnostics
// -----------------------------------------------------------------------------
//
// same discipline as everything above: view calls over the configured json-rpc
// relay, no wallet, no signature, no state change, every call guarded.
//
// this is the read-back argus gates block E on, and the gate is two fields.
// `escrow_` must be the engine account and `destination_` must be the lender,
// both read off the token rather than off our own state. that pair is the
// checkable form of the entire thesis:
//
//   escrow = engine       the agent cannot decide release versus execute
//   destination = lender  the escrow cannot send the collateral anywhere else
//
// `HoldStorageWrapper._validateExecuteHold` (`:1086-1088`) skips the destination
// check when `hold.to == address(0)`, so an unpinned destination would leave the
// escrow free to send the notes to any address it liked. reading both back is
// how we show neither is true here.

const HOLD_ABI = [
  // HoldByPartition facet, contracts/facets/holdByPartition/IHoldByPartition.sol:146-159
  "function getHoldForByPartition((bytes32 partition, address tokenHolder, uint256 holdId) holdIdentifier) view returns (uint256 amount_, uint256 expirationTimestamp_, address escrow_, address destination_, bytes data_, bytes operatorData_, uint8 thirdPartyType_)",
  "function getHoldsIdForByPartition(bytes32 partition, address tokenHolder, uint256 pageIndex, uint256 pageLength) view returns (uint256[] holdsId_)",
  "function getHoldCountForByPartition(bytes32 partition, address tokenHolder) view returns (uint256)",
  "function getHeldAmountForByPartition(bytes32 partition, address tokenHolder) view returns (uint256)",
  // Clearing facet, contracts/facets/clearing/Clearing.sol:63. holds are only
  // available while clearing is off: createHoldByPartition carries
  // onlyClearingDisabled (HoldByPartition.sol:49)
  "function isClearingActivated() view returns (bool)",
  // ControlList facet. isAbleToAccess is (isWhiteList == inList), checked on the
  // token holder at execute (HoldStorageWrapper.sol:1082-1084)
  "function getControlListType() view returns (bool)",
  "function isInControlList(address account) view returns (bool)",
  // Kyc facet
  "function getKycStatusFor(address account) view returns (uint8)",
  // shared
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function balanceOfByPartition(bytes32 partition, address account) view returns (uint256)",
  "function paused() view returns (bool)",
  "function isDeactivated() view returns (bool)",
];

/** `ThirdPartyType`, contracts/domain/asset/types/ThirdPartyType.sol:9-15. */
export const THIRD_PARTY_TYPE_LABELS = [
  "NULL",
  "AUTHORIZED",
  "OPERATOR",
  "PROTECTED",
  "CONTROLLER",
] as const;

export interface HoldReadBack {
  holdId: number;
  holderLabel: string;
  holderEvm: string;
  /** whole notes, scaled by the token's decimals */
  amount: string;
  amountRaw: string;
  expirationTimestamp: number;
  expirationIso: string;
  secondsToExpiry: number;
  /** past expiry: release and execute both revert HoldExpirationReached */
  expired: boolean;
  /** the only address that may release or execute this hold */
  escrow: string;
  escrowLabel: string;
  /** the pinned recipient on execute. address(0) means any recipient is allowed */
  destination: string;
  destinationLabel: string;
  /** the two checks the block E gate is */
  escrowIsEngine: boolean;
  destinationIsLender: boolean;
  destinationPinned: boolean;
  data: string;
  operatorData: string;
  thirdPartyType: number;
  thirdPartyTypeLabel: string;
}

export interface HoldAccount {
  label: string;
  accountId: string;
  evm: string;
  /** balance NOT under hold. creating a hold moves notes out of this */
  available: string;
  /** total held across this holder's holds on partition 1 */
  held: string;
  holdCount: number;
  holdIds: number[];
  kycStatus: number;
  kycStatusLabel: "NOT_GRANTED" | "GRANTED" | "unreadable";
  /** false means the control list would block this account at execute */
  ableToAccess: boolean;
}

export interface Prerequisite {
  name: string;
  ok: boolean;
  /** what satisfies it when it is not met */
  detail: string;
}

export interface HoldDiagnostics {
  evmAddress: string;
  decimals: number;
  totalSupply: string;
  clearingActivated: boolean;
  paused: boolean;
  deactivated: boolean;
  /** true = whitelist, false = blacklist. ControlList.sol:55 */
  controlListIsWhitelist: boolean;
  nowSeconds: number;
  accounts: HoldAccount[];
  holds: HoldReadBack[];
  prerequisites: Prerequisite[];
  notes: string[];
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * reads every hold on the watched accounts, plus everything block E needs to be
 * true before a signature is worth spending.
 *
 * the prerequisite list exists because of the modifier order on
 * `executeHoldByPartition` (`HoldByPartition.sol:110-120`): KYC and compliance
 * are checked before the hold id, the escrow and the destination, so one missing
 * grant masks every other problem and does it on the shot the video is built
 * around. all of it is visible here before the recorder starts.
 */
export async function readHoldDiagnostics(
  cfg: CovenantConfig,
  idOrAddress: string,
  accounts: { label: string; id: string; evm: string }[],
  holdersToScan: { label: string; id: string; evm: string }[],
): Promise<HoldDiagnostics> {
  const evmAddress = toEvmAddress(idOrAddress);
  const provider = rpc(cfg);
  const token = new ethers.Contract(evmAddress, HOLD_ABI, provider);
  const notes: string[] = [];
  const nowSeconds = Math.floor(Date.now() / 1000);

  const [
    decimalsRaw,
    totalSupplyRaw,
    clearingActivated,
    paused,
    deactivated,
    controlListIsWhitelist,
  ] = await Promise.all([
    attempt(notes, "decimals()", BigInt(0), async () => await token.decimals()),
    attempt(notes, "totalSupply()", BigInt(0), async () => await token.totalSupply()),
    attempt(notes, "isClearingActivated()", false, async () => await token.isClearingActivated()),
    attempt(notes, "paused()", false, async () => await token.paused()),
    attempt(notes, "isDeactivated()", false, async () => await token.isDeactivated()),
    attempt(notes, "getControlListType()", false, async () => await token.getControlListType()),
  ]);

  const decimals = Number(decimalsRaw);

  const label = (address: string): string => {
    if (address === ethers.ZeroAddress) return "the zero address, unpinned";
    const hit = accounts.find((a) => sameAddress(a.evm, address));
    return hit ? `${hit.label} ${hit.id}` : "an account outside the four";
  };

  const watched: HoldAccount[] = await Promise.all(
    accounts.map(async (a): Promise<HoldAccount> => {
      const evm = toEvmAddress(a.evm);
      const [available, held, holdCount, holdIds, kycStatusRaw, inControlList] =
        await Promise.all([
          attempt(notes, `balanceOfByPartition(${a.label})`, BigInt(0), async () =>
            await token.balanceOfByPartition(PARTITION_1_ID, evm),
          ),
          attempt(notes, `getHeldAmountForByPartition(${a.label})`, BigInt(0), async () =>
            await token.getHeldAmountForByPartition(PARTITION_1_ID, evm),
          ),
          attempt(notes, `getHoldCountForByPartition(${a.label})`, BigInt(0), async () =>
            await token.getHoldCountForByPartition(PARTITION_1_ID, evm),
          ),
          attempt(notes, `getHoldsIdForByPartition(${a.label})`, [] as bigint[], async () =>
            await token.getHoldsIdForByPartition(PARTITION_1_ID, evm, 0, 50),
          ),
          attempt(notes, `getKycStatusFor(${a.label})`, BigInt(-1), async () =>
            await token.getKycStatusFor(evm),
          ),
          attempt(notes, `isInControlList(${a.label})`, false, async () =>
            await token.isInControlList(evm),
          ),
        ]);

      const kycStatus = Number(kycStatusRaw);
      return {
        label: a.label,
        accountId: a.id,
        evm,
        available: units(available, decimals),
        held: units(held, decimals),
        holdCount: Number(holdCount),
        holdIds: (holdIds as bigint[]).map((i) => Number(i)),
        kycStatus,
        kycStatusLabel:
          kycStatus === 1 ? "GRANTED" : kycStatus === 0 ? "NOT_GRANTED" : "unreadable",
        // ControlListStorageWrapper.isAbleToAccess:110-114, (isWhiteList == inList)
        ableToAccess: Boolean(controlListIsWhitelist) === Boolean(inControlList),
      };
    }),
  );

  const holds: HoldReadBack[] = [];
  for (const holder of holdersToScan) {
    const evm = toEvmAddress(holder.evm);
    const ids = await attempt(
      notes,
      `getHoldsIdForByPartition(${holder.label})`,
      [] as bigint[],
      async () => await token.getHoldsIdForByPartition(PARTITION_1_ID, evm, 0, 50),
    );
    for (const idRaw of ids as bigint[]) {
      const holdId = Number(idRaw);
      const raw = await attempt(notes, `getHoldForByPartition(${holder.label}, ${holdId})`, null, async () =>
        await token.getHoldForByPartition({
          partition: PARTITION_1_ID,
          tokenHolder: evm,
          holdId,
        }),
      );
      if (!raw) continue;
      const expiration = Number(raw[1]);
      const escrow: string = raw[2];
      const destination: string = raw[3];
      holds.push({
        holdId,
        holderLabel: holder.label,
        holderEvm: evm,
        amount: units(raw[0], decimals),
        amountRaw: raw[0].toString(),
        expirationTimestamp: expiration,
        expirationIso: expiration ? new Date(expiration * 1000).toISOString() : "",
        secondsToExpiry: expiration - nowSeconds,
        // HoldStorageWrapper.isHoldExpired:764-766 is `now >= expiration`, so the
        // expiration second itself is already expired
        expired: nowSeconds >= expiration,
        escrow,
        escrowLabel: label(escrow),
        destination,
        destinationLabel: label(destination),
        escrowIsEngine: sameAddress(escrow, cfg.accounts.engine.evm),
        destinationIsLender: sameAddress(destination, cfg.accounts.lender.evm),
        destinationPinned: destination !== ethers.ZeroAddress,
        data: raw[4],
        operatorData: raw[5],
        thirdPartyType: Number(raw[6]),
        thirdPartyTypeLabel:
          THIRD_PARTY_TYPE_LABELS[Number(raw[6])] ?? "unreadable",
      });
    }
  }

  const holderRow = watched.find((a) => sameAddress(a.evm, cfg.accounts.holder.evm));
  const lenderRow = watched.find((a) => sameAddress(a.evm, cfg.accounts.lender.evm));

  const prerequisites: Prerequisite[] = [
    {
      name: "clearing is off",
      ok: !clearingActivated,
      detail:
        "createHoldByPartition carries onlyClearingDisabled (HoldByPartition.sol:49). " +
        "the note was issued with clearingActive false.",
    },
    {
      name: "the token is not paused or deactivated",
      ok: !paused && !deactivated,
      detail: "onlyUnpaused and onlyActivated on all four hold verbs.",
    },
    {
      name: "the note holder has notes to pledge",
      ok: Number(holderRow?.available ?? "0") > 0,
      detail:
        "block B mints to the issuer and transfers to the note holder. with a zero " +
        "balance createHoldByPartition reverts InvalidPartition, because the holder " +
        "has no entry on partition 1 at all (ERC1410StorageWrapper.sol:114-117).",
    },
    {
      name: "the note holder holds KYC",
      ok: holderRow?.kycStatus === 1,
      detail:
        "checked at execute, not at create: onlyIdentifiedAddresses(tokenHolder, _to), " +
        "HoldByPartition.sol:118. block B step 7 grants it.",
    },
    {
      name: "the lender holds KYC",
      ok: lenderRow?.kycStatus === 1,
      detail:
        "the destination is checked at execute by both onlyIdentifiedAddresses and " +
        "onlyCompliant (HoldByPartition.sol:118-119). block B step 8 grants it. " +
        "without it the money shot reverts InvalidKycStatus and the escrow check is " +
        "never even reached.",
    },
    {
      name: "the note holder is not blocked by the control list",
      ok: holderRow?.ableToAccess !== false,
      detail:
        "_validateExecuteHold reverts AccountIsBlocked before anything else " +
        "(HoldStorageWrapper.sol:1082-1084).",
    },
    {
      name: "the escrow account is not the issuer",
      ok: !sameAddress(cfg.accounts.engine.evm, cfg.accounts.issuer.evm),
      detail:
        "if the agent is the escrow, the agent decides release versus execute. " +
        "see DECISIONS.md D5.",
    },
  ];

  return {
    evmAddress,
    decimals,
    totalSupply: units(totalSupplyRaw, decimals),
    clearingActivated: Boolean(clearingActivated),
    paused: Boolean(paused),
    deactivated: Boolean(deactivated),
    controlListIsWhitelist: Boolean(controlListIsWhitelist),
    nowSeconds,
    accounts: watched,
    holds,
    prerequisites,
    notes,
  };
}
