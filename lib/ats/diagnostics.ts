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
  const provider = new ethers.JsonRpcProvider(cfg.rpcNode);
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
  const provider = new ethers.JsonRpcProvider(cfg.rpcNode);
  const token = new ethers.Contract(evmAddress, COMPLIANCE_ABI, provider);
  const notes: string[] = [];

  const decimals = Number(await token.decimals());
  const internalKycActivated: boolean = await token.isInternalKycActivated();
  const externalKycListsCount = Number(await token.getExternalKycListsCount());
  const credentialIssuerCount = Number(await token.getIssuerListCount());

  let paused = false;
  try {
    paused = await token.paused();
  } catch (e) {
    notes.push(`paused() reverted: ${reason(e)}`);
  }
  let deactivated = false;
  try {
    deactivated = await token.isDeactivated();
  } catch (e) {
    notes.push(`isDeactivated() reverted: ${reason(e)}`);
  }

  let kycGrantedCount = 0;
  try {
    kycGrantedCount = Number(await token.getKycAccountsCount(1));
  } catch (e) {
    notes.push(`getKycAccountsCount(GRANTED) reverted: ${reason(e)}`);
  }

  const out: AccountCompliance[] = [];
  for (const a of accounts) {
    const evm = toEvmAddress(a.evm);

    let kycStatus = -1;
    try {
      kycStatus = Number(await token.getKycStatusFor(evm));
    } catch (e) {
      notes.push(`getKycStatusFor(${a.label}) reverted: ${reason(e)}`);
    }

    let kycRecord: AccountCompliance["kycRecord"];
    try {
      const r = await token.getKycFor(evm);
      const recordIssuer: string = r.issuer;
      if (recordIssuer !== ethers.ZeroAddress) {
        kycRecord = {
          validFrom: r.validFrom.toString(),
          validTo: r.validTo.toString(),
          vcId: r.vcId,
          issuer: recordIssuer,
          status: Number(r.status),
          issuerStillRegistered: await token.isIssuer(recordIssuer),
        };
      }
    } catch (e) {
      notes.push(`getKycFor(${a.label}) reverted: ${reason(e)}`);
    }

    let externallyGranted = true;
    try {
      externallyGranted = await token.isExternallyGranted(evm, 1);
    } catch (e) {
      notes.push(`isExternallyGranted(${a.label}) reverted: ${reason(e)}`);
    }

    const roles: { name: string; held: boolean }[] = [];
    for (const r of WATCHED_ROLES) {
      try {
        roles.push({ name: r.name, held: await token.hasRole(r.id, evm) });
      } catch {
        roles.push({ name: r.name, held: false });
      }
    }

    out.push({
      label: a.label,
      accountId: a.id,
      evm,
      kycStatus,
      kycStatusLabel:
        kycStatus === 1 ? "GRANTED" : kycStatus === 0 ? "NOT_GRANTED" : "unreadable",
      kycRecord,
      externallyGranted,
      isCredentialIssuer: await token.isIssuer(evm),
      roles,
      balance: units(await token.balanceOf(evm), decimals),
      balanceByPartition1: units(
        await token.balanceOfByPartition(PARTITION_1_ID, evm),
        decimals,
      ),
      partitions: (await token.partitionsOf(evm)).map((p: string) => p),
    });
  }

  return {
    evmAddress,
    decimals,
    totalSupply: units(await token.totalSupply(), decimals),
    maxSupply: units(await token.getMaxSupply(), decimals),
    internalKycActivated,
    externalKycListsCount,
    credentialIssuerCount,
    kycGrantedCount,
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
  const provider = new ethers.JsonRpcProvider(cfg.rpcNode);
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
