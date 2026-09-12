# MASTER_TODO_LIST.md

owner: hermes
status: **G1 to G4 green and independently verified. 12 sep 2026.**
remaining: the video (three takes and an edit), and CRE, which is expendable.

| | |
|---|---|
| now | thu 10 sep 2026, 03:24 SGT |
| deadline | **sun 13 sep 12:00 EDT = mon 14 sep 00:00 SGT** |
| wall clock | 104.6 h |
| build order | 40 working h (CLAUDE.md §5) |
| slack | ~64 h for sleep, meals, and overrun |
| target submit | **sun 13 sep, 20:00 SGT.** four hours before the line. |

CRE is **in**. the hours 26-30 timebox stays at 4 hours and chronos still calls it.

---

## phase 0. team formation

there is no `.claude/` directory in this repo. the nine personas in CLAUDE.md §2 do not exist
as anything a tool can invoke. formation means writing them.

- [x] **0.1** create `.claude/agents/` and write nine definitions, one file each:
      `apollo.md`, `athena.md`, `hercules.md`, `gamma.md`, `zeus.md`, `rudolph.md`,
      `argus.md`, `iris.md`, `chronos.md`. each carries its CLAUDE.md §2 charter as the
      system prompt, plus a tools allowlist and a model choice.
- [x] **0.2** set tool scope per agent. athena and apollo get read and search only, no write.
      gamma and hercules get full tools. rudolph gets bash and git. argus gets read, bash,
      and web fetch for hashscan. zeus and iris get read and write.
- [x] **0.3** set model per agent. opus for apollo, gamma, hercules. sonnet for athena,
      zeus, rudolph, argus, iris. haiku for chronos.
- [x] **0.4** deadline corrected in `PROJECT_BRIEF.md:5` and `CLAUDE.md:17` to
      "monday 14 september 2026, 11:59am SGT". approved by hao.
      **superseded 12 sep.** that was still wrong. the real deadline is sunday 13 september
      12:00pm EDT, which is monday 14 september 00:00 SGT. we read it off the submission
      rules rather than the brief and lost 12 hours of assumed runway. corrected everywhere.
- [x] **0.5** reconcile `CLAUDE.md` §6. its paths are relative to the ATS clone, not this
      repo. rewrite §6 to name the sibling clone as read-only reference and this repo as
      where our code lives. see D1, approved.
- [x] **0.6** create `DECISIONS.md`, `EVIDENCE.md`, `specs/`. seed DECISIONS.md with D1
      through D5 below.
- [x] **0.7** `git add PROJECT_BRIEF.md` and commit the whole governance set. it is currently
      untracked. spec files and prompts in the repo are an ETHGlobal eligibility condition,
      not housekeeping.

- [x] **0.8 done, 10 sep.** session restarted, all nine agents resolve. claude code reads
      `.claude/agents/` **at session start**, so the nine definitions written this session do
      not resolve yet. verified: `Agent(subagent_type: "rudolph", ...)` returned
      `Agent type 'rudolph' not found`. frontmatter on all nine parses clean and names match
      filenames, so this is a loader lifecycle issue, not a content bug. nothing else in
      phase 0 or 1 is affected, and no agent work can start until it is done.

**definition of done for phase 0:** commit `9337f81` exists containing brief, claude.md,
decisions, evidence, specs and the nine agent definitions. **partially met.**
`Agent(subagent_type: "athena", ...)` resolving is deferred to 0.8, after a session restart.

---

## phase 1. team briefing

each agent gets a written brief before its first task. not a chat message, a file, so it
survives context loss and lands in the repo for eligibility.

- [x] **1.1** `specs/00-mission.md` written. the shared brief every agent reads first.
      every one of the nine definitions opens by pointing at it.
- [x] **1.2 cut. see D7.** `.claude/agents/*.md` are the charters and the prompts, they are
      committed, and they are what the runtime loads. a second document describing the same
      nine agents would drift.
- [x] **1.3 done.** apollo reviewed `specs/00` and `01` and this file before any build starts.
      apollo has standing halt authority. if it halts, i fix the plan or escalate to you.
- [x] **1.4 done.** athena's first task, run in parallel with 1.3, no dependency on it:
      map the sdk operation surface for issuance, kyc, coupon, `addKpiData`,
      `createKpiLinkedRate`, and all six hold verbs. cite `.d.ts` paths and line numbers.
      the published sdk ships 3638 typings under
      `node_modules/@hashgraph/asset-tokenization-sdk/build`, so this is answerable locally.
      output to `specs/02-sdk-surface.md`.
- [x] **1.5 done.** athena's second task: read the upstream `.claude/commands` and `.claude/skills`
      in the ATS repo once the reference clone exists (D1). those are the maintainers' own
      workflows. output to `specs/03-upstream-workflows.md`.

**definition of done for phase 1:** apollo has signed off or logged an objection, and
`specs/02-sdk-surface.md` cites real file paths for every operation in the ship order.

---

## phase 2. standing processes

honest note on mechanism. sub-agents are ephemeral. they do not run in the background on a
schedule the way the charters imply. what follows is what is actually enforceable.

### the timebox check (chronos). option C, see D4

- [ ] **2.1a** blocks A through E and G: manual check at each phase boundary. no loop.
- [ ] **2.1b** block F only: start a `/loop` at the moment CRE work begins, and stop it the
      moment G5 resolves either way. it compares elapsed against the 4 hour timebox and
      calls the stop. it does not negotiate and i do not get to argue with it.

### the gate ritual, at every gate G1 to G6

fixed sequence, no exceptions, no shortcuts when we are behind:

1. gamma or hercules declares the flow working
2. **argus verifies independently, read-only.** argus cannot re-execute, since every
   signature needs hao clicking MetaMask (D3). so argus queries mirror node and hashscan
   for the resulting chain state, in a fresh session with no sight of gamma's transcript.
   a claim without a hashscan link is not a claim
3. argus appends the transaction id and hashscan url to `EVIDENCE.md`
4. **iris captures footage immediately.** before polish, before the next task
5. apollo attacks the claim as a finance-literate judge would. **G3 onward only, and any
   time a sentence is written for a judge.** not at G1 or G2, which are transactions that
   either landed or did not, with nothing to attack. see D15
6. rudolph commits
7. hermes signs off, or escalates to hao for G3 and G5

### continuous

- [ ] **2.2** rudolph commits at every green state, conventional commits, never force-push,
      never rewrite history. the repo is demoable at every commit after G1.
- [ ] **2.3** every prompt and spec written during the build lands in `specs/`. eligibility.
- [ ] **2.4** apollo enforces §8 vocabulary on every artifact at the moment it is written,
      not in a sweep at the end. never risk-free, ZK, trustless, vesting, APY.
      **"repo" is banned in the finance sense only** (repurchase agreement). write
      "repository" in full in judge-facing artifacts. the blanket ban was unenforceable:
      our own committed files used it ~15 times meaning a code repository, and a rule that
      is false on its face gets ignored wholesale. narrowed per D15.
- [ ] **2.5** log every non-obvious call in `DECISIONS.md`, including any apollo objection i
      proceed against.

---

## phase 3. build

calendar is indicative. gates are not.

### block A. environment and issuance. **DONE, G1 green 10 sep.**

**nothing else happens until this works.** if it breaks, this is the whole block.

- [x] **3.1** `.env.example` committed, `.env.local` created and ignored. network, resolver,
      factory, both config ids, hashscan base, and all four accounts. **`NEXT_PUBLIC_`
      prefixes, not `REACT_APP_`**, see D8. no key material, by design.
- [x] **3.2** *hao action, done.* **all four funded and verified:** issuer `0.0.10424387`, evm
      `0x56a45ef1d79a3a6fd6cfa6b833612705d2edc742`, 974.76 HBAR, ECDSA_SECP256K1, verified on
      mirror node 10 sep. three more accounts in progress for holder, lender and escrow.
      **each must be ECDSA secp256k1, not ED25519.** MetaMask cannot hold an ED25519 key, so
      an ED25519 account is unusable however well funded. argus verifies each on arrival.
      no token association step is needed: there are no associate methods in `port/in`,
      which confirms ATS securities are EVM contract state via the resolver, not HTS native
      tokens. so a failed transfer in block B fails for the reason we claim it does.
- [x] **3.3** gamma: sdk init, wallet connect, network handshake. **rabby confirmed
      reporting `isMetaMask: true`**, which is what `MetamaskService.ts:99` hard-checks, so
      no wallet detour. prove we can read chain state before we try to write any.
- [x] **3.4** gamma: **issue via `Bond.createKpiLinkedRate` against config `0x...04`.**
      rewritten per D10. this single call is the highest-consequence moment in the build.

      **config `0x...04`, never `0x...02`.** config 2 is bond *variable rate* and carries no
      `KpisFacet` and no `KpiLinkedRateFacet`. issuing on it means `addKpiData` hits an
      unregistered selector at block D and the build is lost at hour 20. verified live on
      resolver `0.0.9212226`: config 4 is at version 1, 8 configurations registered.

      **`createKpiLinkedRate` IS the issuance call**, not a later configuration step.
      `port/in/bond/Bond.ts:227` takes `CreateBondKpiLinkedRateRequest`, builds
      `SecurityProps`, returns a new security. old task 3.18 was impossible and is deleted.

      **three flags, set once here, each silently killing a later block if wrong:**
      - `clearingActive: false`. `HoldByPartition.sol:50` carries `onlyClearingDisabled`.
        clearing on means block E is dead and unrecoverable
      - `internalKycActivated: true`. otherwise block B does not block and the compliance
        demo is a lie
      - `proceedRecipientsIds`: at least one project address, or `addKpiData` is **silently
        ignored** (`KpiLinkedRateLib.sol:87-111`). silent, not an error

      **choose `missedPenalty` and the baseline here** so the KPI path and the missed-report
      path produce visibly different rates. see D11, this is what makes G4 provable.
- [x] **3.5** argus: find it on hashscan, link into `EVIDENCE.md`. **also read back the
      config id and the three flags from chain** and confirm each. this is the one gate where
      verifying the parameters matters more than verifying the transaction landed.
- [ ] **3.6** iris: capture the issuance shot.
- [x] **G1 GREEN, 10 sep.** token `0.0.10450229`, tx `0xb13a7851…`, argus verified.

### block B. compliance. **DONE, G2 green 10 sep.**

**the evidence model changed here. read this before planning the shot.**
`TransferCommandHandler.ts:42` pre-checks with a `CanTransferByPartitionQuery` eth_call and
throws a client-side `InvalidKycStatus` **before submitting any transaction.** so the blocked
transfer produces **no hashscan link** by default. the token would reject it, but the sdk
never lets it get that far.

- [x] **3.7** gamma: attempt a transfer to an unverified party. capture the thrown sdk error
      **and** the `CanTransferByPartition` eth_call returning false. that pair is the
      evidence, not a failed transaction.
- [x] **3.7b** gamma: **additionally force one raw on-chain attempt**, bypassing the sdk
      pre-check, so we get a genuinely reverted transaction on hashscan. "the token rejected
      it" is the claim we are making, and a client-side exception does not prove it.
      timebox 45 minutes. if it fights back, ship 3.7 alone and say plainly in the writeup
      that the sdk blocks client-side.
- [x] **3.8** gamma: kyc grant. **use the mock external kyc list path**
      (`ExternalKycListsManagement.createExternalKycMock()` then `grantKycMock()`), not
      internal `grantKyc`. `GrantKycCommandHandler.ts:38-41` calls `verifyVc()` from
      `@terminal3/verify_vc` and throws without a real verifiable credential. we do not have
      one and are not getting one this weekend.
- [x] **3.8b** gamma: **grant kyc to the lender too, not just the holder.**
      `executeHoldByPartition` carries `onlyIdentifiedAddresses(tokenHolder, _to)` and
      `onlyCompliant` (`HoldByPartition.sol:118-119`), so an unverified lender means block E
      reverts at the money shot. cheap now, fatal on saturday.
- [x] **3.9** gamma: same transfer again. it succeeds. **this one does produce a hashscan
      link**, and the contrast with 3.7 is the demo.
- [x] **3.10** hercules: the console renders all three states legibly. a judge watching at
      1.5x has to see blocked, granted, permitted.
- [x] **3.11** argus records. iris captures immediately. two of the four shots that matter.
- [x] **G2 GREEN, 10 sep 2026.** signed on testnet, argus verifying independently.
      mint `0x69bcc898…`, forced revert `0x904d61cc…` (`CONTRACT_REVERT_EXECUTED`,
      selector `0xfc855b1b` = `InvalidKycStatus()`), holder grant `1789049932.186440373`,
      lender grant `0x0bf73993…`, permitted transfer `0x582b822d…`.
      final state: issuer 750.00, holder 250.00, all three accounts GRANTED.
      **apollo not run at this gate**, see D15.

### block C. coupon. **DONE, G3 green 11 sep. a submittable entry exists.**

- [x] **3.12** gamma: `updateMaturityDate` to compress the lifecycle into demo time.
      needs `ROLE_MATURITY_MANAGER`, which athena found is **missing from the sdk's
      `SecurityRole` TS enum** and must be passed to `grantRole` as a raw hex literal.
- [x] **3.13** gamma: set the coupon, distribute to holders of record.
- [x] **3.14 CUT, see D13.** `scheduledTask` is an internal EVM task queue, not the hedera
      schedule service. the extra-points line is dropped and not claimed. cutting this also
      buys back hours that block D now needs.
- [x] **3.15** argus records. iris captures.
- [x] **G3 GREEN, 11 sep. a submittable hedera entry exists.** the token priced the
      coupon from its own storage: we sent a pending triplet, it stamped 600 at 4 decimals.
      from here everything is upside and i will not risk 1 to 3 to reach it.

### block D. confidential engine and repricing. **DONE.** the engine and the
lender/agent split were built ahead of schedule; the repricing leg folded into block C.

- [x] **3.16** hercules: the engine as a **plain local service behind a clean interface.**
      inputs revenue, ebitda, leverage. outputs covenant verdict, kpi value, haircut.
      no CRE yet. the interface is the whole point, the handler swaps in later without
      touching a single caller.
- [x] **3.17** hercules: **the lender view and agent view split.** the agent sees the inputs.
      the lender sees only the haircut, with the input fields visibly absent. brief §9.3 is
      right that confidentiality is invisible on video. the visible absence is the demo.
- [x] **3.18 DELETED, folded into 3.4.** `createKpiLinkedRate` is the issuance call. it
      could never have been applied to an already-issued note. see D10.
- [x] **3.18b** gamma: grant the roles this block needs, each its own transaction:
      `ROLE_KPI_MANAGER` for `addKpiData` (`facets/kpi/Kpis.sol:41`) and
      `ROLE_INTEREST_RATE_MANAGER` for the rate setters
      (`facets/kpiLinkedRate/KpiLinkedRate.sol:54,74`). none of these were in the old plan.
- [x] **3.19** gamma: post the engine's kpi via `addKpiData`. **the rate does not step when
      you call this.** `KpiLinkedRateLib.sol:40-64` computes at a coupon's `fixingDate`, on
      read. `onlyValidDate` (`KpisModifiers.sol:25`) rejects a future date, a duplicate
      checkpoint date, or one below the minimum. this block is date arithmetic across
      `startPeriod`, `reportPeriod`, `fixingDate` and the compressed maturity.
- [x] **3.20** argus: **verify by value, not by delta. see D11.** the gate is that the new
      rate equals `_getRateFromImpact(impact, kpiData)` for the value we posted **and is not
      equal to** `previousRate + missedPenalty`. a rate that moved via the missed-report path
      looks identical on screen and in the mirror node, and claiming our kpi caused it would
      be a false causal claim on video, checkable from source in five minutes.
      iris captures before and after only once argus has confirmed which path fired.
- [x] **G4a** done, folded into G4.

**block D is the block that overruns, not block E.** it is the date choreography, and it got
heavier when the role grants and the value check were counted.

### block E. collateral hold. **DONE, G4 green 12 sep.**

strongest single shot on video.

**two holds, not one.** release and execute are mutually exclusive outcomes of the same
hold. the old plan did 3.23 then 3.24 and would have found the hold gone. one extra
signature, and the video gets better: the engine choosing differently on two identical
instruments.

**scope cut, see D15.** we call three of the six verbs. `createHoldFrom`, `controllerCreate`
and `protectedCreate` demonstrate nothing plain create does not, and `protectedCreate` needs
EIP-712 signature assembly (`Hold.ts:106-131`) that would eat two hours. athena has mapped
all six for the writeup. gamma calls three.

- [x] **3.21** gamma: **two** `createHoldByPartition` calls, both with `escrow` =
      `0.0.10445014` and **`to` = the lender**. pinning `to` at creation
      (`HoldStorageWrapper.sol:1086-1088`) means the escrow's only remaining choice is
      release versus execute, which is exactly the decision we claim the engine makes. that
      is a stronger writeup sentence than "the engine is the escrow".
      **watch the expiry.** `_validateExecuteHold` reverts `HoldExpirationReached`, so a
      short demo expiry kills the money shot.
- [x] **3.22** hercules: lender advances cash at the engine's haircut, in the console.
      off-chain, tracked in the console only. zeus has already drawn it that way.
- [x] **3.23** gamma: `releaseHoldByPartition` on hold #1, the repayment path.
- [x] **3.24** gamma: **`executeHoldByPartition` on hold #2**, the default path. collateral
      moves to the lender, driven by a number the lender never saw. the money shot.
      **signer must be the engine account.** the escrow check is on-chain only and not
      pre-validated by the sdk, so a wrong signer reverts `IsNotEscrow` live. confirm the
      wallet is on `0.0.10445014` before recording.
- [x] **3.25 CLOSED, see D12.** the `HoldDetails` timestamp trap is not a bug. apollo and
      athena verified independently: the constructor param is misnamed but the only call site
      passes the right value and the struct carries one timestamp, so no swap is possible.
      demoted to a naming nit. **F2 is the upstream candidate**, not this.
- [x] **3.26** argus records every hold transaction. iris captures 3.24 first and best.
- [x] **3.26b DROPPED.** the `Hold.data` commitment is unreachable through the sdk
      (`RPCTransactionAdapter.ts:1016` hardcodes `0x`) and reachable only by hand-built
      calldata on the single most load-bearing transaction in the demo, to add a commitment
      nothing on chain verifies. recorded in `docs/architecture.md` under what the diagram
      deliberately does not draw. original note follows.
      ~~decision pending: put a hash of the engine's output payload into
      `Hold.data`** (`HoldStorageWrapper.sol:69`, emitted in `HeldByPartition` at
      `HoldByPartition.sol:65`). apollo's proposal, roughly 30 minutes. it gives the hold an
      on-chain commitment to the exact haircut computation, readable on hashscan, and turns
      "a human typed a number" into "the hold commits to the engine output and only the
      engine can act on it". **not decided. hermes decides at G4 with the real sdk surface
      in hand, and tells hao before it ships**, since it changes what the architecture
      diagram may honestly draw.
- [x] **G4 GREEN, 12 sep 2026.** argus verified independently. both holds named the engine
      `0.0.10445014` as escrow and the lender `0.0.10444404` as destination, decoded from
      calldata and cross-checked against each `HeldByPartition` event. destination non-zero
      on both. collateral moved: holder 250.00 to 150.00, lender 0 to 100.00.
      create A `0x46c5fbaa…`, release A `0x224eb538…`, create B `0xea01d72c…`,
      execute B `0xed43e199…`.

### block F. CRE confidential workflow. **now runs AFTER block G. see D15.**
**hard 4 hour timebox**

**reordered.** the plan had CRE on saturday and the submission artifacts after it. chronos'
own charter argues against that: "the cost of overrunning is the video, the README and the
writeups, which are downstream of block F." that is an argument for reordering, not for a
tighter timebox.

so: block G first. video, README and the two hedera writeups drafted against the local
engine. **then** open the CRE timebox. if it lands, add forty seconds to the video and the
third writeup. if it does not, nothing is downstream and CRE is genuinely expendable rather
than nominally expendable.

do not start until every gate above is green **and block G is drafted**.

- [ ] **3.27** athena: read the CRE confidential workflows templates and bootcamp. cite the
      exact `handlerInTee` registration signature. no guessing.
- [ ] **3.28** hercules: swap the 3.16 service behind `handlerInTee`. if the interface was
      built right this is small. if it is not small, the interface was wrong and that is
      the signal to stop.
- [ ] **3.29** at least one genuinely sensitive input processed inside the enclave.
      meaningfully integrated, not a placeholder handler. the prize checks this.
- [ ] **3.30** CRE CLI simulation runs, evidence captured.
- [ ] **G5 — needs hao.** simulation runs, proceed. does not run at hour 4, chronos calls
      it, we drop the chainlink prize and lose nothing already built. **if we ship the
      simulation we say so plainly in the writeup. TEE-based, not ZK, and simulated.**

### block G. submission. sat 12 sep to sun 13 sep

- [ ] **3.31** iris: **video, 4 minutes maximum, 2 minimum.** issuance, configuration, at least one
      lifecycle op. **open on a hashscan transaction inside twenty seconds.** no logo intro,
      no market-size slide. the four shots: blocked transfer, kyc grant, permitted transfer,
      `executeHoldByPartition` firing. then the confidentiality reveal, engine inputs on
      screen, then the lender's view with those fields gone.
      *hao action: screen recording and voiceover. iris writes the shot list and script.*
- [x] **3.32** zeus: **architecture diagram.** stated requirement for chainlink, not a nicety.
- [x] **3.33** zeus: README.
- [~] **3.34** zeus: three per-prize writeups. **drafted**, G4 and video placeholders open. the integration note is the high-leverage
      neglected one. **write the integration section like documentation and the feedback
      section like a real bug report:** what was hard in the ATS sdk, what needed a
      workaround, what is missing. name our own weaknesses from brief §9 before a judge
      finds them. input integrity, illiquid seizure, invisible confidentiality.
- [~] **3.35 reframed.** the Open Source track wants a contribution to
      `hedera-dev/hedera-harness`, a different repository. our fifteen defects are against
      the asset tokenization studio, so they do **not** qualify for that track and count
      instead as an extra point on Tokenization. see `specs/06-hedera-harness.md`.
      ~~rudolph: prepare the upstream PR to `hashgraph/asset-tokenization-studio`.
      **branch off their `develop`, not `main`.** DCO sign-off and GPG signature on every
      commit from the first one, see D9 and H9. PR needs an assignee. changeset required
      unless a bypass label applies. full checklist at the top of
      `specs/03-upstream-workflows.md`. **prepare only. hao opens it.**
- [ ] **3.36** apollo: final pass. every claim against a finance-literate judge, every
      artifact against §8. this is the last chance, judging is asynchronous and there is
      no Q&A.
- [ ] **3.37** argus: every claim in every writeup traces to a link in `EVIDENCE.md`.
- [ ] **G6 — needs hao.**

### block H. buffer. **sun 13 sep 20:00 to 22:00 SGT. untouchable.**

no new work. **submit at 22:00 SGT on sunday**, two hours before the line.

the deadline is **mon 14 sep 00:00 SGT**, which is sunday 13 sep 12:00pm EDT. the previous
version of this block submitted at 10:00 SGT on monday, **ten hours after the deadline had
closed.** apollo halted it. corrected 12 sep.

---

## blocked on hao

no agent can do these and several block everything downstream.

| | what | blocks |
|---|---|---|
| H1 | ~~metamask + faucet~~ issuer account **done**, `0.0.10424387`, 974.76 HBAR, ECDSA. three more in progress | block B onward |
| H2 | ~~chronos~~ **decided**, option C, see D4 | nothing |
| H3 | screen recording and voiceover | 3.31 |
| H4 | approve deadline correction in the two governing docs | 0.4 |
| H5 | ~~repo layout~~ **decided**, see D1 | nothing |
| H6 | G3, G5, G6 sign-off | phase transitions |
| H7 | open the upstream PR | 3.35 |
| H9 | **new.** GPG key generated and configured, before rudolph's first upstream-bound commit. their `pre-push` hook hard-rejects any commit lacking DCO sign-off or a GPG signature (`.husky/pre-push:131-139`). retrofitting needs `rebase -i`, which is unavailable here. their setup script is `.github/scripts/setup-git.sh`. **does not affect covenant's own commits** | 3.35, and only 3.35 |
| H8 | submit to ETHGlobal | everything |

---

## decisions pending log

**D1. repo layout. resolved 10 sep.** the ATS clone exists at
`~/projects/hackathon/hedera/asset-tokenization-studio`, tag `v.8.0.0-ats`, exactly matching
our installed `@hashgraph/asset-tokenization-sdk@8.0.0`. so `packages/ats/sdk/src` there is
true ground truth for what we run, not an approximation. it is a **read-only reference.** we
build the console in this next.js app on the npm sdk, because the lender / agent view split
in 3.17 is the confidentiality demo and grafting it onto their react 18 app is slower than
writing it. their `.claude/` holds `commands/docs/update-docs.md` and a
`skills/solidity-natspec` checker. athena reads both.
**status: hao approved, 10 sep.**

**D2. CRE retained.** at the 11 sep reading the 4 hour CRE timebox did not fit. at the real
14 sep deadline it fits with room. three prizes attempted at the time; now two, see the open source withdrawal. the 4 hour timebox and
chronos' authority to call it are unchanged.
**status: hao decided, 10 sep.**

**D3. no private key, ever.** `SupportedWallets` at
`packages/ats/sdk/src/domain/context/network/Wallet.ts:5-13` has `CLIENT` commented out at
line 9. the raw-key signer is disabled in sdk v8. the live adapters are
`port/out/rpc/RPCTransactionAdapter.ts`, which delegates every signature to `MetamaskService`
and the browser injected provider, `port/out/hs/walletconnect`, and `port/out/hs/custodial`.
there is no local-key path. `RequestAccount.privateKey` at `BaseRequest.ts:9` is vestigial
and consumed by nothing, which is the trap.
consequence: **every signature is hao clicking MetaMask.** no key enters `.env`, the repo, or
any agent's context. and argus cannot re-execute a flow, so argus verifies read-only against
mirror node and hashscan instead. that checks chain state rather than re-running, and it is
still independent.
**status: settled by source, 10 sep.**

**D4. chronos runs once, in block F only.** `/loop` re-invokes the main session carrying full
context, and a 2h interval exceeds the 1h prompt cache TTL, so every wakeup pays a cold read.
that is the worst available cost profile. more to the point, chronos got less valuable when
the deadline moved to 14 sep: 104h against a 40h plan is ~64h of slack, so drift is absorbed,
not fatal. the one place a timebox still bites is the CRE 4 hour stop, which exists precisely
for the moment i am mid-debug and sure the next fix is the one. loop there, nowhere else.
**status: hao approved option C, 10 sep.**

**D5. four accounts, not one.** issuer/agent, note holder, lender, and the engine as
`Hold.escrow`. the escrow split is load-bearing: if escrow is the agent's address then the
agent decides release vs execute, which is exactly the status quo brief §4 says we replace.
a judge who reads the escrow address would find the thesis undone.
**status: hao provisioning, 10 sep.**

---

## the rules that do not bend

- one feature at a time, finished. no starting CRE while the coupon is half-wired
- testnet only. no new solidity, no contract deployment
- evidence or it didn't happen. a hashscan link or it is not done
- capture footage the moment a flow first works, not when it is pretty
- no silent scope growth. if a task is bigger than planned, stop and tell hermes
- ship order 1 to 3 is never risked to reach 4 to 7
