"use client";

// covenant. the ATS SDK bootstrap and the issuance call.
//
// the SDK is imported dynamically inside each function rather than at module
// scope. it reaches for `globalThis.window.ethereum` during wallet setup
// (`app/service/wallet/metamask/MetamaskService.ts:150`) and pulls in dotenv and
// winston, none of which survive being evaluated on the server during prerender.
//
// there is no private key anywhere in this path. every transaction is signed by
// a human clicking the browser wallet. see DECISIONS.md D3.

import type { CovenantConfig } from "@/lib/config";
import { buildBondTerms, type BondTerms } from "@/lib/ats/note-terms";

type Sdk = typeof import("@hashgraph/asset-tokenization-sdk");

let sdkPromise: Promise<Sdk> | null = null;

function loadSdk(): Promise<Sdk> {
  if (!sdkPromise) {
    sdkPromise = import("@hashgraph/asset-tokenization-sdk");
  }
  return sdkPromise;
}

export interface ConnectResult {
  accountId: string;
  evmAddress: string;
  network: string;
  factoryAddress: string;
  resolverAddress: string;
}

let initialised = false;

/**
 * `Network.init` registers the transaction adapters and seeds the per-environment
 * factory, resolver, mirror node and rpc tables.
 *
 * the per-environment tables are not optional decoration. when the wallet pairs,
 * `MetamaskService.setMetamaskNetwork`
 * (`app/service/wallet/metamask/MetamaskService.ts:200-220`) re-derives the
 * configuration from those tables and issues its own `SetConfigurationCommand`,
 * overwriting whatever `InitializationRequest.configuration` set. pass only
 * `configuration` and the factory and resolver addresses are silently reset to
 * the empty string the moment the wallet connects, and issuance then fails with
 * "Factory not found in request" from
 * `CreateBondKpiLinkedRateCommandHandler.ts:68` rather than anything pointing at
 * the wallet.
 */
export async function initSdk(cfg: CovenantConfig): Promise<void> {
  if (initialised) return;
  const { Network, InitializationRequest } = await loadSdk();

  const mirrorNode = { baseUrl: cfg.mirrorNode, apiKey: "", headerName: "" };
  const rpcNode = { baseUrl: cfg.rpcNode, apiKey: "", headerName: "" };

  // `Network.init` iterates every registered adapter and awaits `init()` on each
  // (`port/in/network/Network.ts:130-152`). `Injectable.registerTransactionAdapterInstances`
  // (`core/injectable/Injectable.ts:91-105`) always registers the walletconnect
  // adapter and the three custodial adapters alongside the RPC one, so an
  // adapter we do not use can reject and take the whole call down with it. the
  // RPC adapter is first in that list and its `setConfig` runs immediately
  // after its own `init`, so by the time a later adapter fails, the values we
  // care about are already in place. the ATS reference application swallows
  // this the same way (`apps/ats/web/src/services/SDKService.ts:299-306`).
  //
  // we do not swallow it blindly: the configuration is read back below and a
  // genuine misconfiguration still throws.
  let initError: unknown = null;
  try {
    await Network.init(
      new InitializationRequest({
        network: cfg.network,
        mirrorNode,
        rpcNode,
        configuration: {
          factoryAddress: cfg.factoryId,
          resolverAddress: cfg.resolverId,
        },
        mirrorNodes: { nodes: [{ mirrorNode, environment: cfg.network }] },
        jsonRpcRelays: {
          nodes: [{ jsonRpcRelay: rpcNode, environment: cfg.network }],
        },
        factories: {
          factories: [{ factory: cfg.factoryId, environment: cfg.network }],
        },
        resolvers: {
          resolvers: [{ resolver: cfg.resolverId, environment: cfg.network }],
        },
      }),
    );
  } catch (e) {
    initError = e;
  }

  const factory = Network.getFactoryAddress();
  const resolver = Network.getResolverAddress();
  if (!factory || !resolver) {
    throw new Error(
      `Network.init did not leave a factory and resolver configured (factory "${factory}", resolver "${resolver}").` +
        (initError ? ` underlying error: ${String(initError)}` : ""),
    );
  }

  initialised = true;
}

/**
 * opens the browser wallet and returns whichever account it is pointed at.
 *
 * `MetamaskService.connectMetamask` (`:96-115`) hard-checks
 * `ethProvider.isMetaMask`, so any wallet reporting that flag works. rabby is
 * confirmed reporting it.
 */
export async function connectWallet(
  cfg: CovenantConfig,
): Promise<ConnectResult> {
  const { Network, ConnectRequest, SupportedWallets } = await loadSdk();

  await initSdk(cfg);

  const init = await Network.connect(
    new ConnectRequest({
      network: cfg.network,
      mirrorNode: { baseUrl: cfg.mirrorNode, apiKey: "", headerName: "" },
      rpcNode: { baseUrl: cfg.rpcNode, apiKey: "", headerName: "" },
      wallet: SupportedWallets.METAMASK,
    }),
  );

  return {
    accountId: init.account?.id?.toString() ?? "",
    evmAddress: init.account?.evmAddress ?? "",
    network: Network.getNetwork(),
    factoryAddress: Network.getFactoryAddress(),
    resolverAddress: Network.getResolverAddress(),
  };
}

export interface IssueResult {
  transactionId: string;
  securityId: string;
  securityEvmAddress: string;
  terms: BondTerms;
  /** flags read back off chain by the SDK's post-create `GetSecurityQuery` */
  onChain: {
    name?: string;
    symbol?: string;
    isin?: string;
    decimals?: number;
    clearingActive?: boolean;
    internalKycActivated?: boolean;
    isControllable?: boolean;
    isMultiPartition?: boolean;
    maxSupply?: string;
  };
}

/**
 * `Bond.createKpiLinkedRate` declares its `security` field as `SecurityViewModel`
 * (`port/in/bond/Bond.ts:228`), whose fields are all strings and primitives. what
 * it actually returns is the domain `Security` object spread verbatim
 * (`Bond.ts:296-303`, `{ ...res }` where `res` came straight from
 * `GetSecurityQuery`). in that object `diamondAddress` is a `HederaId` instance,
 * `evmDiamondAddress` is an `EvmAddress` instance and `maxSupply` is a
 * `BigDecimal` (`port/out/rpc/RPCQueryAdapter.ts:250-253`). the declared type and
 * the runtime value disagree, so anything that trusts the type and renders these
 * directly gets "[object Object]".
 */
function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return String(v);
}

/**
 * issues the note.
 *
 * this calls `Bond.create` (`port/in/bond/Bond.ts:87`), which reaches
 * `Factory.deployBond`. it does NOT call `Bond.createKpiLinkedRate`, which is
 * dead against any real deployment: see the F8 note at the top of
 * `lib/ats/note-terms.ts`.
 *
 * `Bond.create` carries exactly the same four undocumented requirements as the
 * KPI variant, all handled in `buildBondTerms`: `regulationType` and
 * `regulationSubType` are marked optional but throw `MissingRegulationType` /
 * `MissingRegulationSubType` at `CreateBondCommandHandler.ts:76-81`;
 * `diamondOwnerAccount` is optional but non-null asserted at `:83-85`; and
 * `proceedRecipientsData` defaults to `[]` in the adapter while the recipients
 * array has entries.
 */
export async function issueNote(cfg: CovenantConfig): Promise<IssueResult> {
  const { Bond, CreateBondRequest } = await loadSdk();

  const terms = buildBondTerms(cfg);
  const res = await Bond.create(new CreateBondRequest(terms));

  const security = (res.security ?? {}) as Record<string, unknown>;

  return {
    transactionId: res.transactionId,
    // `Bond.ts:293-303` returns an empty object for `security` when the factory
    // returned the null contract id, so an empty securityId here means the
    // deployment did not produce an address, not that the read failed.
    securityId: asString(security.diamondAddress),
    securityEvmAddress: asString(security.evmDiamondAddress),
    terms,
    // read straight back off chain by the SDK's own post-create GetSecurityQuery
    // (`port/out/rpc/RPCQueryAdapter.ts:215-254`). this is the block A gate
    // evidence: the flags as the token reports them, not as we sent them.
    onChain: {
      name: security.name as string | undefined,
      symbol: security.symbol as string | undefined,
      isin: security.isin as string | undefined,
      decimals: security.decimals as number | undefined,
      clearingActive: security.clearingActive as boolean | undefined,
      internalKycActivated: security.internalKycActivated as boolean | undefined,
      isControllable: security.isControllable as boolean | undefined,
      isMultiPartition: security.isMultiPartition as boolean | undefined,
      maxSupply: security.maxSupply === undefined ? undefined : asString(security.maxSupply),
    },
  };
}
