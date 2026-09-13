# PROJECT_BRIEF.md

**Project codename:** Covenant
**Event:** ETHGlobal ETHOnline 2026
**Hard deadline:** Sunday 13 September 2026, 12:00pm EDT (Monday 14 September, 00:00 SGT)
**Builder:** Hao (solo, assisted by the Hermes agent team)

---

## 1. One-line description

A tokenised private credit note whose interest rate and collateral haircut are set by a
confidential compute engine that reads the borrower's private financials, so a cash lender
can price a risk it is not permitted to inspect.

---

## 2. The problem, in plain terms

You would not lend someone money against their house and also let them tell you what the
house is worth. Private credit comes close to doing exactly that.

A private credit fund lends $50m to a mid-sized company and sells participation in that loan
to pension funds and family offices in $1m slices. The fund holds the loan on its own books
and marks it itself, and that mark is the number everything downstream, the participation,
the financing against it, prices off. The Financial Stability Board looked at this directly:
"discrepancies in valuations can arise due to subjective judgment, with examples made in
comparable cases having different valuations across managers" (FSB, *Report on
Vulnerabilities in Private Credit*, 6 May 2026, §3.3,
https://www.fsb.org/uploads/P060526.pdf). The same loan, marked by different managers, comes
out at different numbers, because the judgement behind the mark is the manager's own. Private
credit was roughly $1.7tn globally at year-end 2023 (Federal Reserve, FEDS Notes, 23 Feb
2024); the sector has grown since, and this dispersion in marks is the asset class's loudest
standing criticism, not a defect invented for a demonstration.

Three parties sit inside that problem:

| Party | Wants | Constraint |
|---|---|---|
| Borrower | Capital | Financials are commercially sensitive and cannot be published |
| Note holder | Liquidity without waiting 3 years or selling at a discount | Holds an illiquid claim |
| Cash lender | To lend against the note at a fair advance rate | Not entitled to see the borrower's books |

**The core asymmetry:** the cash lender must set a haircut on collateral whose quality
depends on data it cannot see, and today the only number available to price against is one
the fund holding that collateral produced about itself.

**What Covenant does:** it takes the valuation out of self-marking and gives the job to a
program. The borrower's revenue, EBITDA and leverage go into a hardware isolated enclave.
Only two things come out: a covenant pass/fail and a haircut, published as a function before
the facility is struck, so both sides read it before either relies on it. Covenant makes a
private credit note financeable for a lender who is not entitled to see the borrower's
books: the lender never sees the inputs, and can still verify the computation ran the
published code.

---

## 3. What we are building

An issuer/agent console on top of the Asset Tokenization Studio that runs the full life of a
private credit note.

**Flow:**

1. **Issue** a KPI-linked private credit note via the deployed ATS bond config.
2. **Gate the register.** Accredited investors only. A transfer to an unverified party is
   rejected by the token itself; after a KYC grant the same transfer succeeds.
3. **Distribute** a coupon to holders of record.
4. **Compute confidentially.** The engine ingests private borrower financials and outputs a
   covenant verdict, a KPI value and a haircut.
5. **Reprice.** The engine's leverage reading is converted to a coupon rate off chain,
   against bounds fixed and published at issuance, and posted to the token by a role-gated
   `setRate` transaction. From there ATS owns it: under `RateType.FIXED` the token refuses
   any rate supplied by the caller and stamps every coupon from its own storage, so what a
   holder is paid comes from token state rather than from our application.

   The conversion from a KPI reading to a rate would have happened on chain, inside ATS's
   own `KpiLinkedRateFacet`. **We could not use it.** That configuration is registered in
   the deployed resolver and cannot be deployed against by any path, which is our upstream
   bug report. See `BUG.md` B1.

   **Where the confidential boundary actually sits, stated precisely.** The borrower's
   revenue, EBITDA, total debt and interest expense never leave the engine. Verified: the
   lender's page and every script it loads were scanned for those values and their
   variants, with a control scan against the agent view to prove the search works.

   The derived leverage is a different matter. `rateForKpi` is piecewise linear and finer
   grained than the KPI it consumes, so within the published bounds it is **invertible**.
   Once `setRate` lands on chain, anyone holding the bounds recovers the leverage from the
   rate. It is non-invertible only outside the caps, where values clamp.

   So the confidentiality claim is about the **financials, not the KPI**. An on-chain
   `addKpiData` would have published the same derived leverage. Neither path exposes the
   underlying statements. We do not claim the substitute discloses less, because it does
   not.

6. **Collateralise.** The note holder pledges the note via `createHoldByPartition`, naming
   the engine as `escrow`. The lender advances cash at the computed haircut.
7. **Resolve.** Repayment → `releaseHoldByPartition`. Default → `executeHoldByPartition`,
   collateral moves to the lender, driven by a number the lender never saw.

---

## 4. Why this is not the obvious submission

The brief's opening paragraph points at tokenised treasuries as repo collateral. That is
what the field will build, and it is what an LLM outputs when fed this brief. Treasury
haircuts are ~2% and standardised. There is no interesting problem there.

We moved to an asset where **the haircut is the negotiation** and its input is confidential.
That produces the property most hackathon privacy projects lack: **the confidential compute
is load-bearing, not decorative.**

State the claim precisely, because the loose version does not survive one follow-up question.

The enclave lets a function the lender and borrower agree in advance be run on data only one
side is entitled to see, and lets the lender check that the published code is what ran.
**It replaces trust in execution with attestation. It does not touch trust in the inputs.**
The borrower supplies revenue and EBITDA, and a borrower's incentive to inflate them is
larger and more direct than a fund's incentive to delay marking down its own book. So an
enclave alone does not remove trust from this arrangement; it relocates it, to the one party
with the clearest motive to misreport.

That is not a gap we are papering over. It is the boundary of what this primitive does, and
the production answer sits just past it: auditor-signed financials, or an authenticated
accounting API verified inside the enclave before the computation runs. Chainlink lists
privacy-preserving access to authenticated Web2 APIs, which is the shape of that answer. We
name it; we do not build it.

Today the lender gets neither guarantee. It gets a number the fund produced about its own
collateral, with no way to check the execution or the inputs. We remove one of those two
unknowns and say exactly which.
A trusted third party could compute the same haircut, but then the lender trusts that party's
execution *and* its confidentiality. Attestation is the difference, and it is a real one.

Second differentiator: we drive a native ATS rate mechanism from a confidential
computation. The engine's output reaches the token through a role-gated `setRate`, and under
`RateType.FIXED` the token applies it to every coupon itself, rejecting any rate a caller
tries to supply. That is protocol state, not an application field.

We had intended to use `createKpiLinkedRate` and `addKpiData`, which are first-class ATS
methods almost nobody will notice. Neither is reachable: `createKpiLinkedRate` calls a
factory function that exists only on a test mock, and the KPI-linked configuration cannot be
deployed against at all. Establishing that, from source and on chain, is our contribution to
the harness track.

---

## 5. What ATS gives us for free

Do not rebuild any of this.

- **Bond config already deployed on testnet.** No Solidity, no contract deployment.
- **Hold facet** — a complete tri-party collateral primitive. The `Hold` struct carries an
  `escrow` address, i.e. a third party who decides the outcome. Verbs: create, createFrom,
  controllerCreate, protectedCreate, release, reclaim, execute.
- **KYC and external KYC list management** — the compliance demo.
- **Coupon, dividend, interestRates, kpis** — the distribution and repricing legs.
- **scheduledTask** — an internal EVM task queue, drained lazily by the next
  state-mutating call. **Not the Hedera Schedule Service.** See DECISIONS.md D13.
- **role** — issuer, controller and escrow permissions.
- **`updateMaturityDate`** — lets us compress a 3-year lifecycle into a 5-minute demo.

---

## 6. Judging criteria this maps to

### Hedera — Tokenization of Anything ($6,000, 3 slots)

Gates (all mandatory):
- [ ] ATS used to issue and manage a tokenised asset
- [ ] Deployed and demonstrated on Hedera **testnet**
- [ ] Public GitHub repo, contracts verified on HashScan where applicable
- [ ] Demo video 2 to 4 min showing **issuance, configuration, and at least one lifecycle op**

Extra points (targeting 4 of 6):
- [x] Compliance controls — KYC grants, blocked transfer, permitted transfer
- [x] Coupon distributions
- [x] Oracle / NAV — the confidential haircut and KPI engine
- [x] Contributions upstream to ATS
- [ ] Scheduled Transactions — **dropped, and not claimed.** ATS `scheduledTask` is an
      internal EVM task queue, not the Hedera Schedule Service. Six greps across the
      contracts tree return zero hits, and the SDK's entire port surface is two read
      queries. Claiming this line would be disprovable in thirty seconds and would
      contaminate the four above it. See DECISIONS.md D13.
- [ ] Secondary market — **deliberately skipped.** If the engine lands early, add a
      *periodic auction*, never an order book. Illiquid instruments clear by auction.

"Or a combination" is satisfied: we touch the SDK, the contracts (via Hold), and the web app.

### Chainlink — Best Confidential Workflow ($2,000, 2 slots)

- [ ] CRE Workflow using Confidential Workflows
- [ ] Registers and uses `handlerInTee` (TS) or `cre.HandlerInTee` (Go)
- [ ] Processes at least one sensitive input inside the enclave
- [ ] Meaningfully integrated into core functionality, not a placeholder handler
- [ ] Evidence via CRE CLI simulation or live deployment

**This is the secondary prize and is expendable.** See the timebox in CLAUDE.md.

### Hedera — Open Source, Improve the Hedera Harness ($2,000, 2 slots)

Optional third slot. An unmerged PR qualifies. Only pursue if a genuine friction fix emerges
from our own build. Do not manufacture one.

**ETHGlobal caps partner prizes at 3 per submission.**

---

## 7. Non-goals

Explicitly out of scope. Do not let scope creep back in.

- Writing or deploying new Solidity
- An order book or continuous secondary market
- AMM or liquidity pool mechanics — permissioned securities cannot pass a compliance check
  on every swap
- Lending on top of borrowed notes (rehypothecation)
- Any AI trading, yield-optimisation or arbitrage agent
- Mixers, anonymity sets, or hiding *who* holds the asset
- Real estate, treasuries, or invoice factoring as the asset
- Mainnet anything

---

## 8. Vocabulary rules

These are credibility tripwires. The judge works in institutional tokenisation.

| Never write | Write instead |
|---|---|
| repo / repurchase agreement | collateralised facility, NAV-based lending |
| risk-free yield | overcollateralised financing with daily margining |
| zero-knowledge, ZK, ZK proof | confidential compute, hardware-isolated enclave |
| trustless | attested execution, verifiable computation |
| vesting (for a hold) | collateral hold, escrow |
| APY, yield farming, degen, any crypto slang | the actual instrument term |

**Chainlink CRE Confidential Workflows are TEE-based, not ZK.** Saying ZK anywhere is the
fastest way to lose credibility. State plainly that the confidential leg is simulated via the
CRE CLI if that is what we shipped. Honest and still qualifying.

---

## 9. Known weaknesses — name them ourselves

A judge who spots a hole we already flagged reads it as rigour. Address these in the writeup.

1. **Input integrity.** Folded into §4 rather than left here as a separate caveat, so the
   claim and its boundary read as one thought instead of an assertion followed by a
   retraction. A TEE proves the computation was honest, not that the inputs were. §4 states
   this as part of what the primitive *is*, which is the honest framing and the one that
   survives a judge's follow-up question.
2. **Illiquid seizure.** Seizing a private credit note leaves the lender holding an illiquid
   claim. This is why the framing is NAV-based lending, where the lender expects to work out
   the asset, not flip it.
3. **Confidentiality is invisible on video.** Solve it in the demo: show the engine's inputs
   on screen during setup, then show the lender's view where those fields are absent and only
   the haircut appears. **The visible absence is the demo.**

---

## 10. Environment facts

```
Node        >= 20.19.4   (repo ships .nvmrc — run `nvm use`)
npm         >= 10.9.0
Setup       npm run ats:setup      (already completed)
Run         npm run ats:start
Test        npm run ats:test
```

Pre-deployed Hedera testnet infrastructure — **we deploy none of this**:

```
REACT_APP_RPC_RESOLVER   0.0.9212226
REACT_APP_RPC_FACTORY    0.0.9213391
REACT_APP_BOND_CONFIG_ID 0x...0002
REACT_APP_EQUITY_CONFIG_ID 0x...0001
Mirror node  https://testnet.mirrornode.hedera.com/api/v1/
JSON-RPC     https://testnet.hashio.io/api
```

MetaMask connects directly; the WalletConnect project ID placeholder can be ignored.

Standards reality check: ATS is **ERC-1400 compliant with partial ERC-3643 support**. The
prize brief overstates this. Do not claim full ERC-3643 in any writeup.

---

## 11. Definition of done

Ship order. Each line must be true before the next is attempted.

1. A bond is issued on Hedera testnet and visible on HashScan.
2. A transfer is blocked by KYC, a grant is issued, the same transfer succeeds. Recorded.
3. A coupon is distributed to holders.
4. `setCouponRateType(FIXED)` is called **before the first coupon**, then the engine's
   rate is posted by a role-gated `setRate` and the token stamps a coupon from it.
5. A hold is created, then executed on default. Recorded.
6. Confidential engine swapped behind a CRE `handlerInTee`, simulation evidence captured.
7. Video 2 to 4 min, README, per-prize writeups, HashScan links, upstream PR.

**1 through 3 alone is a complete, submittable Hedera entry.** Everything after that is
upside. Never risk 1-3 to reach 6.