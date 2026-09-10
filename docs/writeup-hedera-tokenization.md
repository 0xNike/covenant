# hedera, tokenization of anything

**prize:** hedera, tokenization of anything ($6,000, 3 slots). the primary submission.
**repository:** https://github.com/0xNike/covenant
**evidence of record:** [`EVIDENCE.md`](../EVIDENCE.md). every factual claim below traces to a
line there. where a line is not yet filled, this document says so with a placeholder, not with
a claim.

**status at time of writing, 10 sep 2026.** one gate is verified on chain. three more are built
and dry-run against the live token, correct against source, but not yet signed. this document
is written to be updated as those signatures land, not rewritten. see the gate table below.

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
| 1 | ATS used to issue and manage a tokenised asset | issuance is verified; management (compliance gate, coupon, collateral hold) is built and dry-run against the live token, awaiting signature | issuance: see below. management: `[G2 tx: pending]`, `[G3 tx: pending]`, `[G4 tx: pending]` |
| 2 | deployed and demonstrated on hedera testnet | issuance demonstrated; the remaining lifecycle operations are demonstrated once the gates below turn green | see gate table |
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

### management, built and dry-run, not yet signed

the following are implemented against the sdk, exercised in dry-run against the live token
`0.0.10450229`, and correct against the source cited. none of them has a transaction id yet. we
do not claim they ran. they will, before this document is finalised, and the placeholders below
will be replaced with hashscan links, not with new prose.

- **G2, compliance.** a transfer to an unverified account is rejected by the token itself; kyc
  is granted through the token's internal registry; the same transfer succeeds. `[G2 tx:
  pending]` for each of the three steps.
- **G3, coupon.** `setCouponRateType(FIXED)`, then `setCoupon` with the pending rate triplet,
  then a read of the resulting entitlement. `[G3 tx: pending]`.
- **G4, rate and collateral.** the engine's rate posted through `FixedRate.setRate`, then a
  collateral hold created via `createHoldByPartition` and resolved by the engine's escrow
  account, one instrument released and one executed on default. `[G4 tx: pending]`.

**gates 1 through 3 alone are a complete, submittable hedera entry.** everything past that is
upside, not a requirement we are short of. see `specs/00-mission.md`'s ship order.

---

## extra points, targeting 4 of 6

### compliance controls

the token is issued with `internalKycActivated: true`. a transfer to an account without a kyc
grant is rejected before any transaction reaches the network. the sdk's own
`checkCanTransfer` pre-check throws client-side, so the blocked step is evidenced as a thrown
sdk error and an `eth_call` returning false, not a failed hashscan transaction (this is a
property of the sdk's validation path, not of our build; see the integration note in the
open-source writeup). kyc is then granted through the token's own internal `Kyc.grantKyc`
facet, carrying a placeholder credential identifier that the contract stores and never
verifies. **we do not claim to have verified anyone's identity.** we claim, and only claim,
that we exercised the token's compliance gate: the same transfer that was rejected now
succeeds, with a hashscan link. `[G2 tx: pending]`.

### coupon distributions

`setCoupon` records rate and dates on chain and the holder list is read from the chain via
`getCouponHolders`. paying holders is a separate, off-chain step; ATS has no `pay` method on
the coupon facet (confirmed by reading the full `ICoupon.sol` interface, `specs/05` §3). what
we claim is the on-chain declaration and the resulting on-chain entitlement, not a push
payment. `[G3 tx: pending]`.

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
- the coupon payment and the lender's cash advance are both off chain, tracked in the console.
  `setCoupon` records terms and the holder list is read from the chain; moving money is not
  itself an ATS transaction.

full account in [`README.md`](../README.md) §"what is real and what is not", which this
document does not repeat beyond what is specific to this prize's gates.

---

## what to fill in before this document is final

every placeholder above, collected:

- `[G2 tx: pending]`, three transactions: blocked transfer evidence, the kyc grant, the
  permitted transfer.
- `[G3 tx: pending]`, `setCouponRateType(FIXED)`, `setCoupon`, and the resulting
  `getCouponFor` read.
- `[G4 tx: pending]`, `FixedRate.setRate`, `createHoldByPartition` (two instruments),
  `releaseHoldByPartition`, `executeHoldByPartition`.
- `[repository visibility confirmed: pending]`, confirm the repository is public before
  submission.
- `[video link: pending]`, the cut video, under five minutes.
- `[upstream PR: pending]`, the hashgraph/asset-tokenization-studio pull request, once opened.

none of these are claims made and unproven. they are claims not yet made, marked as such.
