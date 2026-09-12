# hedera, improve the hedera harness

**this document targets a prize we do not qualify for. read this note before the rest.** we
built against the hedera asset tokenization studio (ATS) and, in the course of a working
submission, found fifteen defects in its sdk and contracts, filed in `BUG.md`. on reading the
"improve the hedera harness" prize text closely, the contribution it asks for is to
`hedera-dev/hedera-harness`, an agentic testing cli for a different starter project entirely,
a separate repository at a different layer of the stack from ATS. `specs/06-hedera-harness.md`
checks this directly: none of our fifteen findings, and none of our own first-hour friction,
reproduce anywhere in `hedera-harness`'s source, tests, or its default target project,
`scaffold-hbar`. the findings below are real. the track named in this document's title is the
wrong one for them.

**what we do with them instead.** the fifteen defects are claimed as the "contributions back
upstream to ATS" extra-points line on the hedera tokenization writeup
(`docs/writeup-hedera-tokenization.md`), not as an entry in this track. the upstream pull
request to `hashgraph/asset-tokenization-studio` is still worth opening on its own merits,
independent of which prize, if any, it counts toward. this document is kept, not deleted,
because the findings are the useful part and a reader should be able to see exactly where they
were meant to land and where we discovered they actually belong.

---

**prize:** hedera, improve the hedera harness ($2,000, 2 slots). not entered, per the note
above.
**repository:** https://github.com/0xNike/covenant
**full defect log:** [`BUG.md`](../BUG.md), fifteen entries, `B1` through `B15`, plus two
investigated and withdrawn, `W1` and `W2`. this document is a curated, prioritised reading of
that file for a judge with limited time; `BUG.md` has the full reasoning, every file and line
cited, and the reproductions.
**upstream target:** https://github.com/hashgraph/asset-tokenization-studio, tag `v.8.0.0-ats`,
an exact match for our installed `@hashgraph/asset-tokenization-sdk@8.0.0`.
**upstream pull request:** `[upstream PR: pending]`. prepared, not yet opened, per this
project's own rule that opening it needs approval outside this document's scope. see
`DECISIONS.md` D9 for the signing and branch setup this required before commit one.

every entry below was hit by building a working submission against the sdk. none was found by
auditing the sdk looking for faults. that distinction matters for how these should be read: a
developer building the same thing we built, on the same version, hits the same wall in the
same place.

---

## B1. `Bond.createKpiLinkedRate` cannot work against any real deployment

**severity: the feature is unusable. dead on arrival in v8.0.0.**

calling `Bond.createKpiLinkedRate`, the sdk's documented entry point for issuing a kpi-linked
bond, throws at signing time:

```
TypeError: factoryInstance[deployMethod] is not a function
```

**why.** the sdk calls `deployBondKpiLinkedRate` on the factory
(`packages/ats/sdk/src/port/out/rpc/RPCTransactionAdapter.ts:306`). that function does not
exist on the deployed factory contract. it exists in exactly one place in the repository:
`packages/ats/contracts/contracts/test/mocks/MockFactory.sol`, alongside its sibling
`deployBondFixedRate`. confirmed against compiled selectors, not inferred: the real factory's
ABI has four deploy functions (`deployProxy`, `deployEquity`, `deployBond`,
`deployDepositToken`); `MockFactory`'s ABI has those four plus the two kpi/fixed-rate ones.
typechain generates `Factory.ts` from the real contract and it contains **zero** occurrences of
`deployBondKpiLinkedRate`.

**the maintainers' own tooling hits the same wall.**
`packages/ats/contracts/scripts/domain/factory/deployBondKpiLinkedRateToken.ts`, the contracts
team's own deploy script, reaches the function by casting the factory to `IMockFactory`, the
mock interface, named outright, in a script whose purpose is deploying to a real network. the
same defeat-the-typechecker pattern appears twice, independently, in the sdk and in the
contracts tooling, which suggests the missing implementation was noticed at both call sites and
cast around rather than fixed. that script also disagrees with the sdk about the call shape:
one argument bundling four fields, versus the sdk's two plus overrides. so even restoring the
function would leave two callers that cannot both be correct.

**why four separate safety nets each missed it.** the contracts document the function as real
(`IFactory.sol:143`). the type system knows it does not exist, typechain correctly omits it.
an `as any` cast at `RPCTransactionAdapter.ts:2349` defeats that at the one call site that
matters, turning a compile-time error into a runtime `TypeError`. and the sdk's own test suite
passes because it points at `MockFactory`, the only place the feature works.

**it is not only a client-side defect.** we verified live against the deployed resolver
`0.0.9212226` with `getFacetIdByConfigurationIdVersionAndSelector` that the kpi-linked
configuration, `0x...04`, is registered at version 1 with 95 facets, and unreachable by any
working path: the sdk's entry point fails before constructing a transaction, as above, and the
one path that does deploy, `deployBond`, reverts against config 4 independently, because it
unconditionally calls `initializeFixedRate`, a selector absent from that configuration
(`Factory.sol:291`, revert `IResolverProxy.FunctionNotFound(0xf2e78174)`). two separate
failures, either one sufficient. a configuration ships in the deployed resolver that nothing
can deploy against.

**what we did instead.** we issued on config `0x...02`, bond variable rate, which works, and it
cost the on-chain kpi mechanism entirely, see the tokenization writeup, "the rate leg," for
what we built in its place and why that is still a real claim, just a smaller one.

**suggested fix.** implement `deployBondKpiLinkedRate` and `deployBondFixedRate` on
`Factory.sol`, or remove the sdk paths, the enum entries and the documentation that promise
them. remove the `as any` at `RPCTransactionAdapter.ts:2349`, which would have caught this at
compile time. run at least one integration test against a real factory rather than the mock.

full reproduction, selector table and the exact revert path: `BUG.md` B1.

---

## a feature that fails piece by piece: `Hold`

three separate defects sit in the hold facet, ATS's tri-party collateral primitive and the
mechanism this project's own thesis leans on hardest. grouped because they are the same shape
of problem, applied three times, to the one feature whose entire job is getting a third party's
authority right.

**B10. `createHoldByPartition` validates one account's balance and debits another's.**
`CreateHoldByPartitionCommandHandler.ts:50` checks balance against the sdk's cached account. the
contract holds from `EvmAccessors.getMsgSender()` (`HoldByPartition.sol:60`), a different
account entirely if the cache has gone stale. there is no `from` parameter anywhere in the
request, so the sdk has no way to express "hold from account X" at all. the two accounts
coincide on the happy path, which is exactly what makes this invisible until they do not.
suggested fix: thread an explicit `from` field through `CreateHoldByPartitionRequest` and
validate against it.

**B13. the documented never-expiring hold does not exist and cannot be reached.**
`IHoldTypes.sol:44-45` documents an `expirationTimestamp` of zero as meaning the hold never
expires. two places in the code disagree, in two different directions:
`LockStorageWrapper.requireValidExpirationTimestamp` (`:352-355`) rejects any expiration below
the current block timestamp, making zero unreachable at creation; and `isHoldExpired`
(`HoldStorageWrapper.sol:764-766`), `now >= expiration`, would read a zero-expiry hold as
permanently expired if one ever existed, the opposite of "never expires." confirmed by
`eth_call`: creating a hold with `expirationTimestamp = 0` reverts `WrongExpirationTimestamp()`.
suggested fix: allow zero through the validator and special-case it in `isHoldExpired`, or
correct the natspec to say a hold always expires.

**B14. the create path recovers its hold id by polling the mirror node rather than reading an
event.** the adapter creates a hold without passing an event name
(`RPCTransactionAdapter.ts:1019-1024`), so `res.response?.holdId` is undefined and the handler
falls through to polling `contracts/results/{hash}` for up to 15 seconds. a slow mirror node
makes the sdk report failure for a hold that exists on chain. this is the worst shape a defect
can take: a successful transaction reported as an error, indistinguishable from a real failure
without checking hashscan directly. suggested fix: pass the event name, as is done elsewhere in
the sdk, and read the hold id off the event log.

---

## module resolution, in both directions

three defects, none of which surface in the sdk's own reference app, because that app is built
with vite. two fail for anyone building without a bundler; the third fails specifically for an
app on a modern bundler-resolution setup, the opposite direction, same underlying cause: the
package was built and tested against one consumer and ships broken for every other shape of
consumer.

**B2. the sdk cannot be loaded in any browser bundler without hand-written shims.** one entry
point serves both node and browser. it pulls `winston`, which needs `fs`, via
`packages/ats/sdk/src/port/in/Common.ts:3-5`, and `dotenv` via `src/index.ts:4-6`. there is no
browser build and no `"browser"` field in `package.json`. the evidence this is a real problem
and not our misuse sits in the repository itself: the reference app solves it with stub aliases
at `apps/ats/web/vite.config.ts:38-45`. the maintainers hit this, worked around it locally, and
shipped the package without the fix. suggested fix: a `"browser"` field mapping both to stubs,
a separate browser entry point, or an injectable logger interface.

**B3. the published ESM build cannot be loaded by node.** `build/esm/src/index.js:5` re-exports
through extensionless relative specifiers, and there are 8,181 of them across the esm build.
node's esm resolver rejects extensionless specifiers; bundlers tolerate them, so this is
invisible to anyone using webpack, vite or turbopack and fatal to anyone importing the package
directly in node. suggested fix: one line of tsconfig, or a `tsc-alias` step, to emit explicit
`.js` extensions.

**B15. the typechain package's ethers types are unusable from a bundler-resolution app.**
`@hashgraph/asset-tokenization-contracts` declares `"type": "commonjs"`, so its generated
typechain declarations resolve `ethers` to `node_modules/ethers/lib.commonjs`. an app on
`"moduleResolution": "bundler"`, the next.js default and ours, resolves the same `ethers` to
`lib.esm`. ethers ships a separate declaration set per build, and both declare classes carrying
private fields, so the two `Network` types are nominally incompatible even though they are the
same class at runtime: `IAsset__factory.connect(address, signer)` fails to typecheck against a
`JsonRpcSigner` that is the correct runtime object, and no cast at the call site fixes it
cleanly, because the mismatch is in a transitive type. the typed factories, the entire reason
to depend on this package rather than a plain ABI, are unreachable from any app using bundler
resolution. our workaround, in `lib/ats/coupon.ts` and `lib/ats/collateral.ts`, both documented
inline: take `IAsset__factory.abi` and hand it to a plain `ethers.Contract`, which keeps the
correct ABI and discards the generated types. suggested fix: publish dual declarations, or add
an `exports` map with a `types` condition per resolution mode.

---

## two validators, one field, different values

the same failure shape, found twice independently: a value passes one check and is then sent
as, or checked against, something the first check never saw.

**B8. `Security.checkISIN` accepts an ISIN the deployed contract rejects, and finding out costs
gas.** `CreateBondRequest.validate()` calls `checkISIN`
(`domain/context/security/Security.ts:186-194`), which checks length and emptiness only, no
digit-check validation at all. the deployed factory enforces a real ISO 6166 mod-10 checksum
(`Factory.sol:283`'s `onlyValidISIN`, calling `isinValidator.sol:30-36`). we hit this directly,
not hypothetically: our first issuance attempt used `XS9999COV001`, sdk validation returned
zero errors, and the transaction reverted on chain with `WrongISINChecksum(string)`, costing
`0.18855433` HBAR to learn what the contract already knew. reverted transaction
[`0x305fbb1a04946a5c4e18dd98675f0891934b8db699633fba0579e4a345a02a0b`](https://hashscan.io/testnet/transaction/0x305fbb1a04946a5c4e18dd98675f0891934b8db699633fba0579e4a345a02a0b),
full mirror-node record in `EVIDENCE.md`'s friction log. the reissue five minutes later, with a
valid checksum, is the live token in this project's `EVIDENCE.md` G1. suggested fix: run the
same ISO 6166 check digit `isinValidator.sol` runs, client side, before a caller pays gas to
learn the same thing the contract already knows.

**B11. `expirationDate.substring(0, 10)` validates a different number than it sends.**
`CreateHoldByPartitionCommandHandler.ts:58` truncates the caller's `expirationDate` to its
first ten characters before sending it. `CreateHoldByPartition.ts:36-38` validated
`parseInt(val)` on the untruncated value. a 13-digit millisecond timestamp passes validation as
a year-58690 date and is then sent, correctly, as seconds; an iso 8601 string gives `NaN` at
validation and garbage at send time. suggested fix: validate the same value, in the same units,
that gets sent.

---

## documentation that contradicts the code

**B9. `updateMaturityDate`'s natspec contradicts its implementation.** `IMaturity.sol`'s
natspec states a new maturity date must be later than the current one. the on-chain guard
checks only `newDate > block.timestamp`
(`MaturityDateStorageWrapper.sol:56-60`). the "later than the current maturity" rule exists
only client-side, in the sdk's `ValidationService.checkMaturityDate`, so any caller reaching
the contract directly, which is every caller not using this sdk, can move a bond's maturity
date backwards, to any point in the future, and the contract accepts it. for our own use this
is convenient, since we compress a three-year lifecycle into a demo; but a documented invariant
that lives only in one client is not an invariant. suggested fix: enforce it on chain, or
correct the natspec to say what is actually guaranteed. (B13, above, is the same shape of
problem applied to hold expiration.)

---

## minor: developer traps and naming

grouped because each is real, none is severe, and each sits exactly where a developer building
the same flow will hit it next.

- **B4. `RequestAccount.privateKey` is a live field the sdk silently ignores.**
  `port/in/request/BaseRequest.ts:9` exposes an optional `privateKey` on the public request
  interface. nothing in the adapter layer consumes it, the raw-key signer it belonged to is
  disabled (`SupportedWallets.CLIENT` commented out, `domain/context/network/Wallet.ts:9`). a
  developer who supplies it will reasonably assume it is being used. it invites a caller to
  hand the sdk key material and discards it without complaint, which is a developer trap with a
  security shape. suggested fix: remove the field while `CLIENT` is disabled, or document it as
  unused.
- **B5. `@hashgraph/hedera-wallet-connect@2.1.2` has an undeclared dependency.** it imports
  `@hiero-ledger/proto` without declaring it in `dependencies` or `peerDependencies`, and the
  walletconnect adapter is registered unconditionally
  (`core/injectable/Injectable.ts:91-105`), so this breaks metamask-only consumers who never
  asked for walletconnect. suggested fix: declare the dependency, and register the adapter
  lazily.
- **B6. `Bond.createKpiLinkedRate`'s declared return type does not match its runtime value.**
  declared `SecurityViewModel`, all strings, at `port/in/bond/Bond.ts:228`; returns the domain
  `Security` spread verbatim, where `diamondAddress` is a `HederaId` and `maxSupply` a
  `BigDecimal`. produces `[object Object]` in a ui that trusts the declared type. suggested
  fix: map to the view model, or correct the declared type.
- **B7. `ROLE_MATURITY_MANAGER` is missing from the sdk's role enum.** `updateMaturityDate`
  requires it, but it is absent from `SecurityRole`, so callers must pass a raw hex literal to
  `grantRole` with no named constant to reach for.
- **B12. `targetId` means two different things on two sibling requests.** on
  `ExecuteHoldByPartitionRequest` it is the destination of the executed hold; on
  `ReleaseHoldByPartitionRequest` the adapter puts the same field name into
  `HoldIdentifier.tokenHolder` (`RPCTransactionAdapter.ts:1132-1136`), meaning the token holder
  instead. same name, two meanings, on two calls a developer writes next to each other.
  suggested fix: `destinationId` on execute, `tokenHolderId` on release.
- not an sdk defect, an inconsistency in the reference app: `apps/ats/web` encodes currency two
  different ways. `utils/format.ts:145-150` does correct ascii hex; the bond creation form at
  `CreateBond/Components/StepReview.tsx:109` concatenates decimal character codes as hex
  digits, so `"USD"` becomes `0x858368` instead of `0x555344`.

---

## investigated and withdrawn

deciding not to report something is part of reporting honestly. a reader who sees us discard
our own findings has a reason to believe the ones we kept.

**W1. `HoldDetails` constructor parameter naming.** `domain/context/security/Hold.ts:23-48`
names its first constructor parameter `executionTimeStamp` while assigning it to
`this.expirationTimeStamp`. we expected a value swap and checked for one. there is none: the
one call site, `port/out/rpc/RPCQueryAdapter.ts:886-894`, passes
`hold.expirationTimestamp_`, the contract's correctly named field, and `IHoldTypes.sol:51-58`
carries only one timestamp on the struct in the first place, so no swap was ever possible. the
returned value is correct. a cosmetic parameter rename with zero behavioural effect. mentioned
here only for completeness, not filed.

**W2. `scheduledTask` naming.** we briefly read ATS's `scheduledTask` as an integration with
the hedera schedule service. it is not: it is an internal EVM task queue in
`domain/orchestrator/ScheduledTasksOps.sol`, drained by the next state-mutating call. on
investigation this was our misreading, not a documentation gap. `docs/ats/user-guides/
corporate-actions.md:283-337` documents the queue mechanism thoroughly and accurately,
including force-cancel semantics and queue-blocking behaviour. greps for "hedera schedule
service", "schedule service", "HSS" and the schedule service's precompile address across
`docs/` and `README.md` return zero hits. ATS never claims native scheduling anywhere. we
conflated "scheduled" and "built on hedera" without reading the surrounding documentation. no
report filed, recorded here because we nearly filed one.

---

## how this was gathered

every entry above was hit by building a working submission: an issued bond, a compliance gate,
a coupon, a collateral hold, against a real hedera testnet deployment, using the sdk as
documented. B1 is the one that reshaped the project, see the tokenization writeup for what we
built once the kpi-linked path turned out to be dead, and it is the one worth a judge's full
attention if only one is read. the rest are proportionate to their severity, not to how many
words it takes to describe them: fifteen entries earns grouping, not fifteen equal-weight
paragraphs.
