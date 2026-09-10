# DECISIONS.md

every non-obvious call, with reasoning and any apollo objection. newest at the bottom.
per `CLAUDE.md` §9, if hermes proceeds against an apollo objection it is logged here with
the reasoning. apollo is not overruled silently.

---

## D1. repo layout. ATS clone is a read-only reference, we build in this repo

`CLAUDE.md` §6 described paths (`packages/ats/sdk/src`, `apps/ats/web`, `.claude/commands`)
that are relative to the ATS checkout, not to this repo. this repo is a next.js 16 / react 19
app with `@hashgraph/asset-tokenization-sdk@8.0.0` installed.

the clone at `~/projects/hackathon/hedera/asset-tokenization-studio` is tag `v.8.0.0-ats`,
an **exact match** for our installed sdk version. so `packages/ats/sdk/src` there is true
ground truth for what we run, not an approximation of it.

**decision:** the clone is a read-only reference for source and for the maintainers'
`.claude/commands` and `.claude/skills`. we build the console here, on the npm sdk.

**why:** the lender-view / agent-view split is the confidentiality demo, and grafting it onto
their react 18 app is slower than writing it in an app we control.

approved by hao, 10 sep 2026.

---

## D2. CRE retained, all three prizes attempted

at the original "friday 11 september" reading of the deadline there were 32.5 hours against a
40 hour build order, and the 4 hour CRE timebox did not fit. the real deadline is **monday 14
september**, giving 104.6 hours, so it fits with room.

**decision:** CRE stays in. the 4 hour timebox and chronos' authority to call it are
unchanged.

decided by hao, 10 sep 2026.

---

## D3. no private key, ever. every signature is MetaMask

`SupportedWallets` at `packages/ats/sdk/src/domain/context/network/Wallet.ts:5-13` has
`CLIENT` commented out at line 9. the raw-key signer is disabled in sdk v8. the live adapters
are `port/out/rpc/RPCTransactionAdapter.ts`, which delegates every signature to
`MetamaskService` and the browser injected provider, plus `port/out/hs/walletconnect` and
`port/out/hs/custodial` for DFNS, Fireblocks and AWS KMS. there is no local-key path.

`RequestAccount.privateKey` at `port/in/request/BaseRequest.ts:9` still exists as an optional
field but nothing in the adapter layer consumes it. it is vestigial from when `CLIENT` was
live, and it is the trap.

**decision:** no key enters `.env`, this repo, or any agent's context. `.gitignore:34` covers
`.env*`.

**consequence, and it is a real one:** argus cannot re-execute a flow to verify it. argus
verifies read-only against mirror node and hashscan instead, checking chain state rather than
re-running. that is arguably stronger, since it observes what actually landed rather than
what a script claims it sent. the gate ritual was rewritten accordingly.

settled by source, 10 sep 2026.

---

## D4. chronos runs once, during block F only

`/loop` re-invokes the main session carrying its full context, and a 2 hour interval exceeds
the 1 hour prompt cache TTL, so every wakeup pays a cold read. that is the worst available
cost profile, and it is the configuration `CLAUDE.md` §2 originally specified.

more importantly, chronos got **less valuable when the deadline moved**. 104 hours against a
40 hour plan is roughly 64 hours of slack, so two or three hours of drift is absorbed rather
than fatal.

**decision:** manual checks at phase boundaries for blocks A through E and G. one `/loop`
during block F only, started when CRE work begins and stopped when G5 resolves either way.

**why block F specifically:** the CRE timebox exists for the moment hermes is mid-debug and
certain the next fix is the one. that is exactly the moment hermes will not stop himself.

approved by hao, option C, 10 sep 2026.

---

## D5. four accounts, and the escrow split is load-bearing

**decision:** four hedera testnet accounts, all ECDSA_SECP256K1.

| role | account | evm |
|---|---|---|
| issuer / agent | `0.0.10424387` | `0x56a45ef1d79a3a6fd6cfa6b833612705d2edc742` |
| note holder | `0.0.10444395` | `0x7b3f60333a54e03c4ee4240d2ba2f9600c502e1e` |
| lender | `0.0.10444404` | `0xb85d1ed5da74d656d00cecbc352e5b513af25970` |
| engine, as `Hold.escrow` | `0.0.10445014` | `0xe03d10ae975fa1bd8b5d17e322d68fd4fe9c8222` |

**why four and not three:** if `Hold.escrow` is the agent's address then the agent decides
release versus execute, which is exactly the status quo `PROJECT_BRIEF.md` §4 says we
replace. a judge who reads the escrow address would find the thesis undone. the fourth
account is not tidiness, it is the argument.

ECDSA_SECP256K1 is required because MetaMask cannot hold an ED25519 key, and hedera's portal
offers both.

all four verified on mirror node 10 sep 2026: not deleted, correct key type, funded.

**a trap that turned out not to exist:** there are no associate methods anywhere in
`packages/ats/sdk/src/port/in`, confirming ATS securities are EVM contract state via the
resolver and factory, not HTS native tokens. so no token association step is needed, and a
failed transfer in block B cannot be a `NO_ASSOCIATION` failure masquerading as a compliance
block. it fails for the reason we claim it does.

---

## D6. the team is nine agents with a seven step gate ritual

flagged to hao as heavy for a four day solo build, with a proposed lighter cut (merge iris
into zeus, drop chronos). hao approved the plan as written.

**why keep it:** judging is asynchronous with no Q&A, so nothing gets explained after the
fact. apollo and argus exist to stop us shipping a claim that does not hold, and that is the
only failure mode that cannot be recovered from.

approved by hao, 10 sep 2026.

---

## D7. `specs/01-agent-charters.md` cut as redundant

the plan had phase 0 write agent definitions and phase 1 write a separate charter document.
that was written before the definitions existed. `.claude/agents/*.md` **are** the charters
and **are** the prompts, they are committed, and they are what the runtime actually loads.

**decision:** cut `specs/01-agent-charters.md`. `specs/README.md` points at `.claude/agents/`
instead.

**why:** two documents describing the same nine agents would drift apart within a day, and
the one that drifted would be the one nobody reads. the eligibility condition is that spec
files and prompts are committed, which `.claude/agents/` satisfies directly.

scope cut down, hermes decides alone per `CLAUDE.md` §1.

---

## D8. `NEXT_PUBLIC_` not `REACT_APP_`

the ATS reference app at `apps/ats/web` is create-react-app and uses `REACT_APP_` prefixes.
`PROJECT_BRIEF.md` §10 quotes those names. this repo is next.js 16, where only
`NEXT_PUBLIC_`-prefixed vars reach the browser and `REACT_APP_` ones are silently undefined
at runtime.

**decision:** our `.env.example` uses `NEXT_PUBLIC_`. the values are unchanged from the
brief, only the prefixes differ.

**why it matters:** a silently undefined resolver address fails at the first contract call
with an error that points nowhere near the cause. worth an entry so nobody "fixes" it back.

`.gitignore` line 34 is `.env*`, which would have swallowed the template too, so line 35 now
negates it with `!.env.example`. `.env.local` stays ignored.

---

## D9. the upstream PR needs GPG set up before commit one, not after

athena read the maintainers' actual contribution process. findings in
`specs/03-upstream-workflows.md`, all cited. the operative constraints:

- **branch off `develop`, not `main`.** `CONTRIBUTING.md:214`, and
  `.github/workflows/000-flow-changeset-check.yaml:5-9` only triggers on
  `develop`/`development`
- **every commit needs DCO sign-off AND a GPG signature.** the `pre-push` hook at
  `.husky/pre-push:35-56` and `:131-139` rejects the push if any commit in the range lacks
  `Signed-off-by:` or has git `%G?` status `N`. this is a hard block, not a warning
- their setup script is `.github/scripts/setup-git.sh`, referenced at `CONTRIBUTING.md:119`
- a PR needs at least one assignee or CI fails
- a changeset is required unless a bypass label (`no-changeset`, `docs-only`, `chore`,
  `hotfix`) applies
- new non-test `.ts`/`.sol` files need an `// SPDX-License-Identifier: Apache-2.0` header,
  enforced by lint-staged via `check-license.js`
- upstream pins node `24.15.0` in `.nvmrc`

**decision:** rudolph configures signing **before** writing the first commit intended for
upstream, on a branch cut from their `develop`.

**why it cannot wait:** retrofitting sign-off and signatures onto existing commits needs an
interactive `git rebase -i` per `CONTRIBUTING.md:151-161`. interactive rebase is unavailable
in this environment, and history rewriting needs hao's approval under `CLAUDE.md` §1 anyway.
so an unsigned upstream branch on sunday night is not a small fix, it is a dead branch.

**this does not affect our own repo.** covenant's commits need no GPG. only the upstream
branch does.

**and one thing that is simply absent:** `docs/references/proposals` does not exist and never
has, confirmed against `git log --all`. `CLAUDE.md` §6 named it as the destination for an
enhancement proposal, and `CONTRIBUTING.md:260` and their own `.claude/commands` both
reference it as though populated. there is no existing proposal to pattern-match against.
§6 corrected. if we file a proposal we are setting the template, not following one.

---

## D10. apollo halted block A and was right. we issue on config 4, not config 2

**apollo's first review returned `PROCEED WITH CHANGES` with a halt on tasks 3.1 and 3.4.**
hermes verified the load-bearing claims independently before accepting them, per
`CLAUDE.md` §3. all three confirmed.

**the halt.** `PROJECT_BRIEF.md` §10 and our committed `.env.example` both pinned
`BOND_CONFIG_ID = 0x...02`. `packages/ats/contracts/scripts/domain/constants.ts:25-49`
defines four bond-family configs, not two:

```
0x..01 equity              0x..02 bond variable rate   <- what the plan had
0x..03 bond fixed rate     0x..04 bond KPI-linked rate <- what the plan needs
```

config 2's facet list in `domain/bond/createConfiguration.ts` is `CouponFacet` and
`InterestRateFacet`. **no `KpisFacet`, no `KpiLinkedRateFacet`.** config 4's list carries
both, plus `HoldByPartitionFacet`, `KycFacet`, `MaturityFacet` and
`ProceedRecipientsKpiLinkedRateFacet`.

issuing on config 2 means `addKpiData` hits an unregistered selector at block D. recovery is
re-issuing and redoing kyc, coupon and hold. that is the build lost at hour 20, discovered
on friday.

hermes verified by eth_call against the live resolver `0.0.9212226`, not from source alone:
config 2 latest version 1, **config 4 latest version 1**, 8 configurations registered.

**second half of the halt, equally important.** `createKpiLinkedRate` is not a
post-issuance configuration call. `port/in/bond/Bond.ts:227` takes
`CreateBondKpiLinkedRateRequest` and builds a `SecurityProps` with name, symbol, isin,
decimals, `clearingActive`, `internalKycActivated` and maxSupply, returning a new security.
**it is the issuance call.** task 3.18, "gamma: `createKpiLinkedRate` on the note" in block D,
could never have worked against an already-issued note.

**decision:** block A issues via `Bond.createKpiLinkedRate` against config `0x...04`.
task 3.18 is deleted, folded into 3.4. `.env.example` corrected.

**three issuance flags now pinned, because each is set once and silently kills a later block:**

- `clearingActive: false`. `HoldByPartition.sol:50` carries `onlyClearingDisabled`. clearing
  on means block E is dead and unrecoverable
- `internalKycActivated: true`. otherwise block B's blocked transfer does not block and the
  compliance demo is a lie
- `proceedRecipientsIds` must contain at least one project address, or KPI data has nowhere
  to attach

none of the three appeared anywhere in the plan. they are the highest-consequence,
lowest-visibility decisions in the build and they are made in one call at hour two.

---

## D11. the rate-step claim needs a value check, not a delta check

`domain/asset/KpiLinkedRateLib.sol:40-64` computes the coupon rate at a coupon's
`fixingDate`, not when `addKpiData` is called. if no KPI report is found in the window,
`:57-60` takes `_getRateWhenNoReport`: `previousRate + missedPenalty`, capped at `maxRate`.

**so the rate moves whether or not our KPI landed.** the plan had argus record "the rate
changed" and iris capture before and after. a rate that moved via the missed-penalty path
looks identical on screen and in the mirror node. we would have put a false causal claim on
video, checkable from source in five minutes.

athena reached the same place independently: the rate changes **only on read, at a coupon's
`fixingDate`**, and sums KPI values only from addresses registered via `addProceedRecipient`.
posting `addKpiData` for an unregistered project is **silently ignored**
(`KpiLinkedRateLib.sol:87-111`).

**decision:** argus's G4 gate is not "the rate changed". it is that the new rate equals
`_getRateFromImpact(impact, kpiData)` for the value we posted, **and is not equal to**
`previousRate + missedPenalty`. `missedPenalty` and the baseline are chosen at issuance so
the two paths give visibly different numbers.

also uncounted in the plan, and each needing its own `Role.grantRole` transaction:
`ROLE_KPI_MANAGER` for `addKpiData` (`facets/kpi/Kpis.sol:41`),
`ROLE_INTEREST_RATE_MANAGER` for the rate setters (`facets/kpiLinkedRate/KpiLinkedRate.sol:54,74`),
and `ROLE_MATURITY_MANAGER` for `updateMaturityDate`, which athena found is **missing from
the SDK's `SecurityRole` TS enum entirely** and must be passed as a raw hex literal.

`onlyValidDate` (`services/asset/KpisModifiers.sol:25`) rejects a future date, a duplicate
checkpoint date, or a date below the minimum.

**block D is the block that overruns, not block E.** it is date arithmetic across
`startPeriod`, `reportPeriod`, `fixingDate` and `updateMaturityDate`, and it just got heavier.

---

## D12. W1 is not a bug. B4 is the upstream candidate

apollo and athena reached this independently, by different routes.

`domain/context/security/Hold.ts:23-48` does name the constructor's first parameter
`executionTimeStamp` while assigning it to `this.expirationTimeStamp`. but the only call
site, `port/out/rpc/RPCQueryAdapter.ts:886-894`, passes `hold.expirationTimestamp_`, the
contract's correctly named field. **the returned value is correct.** athena adds that
`IHoldTypes.sol:51-58` carries only one timestamp on the struct, so no swap is even possible.

it is a misnamed parameter with zero behavioural effect. a one-line rename.

**decision:** W1 demoted to a naming nit in the writeup's feedback section. **B4 promoted**:
`RequestAccount.privateKey` at `port/in/request/BaseRequest.ts:9` is a public field consumed
by nothing, because `SupportedWallets.CLIENT` is commented out at `Wallet.ts:9`. a field that
invites you to hand the sdk a key it silently ignores is a real developer trap with a
security shape.

**why this matters more than it looks.** `CLAUDE.md` §2 named W1 as our upstream PR candidate
and `PROJECT_BRIEF.md` §6 says do not manufacture a friction point. submitting a cosmetic
rename as an ATS improvement invites a devrel judge to open the file and find exactly that.
the plan was quietly breaking its own rule. we take the third prize slot only if blocks A
through E produce a genuine friction point.

---

## D13. two factual overclaims removed from PROJECT_BRIEF.md

both found by **apollo** on its first review, one corroborated independently by **athena**
while mapping the sdk surface for an unrelated task. hao approved both corrections and
identified :93 as his own error rather than a misreading.

### :93 and §6. ATS `scheduledTask` is not the Hedera Schedule Service

the brief called it "native scheduled transactions" and claimed the **Scheduled
Transactions** extra-points line on that basis.

**evidence, re-run by hermes before logging rather than taken from apollo's report.** six
patterns grepped across `packages/ats/contracts`, `--include="*.sol"`:

```
IHederaScheduleService                          0 hits
ScheduleCreate                                  0 hits
scheduleCreate                                  0 hits
HederaScheduleService                           0 hits
0x16b                                           0 hits
0x000000000000000000000000000000000000016b      0 hits
```

what it actually is: `domain/orchestrator/ScheduledTasksOps.sol`, an internal EVM task queue
drained lazily by the next state-mutating call. athena, tracing the sdk for a different
question, found the **entire** `port/in/scheduledTask` surface is two read queries,
`scheduledCouponListingCount` and `getScheduledCouponListing`
(`ScheduledCouponListing.ts:27,38`). there is no sdk write call that triggers a scheduled
coupon at all.

**decision:** the extra-points line is **dropped and not claimed.** four of six stands:
compliance controls, coupon distributions, oracle/NAV, upstream contribution. task 3.14 is
cut from block C.

**why dropping beats hedging:** a hedera judge disproves this in thirty seconds, and a claim
caught false contaminates the four that are true. we lose one line and keep the credibility
of the rest. cutting it also buys back block C hours that D11 says block D is going to need.

### :75. "There is no non-cryptographic version" removed

the sentence inverts under one question. the enclave attests `f(x)`, but `x` comes from the
borrower, and a borrower's incentive to inflate revenue and EBITDA is larger and more direct
than an agent bank's incentive to shade a haircut. so the arrangement as built does not
remove trust, it relocates it to the party with the clearest motive to misreport. naming
input integrity separately in §9.1 scoped the weakness but could not repair an **absolute**
claim that depended on its absence.

**decision:** §4 now states the narrower claim, which is true and still a differentiator:
the enclave replaces trust in execution with attestation, does not touch trust in the inputs,
and the production path for that is auditor-signed financials or an authenticated accounting
API verified inside the enclave.

per hao, **§9.1 is folded into §4** rather than left as a separate caveat, so the limitation
and the claim read as one thought instead of an assertion followed by a retraction. §9.1 now
points at §4 rather than repeating it.

**this is now the load-bearing paragraph of the submission.** zeus writes the writeups from
§4 as it now stands, not from memory of the old version.

---

## D14. W2 withdrawn. the scheduledTask docs are fine, we misread them

hao instructed that the `scheduledTask` finding was a documentation gap in ATS and should go
to rudolph as an upstream PR candidate. rudolph assessed it and **came back saying it is not
a gap.** hermes verified rudolph's evidence before accepting the reversal.

**what the docs actually contain.** `docs/ats/user-guides/corporate-actions.md:283-337`
documents the queue mechanism thoroughly and correctly, including force-cancel semantics and
the behaviour when a failing task blocks the queue: "when a task fails, the entire
transaction reverts and the queue stops processing". that is unambiguously an internal
queue, described accurately. `ScheduledTasksOps.sol` natspec reads "trigger every pending
cross-ordered task whose timestamp has elapsed".

greps for `hedera schedule service`, `schedule service`, `HSS` and `0x16b` across `docs/` and
`README.md`: **zero hits.** ATS never claims native hedera scheduling anywhere.

**so the misreading was entirely ours.** we conflated "scheduled" plus "built on hedera" into
"Hedera Schedule Service" without reading past the facet name. D13's correction to the brief
stands and was necessary. what does not stand is the characterisation of the cause.

**decision:** W2 withdrawn as a PR candidate. **B4 is the single upstream contribution**, and
`RequestAccount.privateKey` was re-verified live against `BaseRequest.ts:9` and `Wallet.ts:9`
during this assessment. W2 becomes one honest sentence in the writeup feedback section: we
briefly misread `scheduledTask` as the native schedule service, and on a closer read the docs
are accurate and never claim it.

**why this is the right outcome.** `PROJECT_BRIEF.md` §6 says do not manufacture a friction
point. D12 already caught the plan breaking that rule once, on W1. filing a docs PR to fix a
gap that does not exist would have been the same error a second time, and a devrel judge who
opened the file would have found accurate documentation and a contributor who had not read
it. the honest sentence is also the better devrel story.

**process note worth keeping.** this is the second time an agent has overturned a claim that
reached hao through hermes. the first was apollo on the bond config. in both cases the agent
checked a source that hermes had accepted on someone else's report. the gate ritual's step 2
is earning its cost.

---

## D15. four scope and process changes from apollo's review, hermes deciding alone

all four are scope cuts or reorderings, which `CLAUDE.md` §1 puts in hermes' hands. logged
because each one changes what we ship.

**CRE moves after block G.** the plan ran CRE on saturday with the video, README and writeups
after it. chronos' own charter supplies the counter-argument: the cost of overrunning the CRE
timebox is the submission artifacts, which are downstream of it. so draft block G first
against the local engine, then open the CRE timebox. if it lands, add forty seconds of video
and the third writeup. if it does not, **nothing is downstream** and CRE becomes genuinely
expendable rather than nominally expendable. costs nothing and removes the only way CRE can
hurt us. hao's instruction to keep CRE is unchanged, this is ordering only.

**three of six hold verbs.** `createHoldFrom`, `controllerCreate` and `protectedCreate`
demonstrate nothing plain create does not, and `protectedCreate` needs EIP-712 signature
assembly (`Hold.ts:106-131`) worth about two hours. athena has mapped all six for the
writeup. gamma calls create, release and execute.

**two holds in block E, not one.** release and execute are mutually exclusive outcomes of the
same hold, so the old plan would have reached 3.24 and found the hold gone. two holds costs
one signature and improves the video: the engine choosing differently on two identical
instruments.

**apollo does not run at G1 and G2.** those gates are transactions that either landed or did
not. there is no claim to attack, and running the ritual where it does nothing trains us to
skip it where it matters. apollo runs from G3 onward and any time a sentence is written for
a judge.

**and the vocabulary rule is narrowed.** `specs/00-mission.md` banned the word "repo"
outright. our own committed artifacts used it about fifteen times meaning a code repository,
including in the charters that enforce the rule. a rule that is false on its face gets
ignored wholesale, which is worse than a narrow rule that is followed. **"repo" is banned in
the finance sense only.** write "repository" in full in judge-facing artifacts.

em-dashes have been stripped from `.env.example`, all nine charters and
`specs/03-upstream-workflows.md`. `CLAUDE.md` and `PROJECT_BRIEF.md` keep theirs, being
internal and in hao's own register.

---

## D16. the rate leg restated truthfully, and `setCouponRateType(FIXED)` is now load-bearing

apollo's second review. hao approved the rewrite.

**what was false.** `PROJECT_BRIEF.md` §3 step 5 and §11 item 4 said the KPI is posted via
`addKpiData` and the KPI-linked rate mechanism steps the coupon automatically. none of that
happens. `specs/00-mission.md:33` repeated it. we are on a config-2 token, which carries no
`KpisFacet` and no `KpiLinkedRateFacet`, because config 4 cannot be deployed against by any
path (`BUG.md` B1).

**the thing apollo found that neither hermes nor gamma had.** we had accepted
`RateType.STANDARD` as given because `deployBond` hardcodes it. it is not given. config 2
carries `InterestRateFacet`, which exposes `setCouponRateType`
(`facets/interestRate/IInterestRate.sol:67`), gated by `ROLE_INTEREST_RATE_MANAGER`, a role
we were already granting. **one extra transaction.**

the difference is the whole second differentiator:

- **STANDARD** (`CouponRateDispatch.validateAndStamp:96-98`): the caller hands the token a
  rate and the token stores whatever it is handed. no rate logic. our console types a number
  into a struct field. **apollo's verdict: on this path we collapse into a bond with a
  privacy story bolted on**, which §4 explicitly says we moved away from being
- **FIXED** (`:85-89`): the token **reverts with `InterestRateIsFixed()` if the caller
  supplies any rate at all**, reads the rate from its own storage, and stamps every coupon
  itself. the rate reaches storage only through `FixedRate.setRate`
  (`facets/fixedRate/FixedRate.sol:29-36`), a separate role-gated transaction emitting
  `RateUpdated`, whose entire payload is the engine's output

**hard ordering constraint.** `InterestRate.sol:38` carries a maintainer TODO: "check if
changing the rate type is allowed after existing coupons have been issued". they do not know.
**so we switch before the first `setCoupon`, not after.** that TODO is also an honest line
for the writeup's feedback section.

`setCouponRateType` is not exposed anywhere in `port/in`, so it is a direct ethers call.
gamma must confirm one thing before block C: that `BigDecimal.fromString("0")` yields
`decimals === 0`, so the pending triplet reaches the contract. if it does not, this path is
dead and that is itself a bug report.

**what §3 step 5 now says**, and zeus writes from this, not from memory of the old version:
the engine's leverage reading is converted to a rate off chain against bounds published at
issuance, posted by a role-gated `setRate`, and ATS stamps every coupon from token storage.
then plainly what we could not use and why.

**one ordering rule apollo insisted on and it is right.** the on-chain version would publish
the borrower's leverage ratio to a public ledger, and in real private credit a covenant
compliance certificate goes to lenders under an NDA. so the substitute discloses strictly
less. **that must never lead.** say what we could not do, then why, then one sentence that
the substitute discloses less. in that order it is a design observation. in the other order
it is an excuse for a limitation we did not choose.

**the thesis was never at risk.** apollo re-read §4: the load-bearing claim is a lender
pricing a risk it may not inspect, carried by the haircut, `Hold.escrow`, and the
release-versus-execute fork. all present on config 2, escrow `0.0.10445014` distinct from the
agent `0.0.10424387`. what config 2 costs is sponsor-product depth, which is a real loss and
a smaller one than it felt.

---

## D17. the "discloses strictly less" claim was false. corrected

hercules flagged it while building the engine, and hermes verified it.

apollo's second review argued, and hermes wrote into `PROJECT_BRIEF.md` §3 step 5, that our
off-chain rate path "discloses strictly less" than an on-chain `addKpiData` would, because
`addKpiData` publishes the borrower's leverage ratio to a public ledger.

**it does not.** `rateForKpi` in `lib/ats/note-terms.ts` is piecewise linear across the
published bounds: 1.00x leverage maps to 4.00%, 3.00x to 8.00%, 6.00x to 16.00%. the rate is
**finer grained than the KPI it consumes**, 400 rate steps across 200 leverage steps, so
inside the operating band every leverage value maps to a distinct rate. the mapping is
**invertible**. once `FixedRate.setRate` lands, anyone holding the bounds, which are
published at issuance by design, recovers the leverage from the rate. it is non-invertible
only outside the caps, where values clamp to min or max.

so publishing the rate is, within the band, equivalent to publishing the KPI. the substitute
discloses the same thing by a slightly longer route.

**what is actually true, and it is still the claim worth making.** the boundary is around the
**financials, not the KPI**. revenue, EBITDA, total debt and interest expense never leave the
engine. hercules verified that against the running server: the lender page, its inlined RSC
flight payload, and all fourteen script chunks it loads, 3.64 MB, scanned for every fixture
value and field name, zero hits, **with a control scan against the agent view returning hits
to prove the search actually fires.** a negative result without a control is worthless.

§3 step 5 rewritten to say exactly that, and to state plainly that we do not claim the
substitute discloses less, because it does not.

**process note.** apollo proposed the line and hermes wrote it, and neither checked whether
the function was invertible. it took the person building the thing to notice. that is the
third time an agent has overturned a claim that had already passed review, and it is an
argument for having the implementer read the claims rather than only the reviewer.

---

## D18. block B uses the internal KYC registry directly, not the mock external list

hermes instructed gamma to use `createExternalKycMock()` + `grantKycMock()` and avoid internal
`grantKyc`. gamma deviated and was right. hermes verified the load-bearing claim at source
before approving.

**why the mock path cannot work on this token.** `KycStorageWrapper.sol:206-210` **ANDs** the
two legs:

```solidity
bool internalKycValid = !kycStorage().internalKycActivated ||
    getKycStatusFor(_account, ...) == _kycStatus;
return internalKycValid && ExternalListManagementStorageWrapper.isExternallyGranted(...);
```

our token has `internalKycActivated == true`, pinned deliberately at issuance per D10. an
external-list grant satisfies only the second leg, so the transfer stays blocked. making the
mock path work needs `deactivateInternalKyc()` first, which discards the flag D10 calls
load-bearing, adds transactions, and moves the compliance gate onto `contracts/test/mocks`.

**why the internal path is legitimate.** hermes' reason for avoiding it was
`GrantKycCommandHandler.ts:34-42`, which decodes a Terminal3 verifiable credential and calls
`verifyVc()`. **that check is entirely client side.** the deployed contract
(`facets/kyc/Kyc.sol:59-81`) takes `string memory _vcId` and stores it opaquely in
`KycData`. verified: the only read of it anywhere is `KycStorageWrapper.sol:131`, a
revocation-list lookup that runs only if a revocation list address was set, which on our
token it was not.

**decision:** grant KYC through the deployed `Kyc` facet directly via ethers. same precedent
as `setCouponRateType` in D16. keeps `internalKycActivated: true`, uses the production
registry rather than a test double, and costs 7 signatures rather than 9.

**how this must be described, and it is not optional.** we grant KYC in the token's own
internal registry, carrying a **placeholder credential identifier that the contract stores
and never verifies.** we do not claim to have verified anyone's identity. saying we ran KYC
would be false; saying we exercised the token's compliance gate is true. zeus writes the
second.

**two prerequisites nobody had found**, both verified live by gamma:
`KycStorageWrapper.sol:126` returns `NOT_GRANTED` when `isIssuer(record.issuer)` is false, and
the token reports `getIssuerListCount() == 0`, so `SsiManagement.addIssuer` must run first or
**every grant reads as not granted no matter what was written**. and `ROLE_KYC`,
`ROLE_SSI_MANAGER` and `ROLE_ISSUER` are all unheld: the issuer holds only
`DEFAULT_ADMIN_ROLE`.

---

## D19. the issued token has zero supply. `deployBond` writes a cap, it does not mint

found by gamma reading the chain rather than assuming. `totalSupply() == 0`,
`balanceOf(issuer) == 0`, `getMaxSupply() == 100000` raw, which is 1000.00 notes at 2 decimals.

**G1 remains honest as recorded**: a bond was issued and exists on chain. it had no supply,
and nothing in `EVIDENCE.md` claimed otherwise. but minting is now part of block B, and it is
itself compliance gated: `Mint.sol:48` carries
`onlyIdentifiedAddresses(address(0), _tokenHolder)`, so **the issuer must hold KYC before it
can receive its own notes.**

that is what turns block B from three transactions into eight.
