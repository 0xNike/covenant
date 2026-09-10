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
