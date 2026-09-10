# covenant

a tokenised private credit note whose interest rate and collateral haircut are set by a
confidential compute engine that reads the borrower's private financials, so a cash lender
can price a risk it is not permitted to inspect.

built on the Hedera Asset Tokenization Studio (ATS), for ETHGlobal ETHOnline 2026.

---

## what this is

a private credit fund lends to a mid-sized company and sells participation in that loan to
holders in smaller slices. the note holder wants liquidity without waiting out the note's
term. a cash lender will advance against the note as collateral, but has no right to see the
borrower's books, so it cannot price the haircut itself. covenant puts the borrower's
revenue, EBITDA and leverage into a hardware-isolated enclave. only two things leave it: a
covenant pass or fail, and a haircut. the lender never sees the inputs and can still check
that the computation ran the published code. the note itself, its compliance gate, its
coupon and its collateral hold run on the ATS diamond on Hedera testnet, through the
pre-deployed resolver and factory. we write no Solidity and deploy no contracts.

what this replaces trust in, and what it does not, is the load-bearing paragraph of this
project. read `PROJECT_BRIEF.md` §4 before assuming more than the paragraph above claims.

---

## status

**honest, as of 10 sep 2026. this section is updated as gates go green and nothing here is
written ahead of the evidence.** the table below mirrors `EVIDENCE.md` gate by gate. update
it there first, then here, never the other way round.

**G1 is green.** a bond has landed on Hedera testnet. what exists beyond that is still mostly
governance, planning and configuration: the nine agent definitions in `.claude/agents/`,
`PROJECT_BRIEF.md`, `DECISIONS.md`, the sdk operation surface mapped in
`specs/02-sdk-surface.md`, the `.env.example` template wired to real testnet accounts and the
deployed ATS infrastructure, and the architecture diagram at `docs/architecture.md`. the
application code in `app/` now has an issuance console (`app/issue-panel.tsx`), which is what
produced the token below. kyc, coupon, kpi and collateral hold screens do not exist yet.

| gate | proves | status |
|---|---|---|
| G1 | bond issued on Hedera testnet, visible on HashScan | **VERIFIED** |
| G2 | transfer blocked by KYC, grant issued, same transfer succeeds | not started |
| G3 | coupon distributed to holders of record. **first submittable entry** | not started |
| G4 | `addKpiData` posted, coupon rate steps on a coupon's `fixingDate`, hold created and executed | not started |
| G5 | confidential engine running behind a CRE `handlerInTee`, or an honestly-labelled CRE CLI simulation | not started |
| G6 | video, README, three per-prize writeups, evidence, upstream PR prepared | not started |

nothing below G3 is a complete submission on its own. G1 through G3 together are.

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
| coupon rate type | STANDARD (1). open item, see below |

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

**the open item.** the token issues with coupon rate type STANDARD, meaning the token will
accept whatever rate a caller hands it. `RateType.FIXED` must be set before the first coupon
so the token refuses a caller-supplied rate and stamps every coupon from its own storage
instead. that is the difference the writeup leans on. `setCouponRateType` has not been called
yet.
G3 does not proceed until this is resolved.

---

## what runs today

this repository is a next.js 16 / react 19 app with the ATS sdk (`@hashgraph/asset-tokenization-sdk@8.0.0`)
as an npm dependency. `npm run dev` now serves an issuance console (`app/issue-panel.tsx`),
which is what issued the token verified in G1 above. it does not yet cover kyc, coupon, kpi
or collateral hold. the instructions below are for running what exists, and will describe
more as the build order in `MASTER_TODO_LIST.md` moves through its gates.

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
| issuer / agent | `0.0.10424387` | issues the note, grants KYC, sets and distributes the coupon, posts `addKpiData` |
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
- **the confidential engine is not built yet.** it is being built now as a plain local
  service, behind a clean interface, so it does not exist as a running thing you can point
  at today. the target is to run the same computation behind a Chainlink CRE `handlerInTee`,
  a hardware-isolated, TEE-based enclave. if that does not land in the build's timebox, the
  fallback is a CRE CLI simulation of the same handler.
  whichever ships, `EVIDENCE.md` and the Chainlink writeup say so plainly rather than
  implying a live deployment that did not happen.
- **ATS is ERC-1400 compliant with partial ERC-3643 support.** it is not a full ERC-3643
  implementation. we do not claim otherwise anywhere in this project.
- **the ATS `scheduledTask` facet is an internal EVM task queue**, drained lazily by the
  next state-mutating call. it is not the Hedera Schedule Service. we do not claim the
  Scheduled Transactions extra-points line for this reason. see `DECISIONS.md` D13 and D14.
- **the coupon payment and the lender's cash advance are both off-chain**, tracked in the
  console rather than moved by an ATS transaction. `setCoupon` records terms on-chain and
  the holder list is read from the chain; paying the holders is not itself a transaction.
  the collateral hold moves the note, not cash.
- **the lender-view / agent-view split that makes confidentiality visible on screen is
  planned, not built.** it is the intended demo of the boundary described above, and its
  status belongs in the table above once it exists, not here.

---

## evidence

every factual claim in this project traces to a transaction id and a HashScan link in
[`EVIDENCE.md`](./EVIDENCE.md). if a claim has no line there, it is not made. `EVIDENCE.md`
is owned by the QA role in this build and is independently re-verified against Hedera's
mirror node and HashScan, not taken on trust from whichever role built the flow.

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
