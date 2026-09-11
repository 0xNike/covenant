# 06. the hedera harness track, what it actually is, and whether we fit it

read-only research. no code changes. clones fetched to a scratch directory outside the
repository and inspected there; nothing here is vendored into covenant.

- `hedera-dev/hedera-harness`, cloned `2026-09-10`, HEAD `e045b10`
  ("Merge pull request #10 from hedera-dev/fix/tier3-mcp-delivery"), tagged in
  `package.json` as version `1.2.2`. last commit `2026-08-16 21:12:00 +0300`
  (`5c8c0ea fix: chromium browser dependencies`).
- `hedera-dev/hedera-skills`, cloned `2026-09-10`, last commit `2026-09-03 16:30:59 +0800`.
- `hedera-dev/scaffold-hbar`, not cloned, fetched two files over the GitHub raw endpoint:
  `package.json` and `packages/nextjs/package.json` at `main`.

## 1. what hedera-harness actually is

**it is not a Hedera SDK wrapper or a collection of transaction helpers.** it is an agentic
CLI that drives a coding agent (Claude Code or Cursor) to build a feature, described in a
PRD you write, into a `scaffold-hbar` project (a Next.js + Hardhat + Foundry Hedera starter,
Scaffold-ETH-like), then decides pass/fail itself rather than trusting the agent's own
report. source: `hedera-harness/README.md:1-45`.

the four-stage pipeline, cited from `hedera-harness/README.md:15-31`:

1. **GENERATE** — the coding agent writes code on a `harness/run-*` branch
   (`src/attemptLoop.ts`, `src/branchDetection.ts`).
2. **ASSERT** — deterministic checks: required files present, static assertions, secret
   scan, build/lint commands run (`src/validation/index.ts`, `src/validation/installFingerprint.ts`).
3. **SMOKE** — a dev server boots and Playwright drives its routes (`src/validation/playwrightGate.ts`,
   `src/validation/devServer.ts`). declared "Tier 2" in `README.md:96`.
4. **EVALUATE** — an adversarial second agent, given numbered assertions in a "contract"
   file, drives the live app via Playwright MCP and grades them, told explicitly to fail
   rather than guess on uncertainty (`src/semanticValidator.ts`, `src/validatorMcp.ts`,
   `README.md:98-103`). declared "Tier 3."
5. an optional **Tier 3.5**, on-chain validation: the harness provisions an ephemeral
   funded ECDSA testnet account, injects it as the scaffold's burner wallet, lets the
   generated app transact with it, and verifies effects against the mirror node rather than
   a UI toast (`src/validation/chainSigner.ts:15-59`, `docs/authoring-a-recipe.md:148-179`).

a failed attempt gets a focused repair prompt and another try, up to a budget; an
infrastructure failure (browser, MCP) aborts without spending a repair attempt on code
that was never broken (`README.md:33-36`, CHANGELOG `1.2.1` entry on browser
misclassification).

**maturity.** 106 commits in the fetched history, a `CHANGELOG.md` with three recent
point releases (`1.2.0`, `1.2.1`, `1.2.2`) each fixing specific reported defects (browser
mismatch between Tier 2 and Tier 3, MCP session files leaking into the workspace, semantic
validator not matching the run's actual agent-specific MCP delivery). last commit three
and a half weeks before this hackathon's build window. active, not abandoned, but young
(`v1.2.2`) and single-purpose.

**language/runtime:** TypeScript, Node ≥20, ships as a CLI (`hedera-harness/package.json:6-8`,
`:31-33`). its own peer dependencies are `@hiero-ledger/sdk` (the core Hedera JS SDK, not
`@hashgraph/hedera-wallet-connect` and not `@hashgraph/asset-tokenization-sdk`) and
`playwright`, both optional (`package.json:53-64`). it runs entirely in Node — never in a
browser bundle — so it does not import anything through webpack, vite, turbopack, or any
bundler resolution mode.

**what it targets by default.** `init` clones `scaffold-hbar`
(`README.md:131-139`, `src/initRunner.ts`, `src/harnessProvisioner.ts`). scaffold-hbar's
own `packages/nextjs/package.json` (fetched from `main`, not the harness clone) declares
exactly one Hedera-related dependency: `@hiero-ledger/sdk@^2.80.0`. no
`@hashgraph/hedera-wallet-connect`, no `@hashgraph/asset-tokenization-sdk`, no
typechain-generated contracts package. its default wallet is a scaffold-eth-style "burner"
key plus RainbowKit; one of the example PRDs in the harness's own docs
(`docs/prds/x402-metered-api.md:168`) explicitly notes scaffold-hbar "does not ship
HashPack" and treats adding Hedera WalletConnect/HashPack support as new work for that
demo, not something already wired.

## 2. what it covers thinly or not at all

these are gaps the maintainers' own artifacts point at, not inferred:

- **the skill index has an explicit, checked-in backlog.** `skills-index.json:51-76` has a
  top-level `unmerged-skills` array carrying `hedera-oracle-adapters`, `axelar-gmp`,
  `layerzero-messaging`, and `x402-payments`. these already exist as full skills in the
  sibling `hedera-skills` repository (`hedera-skills/plugins/oracles`,
  `plugins/cross-chain`, `plugins/native-services-js/skills/x402-payments`) but have not
  been promoted into the harness's own resolvable list. this is the single clearest,
  lowest-risk "thin coverage" gap: the content exists, the index just does not point at it
  yet. whether a contribution here would be "meaningful" per the prize's own bar is a
  judgment call — it is closer to a registry update than new capability.
- **`chainValidation` (Tier 3.5) is generic, not service-specific.** it verifies "effects"
  via the mirror node in the abstract (`docs/authoring-a-recipe.md:148-152`) and the only
  worked example in the recipe format is a plain HBAR flow plus an optional Solidity
  deploy step (`docs/authoring-a-recipe.md:154-170`). there is no HTS-native (token
  create/mint/transfer) or HCS-native (topic/submit-message) assertion helper visible in
  `src/validation/`, `src/types.ts`, or the docs — everything native-service-specific lives
  one layer up, as prose skills in `hedera-skills/plugins/native-services-js`, not as
  first-class Tier 3.5 assertion types in the harness itself. a caller wanting to assert
  "token X was minted" or "message Y landed on topic Z" writes that by hand today.
- **one language, one agent family.** the harness only drives Cursor's `agent` CLI or
  Claude Code's `claude` CLI (`README.md:165`, `prompts/generator.md`,
  `src/providers/commandAgentProvider.ts`). the track's own suggestion of "port it to
  another language or runtime" is live: there is no non-Node implementation and no
  support for another agent CLI.
- **mainnet is refused outright**, by design (`src/validation/chainSigner.ts:30-34`,
  `docs/authoring-a-recipe.md:157`). not a gap to close — a deliberate safety rail — but
  worth naming since it bounds what a Tier 3.5 contribution could ever validate.

## 3. does anything we already have map onto it — a direct no, with the reasoning

**no.** every defect in `BUG.md` sits inside `@hashgraph/asset-tokenization-sdk`,
`@hashgraph/asset-tokenization-contracts`, or the ATS contracts themselves. none of those
packages are imported, vendored, or referenced anywhere in `hedera-harness`'s source,
tests, docs, or its default target project (`scaffold-hbar`). checked directly:

```
grep -rn "asset-tokenization\|hashgraph/hedera-wallet-connect" hedera-harness/  → zero hits
```

going through the four items flagged for specific scrutiny:

- **B2/B3 (browser bundler shims, broken ESM extensionless imports).** these are
  properties of `@hashgraph/asset-tokenization-sdk`'s build output
  (`build/esm/src/index.js`) and its pull of `winston`/`dotenv` into a shared entry point.
  `hedera-harness` never runs in a browser bundle — it is a Node CLI, confirmed by
  `package.json:5` (`"type": "module"`, `bin` entry, no browser field, no bundler in
  `devDependencies`) and by `src/optionalDeps.ts:60-83`, which lazily
  `await import("@hiero-ledger/sdk")` and `await import("playwright")` directly in Node,
  with no bundler in the path. there is no analogous "cannot load in a browser bundler"
  failure mode here to report, because the harness is never consumed by a bundler.
- **B5 (`@hashgraph/hedera-wallet-connect`'s undeclared `@hiero-ledger/proto` dependency).**
  this is a real Hedera-ecosystem package, not an ATS one, which is exactly why it was
  worth checking. but neither `hedera-harness` nor `scaffold-hbar`'s `nextjs` package
  depends on `@hashgraph/hedera-wallet-connect` (confirmed by grep on the harness clone,
  above, and by reading `scaffold-hbar/packages/nextjs/package.json`, which lists only
  `@hiero-ledger/sdk`). the harness's own signing path in Tier 3.5 is a raw
  `@hiero-ledger/sdk` `PrivateKey` used directly against `Client.forTestnet()`
  (`src/validation/chainSigner.ts:61-108`), never WalletConnect. the one place
  WalletConnect/HashPack appears in the harness's materials at all is as *prose in an
  example PRD* (`docs/prds/x402-metered-api.md:116-133,168`) describing work a generated
  app could optionally do — not a dependency the harness itself carries or that would
  break by installing it. B5 does not reproduce here.
- **B15 (typechain declarations resolving `ethers` to the wrong build under bundler
  resolution).** this is specific to `@hashgraph/asset-tokenization-contracts`
  declaring `"type": "commonjs"` while our Next.js app resolves with `"moduleResolution":
  "bundler"`. `hedera-harness` ships no typechain output and no generated contract
  bindings of its own; `package-lock.json` shows `ethers@6.16.0` present only as a
  transitive dependency (likely of `@hiero-ledger/sdk` or a test tool), not something the
  harness's own code imports or re-exports typed factories from. no analogous surface
  exists to be broken this way.
- **our own first-hour friction** (hardcoded `isMetaMask` check, no local-key signer in
  the ATS SDK, the Hedera JSON-RPC relay silently ignoring `eth_call` state overrides):
  none of these reproduce in the harness's own code either, and for the opposite-of-coincidental
  reason that the harness was built to avoid exactly the friction we hit. it signs
  everything with a plain `@hiero-ledger/sdk` `PrivateKey` (`chainSigner.ts:67-104`) — no
  MetaMask, no browser wallet, no "no local-key signer" gap, because the underlying Hedera
  SDK (as opposed to the ATS SDK wrapping it) has never disabled that path. and grepping
  the harness for `eth_call`, `stateOverride`, or `relay` turns up nothing relevant —
  `src/semanticInfra.ts:39,41` only pattern-matches relay *unreachability* strings for its
  own infra-vs-app failure classification, nothing about state overrides. the relay
  friction we hit is real, but it is a property of the Hedera JSON-RPC relay itself
  (a separate piece of infrastructure, `hashgraph/hedera-json-rpc-relay`, not fetched or
  read here — out of scope for this pass), not something `hedera-harness` touches or could
  be patched to fix.

**so the honest answer is: nothing in `BUG.md`, withdrawn or not, and none of our own
first-hour friction, maps onto `hedera-harness`.** the two efforts sit at different layers
of the stack and never share a file. a harness contribution, if pursued, would mean
starting from what the harness's own gaps are (§2), not from anything already in hand.

## 4. what a small, genuine contribution could look like, if pursued

graded roughly by how little it resembles "we needed a contribution and went looking":

1. **promote one or more `unmerged-skills` entries in `skills-index.json` into the merged
   list**, after verifying the corresponding skill in `hedera-skills` actually resolves
   and vendors cleanly through `src/skillResolver.ts` / `src/skillVendor.ts`. small, real,
   and the need is stated by the maintainers in their own backlog array — but it is closer
   to a registry/config change than new capability, so it may not clear "meaningful" on
   its own.
2. **a Tier 3.5 assertion helper for one native service** (HTS token mint/transfer, or HCS
   topic submit-message), verified against the mirror node the same way the existing HBAR
   path is (`docs/authoring-a-recipe.md:148-152`), landing as a new case in
   `src/validation/chainSigner.ts` or a sibling module plus a documented recipe example.
   this is the closest fit to "extend service coverage into areas the harness handles
   thinly" from the track's own wording, and it is real work with a clear, demonstrable
   before/after (a recipe that could not assert an HTS effect on chain, now can).
3. **anything smaller** — e.g. tightening one of the CHANGELOG-documented rough edges
   further, or adding a doctor check — would need a freshly reproduced failure, not
   something in hand. none was found in this pass; time did not extend to running the
   harness itself (`npx hedera-harness doctor` / `run`) against a live project, which
   would be the way to surface a first-hour friction point honestly rather than by
   inspection alone.

none of the above was built, run, or verified beyond reading source. this section names
candidates; it does not claim one is ready.

## 5. `hedera-dev/hedera-skills` — a more natural fit for what we have?

it is a Claude Code / agent-skills marketplace: packaged `SKILL.md` instructions and
reference docs for Hedera-adjacent development, installed via
`/plugin marketplace add hedera-dev/hedera-skills` or `npx skills add hedera-dev/hedera-skills`
(`hedera-skills/README.md:5-30`). plugins present: `agent-kit-plugin`, `system-contracts`
(HTS/HSS precompiles), `oracles`, `cross-chain`, `native-services-js` (HTS/HCS/x402 via the
Hiero JS SDK), `hackathon-helper`, `hedera-harness` (recipe-authoring skills), and
`dev-intelligence` (`README.md:32-256`).

**not a better fit either, for the same reason as the harness.** every plugin here is
either (a) a reference/instruction skill for the *core* Hedera SDK and native services
(HTS, HCS, HSS, oracle feeds, cross-chain messaging), none of which we have found a defect
in, or (b) generic dev-workflow tooling unrelated to any Hedera surface at all
(`session-management`, `quality-gates`, `project-scaffolding`). none of it touches ATS,
ERC-1400/3643, or ethers/typechain resolution. it is a documentation/instruction
marketplace, not a place a bug fix or a code contribution against `BUG.md` would land at
all — there is no code path in it for our findings to attach to.

## answer to the question asked

**no**, nothing already in hand — neither `BUG.md`'s fifteen findings nor the two
withdrawn ones, nor our own first-hour friction — maps onto `hedera-dev/hedera-harness` or
`hedera-dev/hedera-skills`. both are real, active, and reasonably documented, but they sit
one layer below where ATS lives (the core Hedera SDK, native services, and an
agent-driven scaffold-hbar workflow), and none of our findings touch that layer. a harness
contribution, if the timebox allows one, means starting fresh against one of the gaps in
§2 — most plausibly the checked-in `unmerged-skills` backlog or a Tier 3.5 native-service
assertion helper — not repackaging anything already written.
