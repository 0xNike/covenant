# hedera, tokenization of anything

**prize:** hedera, tokenization of anything ($6,000, 3 slots). the primary submission.
**repository:** https://github.com/0xNike/covenant
**evidence of record:** [`EVIDENCE.md`](../EVIDENCE.md). every factual claim below traces to a
line there. where a line is not yet filled, this document says so with a placeholder, not with
a claim.

**status at time of writing, 11 sep 2026.** three gates are verified on chain: issuance, the
compliance gate, and the coupon. a complete, submittable hedera entry exists. the fourth,
KPI posting and the collateral hold, is not yet built. this document is written to be updated
as further signatures land, not rewritten. see the gate table below.

---

## one-line description

a tokenised private credit note whose interest rate and collateral haircut are set by a
confidential compute engine that reads the borrower's private financials, so a cash lender can
price a risk it is not permitted to inspect. issued and operated on the hedera asset
tokenization studio (ATS), against the pre-deployed resolver `0.0.9212226` and factory
`0.0.9213391`. we write no solidity and deploy no contracts.

---

## the mandatory gates, §6 of `PROJECT_BRIEF.md`

| gate | requirement | status | evidence |
|---|---|---|---|
| 1 | ATS used to issue and manage a tokenised asset | issuance, the compliance gate and the coupon are verified on chain; the collateral hold is not yet built | issuance, G2 and G3: see below. hold: `[G4 tx: pending]` |
| 2 | deployed and demonstrated on hedera testnet | issuance, the compliance gate and the coupon are demonstrated on hedera testnet; the collateral hold is demonstrated once G4 turns green | see gate table |
| 3 | public github repository, contracts verified on hashscan where applicable | repository is public at the link above. we deploy no contracts, so there is nothing to verify on hashscan in that sense; instead we show the token deployment and every lifecycle transaction directly on hashscan | `[repository visibility confirmed: pending]` |
| 4 | demo video, five minutes or less, showing issuance, configuration and at least one lifecycle operation | scripted in `docs/video-script.md`, not yet cut | `[video link: pending]` |

### issuance, verified

a bond was issued on hedera testnet through `Bond.createKpiLinkedRate`'s working sibling path
(config `0x...02`, see "the rate leg" below for why not the KPI-linked config), signed by the
issuer account `0.0.10424387`.

| | |
|---|---|
| token (contract) id | `0.0.10450229` |
| token evm address | `0xc10cac0e7afd175faf04572327c85e54f015ca87` |
| transaction | [`0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078`](https://hashscan.io/testnet/transaction/0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078) |
| contract, hashscan | https://hashscan.io/testnet/contract/0.0.10450229 |
| name / symbol | Covenant KPI-Linked Private Credit Note 2029 / CVNT29 |
| isin | XS9999COV006, ISO 6166 checksum valid (see the open-source writeup for how we found this the hard way) |

full independent verification method, run against the mirror node and the testnet json-rpc
relay rather than against this project's own console, is in `EVIDENCE.md` G1.

### G2, compliance, verified

signed by the issuer, `0.0.10424387`, throughout. a transfer of 250.00 notes to the note holder,
`0.0.10444395`, is rejected by the token itself; kyc is granted through the token's internal
`Kyc.grantKyc` facet; the same calldata, byte for byte, then succeeds.

| step | transaction | result |
|---|---|---|
| `transferByPartition`, blocked | [`0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5`](https://hashscan.io/testnet/transaction/0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5) | `CONTRACT_REVERT_EXECUTED` |
| `grantKyc` (holder) | [`0x15e3d2a0590741fa0b6f07c5966d88ba8f08c2753fdf08474b219e58720f375a`](https://hashscan.io/testnet/transaction/0x15e3d2a0590741fa0b6f07c5966d88ba8f08c2753fdf08474b219e58720f375a) | `SUCCESS` |
| `transferByPartition`, same calldata, now permitted | [`0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5`](https://hashscan.io/testnet/transaction/0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5) | `SUCCESS` |

full nine-transaction sequence, including the prerequisite role grants and mint, and one
redundant `grantKyc` that correctly reverts because the holder was already granted:
`EVIDENCE.md` G2.

**the compliance claim, proven twice.** the sdk's own `checkCanTransfer` refuses the blocked
transfer client-side, before any transaction is built, so that refusal leaves nothing on chain
to verify independently. to put a genuinely reverted transaction on chain, we also forced one
raw attempt, bypassing the sdk's client-side check the same way we called
`setCouponRateType` directly, below: the blocked transfer above reverts with `error_message`
`0xfc855b1b0000000000000000000000007b3f60333a54e03c4ee4240d2ba2f9600c502e1e`. selector
`0xfc855b1b` is `InvalidKycStatus()`, recomputed independently and matched against
`facets/kyc/IKyc.sol:57`; the trailing word decodes to the holder's own address. both refusals
are real. **a judge can verify only the second one**, directly on hashscan, without trusting
anything we say: the client-side refusal happens before a transaction exists and leaves no
chain record.

### G3, coupon, verified. the strongest single fact in the project

signed by the issuer throughout, token `0.0.10450229` unchanged since G1/G2. eight
transactions: `applyRoles`, `setCouponRateType(FIXED)`, `FixedRate.setRate(600, 4)`,
`setCoupon`, the internal scheduled-task queue drain, `grantRole` for
`ROLE_MATURITY_MANAGER`, `updateMaturityDate`, and a settlement transfer in HBAR. full table
and every check: `EVIDENCE.md` G3.

- `setCouponRateType(FIXED)`:
  [`0xb0677394cef05a6324b900e349e522e577c19f4b05dbaf10d8a0739d50f358cc`](https://hashscan.io/testnet/transaction/0xb0677394cef05a6324b900e349e522e577c19f4b05dbaf10d8a0739d50f358cc)
- `FixedRate.setRate(600, 4)`:
  [`0x9c92091520459b23d95608e3d10e4466016f29550ebdc3f386c96ee62684439d`](https://hashscan.io/testnet/transaction/0x9c92091520459b23d95608e3d10e4466016f29550ebdc3f386c96ee62684439d)
- `setCoupon` (pending triplet):
  [`0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1`](https://hashscan.io/testnet/transaction/0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1)
- `updateMaturityDate`:
  [`0x98e9a148cef1403825421a52f9f8f26571b553b20b9d3cf75a6596e4bcbb4b33`](https://hashscan.io/testnet/transaction/0x98e9a148cef1403825421a52f9f8f26571b553b20b9d3cf75a6596e4bcbb4b33)
- settlement transfer in HBAR:
  [`0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404`](https://hashscan.io/testnet/transaction/0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404)

`setCoupon` was sent with the pending triplet, `rate = 0`, `rateDecimals = 0`,
`rateStatus = PENDING`. the `CouponSet` event that same transaction emitted carries the coupon
as stored: `rate = 600`, `rateDecimals = 4`, `rateStatus = SET`. **we never named 600.** the
token refused the caller's rate and priced the coupon from a storage slot `FixedRate.setRate`
had written 33 seconds earlier, through a separately role-gated call. this is examined in full
under "the rate leg, precisely" below.

**gates 1 through 3 together are a complete, submittable hedera entry.** the collateral hold,
G4, is upside, not a requirement we are short of. see `specs/00-mission.md`'s ship order.

---

## extra points, targeting 4 of 6

### compliance controls

the token is issued with `internalKycActivated: true`. a transfer of 250.00 notes from the
issuer to the note holder, `0.0.10444395`, without a kyc grant, is proven blocked two ways.
first, the sdk's own `checkCanTransfer` pre-check throws client-side, before any transaction is
built, so that refusal leaves nothing on chain to verify independently (a property of the sdk's
validation path, not of our build; see the integration note in the open-source writeup).
second, we forced the same calldata through directly, bypassing that client-side check, and it
reverted on chain:
[`0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5`](https://hashscan.io/testnet/transaction/0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5),
`error_message` decoding to selector `0xfc855b1b`, `InvalidKycStatus()`, with the holder's own
address appended as the offending account. **a judge can verify only the second refusal**,
directly on hashscan; the client-side one leaves no chain record to check. kyc is then granted
through the token's own internal `Kyc.grantKyc` facet
([`0x15e3d2a0590741fa0b6f07c5966d88ba8f08c2753fdf08474b219e58720f375a`](https://hashscan.io/testnet/transaction/0x15e3d2a0590741fa0b6f07c5966d88ba8f08c2753fdf08474b219e58720f375a)),
carrying a placeholder credential identifier that the contract stores and never verifies. **we
do not claim to have verified anyone's identity.** we claim, and only claim, that we exercised
the token's compliance gate: the same calldata that was rejected now succeeds,
[`0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5`](https://hashscan.io/testnet/transaction/0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5).

### coupon distributions

`setCoupon` records rate and dates on chain and the holder list is read from the chain via
`getCouponFor` / `getCouponAmountFor`. paying holders is a separate, off-protocol step, a plain
HBAR transfer rather than an ATS transaction; ATS has no
`pay` method on the coupon facet (confirmed by reading the full `ICoupon.sol` interface,
`specs/05` §3). what we claim is the on-chain declaration and the resulting on-chain
entitlement, not a push payment:
[`0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1`](https://hashscan.io/testnet/transaction/0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1)
declared the coupon; the settlement that follows it,
[`0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404`](https://hashscan.io/testnet/transaction/0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404),
is a plain HBAR transfer the agent signs, not an ATS operation. see "the rate leg, precisely"
below for what `setCoupon` actually did, and "what `setCoupon` proved, and what it did not"
for what this gate does and does not settle in value.

### oracle and NAV

the confidential compute engine is the oracle and NAV leg. it reads the borrower's revenue,
EBITDA, total debt, cash and interest expense and returns a covenant verdict, a kpi value (net
leverage) and a haircut. it runs today as a plain local service behind a swappable interface
(`lib/engine/registry.ts`), which is also the interface the chainlink leg targets, see the
chainlink writeup. the engine's output reaches the token as described in "the rate leg" below.
`docs/architecture.md` is the diagram of record for where this boundary sits.

### contributions upstream to ATS

`BUG.md` B1: the KPI-linked bond configuration, `0x...04`, is registered in the deployed
resolver and cannot be deployed against by any path. this is verified against the live
resolver with `getFacetIdByConfigurationIdVersionAndSelector`, not inferred from source alone
, see `EVIDENCE.md` G1 item 6 and the open-source writeup for the full account. the upstream
pull request is prepared and has not been opened, per this project's own rule that opening it
needs approval outside this document's scope. `[upstream PR: pending]`.

### the two we did not target, and why

**scheduled transactions, dropped and not claimed.** ATS's `scheduledTask` is an internal EVM
task queue, drained lazily by the next state-mutating call, not the hedera schedule service.
six greps across the contracts tree (`IHederaScheduleService`, `ScheduleCreate`,
`scheduleCreate`, `HederaScheduleService`, `0x16b`, the full precompile address) return zero
hits, and the sdk's entire port surface for it is two read queries with no write path at all.
claiming this line would be disprovable in thirty seconds by anyone who greps the same tree,
and a false claim on one line invites a judge to re-check the other three. we lose one line and
keep the credibility of the rest. see `DECISIONS.md` D13.

**secondary market, deliberately skipped.** illiquid instruments clear by periodic auction, not
by a continuous order book, and an order book cannot pass a compliance check on every match
against a permissioned security in any case. if the engine work lands early we would add a
periodic auction. we do not build a market mechanism this project does not need in order to
tick a line.

---

## the rate leg, precisely

`PROJECT_BRIEF.md` §3 originally described the engine's kpi reading converting to a coupon rate
through ATS's own `createKpiLinkedRate` / `addKpiData`, on chain, automatically. that mechanism
exists in the contracts and in the sdk's type system and documentation. **it cannot be
deployed against.** `Bond.createKpiLinkedRate` calls `deployBondKpiLinkedRate` on the factory,
and that function exists only on a test mock, never on the deployed factory `0.0.9213391`. the
one path that does deploy, `deployBond`, reverts against the kpi-linked configuration for an
independent reason: it unconditionally calls `initializeFixedRate`, a selector absent from that
configuration. two separate failures, either one sufficient. this is `BUG.md` B1, our primary
upstream finding, and it is treated in full there.

so we issued on config `0x...02`, bond variable rate, which carries `CouponFacet` and
`InterestRateFacet` and does not carry `KpisFacet` or `KpiLinkedRateFacet`. the mechanism we
actually drive is smaller than the one originally planned, and we say so rather than imply
otherwise:

- `setCouponRateType(FIXED)` is called before the first coupon. from that point the token
  refuses any rate a caller supplies to `setCoupon`. it reverts `InterestRateIsFixed()` on a
  non-pending rate, and instead stamps every coupon from `InterestRateStorageWrapper`'s own
  storage.
- the engine's rate reaches that storage through a separate, role-gated `FixedRate.setRate`
  transaction, the only way to write it.
- from that point forward, what a holder is owed comes from protocol state, not from an
  application field the console could quietly misreport.

that is a real ATS mechanism doing real work: a rate the token enforces against its own caller,
not a number our application types into a struct and calls done. it is a smaller claim than a
kpi-linked bond stepping its own coupon on chain. we make the smaller claim, and we make it
precisely, rather than the larger claim we could not build.

the conversion from the engine's leverage reading to that rate happens off chain, in our own
code, against bounds published at issuance. the boundary this costs is described exactly in
`docs/architecture.md` and in "the confidentiality claim" below: publishing the rate is, within
the published bounds, equivalent to publishing the kpi it was derived from, because the mapping
is invertible. we do not claim otherwise.

---

## what `setCoupon` proved, and what it did not

**the strongest single fact in the project.** `setCoupon` was sent with the pending triplet,
`rate = 0`, `rateDecimals = 0`, `rateStatus = PENDING`
([`0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1`](https://hashscan.io/testnet/transaction/0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1)).
the `CouponSet` event that same transaction emitted carries the coupon as stored: `rate = 600`,
`rateDecimals = 4`, `rateStatus = SET`. **we never named 600.** the token refused the caller's
rate and priced the coupon from a storage slot `FixedRate.setRate` had written 33 seconds
earlier
([`0x9c92091520459b23d95608e3d10e4466016f29550ebdc3f386c96ee62684439d`](https://hashscan.io/testnet/transaction/0x9c92091520459b23d95608e3d10e4466016f29550ebdc3f386c96ee62684439d)),
through a separately role-gated call. anyone can decode the same transaction and check it,
without trusting our transcript.

stated with its real limits, not overstated. the same account holds both the rate-setting role
and the coupon-declaring role in this demo. nothing on chain binds `600` to the confidential
engine specifically. `setRate` can be called again at any time, so `RateType.FIXED` does not
mean locked, only that a coupon is priced from storage rather than from its own caller. what the
protocol enforces is that the rate is one of record, not one chosen per coupon. the binding to
the engine is ours to claim, and it is checkable a different way: `rateForKpi` is published
(`lib/ats/note-terms.ts`), and `rateForKpi(200) == 600` is exactly what the token's own
`getRate()` returns.

**ordering, as a chain fact, not an assumption.** `getCouponRateType()` flipped to FIXED at
block `40348683` while `getCouponCount()` was still `0`, and stayed `0` for 34 further blocks
until `setCoupon` landed at block `40348717`. the switch happened strictly before any coupon
existed. this matters because `InterestRate.sol:38` carries an unresolved maintainer TODO on
whether switching rate type is safe once a coupon already exists; we did not test that path,
and it is a real open question in the sdk we are relying on, not settled by our transaction.

**three things this gate does and does not settle, stated before a judge finds them
unstated.**

1. **ATS declared the coupon and moved no value.** the coupon facet has no `pay` method.
   entitlements became readable through `getCouponFor` / `getCouponAmountFor`. the cash leg is a
   separate HBAR transfer the agent signs
   ([`0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404`](https://hashscan.io/testnet/transaction/0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404)),
   at a stated demo scale of 1 HBAR per 1,000 of entitlement, because the entitlement is
   denominated in the note's own currency and testnet has no such instrument to move. not an
   exchange rate, a scale factor stated once and applied once. the issuer holds 750 of 1,000
   notes and did not pay itself: no transaction anywhere on this token's history moves value to
   the issuer.
2. **the accrual window is backdated a full quarter.** the coupon's own `startDate` is
   2026-06-12 and its `endDate` is 2026-09-10, roughly ninety days, so the entitlement is sized
   the way a real quarterly coupon would be. the token itself was created 2026-09-09, one day
   before that window closes. the window sits mostly before the token existed. this is a demo
   compression, stated here rather than left for a viewer to notice.
3. **the token's own `name()` still reads "Covenant KPI-Linked Private Credit Note 2029," and
   its maturity now reads 2026-09-11**, permanently and publicly, because `updateMaturityDate`
   compressed a three-year lifecycle into this demo. a judge opening the token on hashscan sees
   both. and the token carries no KPI facet at all: config `0x...02` has `CouponFacet` and
   `InterestRateFacet`, not `KpisFacet` or `KpiLinkedRateFacet`, because the kpi-linked
   configuration cannot be deployed against by any working path (`BUG.md` B1). "KPI-Linked" in
   the name describes the instrument covenant models, not a claim about what facet runs on this
   token.

---

## the confidentiality claim, exactly

the borrower's revenue, EBITDA, total debt, cash and interest expense never leave the engine.
this is not an architectural intention, it is a verified property: a production build was
scanned for every one of those field names and fixture values across the lender's page and
every script chunk it loads, and a control scan against the agent view was run at the same
time, returning hits, to prove the search itself fires rather than reporting a clean result
because it is broken. the check is committed as `npm run scan:disclosure`
(`scripts/scan-disclosure.mjs`), and it was itself tested by deliberately introducing a leak
and confirming the script fails on it before being trusted to pass.

the lender learns the covenant verdict and the haircut, and that is enough to recover the exact
net leverage. the haircut is `1500 + 7 * (kpi - 100) + addon` basis points, where the addon is
fixed by the disclosed verdict and the result does not clamp inside the published operating
range. one equation, one unknown: the lender inverts the haircut and the verdict straight back
to the leverage ratio. we say this ourselves, in the architecture diagram and in the video,
rather than let a reviewer find it. see `DECISIONS.md` D17 for the correction that produced
this exact wording. an earlier draft claimed the haircut disclosed strictly less than
publishing the kpi would have, and that claim was false, caught by the person building the
engine before it shipped.

what the lender does not recover is the leverage figure's own inputs. net leverage is
`(total debt - cash) / EBITDA`, one equation in three unknowns, so revenue, EBITDA, total debt,
cash and interest expense all stay unrecoverable even though their ratio does not. one ratio is
public. its inputs are not.

---

## known weaknesses, named ourselves

**input integrity.** a hardware-isolated enclave proves the computation was honest. it does not
prove the inputs were. the borrower supplies revenue and EBITDA, and a borrower's incentive to
inflate them is larger and more direct than an agent bank's incentive to shade a haircut, so
the enclave alone relocates trust rather than removing it, to the party with the clearest
motive to misreport. the production answer sits past this primitive: auditor-signed financials,
or an authenticated accounting api verified inside the enclave before the computation runs. we
name that path; we do not build it. see `PROJECT_BRIEF.md` §4 for the full argument.

**illiquid seizure.** executing a hold on default gives the lender an illiquid private credit
claim, not cash. this is why the framing throughout is NAV-based lending with daily margining,
where the lender expects to work the asset out, not flip it. a lender receiving collateral it
cannot quickly resell is a real cost of this instrument class, not something the tokenisation
layer fixes.

**confidentiality is invisible by default.** a privacy claim that only shows an absent field
looks identical to a broken page. we address this directly on screen: the agent console shows
the borrower's inputs, then a hard cut to `/lender` shows the same moment with those fields
absent and only the verdict and haircut present, narrowed server-side before the page reaches
the client. the absence is real, and the narration says plainly what it does and does not mean,
per "the confidentiality claim" above.

---

## what is real and what is not, restated for this prize specifically

- we deploy no contracts. the note runs against the pre-deployed ATS resolver `0.0.9212226`
  and factory `0.0.9213391`, both on hedera testnet before this project started.
- ATS is ERC-1400 compliant with partial ERC-3643 support. not full. we do not claim otherwise.
- there is no on-chain attestation of the confidential engine's output. a human reads the
  verdict, the kpi value and the haircut off a screen and signs the transaction that carries
  them onto the chain. nothing on hedera verifies that the published computation is what ran.
  see `docs/architecture.md` for exactly where that boundary sits.
- the coupon settlement is a plain HBAR transfer signed by the agent, not an ATS operation, and
  the lender's cash advance (once G4 lands) will be the same shape. `setCoupon` records terms
  on chain and makes the entitlement readable; moving money against that entitlement is not
  itself an ATS transaction.

full account in [`README.md`](../README.md) §"what is real and what is not", which this
document does not repeat beyond what is specific to this prize's gates.

---

## what to fill in before this document is final

G2 and G3 are filled in above, with hashscan links, and no longer placeholders. what remains:

- `[G4 tx: pending]`, `FixedRate.setRate`, `createHoldByPartition` (two instruments),
  `releaseHoldByPartition`, `executeHoldByPartition`.
- `[repository visibility confirmed: pending]`, confirm the repository is public before
  submission.
- `[video link: pending]`, the cut video, under five minutes.
- `[upstream PR: pending]`, the hashgraph/asset-tokenization-studio pull request, once opened.

none of these are claims made and unproven. they are claims not yet made, marked as such.
