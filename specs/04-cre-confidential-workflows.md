# 04. CRE confidential workflows: what hercules needs before the timebox opens

sources for this file, in the order actually used:

1. `@chainlink/cre-sdk@1.18.0` npm tarball, unpacked, shipped `.d.ts` files — ground truth for
   the TypeScript signature. fetched with `npm pack @chainlink/cre-sdk@1.18.0`.
2. `github.com/smartcontractkit/cre-templates`, cloned shallow, actual source read (not the
   rendered docs) — `starter-templates/hello-confidential-workflows/` and
   `starter-templates/confidential-workflows/`.
3. `github.com/smartcontractkit/cre-sdk-typescript`, cloned shallow, for corroboration
   (not deeply read beyond confirming it matches the npm tarball's `.d.ts`).
4. `docs.chain.link/cre/*` pages, fetched live, cited individually below. per house rule,
   these rank below the source in (1)-(3) wherever they disagree.
5. `smartcontractkit.github.io/CRE-Confidential-bootcamp/` — fetched, thin, see §3.

no local checkout of the CRE SDK exists in this repo or in the hackathon home directory
before this session; everything here was cloned/fetched fresh into a scratch directory and is
not part of the repo.

---

## 6. hard prerequisites — read this section first, it is the one that can sink us

**answer: nothing blocks simulation today. deployment requires two separate approvals, but
neither gates simulation, and the prize explicitly accepts simulation as evidence.**

three distinct gates exist, confirmed from source and from live docs, not assumed:

1. **a free CRE account.** self-serve, no approval queue. requires email address, country,
   acceptance of ToS/privacy policy, and a 6-digit email verification code.
   [`docs.chain.link/cre/account/creating-account`](https://docs.chain.link/cre/account/creating-account).
   "an account is required to log in with the CRE CLI and run any CLI commands" — this
   includes `cre workflow simulate`, so log in first, but there is no wait.

2. **deploy access** — required only for `cre workflow deploy` (pushing a workflow to a real
   DON). explicitly **not** required for simulation:
   > "Deploy access is only required for `cre workflow deploy`. You can continue developing
   > and simulating workflows locally with `cre workflow simulate` while your request is
   > under review."
   [`docs.chain.link/cre/account/deploy-access`](https://docs.chain.link/cre/account/deploy-access).
   approval is by email review, no stated timeline.

3. **confidential workflows private beta enrollment** — separate again from (2), invite-only,
   via a Google Form
   ([link quoted by the docs page](https://docs.google.com/forms/d/e/1FAIpQLSdk8mxDZAXpEX1PHgjzCoBeKxSoQysoO9sxOb-gpBrDrjOhtA/viewform?usp=header)),
   required **to deploy** a confidential workflow, explicitly **not** required to simulate one:
   > "Your CRE organization can run Confidential Workflows using the local simulator" before
   > enrollment; "you don't need to wait for early access" to start experimenting locally.
   [`docs.chain.link/cre/account/confidential-workflows-access`](https://docs.chain.link/cre/account/confidential-workflows-access).
   the same disclaimer is baked into the template itself, not just the docs page — every
   confidential-workflow template's README carries a **"PRIVATE BETA"** banner with this exact
   wording, e.g.
   `starter-templates/hello-confidential-workflows/hello-confidential-workflows-ts/README.md:9-11`.

**conclusion for hercules: create the free CRE account and log in with the CLI before the
timebox (5 minutes, no lead time). do not bother requesting deploy access or confidential
workflows enrollment — the plan per `CLAUDE.md` §5 is CLI simulation only, and simulation
needs neither.**

other prerequisites, all confirmed, none are blockers:

- **CRE CLI**: install via `curl -sSL https://app.chain.link/cre/install.sh | bash` (macOS/
  Linux), installs to `$HOME/.cre`.
  [`docs.chain.link/cre/getting-started/cli-installation/macos-linux`](https://docs.chain.link/cre/getting-started/cli-installation/macos-linux).
  version: the CLI installation index page (fetched via web search cache, not a live fetch,
  flagged as such) names `v1.26.0` as the version the docs were written against; a direct
  live fetch of the macOS/Linux install page (same day) reports `v1.32.0` as current and
  quotes `cre version` → `CRE CLI version v1.32.0`. **these two numbers disagree** — the CLI
  ships fast and the docs pages are not internally consistent about which version they were
  last verified against. run `cre version` yourself and do not hard-code either number.
- **Bun ≥ 1.2.21** for the TypeScript path.
  [`docs.chain.link/cre/getting-started/part-1-project-setup-ts`](https://docs.chain.link/cre/getting-started/part-1-project-setup-ts).
- **no API key or paid tier found anywhere** in the docs pages fetched or the template
  source read. the hello-confidential-workflows default endpoint
  (`https://postman-echo.com/headers`) needs no signup, deliberately, per its own README:
  "no signup or real API key needed"
  (`hello-confidential-workflows-ts/README.md:79`).
- **no Node.js version requirement found** for the TypeScript path — the templates run on
  Bun, not Node; `tsc --noEmit` is the only place `typescript` (5.9.3) appears, as a
  devDependency for typechecking, not as the runtime.

what was deliberately checked and not skimmed past: the confidential-workflows-specific
access page, the general deploy-access page, and the account-creation page, each fetched
live and cross-checked against the two independent statements inside the private-beta note
appearing both in the docs and baked into the template's own `.cre/template.yaml` and
`README.md`. all three agree: **simulation is unblocked, deployment is gated behind two
separate approval processes with no stated lead time**, so this is consistent, not a single
source's claim.

---

## 1. `handlerInTee` — exact TypeScript signature, verbatim

from the shipped type declarations, `@chainlink/cre-sdk@1.18.0`, two identical copies (the
package re-exports the same declaration from two entry points):

`package/dist/sdk/workflow.d.ts:21` (also re-exported at `package/dist/sdk/cre/index.d.ts:26`,
and re-typed identically inline at `package/dist/sdk/cre/index.d.ts:45`):

```ts
export declare const handlerInTee: <
  TRawTriggerOutput extends Message<string>,
  TTriggerOutput,
  TConfig,
  TResult,
>(
  trigger: Trigger<TRawTriggerOutput, TTriggerOutput>,
  fn: HandlerFn<TConfig, TTriggerOutput, TResult, TeeRuntime<TConfig>>,
  tees: TeeConstraint,
  hooks?: Hooks<TConfig, TTriggerOutput>,
) => HandlerEntry<TConfig, TRawTriggerOutput, TTriggerOutput, TResult, TeeRuntime<TConfig>>;
```

supporting types, same file unless noted:

```ts
// workflow.d.ts:16
export type HandlerFn<TConfig, TTriggerOutput, TResult, TRuntime = Runtime<TConfig>> =
  (runtime: TRuntime, triggerOutput: TTriggerOutput) =>
    Promise<CreSerializable<TResult>> | CreSerializable<TResult>;

// workflow.d.ts:17-18
export interface Hooks<TConfig, TTriggerOutput> {
  preHook?: (config: TConfig, triggerOutput: TTriggerOutput) => RestrictionsJson;
}

// workflow.d.ts:19-24
export interface HandlerEntry<TConfig, TRawTriggerOutput extends Message<string>, TTriggerOutput, TResult, TRuntime = Runtime<TConfig>> {
  trigger: Trigger<TRawTriggerOutput, TTriggerOutput>;
  fn: HandlerFn<TConfig, TTriggerOutput, TResult, TRuntime>;
  hooks?: Hooks<TConfig, TTriggerOutput>;
  requirements?: Requirements;
}
```

`TeeConstraint`, `tee-constraints.d.ts` (zod-inferred, verbatim):

```ts
export declare const REGIONS: readonly ["us-west-2"];
export declare const NITRO_REGIONS: readonly ["us-west-2"];
// TeeConstraint = OneOfTees | AnyTeeConstraint, roughly:
//   [{ tee: 'nitro', regions?: ['us-west-2', ...] }, ...]   -- specific tee(s)
//   { regions?: ['us-west-2', ...] }                         -- any registered tee
export type TeeConstraint = z.infer<typeof teeConstraintSchema>;
export declare function buildTeeRequirements(input: TeeConstraint): Requirements;
```

**`us-west-2` is the only literal region value the zod schema accepts today**, and `'nitro'`
(AWS Nitro Enclaves) is the only literal `tee` value — both are `z.ZodLiteral`/`z.ZodEnum`
over a single option, confirmed directly in the shipped `.d.ts`, not inferred from prose.
matches what the hello-confidential-workflows README says in English: "AWS Nitro in
`us-west-2` is currently the only registered TEE type and region."

two call-site shapes are both attested in real templates, both valid, same underlying export:

```ts
// namespaced, hello-confidential-workflows-ts/my-workflow/workflow.ts:138-140
cre.handlerInTee(cronTrigger.trigger({ schedule: config.schedule }), onCronTrigger, [
  { tee: 'nitro', regions: ['us-west-2'] },
])

// named import, automated-liquidation-protection-ts/main.ts (import block + initWorkflow)
import { handlerInTee, NITRO_REGIONS, CronCapability, Runner, type TeeRuntime, type Workflow } from '@chainlink/cre-sdk'
handlerInTee(cron.trigger({ schedule: config.schedule }), onCronTrigger, {} /* any tee, any region */)
```

**the prize brief's phrasing is accurate.** the confidential-workflows starter-templates
package README states it directly, not just implied by usage:
> "The templates register their handler with the TEE variant of the handler API
> (`handlerInTee` in TypeScript, `cre.HandlerInTee` in Go)"
`cre-templates/starter-templates/confidential-workflows/README.md:27-29`.

**gotcha**: `hooks` is optional and positioned *after* `tees`, not before — get the argument
order wrong (e.g. passing hooks as the 3rd arg) and TypeScript will reject it, since `tees:
TeeConstraint` is non-optional in position 3.

---

## 2. minimum viable project structure — worked hello-world, quoted from source

full file tree of `hello-confidential-workflows-ts` (the canonical hello-world), from the
cloned template repo:

```
hello-confidential-workflows-ts/
├── .cre/template.yaml          # template metadata, not needed once the project exists
├── .env.example                 # copy to .env; holds CRE_ETH_PRIVATE_KEY, CRE_TARGET, SECRET_API_TOKEN
├── .gitignore
├── README.md
├── project.yaml                 # CRE project settings — target RPCs (staging-settings / production-settings)
├── secrets.yaml                 # maps workflow-facing secret ID -> env var name
└── my-workflow/
    ├── config.production.json
    ├── config.staging.json      # the config the workflow reads at runtime
    ├── main.ts                  # entry point
    ├── package.json
    ├── tsconfig.json
    ├── workflow.test.ts
    ├── workflow.ts               # handler + TEE logic
    └── workflow.yaml             # per-target workflow-artifacts mapping (path to main.ts/config/secrets)
```

`my-workflow/package.json`, verbatim:

```json
{
  "name": "hello-confidential-workflows-workflow",
  "version": "1.0.0",
  "main": "dist/main.js",
  "private": true,
  "scripts": { "typecheck": "tsc --noEmit" },
  "license": "UNLICENSED",
  "dependencies": {
    "@chainlink/cre-sdk": "1.18.0",
    "viem": "2.34.0",
    "zod": "3.25.76"
  },
  "devDependencies": { "typescript": "5.9.3" }
}
```

`my-workflow/main.ts`, entry point, verbatim, all of it:

```ts
import { Runner } from '@chainlink/cre-sdk'
import { configSchema, initWorkflow } from './workflow'

export async function main() {
  const runner = await Runner.newRunner({ configSchema })
  await runner.run(initWorkflow)
}

main()
```

`Runner.newRunner` signature, `package/dist/sdk/wasm/runner.d.ts`:

```ts
export declare class Runner<TConfig> extends RunnerBase<TConfig> {
  private constructor();
  static newRunner<TConfig, TIntermediateConfig = TConfig>(
    configHandlerParams?: ConfigHandlerParams<TConfig, TIntermediateConfig>,
  ): Promise<Runner<TConfig>>;
}
```

two call patterns both appear in real templates and both compile: `Runner.newRunner({
configSchema })` with a zod schema (hello-confidential-workflows-ts), and bare
`Runner.newRunner<Config>()` with no schema, relying only on the TS generic
(automated-liquidation-protection-ts/main.ts). the zod form gets you runtime validation of
`config.staging.json` for free; the bare generic form does not validate at runtime, only at
compile time.

`secrets.yaml`, verbatim:

```yaml
secretsNames:
    API_TOKEN:
        - SECRET_API_TOKEN
```

`my-workflow/config.staging.json`, verbatim (this is what `runtime.config` resolves to):

```json
{
  "schedule": "0 */1 * * * *",
  "url": "https://postman-echo.com/headers",
  "secretId": "API_TOKEN",
  "scoreThreshold": 500
}
```

`project.yaml`, verbatim (RPC targets; only relevant once you cross back to the DON and want
to write on-chain — see §7):

```yaml
staging-settings:
  rpcs:
    - chain-name: ethereum-testnet-sepolia
      url: https://ethereum-sepolia-rpc.publicnode.com
production-settings:
  rpcs:
    - chain-name: ethereum-testnet-sepolia
      url: https://ethereum-sepolia-rpc.publicnode.com
    - chain-name: ethereum-mainnet
      url: https://ethereum-rpc.publicnode.com
```

setup commands, quoted from `hello-confidential-workflows-ts/README.md`:

```bash
cd my-workflow && bun install && cd ..
cp .env.example .env        # then set SECRET_API_TOKEN
cd my-workflow && bun test
cre workflow simulate my-workflow --target staging-settings --non-interactive --trigger-index 0
```

---

## 3. TypeScript versus Go — decided, TS is the answer. this is a warning, not a survey.

per updated instruction: not comparing further, only flagging where TS is rougher than Go
(or vice versa) if it genuinely is. **finding: if anything, the Go side is the less mature
one right now, not TypeScript.** two pieces of direct source evidence, both contradicting
each other slightly, which is itself worth flagging:

- `hello-confidential-workflows-go/go.mod:1-12` (comment above the `require` block):
  > "cre-sdk-go is pinned to the v1.18.0 tag, which includes Confidential Workflows
  > (cre.HandlerInTee / cre.TeeRuntime). The capabilities/networking/http and
  > capabilities/scheduler/cron submodules have not had a tagged release since v1.18.0
  > shipped, so they're pinned via pseudo-version to the same commit."
  the actual `require` block pins those two submodules to git-commit pseudo-versions
  (`v1.4.1-0.20260806122424-24d22c8dc5bd`, `v1.3.1-0.20260806122424-24d22c8dc5bd`), not
  release tags.

- `starter-templates/confidential-workflows/README.md:40-44` (the sibling monorepo one level
  up, covering three more advanced templates) says something slightly different:
  > "The Go SDK versions in each `go.mod` are pseudo-versions pinned to an unreleased
  > commit, because Confidential Workflows is not yet in a tagged release."

**these two statements disagree on whether confidential workflows is in a Go tagged release
at all** — the hello-world go.mod comment says v1.18.0 (tagged) includes it; the
confidential-workflows README says it isn't tagged yet. both are quoted verbatim above so
hercules can judge; not resolved further since we are not building in Go. the TypeScript
side has no equivalent pseudo-version pinning anywhere found — `package.json` for every TS
template pins to a released semver (`@chainlink/cre-sdk: 1.18.0`, `viem: 2.34.0`, `zod:
3.25.76`), confirmed by reading every TS template's `package.json` in the clone.

conclusion for hercules: no evidence TS is the thinner SDK. the one asymmetry found points
the other way — Go's confidential-workflow-specific submodules are pinned to unreleased
commits, not tags. the CRE-Confidential-bootcamp site
([`smartcontractkit.github.io/CRE-Confidential-bootcamp/`](https://smartcontractkit.github.io/CRE-Confidential-bootcamp/))
was fetched and does not state a language preference or compare the two; it only covers
environment setup, so it gave nothing further on this question.

---

## 4. what "processes at least one sensitive input inside the enclave" means in practice

boundary, quoted directly from `hello-confidential-workflows-ts/README.md`'s confidentiality
table (`:171-181`), reproduced verbatim:

| protected by default | **not** automatically protected |
|---|---|
| secrets the Vault DON releases into the enclave | triggers, chain reads, and chain writes — always run on Workflow DON nodes |
| request and response payloads of HTTP calls made *from the enclave* | the workflow's source code and deployed binary, **including the logic executed in the enclave** |
| sensitive inputs and intermediate values you don't share outside the enclave | capability calls not routed through the enclave |
| enclave execution memory, while your computation runs | reports, calldata, and any output you deliver outside the enclave |

the load-bearing sentence, same README, near-verbatim: **"the logic is not confidential —
the data is."** the compiled workflow binary (including your `scoreResponse`/decision
function) is handed to the enclave by the Workflow DON and is visible as part of that binary.
what the enclave hides is the *data* the logic reads: Vault DON secrets, the request/response
bytes of HTTP calls issued via `HTTPClient.sendRequest(teeRuntime, ...)`, and any intermediate
value you don't explicitly cross out.

mechanically, from `workflow.ts:48-121` (`hello-confidential-workflows-ts`) and mirrored in
`automated-liquidation-protection-ts/main.ts`:

1. a trigger fires on the Workflow DON (cron, log, etc — this part is never confidential).
2. the DON hands the callback to an attested enclave; the callback receives a `TeeRuntime<C>`
   instead of a plain `Runtime<C>`.
3. inside: `runtime.getSecret({ id })` / `runtime.getSecrets([...])` — Vault DON decrypts the
   secret only inside the attested enclave, `SecretsProvider` interface,
   `workflow.d.ts:22-28`.
4. inside: `new cre.capabilities.HTTPClient().sendRequest(runtime, req)` — passing the
   `TeeRuntime` (not a plain `Runtime`) routes the call through the enclave, keeping request
   and response payloads confidential from node operators. the README calls out explicitly:
   *do not* use `ConfidentialHTTPClient` here, it has no `TeeRuntime` overload and is "not
   meant to be called from a TEE handler."
5. your decision logic runs over that data, inside the enclave, still on `TeeRuntime`.
6. `const donRuntime = runtime.usingTheDons()` — a one-way door, `TeeRuntime<C>` →
   `Runtime<C>`, `runtime.d.ts:36-51`. anything you pass into a capability call on
   `donRuntime` from this point on executes on ordinary Workflow DON nodes and is **no longer
   confidential**. the README's rule: cross over only the verdict/score, never the secret or
   raw payload.
7. `donRuntime.report({ encodedPayload, encoderName: 'evm', signingAlgo: 'ecdsa',
   hashingAlgo: 'keccak256' }).result()` — the DON reaches consensus over the enclave's
   *attestation* (proof the claimed enclave logic actually ran) and signs a report over
   whatever payload you handed it.

**mapped to our case** (borrower revenue, EBITDA, leverage in; covenant verdict, KPI value,
haircut out): the three financial inputs would be fetched inside the enclave — either via
`runtime.getSecret()` if pre-provisioned as Vault DON secrets, or via
`HTTPClient.sendRequest(teeRuntime, ...)` if fetched live from an API — computed over inside
the TEE handler, and only the verdict/KPI/haircut numbers would cross `usingTheDons()`. what
is genuinely hidden, and from whom: the raw revenue/EBITDA/leverage figures and any Vault DON
secret used to fetch them are hidden from Workflow DON **node operators** specifically —
never logged, never in the report payload, never in plaintext DON memory. what is **not**
hidden, confirmed above: the covenant logic/thresholds themselves, since they live in the
compiled binary the DON hands to the enclave.

---

## 5. the CRE CLI simulation — command, output, evidence artifact

command, quoted verbatim from `hello-confidential-workflows-ts/README.md:120`:

```bash
cre workflow simulate my-workflow --target staging-settings --non-interactive --trigger-index 0
```

full expected output, quoted verbatim from the same README (`:123-140`):

```
2026-01-01T00:00:00Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
╭────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Trigger requested TEE Execution your trigger will run in one of the following Tees:                │
│     - AWS Nitro in us-west-2                                                                       │
│ The simulator is not a real TEE, and is meant to debug.                                            │
│ Do not use it for sensitive information.                                                           │
│ During real execution, user logs for this trigger will not be visible, and will not leave the TEE. │
│ They are presented in the simulator for debugging only.                                            │
╰────────────────────────────────────────────────────────────────────────────────────────────────────╯

2026-01-01T00:00:00Z [USER LOG] Enclave computation complete. verdict=REJECT

✓ Workflow Simulation Result:
"REJECT (score: 371, secret reached API: true)"
```

a second, independently-fetched example (plain helloworld template, not confidential, but
confirms the general simulate output shape) from
[`docs.chain.link/cre/getting-started/part-1-project-setup-ts`](https://docs.chain.link/cre/getting-started/part-1-project-setup-ts):

```
Workflow compiled
2025-11-03T19:04:21Z [SIMULATION] Simulator Initialized
2025-11-03T19:04:21Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
2025-11-03T19:04:21Z [USER LOG] Hello world! Workflow triggered.

Workflow Simulation Result:
 "Hello world!"
```

**what constitutes the evidence artifact**: the simulator prints an explicit disclosure block
naming the resolved TEE type/region it would run in ("AWS Nitro in us-west-2") and a
one-line warning that this is not a real enclave — capture that box on screen, it is the
thing that proves `handlerInTee` actually registered and resolved a TEE constraint rather
than falling back to a plain handler. capture the `[USER LOG]` line(s), since those are
explicitly simulator-only per the box's own text ("user logs for this trigger will not be
visible" in real execution) — this is the one place the README explicitly tells you logging
inside the enclave is normal for debugging and must be removed before any real deploy
(`README.md:186,209-210`). capture the final `Workflow Simulation Result:` line, since that's
the value that crossed `usingTheDons()`.

for our video: terminal capture (screen recording, not a screenshot, since the box and the
final result both matter) of `cre workflow simulate` running against our workflow, showing
the TEE-resolution box, the enclave log line stating our verdict/KPI/haircut computation
completed, and the final crossed-over result string. that is what the template's own README
treats as the artifact worth showing, and it does not require deploy access or beta
enrollment per §6.

---

## 7. path from a simulated enclave output to a Hedera transaction

**apollo is right, verified from the shipped SDK's own supported-chain constant, not from
docs prose alone. there is no path from a CRE confidential workflow to a Hedera transaction
today. the haircut has to be read by a human and typed/signed into a wallet regardless of
whether CRE is in the loop.**

the chain of reasoning, each link sourced:

1. `usingTheDons()` returns a plain `Runtime<C>` (`runtime.d.ts:56-68`), which exposes
   `report()` but **not** a chain write directly — that's a separate capability.
2. to deliver on-chain, you construct an EVM client capability and call `writeReport` on it,
   confirmed by the working example in `keeper-bot-ts/my-workflow/workflow.ts`:
   ```ts
   const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)
   // ...
   const writeResult = keeper.writeReport(runtime, reportData)
   ```
3. `ClientCapability` (the EVM write capability), `package/dist/generated-sdk/capabilities/
   blockchain/evm/v1alpha/client_sdk_gen.d.ts:29-125`:
   ```ts
   export declare class ClientCapability {
     static readonly SUPPORTED_CHAIN_SELECTORS: { readonly 'ethereum-mainnet': ...n; /* ~55 entries */ };
     constructor(ChainSelector: bigint);
     writeReport<TInput>(runtime: Runtime<unknown>, input: CapabilityInput<TInput, WriteCreReportRequest, WriteCreReportRequestJson>): { result: () => WriteReportReply };
     // + callContract, filterLogs, balanceAt, estimateGas, getTransactionByHash, getTransactionReceipt, headerByNumber, logTrigger
   }
   ```
   `SUPPORTED_CHAIN_SELECTORS` is a hardcoded object literal of ~55 entries (adi, apechain,
   arc, avalanche, binance_smart_chain, celo, cronos, dtcc, ethereum + 10 L2s, gnosis_chain,
   hyperliquid, ink, jovay, megaeth, monad, pharos, plasma, polygon, private-testnet-\*,
   sonic, tac, xlayer). **`hedera-mainnet` and `hedera-testnet` are not in this list** — read
   the full literal directly out of the `.d.ts`, not summarized from a smaller grep.
4. this is *not* the same as Hedera being entirely absent from the package. a separate,
   broader chain-metadata registry ships in the same tarball —
   `package/dist/generated/chain-selectors/{testnet,mainnet}/evm/hedera-{testnet,mainnet}.d.ts`
   — which does register Hedera as `chainFamily: 'evm'`, `chainId: '296'` (testnet), with a
   chain selector (`222782988166878823n`). **that registry is general chain metadata used
   elsewhere across Chainlink tooling; it is not the same list `ClientCapability` checks
   against for writes.** the two lists disagreeing is the actual finding: Hedera is known to
   the SDK's chain metadata but not enabled for the EVM write capability that `writeReport`
   requires.
5. cross-checked live against
   [`docs.chain.link/cre/supported-networks-ts`](https://docs.chain.link/cre/supported-networks-ts):
   Hedera (mainnet or testnet) does not appear in either the mainnets or testnets table.
   the docs page's own stated reasoning — "CRE supports two chain families: EVM-compatible
   chains and Solana" and Hedera is neither — is imprecise (Hedera *is* EVM-compatible, via
   its JSON-RPC relay, which is exactly how our ATS SDK / MetaMask flow works), but the
   practical conclusion matches the SDK source independently: **Hedera is not on the list
   CRE actually writes to.**

**what this means concretely**: `donRuntime.report({ encodedPayload, encoderName: 'evm',
signingAlgo: 'ecdsa', hashingAlgo: 'keccak256' })` produces a signed report, and note the
signing algorithm is `ecdsa` — that part would line up with our accounts, which are all
`ECDSA_SECP256K1` per `specs/00-mission.md`. but the *delivery* mechanism
(`ClientCapability.writeReport`) has no Hedera entry to construct against, so there is no
SDK-native way to get that signed report onto Hedera testnet automatically. the honest
framing for the writeup: CRE computes the verdict/KPI/haircut confidentially and produces a
value a human (or our own backend, outside CRE) reads out of the simulation output or a
future signed report, and that value gets relayed into an ATS SDK call the same way every
other operation in this project does — MetaMask, hao clicking, no private key anywhere. CRE
does not shorten that path today; it only changes what happens to the sensitive inputs before
the number comes out.

**one door not fully closed, flagged as unexplored rather than ruled out**: whether a signed
CRE report with `encoderName: 'evm'`, once produced, could be *manually* relayed by a
non-CRE piece of code (e.g. our own Next.js backend reading the DON's report output and
constructing a Hedera transaction itself, off the CRE rails entirely) is a different question
from whether `ClientCapability.writeReport` supports Hedera, and was not investigated here —
it would mean CRE's role stops at "produces an attested, signed value" and our own code (not
CRE, not any Hedera capability in the SDK) does the relay. this is out of scope for what was
asked (a CRE-native path) and is flagged, not answered, because pursuing it would have meant
guessing at report-verification mechanics not read in source.

---

## appendix: everything else observed while reading, not otherwise asked for but load-bearing

- `Runner<TConfig>`'s constructor is `private` — the only way to get an instance is
  `Runner.newRunner(...)`, confirmed `wasm/runner.d.ts:17-21`. do not try to `new Runner()`.
- `SecretsProvider.getSecret` takes one request and returns `{ result: () => Secret }`;
  `getSecrets` takes an array and returns `{ result: () => Record<string, Secret> }` keyed
  by the secret ID string, `workflow.d.ts:22-28`. both exist on `TeeRuntime<C>` (it `extends
  ... SecretsProvider`, `runtime.d.ts:36`) and on the plain `Runtime<C>`
  (`runtime.d.ts:56`) — secrets are fetchable from both a TEE handler and a normal DON
  handler; only fetching them *inside* the TEE keeps them out of node-operator memory.
- `BaseRuntime<C>.log(message: string): void` exists on every runtime type. the README's
  warning that `runtime.log()` inside a TEE handler must be stripped before production is a
  documentation/discipline rule, not something the type system enforces — nothing in the
  `.d.ts` marks it deprecated or TEE-only.
  `hello-confidential-workflows-ts/README.md:186,209-210`.
  `automated-liquidation-protection-ts/main.ts` calls `runtime.log(...)` inside its TEE
  handler exactly the same way, e.g. `runtime.log("liquidation-getsecrets-ok")`.
- the closest existing template to our shape (financial risk inputs → confidential
  decision → capped/clamped output) is
  `starter-templates/confidential-workflows/automated-liquidation-protection/
  automated-liquidation-protection-ts/main.ts`: it reads a risk state (health factor, LTV,
  liquidation threshold, volatility) and a policy (thresholds, caps) as secrets inside the
  enclave, computes a risk score (`computeRiskScore`, plain arithmetic, no LLM required —
  the README states the LLM step is optional: "every reasoning stage can be implemented with
  deterministic rule-based logic instead of an LLM, if your deployment requires a fully
  rules-driven policy engine"), and returns a capped/clamped decision. structurally this
  maps cleanly onto covenant/KPI/haircut logic; worth using as the starting skeleton over the
  bare hello-world once past the initial `handlerInTee` smoke test.
- `.env.example` in every confidential-workflow template asks for `CRE_ETH_PRIVATE_KEY`
  ("optional for local simulate" per `automated-liquidation-protection/README.md`) — this is
  a CRE-side signing key for eventual on-chain report delivery on an EVM chain, **not** a
  Hedera key and not something the `specs/00-mission.md` "no private key, ever" rule needs to
  worry about unless we actually pursue the deploy path, which §6 and §7 both argue against
  doing inside the timebox.

---

## what was not found

- no documented approval-time SLA for either deploy access or confidential-workflows
  enrollment beyond "shortly" / "you don't need to wait" — not a number of days anywhere in
  the four docs pages fetched for §6.
- no Node.js version requirement for the TypeScript path — not found in
  `part-1-project-setup-ts`, the CLI installation pages, or any template's README. all
  version pins found were for Bun, the CRE CLI itself, and package-level semver in
  `package.json`/`go.mod`.
- no resolution of the go.mod-vs-README contradiction on whether Go confidential workflows
  support is in a tagged release (§3) — flagged, not resolved, since we are not building in
  Go and chasing it further would not change hercules's plan.
- whether a signed CRE report can be manually relayed to Hedera by code outside the CRE SDK
  (as opposed to `ClientCapability.writeReport`, which cannot target Hedera) — not
  investigated, flagged in §7 as a real open door rather than answered.
