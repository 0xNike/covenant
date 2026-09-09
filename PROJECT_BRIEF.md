# PROJECT_BRIEF.md

**Project codename:** Covenant
**Event:** ETHGlobal ETHOnline 2026
**Hard deadline:** Monday 14 September 2026, 11:59am SGT
**Builder:** Hao (solo, assisted by the Hermes agent team)

---

## 1. One-line description

A tokenised private credit note whose interest rate and collateral haircut are set by a
confidential compute engine that reads the borrower's private financials, so a cash lender
can price a risk it is not permitted to inspect.

---

## 2. The problem, in plain terms

A private credit fund lends $50m to a mid-sized company. It sells participation in that loan
to pension funds and family offices in $1m slices. Three parties matter:

| Party | Wants | Constraint |
|---|---|---|
| Borrower | Capital | Financials are commercially sensitive and cannot be published |
| Note holder | Liquidity without waiting 3 years or selling at a discount | Holds an illiquid claim |
| Cash lender | To lend against the note at a fair advance rate | Has no right to see the borrower's books |

**The core asymmetry:** the cash lender must set a haircut on collateral whose quality
depends entirely on data it is not entitled to see.

Today the answer is a number from an agent bank that nobody can verify. Private credit is a
~$1.7tn market and its loudest criticism is exactly this: the marks are self-reported and
unverifiable. This is not a privacy story invented for a demo. It is the market's actual
complaint.

**What Covenant does:** the borrower's revenue, EBITDA and leverage go into a hardware
isolated enclave. Only two things come out — a covenant pass/fail and a haircut. The lender
never sees the inputs and can still verify the computation ran the published code.

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
5. **Reprice.** The KPI is posted via `addKpiData`, and the KPI-linked rate mechanism steps
   the coupon automatically. ATS owns this mechanism; we feed it.
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
is load-bearing, not decorative.** If a judge asks "why not just have the agent bank compute
this," the answer is that the lender is not entitled to the data and the agent has an
incentive to shade the number. There is no non-cryptographic version.

Second differentiator: `createKpiLinkedRate` and `addKpiData` are first-class ATS methods
that almost nobody will notice. Feeding a confidential computation into a native ATS
repricing mechanism uses far more of the sponsor's own product than a generic bond with a
privacy layer bolted on.

---

## 5. What ATS gives us for free

Do not rebuild any of this.

- **Bond config already deployed on testnet.** No Solidity, no contract deployment.
- **Hold facet** — a complete tri-party collateral primitive. The `Hold` struct carries an
  `escrow` address, i.e. a third party who decides the outcome. Verbs: create, createFrom,
  controllerCreate, protectedCreate, release, reclaim, execute.
- **KYC and external KYC list management** — the compliance demo.
- **Coupon, dividend, interestRates, kpis** — the distribution and repricing legs.
- **scheduledTask** — native scheduled transactions.
- **role** — issuer, controller and escrow permissions.
- **`updateMaturityDate`** — lets us compress a 3-year lifecycle into a 5-minute demo.

---

## 6. Judging criteria this maps to

### Hedera — Tokenization of Anything ($6,000, 3 slots)

Gates (all mandatory):
- [ ] ATS used to issue and manage a tokenised asset
- [ ] Deployed and demonstrated on Hedera **testnet**
- [ ] Public GitHub repo, contracts verified on HashScan where applicable
- [ ] Demo video ≤5 min showing **issuance, configuration, and at least one lifecycle op**

Extra points (targeting 5 of 6):
- [x] Compliance controls — KYC grants, blocked transfer, permitted transfer
- [x] Coupon distributions
- [x] Oracle / NAV — the confidential haircut and KPI engine
- [x] Scheduled Transactions — coupon on a timer via `scheduledTask`
- [x] Contributions upstream to ATS
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

1. **Input integrity.** A TEE proves the computation was honest, not that the inputs were.
   The production answer is auditor-signed financials or an authenticated accounting API
   verified inside the enclave before computing. Chainlink lists privacy-preserving access to
   authenticated Web2 APIs. We name the gap; we do not build it.
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
4. A KPI is posted via `addKpiData` and the rate steps.
5. A hold is created, then executed on default. Recorded.
6. Confidential engine swapped behind a CRE `handlerInTee`, simulation evidence captured.
7. Video ≤5 min, README, per-prize writeups, HashScan links, upstream PR.

**1 through 3 alone is a complete, submittable Hedera entry.** Everything after that is
upside. Never risk 1-3 to reach 6.