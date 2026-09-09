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
