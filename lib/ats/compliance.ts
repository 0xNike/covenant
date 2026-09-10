"use client";

// covenant block B. the compliance leg: a transfer the token refuses, a KYC
// grant, then the same transfer settling.
//
// the SDK is imported dynamically inside each function for the same reason as
// lib/ats/client.ts: it reaches for globalThis.window.ethereum during wallet
// setup and pulls in dotenv and winston, none of which survive server render.
//
// there is no private key anywhere in this file. every state change below is
// signed by a human clicking the browser wallet. see DECISIONS.md D3.
//
// -----------------------------------------------------------------------------
// why the internal KYC registry and not the mock external KYC list
// -----------------------------------------------------------------------------
// the note was issued with internalKycActivated = true (EVIDENCE.md G1, read
// back off chain). the on-chain gate is
// `KycStorageWrapper.verifyKycStatus` (contracts/domain/core/KycStorageWrapper.sol:206-210):
//
//   internalKycValid = !internalKycActivated || getKycStatusFor(account) == status
//   return internalKycValid && isExternallyGranted(account, status)
//
// the two legs are ANDed. with internalKycActivated true, a grant on an external
// KYC list satisfies the second leg and leaves the first leg failing, so the
// transfer stays blocked. the mock external list path can only carry this demo
// if internal KYC is switched off first, which throws away the flag block A was
// issued with, adds two transactions, and moves the gate onto a contract that
// lives in `contracts/test/mocks`.
//
// so we use the internal registry. the SDK cannot reach it: `grantKyc`'s command
// handler decodes `vcBase64` and calls `verifyVc` from `@terminal3/verify_vc`
// (app/usecase/command/security/kyc/grantKyc/GrantKycCommandHandler.ts:34-42) and
// throws InvalidVc without a genuine Terminal3 credential. the deployed contract
// asks for no such thing: `Kyc.grantKyc` (contracts/facets/kyc/Kyc.sol:59-81)
// takes a plain `string _vcId` and never verifies it. the verifiable-credential
// requirement is entirely client side.
//
// so the grant goes straight to the deployed facet through the browser wallet,
// the same way `setCouponRateType` will (DECISIONS.md D16). everything else in
// this file goes through the SDK.

import { ethers } from "ethers";
import type { CovenantConfig } from "@/lib/config";
import { toEvmAddress } from "@/lib/ats/diagnostics";
import { decodeRevert, type DecodedRevert } from "@/lib/ats/revert";

export { decodeRevert, REVERT_SELECTORS } from "@/lib/ats/revert";
export type { DecodedRevert } from "@/lib/ats/revert";

type Sdk = typeof import("@hashgraph/asset-tokenization-sdk");

let sdkPromise: Promise<Sdk> | null = null;

function loadSdk(): Promise<Sdk> {
  if (!sdkPromise) {
    sdkPromise = import("@hashgraph/asset-tokenization-sdk");
  }
  return sdkPromise;
}

/**
 * `_PARTITION_ID_1`. every SDK transfer method defaults to it
 * (`port/out/rpc/RPCTransactionAdapter.ts:324`, `ValidationService.ts:195`) and
 * the note is single-partition, so a raw call has to use the same value or it is
 * not the same operation.
 */
export const PARTITION_1 =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

/**
 * role identifiers, `domain/context/security/SecurityRole.ts:6-40` in the SDK
 * source and `contracts/constants/roles.sol` on chain.
 *
 * these are copied rather than imported. `SecurityRole` is not re-exported from
 * the package root and `package.json` declares a single `"."` entry in
 * `exports`, so there is no subpath a consumer can deep-import. meanwhile
 * `RoleRequest.role` and `ApplyRolesRequest.roles` are typed `string` and
 * validated only as bytes32, so every consumer of the published package has to
 * hardcode these hashes. reported to hermes as an extension of BUG.md B7.
 *
 * each value below was checked against the deployed token: `hasRole` returns
 * without reverting for all of them, and DEFAULT_ADMIN reads true for the issuer.
 */
export const ROLES = {
  DEFAULT_ADMIN:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  ISSUER: "0x5eeaf5602c75bf26e73b5206d0bd6ee82f621166255e5fd73cc06bc7bd84a95f",
  SSI_MANAGER:
    "0x3120494a82251fe85b0403877539486dbfcf0f94c20741a3229cfad31f625ee1",
  KYC: "0x754f499f9fdfbb089d12bdec817a6863d593d8a3ea7f546c00a5cafd20957bfc",
} as const;

/**
 * gas limits, `packages/ats/sdk/src/core/Constants.ts`. these are not invented:
 * `GAS.TRANSFER` is 1_200_000 at line 78 and `GAS.GRANT_KYC` is 650_000 at line
 * 29, and they are the exact values the SDK passes for the same two calls
 * (`RPCTransactionAdapter.ts:325` for the transfer).
 *
 * copied rather than imported for the same reason as ROLES above: the compiled
 * `core/Constants.js` ships in the package but the single `"."` export entry
 * makes it unreachable.
 */
export const GAS = {
  /** RPCTransactionAdapter.ts:325, GAS.TRANSFER */
  TRANSFER: 1_200_000,
  /** Constants.ts:29, GAS.GRANT_KYC */
  GRANT_KYC: 650_000,
} as const;

/** `IKyc.KycStatus`, contracts/facets/kyc/IKyc.sol:14-17. */
export const KYC_STATUS = { NOT_GRANTED: 0, GRANTED: 1 } as const;

/**
 * the ABI fragments this file calls directly. every selector below was resolved
 * live against the deployed resolver with
 * `getFacetIdByConfigurationIdVersionAndSelector(0x..02, 1, selector)` and came
 * back non-zero, so the facet is registered on this token's configuration.
 */
const TOKEN_ABI = [
  // Kyc facet, contracts/facets/kyc/Kyc.sol:59. selector 0x81bea54d
  "function grantKyc(address account, string vcId, uint256 validFrom, uint256 validTo, address issuer) returns (bool)",
  // TransferByPartition facet, contracts/facets/transferByPartition/TransferByPartition.sol:31.
  // selector 0x3bc9bcd8. identical shape to what the SDK sends.
  "function transferByPartition(bytes32 partition, (address to, uint256 value) basicTransferInfo, bytes data) returns (bytes32)",
];

/**
 * the browser signer, checked against the account the step requires.
 *
 * every step in block B is signed by a different-looking dialog and they are
 * easy to confuse under a recording light. this refuses to build a transaction
 * against the wrong account rather than letting one land and having to explain
 * it afterwards.
 *
 * exported, because the SDK writes need the same guard. the SDK signs with
 * whatever MetaMask has selected at the moment of the call, and it repairs its
 * own account on `accountsChanged`
 * (`app/service/wallet/metamask/MetamaskService.ts:151-162`) without telling us.
 * four of the SDK steps in this file fail loudly on the wrong account, with
 * `AccountHasNoRole`, and cost one take. `attemptTransfer` does not: signed by
 * the note holder it becomes a holder-to-holder self transfer, lands, and paints
 * the permitted card green while "the same transfer now settles" is false. so
 * every write in this file reads the live signer immediately before building the
 * transaction and refuses on a mismatch.
 */
export async function requireSigner(expectedEvm: string): Promise<ethers.JsonRpcSigner> {
  const eth = (globalThis as { ethereum?: ethers.Eip1193Provider }).ethereum;
  if (!eth) {
    throw new Error(
      "no injected wallet found. open this page in a browser with MetaMask installed.",
    );
  }
  const provider = new ethers.BrowserProvider(eth);
  const signer = await provider.getSigner();
  const actual = await signer.getAddress();
  if (actual.toLowerCase() !== expectedEvm.toLowerCase()) {
    throw new Error(
      `wrong account connected. this step must be signed by ${expectedEvm}, ` +
        `the wallet is on ${actual}. switch accounts in the wallet and retry.`,
    );
  }
  return signer;
}

export interface TxResult {
  /** ethereum transaction hash. this is what hashscan takes. */
  hash: string;
  /** true when the transaction landed with status 1 */
  success: boolean;
  /** present when the transaction reverted on chain */
  revert?: DecodedRevert | null;
  /** what we know about how the hash was recovered, for the evidence trail */
  note?: string;
}

// -----------------------------------------------------------------------------
// step 1. roles
// -----------------------------------------------------------------------------

/**
 * grants the three roles block B needs, in one transaction.
 *
 * `AccessControl.applyRoles` (contracts/facets/accessControl/AccessControl.sol:90)
 * takes parallel role and active arrays and checks `getRoleAdmin(role)` against
 * the sender for each (`AccessControlStorageWrapper.sol:178`). the issuer holds
 * DEFAULT_ADMIN_ROLE, which is the admin of all three, so one signature covers
 * all of them.
 *
 * - SSI_MANAGER, because `addIssuer` carries `onlyRole(ROLE_SSI_MANAGER)`
 *   (SsiManagement.sol:56)
 * - KYC, because `grantKyc` carries `onlyRole(ROLE_KYC)` (Kyc.sol:72)
 * - ISSUER, because `issue` carries
 *   `onlyAnyRole(_buildRoles(ROLE_ISSUER, ROLE_AGENT))` (Mint.sol:45)
 *
 * `applyRoles` skips a role the account already has
 * (`AccessControlStorageWrapper.sol:179`), so running this twice is harmless.
 */
export async function grantComplianceRoles(
  securityId: string,
  targetId: string,
  expectedSignerEvm: string,
): Promise<{ transactionId: string }> {
  await requireSigner(expectedSignerEvm);
  const { Role, ApplyRolesRequest } = await loadSdk();
  const roles = [ROLES.SSI_MANAGER, ROLES.KYC, ROLES.ISSUER];
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

// -----------------------------------------------------------------------------
// step 2. register the credential issuer
// -----------------------------------------------------------------------------

/**
 * registers an address as an accepted credential issuer on this security.
 *
 * this is not optional decoration. `KycStorageWrapper.getKycStatusFor`
 * (contracts/domain/core/KycStorageWrapper.sol:121-141) reads the stored KYC
 * record and returns NOT_GRANTED at line 126 if
 * `SsiManagementStorageWrapper.isIssuer(kycFor.issuer)` is false. so a KYC
 * record whose issuer is not on this list reads as not granted no matter what
 * status was written. `Kyc.grantKyc` also carries `onlyValidIssuer(_issuer)`
 * (Kyc.sol:75), so the grant itself would revert with
 * `AccountIsNotIssuer(address)` first.
 *
 * the deployed token reports `getIssuerListCount() == 0`, so this has not been
 * done yet.
 */
export async function addCredentialIssuer(
  securityId: string,
  issuerId: string,
  expectedSignerEvm: string,
): Promise<{ transactionId: string }> {
  await requireSigner(expectedSignerEvm);
  const { SsiManagement, AddIssuerRequest } = await loadSdk();
  const res = await SsiManagement.addIssuer(
    new AddIssuerRequest({ securityId, issuerId }),
  );
  return { transactionId: res.transactionId };
}

// -----------------------------------------------------------------------------
// step 3. the KYC grant
// -----------------------------------------------------------------------------

export interface GrantKycOptions {
  /**
   * the credential reference stored on chain alongside the grant. this is a
   * reference string, not a credential: nothing on chain verifies it, and we do
   * not claim to have issued a verifiable credential. see the header note.
   */
  vcId?: string;
  /** seconds. how long the grant stays valid from now. */
  validForSeconds?: number;
}

/**
 * grants internal KYC to an account, straight to the deployed facet.
 *
 * `Kyc.grantKyc` (contracts/facets/kyc/Kyc.sol:59-81) requires:
 * - `onlyRole(ROLE_KYC)` on the sender, granted in step 1
 * - a non-zero account
 * - `onlyValidKycStatus(NOT_GRANTED, account)`, so it refuses a second grant
 * - `onlyThreeValidDates(validFrom, validTo, now)`, which is
 *   `validFrom <= validTo && validTo >= now` (`DatesValidation.sol:17-19`)
 * - `onlyValidIssuer(issuer)`, satisfied by step 2
 *
 * `validFrom` is set one minute in the past. `getKycStatusFor` compares against
 * the block timestamp (`KycStorageWrapper.sol:125`) and a grant timestamped at
 * the exact moment of signing can land a second on the wrong side of it.
 */
export async function grantInternalKyc(
  cfg: CovenantConfig,
  tokenEvm: string,
  accountEvm: string,
  opts: GrantKycOptions = {},
  onHash?: (hash: string) => void,
): Promise<TxResult> {
  const signer = await requireSigner(cfg.accounts.issuer.evm);
  const token = new ethers.Contract(toEvmAddress(tokenEvm), TOKEN_ABI, signer);

  const now = Math.floor(Date.now() / 1000);
  const validFrom = now - 60;
  const validTo = now + (opts.validForSeconds ?? 10 * 365 * 24 * 60 * 60);
  const vcId = opts.vcId ?? `covenant-testnet-kyc-${accountEvm.slice(2, 10)}`;

  const tx = await token.grantKyc(
    toEvmAddress(accountEvm),
    vcId,
    validFrom,
    validTo,
    cfg.accounts.issuer.evm,
    { gasLimit: GAS.GRANT_KYC },
  );
  // the hash exists the moment the wallet submits. the receipt is ten to thirty
  // seconds behind it on this network, and a HashScan link on screen during
  // those seconds is the difference between a step that looks alive and one that
  // reads "waiting" through the whole shot.
  onHash?.(tx.hash);
  const receipt = await tx.wait();
  return { hash: tx.hash, success: receipt?.status === 1 };
}

// -----------------------------------------------------------------------------
// step 4. put notes in the issuer's hands
// -----------------------------------------------------------------------------

/**
 * issues notes to an account.
 *
 * the note was deployed with a max supply but **no supply**: `totalSupply()`
 * reads 0 on the deployed token. `Factory.deployBond` writes the cap, it does
 * not mint. so there is nothing to transfer until this runs.
 *
 * `Mint.issue` (contracts/facets/mint/Mint.sol:34-53) carries
 * `onlyIdentifiedAddresses(address(0), _tokenHolder)`, which routes to
 * `_validateIdentifiedAccount` and the same `verifyKycStatus` the transfer
 * uses (`ERC1594StorageWrapper.sol:606-620`). **the destination of a mint must
 * be KYC-verified too**, so step 3 has to grant the issuer before this runs.
 *
 * `amount` is a decimal string in whole notes. the SDK scales by the token's
 * decimals (`IssueCommandHandler.ts:44`), which is 2 here.
 */
export async function issueNotes(
  securityId: string,
  targetId: string,
  amount: string,
  expectedSignerEvm: string,
): Promise<{ transactionId: string }> {
  await requireSigner(expectedSignerEvm);
  const { Security, IssueRequest } = await loadSdk();
  const res = await Security.issue(
    new IssueRequest({ securityId, targetId, amount }),
  );
  return { transactionId: res.transactionId };
}

// -----------------------------------------------------------------------------
// step 5. the transfer the SDK refuses to submit
// -----------------------------------------------------------------------------

export interface BlockedTransferEvidence {
  /** true when the SDK refused. false means it went through, which is a problem */
  blocked: boolean;
  /** the SDK error class name, e.g. TransferCommandError */
  errorName: string;
  /** the SDK error message chain */
  errorMessage: string;
  /** set when the transfer was not blocked */
  transactionId?: string;
}

/**
 * calls the SDK's transfer and reports what came back.
 *
 * `TransferCommandHandler.execute` runs
 * `validationService.checkCanTransfer(...)` at line 42, **before**
 * `handler.transfer(...)` at line 46. `checkCanTransfer`
 * (`ValidationService.ts:180-203`) issues a `CanTransferByPartitionQuery`, which
 * is an eth_call, and throws if the returned status byte is not `0x01`. so on a
 * KYC failure nothing is ever submitted and there is no transaction to look up.
 * the console pairs this thrown error with the eth_call in
 * `readTransferPreflight` so the claim rests on the token's own answer and not
 * on a JavaScript exception.
 */
export async function attemptTransfer(
  securityId: string,
  targetId: string,
  amount: string,
  expectedSignerEvm: string,
): Promise<BlockedTransferEvidence> {
  // the sender is whatever MetaMask has selected, and the SDK never says so.
  // `readTransferPreflight` asks the token about a fixed pair of accounts, so a
  // wrong connected account would put a preflight for one transfer beside a
  // refusal from another and call the pair evidence. refuse first.
  await requireSigner(expectedSignerEvm);
  const { Security, TransferRequest } = await loadSdk();
  try {
    const res = await Security.transfer(
      new TransferRequest({ securityId, targetId, amount }),
    );
    return {
      blocked: false,
      errorName: "",
      errorMessage: "",
      transactionId: res.transactionId,
    };
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    const chain: string[] = [];
    let cur: unknown = err;
    while (cur instanceof Error) {
      chain.push(`${cur.name}: ${cur.message}`);
      cur = (cur as { cause?: unknown }).cause;
    }
    return {
      blocked: true,
      errorName: err.name ?? "Error",
      errorMessage: chain.join("\n  caused by ") || String(e),
    };
  }
}

// -----------------------------------------------------------------------------
// step 6. the same transfer, forced past the client-side check
// -----------------------------------------------------------------------------

/**
 * sends the transfer the SDK would not send, so the refusal is on chain.
 *
 * "the token rejected it" is the claim. a client-side exception does not prove
 * it, because the exception was thrown by our own JavaScript. this builds the
 * identical calldata the SDK builds
 * (`RPCTransactionAdapter.ts:317-326`: `transferByPartition(_PARTITION_ID_1,
 * {to, value}, "0x")` at `GAS.TRANSFER`), supplies the gas limit explicitly so
 * ethers does not call `estimateGas` and refuse locally, and lets it revert on
 * chain.
 *
 * the hedera JSON-RPC relay does not always hand a reverting transaction back as
 * a clean hash, so the hash is recovered from three places in order: the ethers
 * response, the ethers error, and finally the mirror node's own record of the
 * sender's recent contract results. it does exist on chain either way, and the
 * mirror node is the authority on that, not the relay's error shape.
 */
export async function forceTransferOnChain(
  cfg: CovenantConfig,
  tokenEvm: string,
  fromEvm: string,
  toEvm: string,
  amount: string,
  decimals: number,
  onHash?: (hash: string) => void,
): Promise<TxResult> {
  const signer = await requireSigner(fromEvm);
  const tokenAddress = toEvmAddress(tokenEvm);
  const iface = new ethers.Interface(TOKEN_ABI);
  const value = ethers.parseUnits(amount, decimals);
  const data = iface.encodeFunctionData("transferByPartition", [
    PARTITION_1,
    { to: toEvmAddress(toEvm), value },
    "0x",
  ]);

  const submittedAt = Math.floor(Date.now() / 1000) - 5;
  let hash: string | null = null;
  let note = "hash returned by the relay";

  try {
    const tx = await signer.sendTransaction({
      to: tokenAddress,
      data,
      gasLimit: GAS.TRANSFER,
    });
    hash = tx.hash;
    onHash?.(hash);
    const receipt = await tx.wait();
    if (receipt?.status === 1) {
      return {
        hash,
        success: true,
        note: "the transfer succeeded. it was not blocked.",
      };
    }
  } catch (e) {
    hash = hash ?? extractHash(e);
    if (hash) note = "hash recovered from the relay error";
  }

  if (!hash) {
    const found = await findRecentResult(cfg, fromEvm, tokenAddress, submittedAt);
    if (found) {
      hash = found;
      note = "hash recovered from the mirror node by sender and timestamp";
    }
  }

  if (!hash) {
    throw new Error(
      "the transaction was rejected before it reached the network, so there is " +
        "nothing on chain to point at. do not claim an on-chain refusal from this.",
    );
  }

  const result = await readContractResult(cfg, hash);
  return {
    hash,
    success: result?.status === "0x1",
    revert: decodeRevert(result?.errorMessage),
    note: result?.result ? `${result.result}, ${note}` : note,
  };
}

/**
 * digs a transaction hash out of whatever shape the relay threw.
 *
 * ethers, the hedera relay and MetaMask each nest the underlying error
 * differently, and on a reverting call the hash can appear on the receipt, on
 * the error's `transaction`, or only inside the message text. this walks the
 * likely keys and falls back to the first 32-byte hex string it finds.
 *
 * exported because block E needs the same recovery. the SDK's
 * `manageResponse` reads a hash only from `error.transactionHash`
 * (`port/out/response/RPCTransactionResponseAdapter.ts:36`), which ethers often
 * does not set, so a reverted hold would otherwise reach the console as an
 * exception with no HashScan link.
 */
export function extractHash(e: unknown): string | null {
  const KEYS = [
    "hash",
    "transactionHash",
    "receipt",
    "transaction",
    "info",
    "error",
    "data",
    "message",
    "shortMessage",
  ];
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): string | null => {
    if (v === null || v === undefined || depth > 6) return null;
    if (typeof v === "string") {
      const m = v.match(/0x[0-9a-fA-F]{64}/);
      return m ? m[0] : null;
    }
    if (typeof v !== "object" || seen.has(v)) return null;
    seen.add(v);
    for (const key of KEYS) {
      const found = walk((v as Record<string, unknown>)[key], depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(e, 0);
}

interface ContractResult {
  /** `0x1` succeeded, `0x0` reverted */
  status: string;
  /** the consensus node's own verdict, e.g. `CONTRACT_REVERT_EXECUTED` */
  result: string;
  /** raw revert data on a reverted call. confirmed shape against the B8 record. */
  errorMessage: string | null;
  consensusTimestamp: string;
}

/**
 * the mirror node's record of one contract call.
 * `error_message` on a reverted call is the raw revert data, which is what
 * `decodeRevert` reads.
 */
export async function readContractResult(
  cfg: CovenantConfig,
  hash: string,
): Promise<ContractResult | null> {
  const base = cfg.mirrorNode.replace(/\/$/, "");
  // the mirror node lags the relay by a second or two on a fresh transaction
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(`${base}/contracts/results/${hash}`);
    if (res.ok) {
      const body = (await res.json()) as {
        status?: string;
        result?: string;
        error_message?: string | null;
        consensus_timestamp?: string;
      };
      return {
        status: body.status ?? "",
        result: body.result ?? "",
        errorMessage: body.error_message ?? null,
        consensusTimestamp: body.consensus_timestamp ?? "",
      };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export async function findRecentResult(
  cfg: CovenantConfig,
  fromEvm: string,
  tokenEvm: string,
  sinceSeconds: number,
): Promise<string | null> {
  const base = cfg.mirrorNode.replace(/\/$/, "");
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(
      `${base}/contracts/results?from=${fromEvm.toLowerCase()}&order=desc&limit=10&timestamp=gte:${sinceSeconds}`,
    );
    if (res.ok) {
      const body = (await res.json()) as {
        results?: { hash?: string; to?: string }[];
      };
      const hit = body.results?.find(
        (r) => (r.to ?? "").toLowerCase() === tokenEvm.toLowerCase() && r.hash,
      );
      if (hit?.hash) return hit.hash;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}
