# BUG.md

upstream defects found in the hedera asset tokenization studio while building covenant.

every entry below was hit by building against the sdk, not by reading it looking for faults.
each one cites a file and line at tag `v.8.0.0-ats`, which is the tag matching the published
`@hashgraph/asset-tokenization-sdk@8.0.0`. reproductions are minimal and were run.

`PROJECT_BRIEF.md` §6 says do not manufacture a friction point. two candidates were
investigated and **withdrawn** on inspection, and they are listed at the bottom with the
reason. the ones that remain are real.

repository: https://github.com/hashgraph/asset-tokenization-studio

---

## B1. `Bond.createKpiLinkedRate` cannot work against any real deployment

**severity: the feature is unusable. dead on arrival in v8.0.0.**
**status: primary upstream PR candidate.**

### what happens

calling `Bond.createKpiLinkedRate`, the sdk's documented entry point for issuing a
KPI-linked bond, throws at signing time:

```
An error occurred while creating the bond kpi linked rate:
An error occurred when signing the transaction:
Unexpected error in deployBondKpiLinkedRate operation:
TypeError: factoryInstance[deployMethod] is not a function
```

### why

the sdk calls `deployBondKpiLinkedRate` on the factory
(`packages/ats/sdk/src/port/out/rpc/RPCTransactionAdapter.ts:306`).

**that function does not exist on the factory.** the real factory declares exactly four
deploy functions:

| function | `IFactory.sol` | `Factory.sol` |
|---|---|---|
| `deployProxy` | 282 | 218 |
| `deployEquity` | 296 | 239 |
| `deployBond` | 307 | 277 |
| `deployDepositToken` | 320 | 309 |

`deployBondKpiLinkedRate` and `deployBondFixedRate` exist in exactly one place in the
repository: **`packages/ats/contracts/contracts/test/mocks/MockFactory.sol`**, at lines 89,
100, 138 and 173.

so both the KPI-linked and fixed-rate issuance paths are implemented only against a test
double.

### the maintainers' own deploy script hits the same wall

`packages/ats/contracts/scripts/domain/factory/deployBondKpiLinkedRateToken.ts` is the
contracts team's own script for deploying a KPI-linked bond. it reaches the function like
this:

```ts
const tx = await (factory as IMockFactory).deployBondKpiLinkedRate(bondKpiLinkedRateData, {
  gasLimit: GAS_LIMIT.high,
});
```

**it casts the factory to `IMockFactory`.** the mock interface, named outright, in a script
whose purpose is deploying to a real network. so the same defeat-the-typechecker pattern
appears twice independently, in the sdk and in the contracts tooling, which suggests the
missing implementation was noticed at the call sites and cast around rather than fixed.

that script also disagrees with the sdk about the call shape. it passes **one** argument, a
`bondKpiLinkedRateData` bundling `{bondData, factoryRegulationData, interestRate, impactData}`.
the sdk passes **two** plus overrides, `(securityToken, regulationData, { gasLimit })`. even
if the function existed, both call sites cannot be correct.

### confirmed against compiled artifacts

not inferred from source. deploy selectors on each compiled ABI:

```
Factory       deployBond              0x29002951
              deployDepositToken      0xd737ad09
              deployEquity            0x837b37b6
              deployProxy             0xd3959f13

MockFactory   those four, plus
              deployBondFixedRate     0xdbe95016
              deployBondKpiLinkedRate 0xfc04c87e
```

typechain generates `Factory.ts` from the real contract and it contains **zero** occurrences
of `deployBondKpiLinkedRate`.

### where the failure occurs

worth being precise. **`factoryInstance[deployMethod] is not a function` is a client-side
error.** it is ethers failing to find the method on its own ABI. no transaction is
constructed and nothing reaches the network. so this is not a deployment or configuration
problem on any particular network, and it cannot be worked around by pointing at a different
factory address.

### why nothing caught it

four separate safety nets, each defeated:

0. **the maintainers cast around it twice**, as above.
1. **the contracts document the function as real.** `IFactory.sol:143` states that
   `BondDetailsData` is "consumed by the Factory during `deployBond`, `deployBondFixedRate`,
   and `deployBondKpiLinkedRate`". two of those three do not exist.
2. **the type system knows.** typechain generates `Factory.ts` from the real contract, and it
   correctly contains **zero** occurrences of `deployBondKpiLinkedRate`.
3. **a cast defeats the type system.** `RPCTransactionAdapter.ts:2349`:
   ```ts
   const res = await (factoryInstance as any)[deployMethod](securityToken, regulationData, { gasLimit });
   ```
   the `as any` is what turns a compile-time error into a runtime `TypeError`. without it
   this would not have shipped.
4. **the tests mock the factory.** the sdk's own suite passes because `MockFactory` has the
   function the real one lacks. the mock is the only place the feature works.

the enum also carries `SecurityType.BondFixedRate` (`IFactory.sol:30`) and
`SecurityType.BondKpiLinkedRate` (`:32`), so the type, the documentation, the sdk surface and
the tests all assert a capability the deployed bytecode does not have.

### reproduction

against hedera testnet, resolver `0.0.9212226`, factory `0.0.9213391`, sdk 8.0.0:

```ts
await Bond.createKpiLinkedRate(new CreateBondKpiLinkedRateRequest({ /* any valid payload */ }));
// TypeError: factoryInstance[deployMethod] is not a function
```

the request itself is valid. `CreateBondKpiLinkedRateRequest.validate()` returns **zero
errors** before the call is made, so validation gives no warning.

### suggested fix

either implement `deployBondKpiLinkedRate` and `deployBondFixedRate` on `Factory.sol`, or
remove the sdk paths, the enum entries and the documentation that promise them. separately,
**remove the `as any` at `RPCTransactionAdapter.ts:2349`**, which would have caught this at
compile time, and run at least one integration test against a real factory rather than the
mock.

### the configuration is registered and unreachable

this is the stronger statement, and every part of it has been run.

config `0x...04`, the KPI-linked bond configuration, is **registered in the deployed resolver
`0.0.9212226` at version 1 with 95 facets, and reachable by no path.**

- the sdk's entry point, `Bond.createKpiLinkedRate`, calls a factory function that exists
  only on the mock, as above
- the one working entry point, `deployBond`, **reverts against config 4.**
  `Factory.sol:291` unconditionally calls `initializeFixedRate`, selector `0xf2e78174`,
  which is absent from config 4 because it carries `KpiLinkedRateFacet` in place of
  `FixedRateFacet`. the diamond fallback reverts with
  `IResolverProxy.FunctionNotFound(0xf2e78174)`
- `deployBond` also never calls `initializeKpiLinkedRate`, so `setOperationalStatus`
  finds an unready facet and `Factory.sol:293` reverts independently. two separate failures,
  either one sufficient

verified live against the resolver with
`getFacetIdByConfigurationIdVersionAndSelector`:

```
config 2   latestVersion 1   94 facets   0xf2e78174 initializeFixedRate  PRESENT
config 4   latestVersion 1   95 facets   0xf2e78174 initializeFixedRate  ABSENT
```

so this is not only a client-side sdk defect. **a configuration ships in the deployed
resolver that nothing can deploy against.**

### what we did instead

we issued on config `0x...02`, bond variable rate, which works. that costs the on-chain
KPI mechanism entirely: `addKpiData` and `KpiLinkedRateFacet` are absent from config 2, so
the conversion from a KPI reading to a coupon rate happens off chain in our own code.

**we did not attempt a post-deployment configuration switch to `0x...04`.** it is admin gated
via `DiamondCut.sol:23` and appears reachable, but we did not verify that `KpisFacet` accepts
a token whose coupon history predates the switch (`KpisStorageWrapper.sol:102` guards
`lastFixingDate < minDate` and reverts). we are not publishing a recovery procedure we have
not run.

---

## B2. the sdk cannot be loaded in any browser bundler without hand-written shims

**severity: every browser consumer rediscovers this. the maintainers already have.**

one entry point serves both node and browser. it pulls `winston`, which requires `fs`, via
`packages/ats/sdk/src/port/in/Common.ts:3-5`, and `dotenv` via `src/index.ts:4-6`. there is
no browser build and no `"browser"` field in `package.json`.

the evidence that this is a real problem rather than our misuse is in the repository itself:
the ATS reference web application solves it with stub aliases at
**`apps/ats/web/vite.config.ts:38-45`**. the maintainers hit this, worked around it locally,
and shipped the package without the fix.

**suggested fix:** a `"browser"` field mapping both to stubs, or a separate browser entry
point, or move the logger behind an injectable interface.

---

## B3. the published ESM build cannot be loaded by node

**severity: `exports.import` is broken for any non-bundled consumer.**

`build/esm/src/index.js:5` is `export * from "./port/in/index";`. extensionless relative
specifiers are rejected by node's ESM resolver. there are **8,181** of them across the ESM
build.

bundlers tolerate this, so it is invisible to anyone using webpack, vite or turbopack, and
fatal to anyone importing the package directly in node.

**suggested fix:** one line of `tsconfig` or a `tsc-alias` step to emit explicit `.js`
extensions.

---

## B4. `RequestAccount.privateKey` is a live field that the sdk silently ignores

**severity: developer trap with a security shape.**

`packages/ats/sdk/src/port/in/request/BaseRequest.ts:9` exposes:

```ts
privateKey?: RequestPrivateKey;
```

on the public `RequestAccount` interface. **nothing in the adapter layer consumes it.** the
raw-key signer it belonged to is disabled: `SupportedWallets.CLIENT` is commented out at
`domain/context/network/Wallet.ts:9`.

so the public api invites a caller to hand the sdk key material, accepts it without
complaint, and discards it. a developer who supplies it will reasonably assume it is being
used.

**suggested fix:** remove the field while `CLIENT` is disabled, or document it as unused.

---

## B5. `@hashgraph/hedera-wallet-connect@2.1.2` has an undeclared dependency

**severity: breaks MetaMask-only consumers who never asked for walletconnect.**

it imports `@hiero-ledger/proto` at `dist/lib/wallet/index.js:26` and
`dist/reown/wallets/HIP820Wallet.js:4`, but declares it in neither `dependencies` nor
`peerDependencies`. the only package pulling it is `@hiero-ledger/sdk`, which npm installs
**nested**, leaving it unresolvable from the wallet-connect package.

this is not avoidable by not using walletconnect: `core/injectable/Injectable.ts:91-105`
registers the walletconnect adapter **unconditionally**.

**suggested fix:** declare `@hiero-ledger/proto` as a dependency, and register the
walletconnect adapter lazily.

---

## B6. `Bond.createKpiLinkedRate`'s declared return type does not match its runtime value

**severity: minor, but it produces `[object Object]` in a ui that trusts the type.**

declared `SecurityViewModel`, all strings, at `port/in/bond/Bond.ts:228`. returns the domain
`Security` spread verbatim at `:296-303`, where `diamondAddress` is a `HederaId`,
`evmDiamondAddress` an `EvmAddress`, and `maxSupply` a `BigDecimal`.

**suggested fix:** map to the view model, or correct the declared type.

---

## B7. `ROLE_MATURITY_MANAGER` is missing from the sdk's role enum

**severity: minor. undocumented raw hex required.**

`updateMaturityDate` requires it, but it is absent from the `SecurityRole` TypeScript enum, so
callers must pass a raw hex literal to `grantRole`.

---

## B8. `Security.checkISIN` accepts an ISIN the deployed contract rejects

**severity: real friction, and it costs gas to find out.**

### what happens

`CreateBondRequest.validate()` calls `Security.checkISIN`
(`domain/context/security/Security.ts:186-194`), which returns **zero errors** on any
12-character non-empty string. it checks length and emptiness only. no digit-check
validation at all.

the deployed factory enforces one. `Factory.sol:283`'s `onlyValidISIN` modifier calls
`isinValidator.sol:30-36`'s `_checkChecksum`, a real ISO 6166 Luhn/mod-10 check digit over
the converted ISIN body. so the sdk waves through an ISIN the contract will not accept, and
the only way to find that out is to pay gas and get it reverted.

### confirmed against chain, not inferred

the first issuance attempt used isin `XS9999COV001`. sdk validation returned zero errors on
it. the transaction reverted on chain: selector `0x342c92db`, independently recomputed as
`keccak256("WrongISINChecksum(string)")[:4]` and matched exactly. reverted transaction
`0x305fbb1a04946a5c4e18dd98675f0891934b8db699633fba0579e4a345a02a0b`, cost `0.18855433` HBAR
total. see `EVIDENCE.md`'s friction log for the full mirror-node record and the payer split.
the reissue five minutes later, with a valid checksum, `XS9999COV006`, is the live token
reported in `EVIDENCE.md` G1.

### suggested fix

run the same ISO 6166 check digit `isinValidator.sol` runs, client side, inside
`Security.checkISIN`, before a caller submits a transaction that pays gas to learn the same
thing the contract already knows.

---

## B9. `updateMaturityDate`'s natspec contradicts its implementation

**severity: the documented invariant is not enforced, and the real one is weaker.**

`IMaturity.sol`'s natspec states that a new maturity date must be later than the current
one. the on-chain guard does not check that.
`MaturityDateStorageWrapper.sol:56-60` checks only `newDate > block.timestamp`.

the "later than the current maturity" rule exists **only client-side**, in the sdk's
`ValidationService.checkMaturityDate`. so any caller reaching the contract directly, which
is every caller not using this sdk, can move a bond's maturity date **backwards**, to any
point in the future, and the contract will accept it.

for our own use this is convenient: we compress a three year lifecycle into a demo. but a
documented invariant that lives in the client rather than the contract is not an invariant.

**suggested fix:** enforce it on chain, or correct the natspec to say what is actually
guaranteed.

---

## minor: the reference app encodes currency two different ways

not an sdk defect, an inconsistency in `apps/ats/web`.

`utils/format.ts:145-150` does correct ASCII hex. the bond creation form at
`CreateBond/Components/StepReview.tsx:109` concatenates decimal character codes as hex
digits, so `"USD"` becomes `0x858368` instead of `0x555344`.

---

## investigated and withdrawn

listed because deciding *not* to report something is part of reporting honestly.

**W1. `HoldDetails` constructor parameter naming.** `domain/context/security/Hold.ts:23-48`
names its first parameter `executionTimeStamp` while assigning to `this.expirationTimeStamp`.
we expected a value swap. there is none: the only call site,
`port/out/rpc/RPCQueryAdapter.ts:886-894`, passes `hold.expirationTimestamp_`, and
`IHoldTypes.sol:51-58` carries only one timestamp on the struct, so no swap is possible. the
returned value is correct. **a cosmetic parameter rename with zero behavioural effect.**
mentioned here only for completeness.

**W2. `scheduledTask` naming.** we briefly read ATS `scheduledTask` as integration with the
hedera schedule service. it is not: it is an internal EVM task queue in
`domain/orchestrator/ScheduledTasksOps.sol`, drained by the next state-mutating call.

on investigation **this was our misreading, not a documentation gap.**
`docs/ats/user-guides/corporate-actions.md:283-337` documents the queue mechanism thoroughly
and accurately, including force-cancel semantics and queue-blocking behaviour. greps for
"hedera schedule service", "schedule service", "HSS" and `0x16b` across `docs/` and
`README.md` return zero hits. ATS never claims native scheduling anywhere. we conflated
"scheduled" and "built on hedera" without reading the surrounding documentation.

no report filed. recorded here because we nearly filed one.
