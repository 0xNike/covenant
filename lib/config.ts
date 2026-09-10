// covenant. runtime configuration, read from NEXT_PUBLIC_ vars.
//
// next inlines process.env.NEXT_PUBLIC_* at build time only when the property is
// referenced literally, so every read below is written out in full. do not
// refactor these into a dynamic lookup, they will become undefined in the browser.
// see DECISIONS.md D8.
//
// nothing in this file is a secret. there is no private key anywhere in this
// project and there never will be. see DECISIONS.md D3.

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `missing configuration: ${name}. copy .env.example to .env.local and restart the dev server.`,
    );
  }
  return value.trim();
}

function optionalInt(value: string | undefined): number | undefined {
  if (!value || value.trim() === "") return undefined;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isNaN(n) ? undefined : n;
}

export interface CovenantConfig {
  network: string;
  mirrorNode: string;
  rpcNode: string;
  hashscanBase: string;
  resolverId: string;
  factoryId: string;
  kpiLinkedRateConfigId: string;
  /** undefined means "resolve the latest registered version at submit time" */
  kpiLinkedRateConfigVersion: number | undefined;
  /**
   * bond variable rate config. this is the config the deployed factory can
   * actually deploy, see lib/ats/note-terms.ts. it was originally kept only to
   * document what we deliberately did not issue against.
   */
  variableRateConfigId: string;
  accounts: {
    issuer: { id: string; evm: string };
    holder: { id: string; evm: string };
    lender: { id: string; evm: string };
    engine: { id: string; evm: string };
  };
}

export function readConfig(): CovenantConfig {
  return {
    network: required("NEXT_PUBLIC_NETWORK", process.env.NEXT_PUBLIC_NETWORK),
    mirrorNode: required(
      "NEXT_PUBLIC_MIRROR_NODE",
      process.env.NEXT_PUBLIC_MIRROR_NODE,
    ),
    rpcNode: required("NEXT_PUBLIC_RPC_NODE", process.env.NEXT_PUBLIC_RPC_NODE),
    hashscanBase: required(
      "NEXT_PUBLIC_HASHSCAN_BASE",
      process.env.NEXT_PUBLIC_HASHSCAN_BASE,
    ),
    resolverId: required(
      "NEXT_PUBLIC_RPC_RESOLVER",
      process.env.NEXT_PUBLIC_RPC_RESOLVER,
    ),
    factoryId: required(
      "NEXT_PUBLIC_RPC_FACTORY",
      process.env.NEXT_PUBLIC_RPC_FACTORY,
    ),
    // config 4, the KPI-linked rate config. never config 2. see DECISIONS.md D10.
    kpiLinkedRateConfigId: required(
      "NEXT_PUBLIC_BOND_KPI_LINKED_RATE_CONFIG_ID",
      process.env.NEXT_PUBLIC_BOND_KPI_LINKED_RATE_CONFIG_ID,
    ),
    kpiLinkedRateConfigVersion: optionalInt(
      process.env.NEXT_PUBLIC_BOND_KPI_LINKED_RATE_CONFIG_VERSION,
    ),
    variableRateConfigId: required(
      "NEXT_PUBLIC_BOND_VARIABLE_RATE_CONFIG_ID",
      process.env.NEXT_PUBLIC_BOND_VARIABLE_RATE_CONFIG_ID,
    ),
    accounts: {
      issuer: {
        id: required(
          "NEXT_PUBLIC_ACCOUNT_ISSUER",
          process.env.NEXT_PUBLIC_ACCOUNT_ISSUER,
        ),
        evm: required(
          "NEXT_PUBLIC_ACCOUNT_ISSUER_EVM",
          process.env.NEXT_PUBLIC_ACCOUNT_ISSUER_EVM,
        ),
      },
      holder: {
        id: required(
          "NEXT_PUBLIC_ACCOUNT_HOLDER",
          process.env.NEXT_PUBLIC_ACCOUNT_HOLDER,
        ),
        evm: required(
          "NEXT_PUBLIC_ACCOUNT_HOLDER_EVM",
          process.env.NEXT_PUBLIC_ACCOUNT_HOLDER_EVM,
        ),
      },
      lender: {
        id: required(
          "NEXT_PUBLIC_ACCOUNT_LENDER",
          process.env.NEXT_PUBLIC_ACCOUNT_LENDER,
        ),
        evm: required(
          "NEXT_PUBLIC_ACCOUNT_LENDER_EVM",
          process.env.NEXT_PUBLIC_ACCOUNT_LENDER_EVM,
        ),
      },
      engine: {
        id: required(
          "NEXT_PUBLIC_ACCOUNT_ENGINE",
          process.env.NEXT_PUBLIC_ACCOUNT_ENGINE,
        ),
        evm: required(
          "NEXT_PUBLIC_ACCOUNT_ENGINE_EVM",
          process.env.NEXT_PUBLIC_ACCOUNT_ENGINE_EVM,
        ),
      },
    },
  };
}

export function hashscanTx(cfg: CovenantConfig, transactionId: string): string {
  return `${cfg.hashscanBase.replace(/\/$/, "")}/transaction/${transactionId}`;
}

export function hashscanContract(
  cfg: CovenantConfig,
  contractId: string,
): string {
  return `${cfg.hashscanBase.replace(/\/$/, "")}/contract/${contractId}`;
}
