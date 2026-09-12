# covenant

a tokenised private credit note whose interest rate and collateral haircut are set by a
confidential compute engine that reads the borrower's private financials, so a cash lender
can price a risk it is not permitted to inspect.

built on the Hedera Asset Tokenization Studio (ATS), for ETHGlobal ETHOnline 2026.

**built solo, by one person directing a team of AI agent configurations running on Claude.**
every on-chain transaction in this project was signed by a human in MetaMask, not by an
agent; see [`AI_USAGE.md`](./AI_USAGE.md) for what was AI-written, what was not, and why the
distinction is checkable rather than asserted.

---

## what this is

a private credit fund lends to a mid-sized company and sells participation in that loan to
holders in smaller slices. the note holder wants liquidity without waiting out the note's
term. a cash lender will advance against the note as collateral, but has no right to see the
borrower's books, so it cannot price the haircut itself. covenant answers that with a
confidential compute engine: the borrower's revenue, EBITDA, total debt, cash and interest
expense go in, and only a covenant verdict, a kpi value and a haircut come out. today the
engine runs as a plain local service behind a clean interface; the target is the same
computation behind a Chainlink CRE `handlerInTee`, inside a hardware-isolated enclave. the
lender learns the verdict and the haircut, which is enough to recover the exact net
leverage, but never the revenue, EBITDA, total debt, cash or interest expense behind it. the
note itself, its compliance gate, its coupon and its collateral hold run on the ATS diamond
on Hedera testnet, through the pre-deployed resolver and factory. we write no Solidity and
deploy no contracts.

what this replaces trust in, and what it does not, is the load-bearing paragraph of this
project. read `PROJECT_BRIEF.md` §4 before assuming more than the paragraph above claims.

---

## why this exists

this argument used to open the application's landing page. it is here instead, because a
judge reads the argument in a README and opens an application to see whether the thing
works. the app is now the product, the live figures and the three role views; the case for
it is below.

**the situation.** private credit is roughly 1.7 trillion dollars of loans held outside the
banking system. a fund lends to a company and sells participations in that loan to pension
funds and family offices. a participation is a note, and its buyer holds an illiquid claim
for three years. a note holder who wants cash before maturity does not have to sell at a
discount: it can pledge the note and borrow against it. the cash lender on the other side
has to set one number, which is what percentage of the note it will advance.

**what is wrong with it.** that percentage depends on the borrower's financials, and the
lender has no right to see them. so an agent bank reads the books and announces a number.
nobody else can check it, and the borrower pays the agent bank. that is the loudest standing
criticism of the asset class rather than a contrivance for a demonstration: the marks are
self-reported and unverifiable, and the party producing them is never independent of the
party being marked.

**what changes.** covenant gives that job to a program, published before the facility is
struck, so both sides read the test before either side relies on it. the borrower's filing
goes in. two things come out: whether the covenant passed, and what percentage of the note
to advance against it. the advance rate is a published function of the borrower's leverage,
so a lender can work back to that one ratio. that is intended, because leverage is the
covenant it agreed to and the thing it is lending against. it cannot recover the revenue,
EBITDA, total debt, cash or interest expense behind that ratio, because one ratio in several
unknowns fixes none of them. and once the note is pledged, the power to seize it on default
sits on chain with a named party that is not the agent bank; the token refuses the call from
anyone else.

**vocabulary, used the same way everywhere in this project.** the *advance rate* is the
percentage of the note's nominal a lender will lend against. the *haircut* is the rest. they
are one number stated two ways, and `/`, `/holder` and `/lender` all show the pair rather
than making a reader translate between them.

---

## status

**honest, as of 12 sep 2026. this section is updated as gates go green and nothing here is
written ahead of the evidence.** the table below mirrors `EVIDENCE.md` gate by gate. update
it there first, then here, never the other way round.

**G1 through G4 are green. a complete, submittable hedera entry exists, and it now includes
the collateral hold.** a bond is issued, a transfer is blocked by KYC then granted then
permitted, a coupon is set, snapshotted and its entitlements read, and a collateral hold was
created, released and created again to be executed on default, all independently re-verified
by argus against the mirror node and the testnet json-rpc relay, not against this project's
own console or transcript. the application code in `app/` covers the landing page organised
by party (`app/page.tsx`), the role-shaped views (`app/holder/`, `app/lender/`, `app/engine/`)
and the transaction-level operator console at `/console` (`app/console/`), which is what
produced every gate below. kpi posting is not built and is not claimed, see the G1 naming
caveat. the CRE leg (G5) has not been attempted.

| gate | proves | status |
|---|---|---|
| G1 | bond issued on Hedera testnet, visible on HashScan | **VERIFIED** |
| G2 | transfer blocked by KYC, grant issued, same transfer succeeds | **VERIFIED** |
| G3 | coupon distributed to holders of record. **first submittable entry** | **VERIFIED** |
| G4 | `setCouponRateType(FIXED)` set, engine's rate posted by role-gated `setRate` and stamped into a coupon by the token, hold created, released, created again and executed on default | **VERIFIED** |
| G5 | confidential engine running behind a CRE `handlerInTee`, or an honestly-labelled CRE CLI simulation | not started |
| G6 | video, README, three per-prize writeups, evidence, upstream PR prepared | not started |

G1 through G4 together are a complete submission. G5 is upside, not a shortfall.

### G1, in full

every value below was checked independently against Hedera's mirror node and the testnet
json-rpc relay, not against this project's own console. full method in `EVIDENCE.md` G1.

| field | value |
|---|---|
| token (contract) id | `0.0.10450229` |
| token evm address | `0xc10cac0e7afd175faf04572327c85e54f015ca87` |
| transaction | [`0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078`](https://hashscan.io/testnet/transaction/0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078) |
| contract, hashscan | https://hashscan.io/testnet/contract/0.0.10450229 |
| signer | `0.0.10424387` (issuer) |
| cost | 7.80696070 HBAR |
| name / symbol | Covenant KPI-Linked Private Credit Note 2029 / CVNT29 |
| isin | XS9999COV006 |
| decimals / max supply | 2 / 100000 |
| configuration | `0x...02`, bond variable rate, version 1, operational |
| coupon rate type | STANDARD (1) at issuance. switched to FIXED before the first coupon, see G3 below |

**a naming caveat, stated plainly so the name does not imply more than it does.** the token's
name says "KPI-Linked". the on-chain mechanism does not match the name. config `0x...02`
carries `CouponFacet` and `InterestRateFacet`, not `KpisFacet` or `KpiLinkedRateFacet`.
`addKpiData` is not callable on this token. the configuration that does carry the KPI-linked
mechanism, config `0x...04`, is registered in the deployed resolver and unreachable by any
working path (`BUG.md` B1). "KPI-Linked" in the name describes the private credit instrument
covenant models, not a claim about what runs on this token. the KPI reading is converted to a
coupon rate off chain instead, against bounds fixed at issuance, and posted through a
role-gated `setRate` transaction that the token then owns. see `PROJECT_BRIEF.md` §3 step 5
and §4, and `DECISIONS.md` D16, for the full account of what this costs and why.

**the open item, now resolved.** the token issued with coupon rate type STANDARD, meaning it
would have accepted whatever rate a caller handed it. `setCouponRateType(FIXED)` was called
before the first coupon (see G3 below), so the token now refuses a caller-supplied rate and
stamps every coupon from its own storage instead. that is the difference the writeup leans on.

### G2, in full

status **VERIFIED**. every value below was checked independently against Hedera's mirror node
and the testnet json-rpc relay, at both `"latest"` and specific historical block numbers, not
against this project's own console or transcript. `GET /contracts/0.0.10450229/results` returns
exactly nine results for this token, so the sequence below is the complete on-chain history, not
a curated subset. full method, all nine transactions and every check: `EVIDENCE.md` G2.

| step | transaction | result |
|---|---|---|
| `transferByPartition` (issuer to holder, 250.00 notes), blocked | [`0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5`](https://hashscan.io/testnet/transaction/0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5) | `CONTRACT_REVERT_EXECUTED` |
| `grantKyc` (holder) | [`0x15e3d2a0590741fa0b6f07c5966d88ba8f08c2753fdf08474b219e58720f375a`](https://hashscan.io/testnet/transaction/0x15e3d2a0590741fa0b6f07c5966d88ba8f08c2753fdf08474b219e58720f375a) | `SUCCESS` |
| `transferByPartition` (issuer to holder, 250.00 notes), same calldata, now permitted | [`0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5`](https://hashscan.io/testnet/transaction/0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5) | `SUCCESS` |

the three rows above are the demo shots. the full nine-transaction sequence also includes
`applyRoles`, `addIssuer`, `grantKyc` (issuer, self), `issueByPartition` (mint), `grantKyc`
(lender), and one redundant `grantKyc` (holder, again) that correctly reverts because the
holder was already granted, all decoded and listed in `EVIDENCE.md` G2.

**naming correction.** both transfers move 250.00 notes from the issuer to the account labelled
"note holder" (`0.0.10444395`), decoded directly off both transactions' calldata. the account
labelled "lender" (`0.0.10444404`) receives a `grantKyc` in this same block but is not a party
to either transfer.

**the compliance claim, proven twice.** the ATS sdk's own `checkCanTransfer` refuses the blocked
transfer client-side, before any transaction is constructed, so that refusal leaves nothing on
chain to verify independently. to put a genuinely reverted transaction on chain, we also forced
one raw attempt, bypassing the sdk's client-side check via a direct call in the same pattern
already used for `setCouponRateType`: the blocked transfer above,
[`0x904d61cc…`](https://hashscan.io/testnet/transaction/0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5),
reverts with `error_message` `0xfc855b1b0000000000000000000000007b3f60333a54e03c4ee4240d2ba2f9600c502e1e`.
selector `0xfc855b1b` is `InvalidKycStatus()`, recomputed independently in the verification
session (`ethers.id("InvalidKycStatus()").slice(0,10)`) and matched against
`facets/kyc/IKyc.sol:57`; the trailing word decodes to the holder's own address, the transfer's
recipient. both are true. **a judge can verify only the second one**, directly on hashscan,
without trusting anything we say: the sdk's client-side refusal happens before a transaction
exists and leaves no chain record.

**identity caveat.** the `grantKyc` calls carry a placeholder credential identifier
(`covenant-testnet-kyc-<address prefix>`) that the contract stores and never verifies. we
exercised the token's compliance gate. we did not verify anyone's identity, and do not claim to.

### G3, in full

status **VERIFIED. a submittable hedera entry exists.** eight transactions, signed by the
issuer throughout, token `0.0.10450229` unchanged since G1/G2. full method and every check:
`EVIDENCE.md` G3.

| step | transaction | result |
|---|---|---|
| `applyRoles` (INTEREST_RATE_MANAGER, CORPORATE_ACTION → issuer) | [`0xa4af41d0…`](https://hashscan.io/testnet/transaction/0xa4af41d077915da2c819fe39ab92e8d38df86f7f3ff050c3e252e5c1d71a6399) | `SUCCESS` |
| `setCouponRateType(FIXED)` | [`0xb0677394…`](https://hashscan.io/testnet/transaction/0xb0677394cef05a6324b900e349e522e577c19f4b05dbaf10d8a0739d50f358cc) | `SUCCESS` |
| `FixedRate.setRate(600, 4)` | [`0x9c920915…`](https://hashscan.io/testnet/transaction/0x9c92091520459b23d95608e3d10e4466016f29550ebdc3f386c96ee62684439d) | `SUCCESS` |
| `setCoupon` (pending triplet) | [`0x436298a6…`](https://hashscan.io/testnet/transaction/0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1) | `SUCCESS` |
| trigger pending scheduled tasks (internal EVM queue, not the Hedera Schedule Service) | [`0x7738f48b…`](https://hashscan.io/testnet/transaction/0x7738f48b23aa9ae53132b28332addde8c09836311b9b43541644629af83576b0) | `SUCCESS` |
| `grantRole` (ROLE_MATURITY_MANAGER → issuer) | [`0x4a2c16f1…`](https://hashscan.io/testnet/transaction/0x4a2c16f1eae577af8168de86b6942f2360dd6ba983cde39133efd8bb9fc0568d) | `SUCCESS` |
| `updateMaturityDate` (compress) | [`0x98e9a148…`](https://hashscan.io/testnet/transaction/0x98e9a148cef1403825421a52f9f8f26571b553b20b9d3cf75a6596e4bcbb4b33) | `SUCCESS` |
| settle in HBAR, agent action, not an ATS operation, see below | [`0x98043075…`](https://hashscan.io/testnet/transaction/0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404) | `SUCCESS` |

**the strongest single fact in the project.** `setCoupon` was sent with the pending triplet:
`rate = 0`, `rateDecimals = 0`, `rateStatus = PENDING`. the `CouponSet` event that same
transaction emitted carries the coupon **as stored**: `rate = 600`, `rateDecimals = 4`,
`rateStatus = SET`. **we never named 600.** the token refused the caller's rate and priced the
coupon from a storage slot `FixedRate.setRate` had written 33 seconds earlier, through a
separately role-gated call. anyone can decode the same transaction and check it, without
trusting our transcript.

stated with its real limits, not overstated: the same account holds both the rate-setting role
and the coupon-declaring role in this demo, nothing on chain binds `600` to the confidential
engine specifically, and `setRate` can be called again at any time, so `FIXED` does not mean
locked. what the protocol enforces is that the coupon rate is one of record, read from storage,
rather than one chosen per coupon by whoever calls `setCoupon`. the binding to the engine is
ours to claim, and it is checkable a different way: `rateForKpi` is published
(`lib/ats/note-terms.ts`), and `rateForKpi(200) == 600` is exactly what the token's own
`getRate()` returns.

**ordering, proven by block number.** `getCouponRateType()` flipped to FIXED at block
`40348683` while `getCouponCount()` was still `0`, and stayed `0` for 34 further blocks until
`setCoupon` landed at block `40348717`. the switch happened strictly before any coupon existed.
this matters because `InterestRate.sol:38` carries an unresolved maintainer TODO on whether
switching rate type after a coupon exists is safe; we did not test that path.

**three things a judge would otherwise find first.**

1. **ATS declared the coupon and moved no value.** the coupon facet has no `pay` method;
   `getCouponFor` and `getCouponAmountFor` make the entitlement readable, nothing more. the cash
   leg is the last row above, a separate HBAR transfer signed by the agent, at a stated demo
   scale of **1 HBAR per 1,000 of entitlement**, because the entitlement is denominated in the
   note's own currency and testnet has no such instrument to move. not an exchange rate, a scale
   factor stated once and applied once. the issuer holds 750 of 1,000 notes and did not pay
   itself: no transaction anywhere on this token's history moves value to the issuer.
2. **the accrual window is backdated a full quarter.** the coupon's `startDate` is 2026-06-12
   and its `endDate` is 2026-09-10, roughly ninety days, so the entitlement is sized the way a
   real quarterly coupon would be. the token itself was created 2026-09-09, one day before that
   window closes. the window sits mostly before the token existed. this is a demo compression,
   stated here rather than left for a reader to notice.
3. **the token's own `name()` still reads "Covenant KPI-Linked Private Credit Note 2029," and
   its maturity now reads 2026-09-11**, permanently and publicly, because `updateMaturityDate`
   compressed a three-year lifecycle into this demo. a judge opening the token on hashscan sees
   both. and the token carries no KPI facet at all: config `0x...02` has `CouponFacet` and
   `InterestRateFacet`, not `KpisFacet` or `KpiLinkedRateFacet`, because the KPI-linked
   configuration cannot be deployed against by any working path (`BUG.md` B1). "KPI-Linked" in
   the name describes the instrument covenant models, not a claim about what facet runs on this
   token.

### G4, in full

status **VERIFIED**. this is the project's central claim and it holds: two holds, same token,
same escrow, resolved in opposite directions, decoded from calldata and event logs, not from
source or from transcript. token `0.0.10450229` unchanged since G1 through G3. full method and
every check: `EVIDENCE.md` G4.

| step | transaction | signer | result |
|---|---|---|---|
| `createHoldByPartition` (hold A, 100.00 notes) | [`0x46c5fbaa…`](https://hashscan.io/testnet/transaction/0x46c5fbaa4c88d04f53cbdaeb36979a7d8b6c6c2609beef9d3807b28d15cc919d) | `0.0.10444395` (holder) | `SUCCESS` |
| `releaseHoldByPartition` (hold A) | [`0x224eb538…`](https://hashscan.io/testnet/transaction/0x224eb5384684e450039153eeb521bbb39ac9aabe5edc1d34d4a86f5634ed09e0) | `0.0.10445014` (engine) | `SUCCESS` |
| `createHoldByPartition` (hold B, 100.00 notes) | [`0xea01d72c…`](https://hashscan.io/testnet/transaction/0xea01d72c1c3f13b06be59b2c2e2219a9ead90e9da61cee56f3fca3d733647800) | `0.0.10444395` (holder) | `SUCCESS` |
| `executeHoldByPartition` (hold B, default) | [`0xed43e199…`](https://hashscan.io/testnet/transaction/0xed43e199b78b21069f6bd0f5536cf2c42b3ad34ddb5d211de69407c32ba490c5) | `0.0.10445014` (engine) | `SUCCESS` |

**what this gate is not.** `PROJECT_BRIEF.md` §11 item 4, `addKpiData` and the on-chain rate
step, is not part of this gate. it was already established as unreachable on this token (G1's
naming caveat), and the rate leg that is real on this token was signed and verified under G3,
before the first coupon. nothing in the four transactions above touches the rate. this gate's
chain evidence is the hold lifecycle only.

**the load-bearing question: escrow and destination, for both holds, decoded from chain data,
not from source.** both `createHoldByPartition` calls decode, from calldata, to the identical
tuple `(amount, expirationTimestamp, escrow, to, data)` with `escrow = 0.0.10445014` (the
engine) and `to = 0.0.10444404` (the lender), on both holds. the `HeldByPartition` event each
create transaction emits agrees independently: same escrow, same destination, on both. **`to`
is non-zero on both**, which matters specifically: `HoldStorageWrapper.sol:1086-1088` skips the
destination check entirely when `hold.to == address(0)`, which would have let the escrow send
the collateral anywhere. it did not apply here. the destination was pinned to the lender at
creation, on both holds, checked from the calldata itself, not read back from a field we wrote.

**the strongest form of the argument.** `isEscrow(hold, addr)` is a plain equality, called from
the one path both release and execute route through, and it reverts `IsNotEscrow()`
unconditionally for any caller that is not the recorded escrow. neither `executeHoldByPartition`
nor `releaseHoldByPartition` carries any admin or role modifier of its own. so the fact that
both transactions above, signed by `0.0.10445014`, landed as `SUCCESS` is itself proof of who
the enforced escrow was: had the check been keyed to any other address, both would have
reverted regardless of what the console displayed. that is stronger evidence than a field read
back from state, because it is the contract's own gate having already been satisfied.

**the collateral actually moved.** decoded from `TransferByPartition` events, not inferred: the
100.00 notes leave the holder's transferable balance at hold B's creation and land in the
lender's balance at hold B's execution. live balances confirm the same movement: the holder
fell from 250.00 (established under G2/G3) to 150.00, the lender rose from 0 to 100.00, and
`totalSupply()` stayed at 1000.00 throughout. hold A's 100.00 came back to the holder on
release and is included in that net, not lost anywhere.

**cost, and who paid.** this gate was paid entirely by the holder and the engine, neither of
which is the issuer: the holder signed both creates (1.28926268 HBAR), the engine signed the
release and the execute (1.08615491 HBAR). running total across G1 through G4, across three
distinct accounts, is **18.29866232 HBAR**.

---

## what runs today

this repository is a next.js 16 / react 19 app with the ATS sdk (`@hashgraph/asset-tokenization-sdk@8.0.0`)
as an npm dependency. `npm run dev` serves a landing page organised by party (`app/page.tsx`),
three role-shaped views, the note holder's position (`app/holder/`), the lender's narrowed view
(`app/lender/`) and the agent's confidential engine console (`app/engine/`), and the
transaction-level operator console at `/console` (`app/console/`). the operator console holds
four panels in ship order: issuance (`app/console/issue-panel.tsx`, G1), compliance
(`app/console/block-b-panel.tsx`, G2), rate and coupon (`app/console/block-c-panel.tsx`, G3) and
the collateral hold (`app/console/block-e-panel.tsx`, G4). every gate in `EVIDENCE.md` was
signed through one of these four panels. kpi posting is not built and is not claimed, see the
G1 naming caveat. the instructions below are for running what exists, and will describe more as
the build order in `MASTER_TODO_LIST.md` moves through its gates.

```
node   >= 20.19.4
npm    >= 10.9.0

npm install
cp .env.example .env.local   # every value is already correct, nothing to fill in
npm run dev
```

`.env.example` is the committed template and the source of truth for every address this
project uses. it sets the Hedera testnet network, the deployed ATS resolver and factory, the
bond config id, and four testnet accounts, one per party in the flow:

| role | account | does |
|---|---|---|
| issuer / agent | `0.0.10424387` | issues the note, grants KYC, sets and distributes the coupon, posts the engine's rate via `setRate` |
| note holder | `0.0.10444395` | receives the note, is the blocked-then-permitted transfer target, pledges the collateral hold |
| lender | `0.0.10444404` | advances cash at the engine's haircut, receives collateral if the hold is executed |
| engine, as `Hold.escrow` | `0.0.10445014` | the only account authorised to release or execute a hold. deliberately not the issuer's account, see `DECISIONS.md` D5 |

**there is no local-key signer.** `SupportedWallets.CLIENT` is disabled in ATS sdk v8, so
every transaction is signed by a human clicking a browser wallet (MetaMask) on the relevant
account, not by a script holding a key. no private key exists in this repository, in
`.env.local`, or in any agent's context, by design. see `DECISIONS.md` D3.

---

## what is real and what is not

- **we deploy no contracts.** we issue and operate a note against the pre-deployed ATS
  business logic resolver `0.0.9212226` and factory `0.0.9213391`, both already on Hedera
  testnet before this project started.
- **there is no on-chain attestation of the enclave.** the confidential engine's output,
  the covenant verdict, the KPI value, and the haircut, reaches the chain only because a
  human reads it off a screen and signs a transaction. nothing on Hedera verifies that the
  published computation is what ran, or that the value a human typed in matches its output.
  see `docs/architecture.md` for exactly where that boundary sits and what it deliberately
  does not draw.
- **the confidential engine runs today as a plain local service**, behind a clean interface.
  the lender-view / agent-view split that makes confidentiality visible on screen is built
  and working: the agent console shows the borrower's inputs, and `/lender` renders only the
  verdict, the kpi value and the haircut, narrowed server-side before the page ever reaches
  the client. the target is to run the same computation behind a Chainlink CRE
  `handlerInTee`, a hardware-isolated, TEE-based enclave. if that does not land in the
  build's timebox, the fallback is a CRE CLI simulation of the same handler. whichever ships,
  `EVIDENCE.md` and the Chainlink writeup say so plainly rather than implying a live
  deployment that did not happen.
- **ATS is ERC-1400 compliant with partial ERC-3643 support.** it is not a full ERC-3643
  implementation. we do not claim otherwise anywhere in this project.
- **the ATS `scheduledTask` facet is an internal EVM task queue**, drained lazily by the
  next state-mutating call. it is not the Hedera Schedule Service. we do not claim the
  Scheduled Transactions extra-points line for this reason. see `DECISIONS.md` D13 and D14.
- **the coupon payment and the lender's cash advance are both off-chain**, tracked in the
  console rather than moved by an ATS transaction. `setCoupon` records terms on-chain and
  the holder list is read from the chain; paying the holders is not itself a transaction.
  the collateral hold moves the note, not cash.
- **the lender only ever sees the verdict and the haircut**, and that is less private than
  it first looks: the haircut is a linear function of the kpi value with an offset fixed by
  the disclosed verdict, so it inverts back to the exact net leverage. what it does not
  invert to is the leverage figure's own inputs, revenue, EBITDA, total debt, cash and
  interest expense, one ratio being public does not make its numerator and denominator
  public. see `docs/architecture.md` for the arithmetic.

---

## evidence

every factual claim in this project traces to a transaction id and a HashScan link in
[`EVIDENCE.md`](./EVIDENCE.md). if a claim has no line there, it is not made. `EVIDENCE.md` is
owned by argus, the AI agent configuration in this build assigned to verification, and every
entry in it is independently re-checked against Hedera's mirror node and HashScan, not taken
on trust from whichever agent built the flow. see [`AI_USAGE.md`](./AI_USAGE.md) for what
"agent" means here.

---

## architecture

[`docs/architecture.md`](./docs/architecture.md) is the diagram of record. it answers one
question: what enters the confidential engine, what leaves it, and who can see each. it also
draws, on purpose, everywhere the diagram does not imply an on-chain guarantee that does not
exist.

---

## more

- [`PROJECT_BRIEF.md`](./PROJECT_BRIEF.md), what is being built and why, including the
  argument in §4 for why this is not the obvious tokenised-treasury submission, and the
  weaknesses named against ourselves in §9
- [`DECISIONS.md`](./DECISIONS.md), every non-obvious call made during the build, with
  reasoning, and any standing objection logged rather than silently overruled
- [`MASTER_TODO_LIST.md`](./MASTER_TODO_LIST.md), the build order, the gates, and the
  current phase
- [`specs/`](./specs), the spec files and prompts committed as part of this build, including
  the ATS sdk operation surface mapped to file and line in `specs/02-sdk-surface.md`
