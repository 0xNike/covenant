# MASTER_TODO_LIST.md

owner: hermes
status: **phase 0 executing. hao approved 10 sep 2026.**

| | |
|---|---|
| now | thu 10 sep 2026, 03:24 SGT |
| deadline | mon 14 sep 2026, 11:59 SGT |
| wall clock | 104.6 h |
| build order | 40 working h (CLAUDE.md §5) |
| slack | ~64 h for sleep, meals, and overrun |
| target submit | mon 14 sep, 10:00 SGT. two hours before the line. |

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
- [~] **1.3 running.** apollo reviews `specs/00` and `01` and this file before any build starts.
      apollo has standing halt authority. if it halts, i fix the plan or escalate to you.
- [~] **1.4 running.** athena's first task, run in parallel with 1.3, no dependency on it:
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
5. apollo attacks the claim as a finance-literate judge would
6. rudolph commits
7. hermes signs off, or escalates to hao for G3 and G5

### continuous

- [ ] **2.2** rudolph commits at every green state, conventional commits, never force-push,
      never rewrite history. the repo is demoable at every commit after G1.
- [ ] **2.3** every prompt and spec written during the build lands in `specs/`. eligibility.
- [ ] **2.4** apollo enforces §8 vocabulary on every artifact at the moment it is written,
      not in a sweep at the end. never repo, risk-free, ZK, trustless, vesting, APY.
- [ ] **2.5** log every non-obvious call in `DECISIONS.md`, including any apollo objection i
      proceed against.

---

## phase 3. build

calendar is indicative. gates are not.

### block A. environment and issuance. thu 10 sep, target G1 by 09:00 SGT

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
- [ ] **3.3** gamma: sdk init, wallet connect, network handshake. prove we can read chain
      state before we try to write any.
- [ ] **3.4** gamma: issue the kpi-linked private credit note against the deployed bond
      config. no solidity, no deployment.
- [ ] **3.5** argus: find it on hashscan, link into `EVIDENCE.md`.
- [ ] **3.6** iris: capture the issuance shot.
- [ ] **G1** hermes signs off.

### block B. compliance. thu 10 sep, target G2 by 14:00 SGT

- [ ] **3.7** gamma: attempt a transfer to an unverified party. **it must fail at the token.**
      the rejection is the evidence, capture the revert.
- [ ] **3.8** gamma: kyc grant to that party.
- [ ] **3.9** gamma: same transfer again. it succeeds.
- [ ] **3.10** hercules: the console renders all three states legibly. a judge watching at
      1.5x has to see blocked, granted, permitted.
- [ ] **3.11** argus records all three transactions. iris captures immediately. these are
      two of the four shots that matter.
- [ ] **G2** hermes signs off.

### block C. coupon. thu 10 sep, target G3 by 20:00 SGT

- [ ] **3.12** gamma: `updateMaturityDate` to compress the lifecycle into demo time.
- [ ] **3.13** gamma: set the coupon, distribute to holders of record.
- [ ] **3.14** gamma: wire `scheduledTask` so the coupon fires on a timer. this is an
      extra-points line in brief §6 and it is nearly free once the coupon works.
- [ ] **3.15** argus records. iris captures.
- [ ] **G3 — needs hao. a submittable hedera entry exists at this point.**
      from here everything is upside and i will not risk 1 to 3 to reach it.

### block D. confidential engine and repricing. fri 11 sep

- [ ] **3.16** hercules: the engine as a **plain local service behind a clean interface.**
      inputs revenue, ebitda, leverage. outputs covenant verdict, kpi value, haircut.
      no CRE yet. the interface is the whole point, the handler swaps in later without
      touching a single caller.
- [ ] **3.17** hercules: **the lender view and agent view split.** the agent sees the inputs.
      the lender sees only the haircut, with the input fields visibly absent. brief §9.3 is
      right that confidentiality is invisible on video. the visible absence is the demo.
- [ ] **3.18** gamma: `createKpiLinkedRate` on the note.
- [ ] **3.19** gamma: post the engine's kpi via `addKpiData`, **the rate steps.** ATS owns
      the mechanism, we feed it.
- [ ] **3.20** argus records the rate change. iris captures the before and after.
- [ ] **G4a** hermes signs off.

### block E. collateral hold. fri 11 sep to sat 12 sep

strongest single shot on video.

- [ ] **3.21** gamma: `createHoldByPartition`, note holder pledges, **engine named as
      `escrow`.** the third party who decides the outcome is the confidential computation.
- [ ] **3.22** hercules: lender advances cash at the engine's haircut, in the console.
- [ ] **3.23** gamma: `releaseHoldByPartition` on the repayment path.
- [ ] **3.24** gamma: **`executeHoldByPartition` on default.** collateral moves to the
      lender, driven by a number the lender never saw. this is the money shot.
- [ ] **3.25** gamma: verify the `HoldDetails` trap from CLAUDE.md §2. the constructor takes
      `executionTimeStamp` and assigns it to `expirationTimeStamp`. **check which value
      actually returns before building any maturity countdown on it.** if it is genuinely
      wrong this is our upstream PR candidate and the feedback section writes itself.
- [ ] **3.26** argus records every hold transaction. iris captures 3.24 first and best.
- [ ] **G4** hermes signs off.

### block F. CRE confidential workflow. sat 12 sep. **hard 4 hour timebox**

do not start until every gate above is green.

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

- [ ] **3.31** iris: **video, five minutes or less.** issuance, configuration, at least one
      lifecycle op. **open on a hashscan transaction inside twenty seconds.** no logo intro,
      no market-size slide. the four shots: blocked transfer, kyc grant, permitted transfer,
      `executeHoldByPartition` firing. then the confidentiality reveal, engine inputs on
      screen, then the lender's view with those fields gone.
      *hao action: screen recording and voiceover. iris writes the shot list and script.*
- [ ] **3.32** zeus: **architecture diagram.** stated requirement for chainlink, not a nicety.
- [ ] **3.33** zeus: README.
- [ ] **3.34** zeus: three per-prize writeups. the integration note is the high-leverage
      neglected one. **write the integration section like documentation and the feedback
      section like a real bug report:** what was hard in the ATS sdk, what needed a
      workaround, what is missing. name our own weaknesses from brief §9 before a judge
      finds them. input integrity, illiquid seizure, invisible confidentiality.
- [ ] **3.35** rudolph: prepare the upstream PR to `hashgraph/asset-tokenization-studio`.
      **branch off their `develop`, not `main`.** DCO sign-off and GPG signature on every
      commit from the first one, see D9 and H9. PR needs an assignee. changeset required
      unless a bypass label applies. full checklist at the top of
      `specs/03-upstream-workflows.md`. **prepare only. hao opens it.**
- [ ] **3.36** apollo: final pass. every claim against a finance-literate judge, every
      artifact against §8. this is the last chance, judging is asynchronous and there is
      no Q&A.
- [ ] **3.37** argus: every claim in every writeup traces to a link in `EVIDENCE.md`.
- [ ] **G6 — needs hao.**

### block H. buffer. sun 13 sep 22:00 to mon 14 sep 10:00. untouchable

no new work. submit at 10:00 SGT.

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
14 sep deadline it fits with room. all three prizes attempted. the 4 hour timebox and
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
