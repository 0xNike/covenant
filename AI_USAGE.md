# AI_USAGE.md

how AI was used in this build, stated plainly, per ETHGlobal's disclosure requirement.

---

## the fact to lead with

**every one of the 21 transactions recorded in [`EVIDENCE.md`](./EVIDENCE.md) against the
token, from issuance through the collateral hold, was physically signed by a human in
MetaMask, and this is structurally provable rather than asserted.**

`SupportedWallets.CLIENT` is commented out at
`packages/ats/sdk/src/domain/context/network/Wallet.ts:9` in the ATS sdk. version 8, the
version this project runs, ships no local-key signer. the live path is `RPCTransactionAdapter`
delegating every signature to `MetamaskService` and the browser's injected provider
(`DECISIONS.md` D3). so no private key exists anywhere an agent could reach: not in this
repository, not in `.env.local`, not in any agent's context, by design. no agent could have
signed any of these transactions. the entire on-chain record is a human record, and anyone can
check it independently on Hedera's mirror node without trusting a word of this document.

most AI-assisted submissions cannot say that about their on-chain activity. this one can.

---

## who and what built this

covenant is built by one person, hao, directing a team of AI agent configurations running on
Claude, not a team of people.

`CLAUDE.md` (this repository's root) defines ten roles. hermes is the identity given to the
top-level orchestrating session itself, in `CLAUDE.md` directly. the other nine, apollo,
argus, athena, chronos, gamma, hercules, iris, rudolph and zeus, are separate agent
configurations, one file each, under [`.claude/agents/`](./.claude/agents/). every name that
appears in this project's documentation, commit history or internal writing, hermes, apollo,
gamma, and so on, refers to one of these ten configurations. none of them is a person.

each configuration in `.claude/agents/` declares a model tier in its frontmatter (`opus`,
`sonnet` or `haiku`). the commit history carries the concrete model versions that actually
produced the work: 30 of this repository's 31 commits carry a `Co-Authored-By` trailer naming
either `Claude Opus 5` or `Claude Sonnet 5` (`git log --format='%b'`, grep for
`Co-Authored-By`). the one commit without a trailer is the initial `chore: init covenant`,
made directly by hao before any agent session began. this document is itself written by the
zeus configuration, running as Claude Sonnet 5.

---

## which files are AI-written

effectively all of it. `app/`, `lib/`, `docs/`, and the documentation set including this file,
`README.md`, `PROJECT_BRIEF.md`, `EVIDENCE.md`, `DECISIONS.md`, `BUG.md` and
`MASTER_TODO_LIST.md`, were written by hermes or one of the nine agent configurations above,
directed by hao. there is no carved-out set of files that a human typed alone. saying
otherwise to look more hand-built would be false, so this document does not say it.

---

## what the human did that no agent could

- **selected the asset class and the argument.** the decision that this is a tokenised
  private credit note, and the reasoning in `PROJECT_BRIEF.md` §4 for why that is not the
  obvious tokenised-treasury submission, is hao's. agents built, checked and wrote against
  that decision; they did not make it.
- **approved every gate.** `CLAUDE.md` §4 requires sign-off at each of the six gates, with
  gates G3 and G5 requiring hao specifically. no agent can pass its own gate.
- **signed every transaction in `EVIDENCE.md`, in MetaMask, by hand.** see above. this is not
  a claim, it is a consequence of `DECISIONS.md` D3: no key, no agent-side signer.
- **caught two errors that no agent on this project caught.** the deadline misreading
  (`DECISIONS.md` D2, the build was first planned against friday 11 september, 32.5 hours
  short of the CRE timebox, against the real deadline of monday 14 september) and the
  `scheduledTask` misreading (`DECISIONS.md` D13 and D14, the claim that ATS uses the Hedera
  Schedule Service, raised, corrected, and on a closer read by rudolph, corrected again to say
  the original documentation was accurate and the project had misread it). read the
  identifiers directly rather than trusting this paraphrase.

everything else, code, transaction construction, verification method, prose, was agent work
directed by these decisions.

---

## where the prompts and planning artifacts live

this project uses a spec-driven workflow, and everything that workflow produced is committed,
per the ETHGlobal requirement that spec files, prompts and planning artifacts ship with the
submission.

- [`specs/`](./specs), the spec files: the shared mission brief every agent reads first
  (`specs/00-mission.md`), the ATS sdk operation surface mapped to file and line
  (`specs/02-sdk-surface.md`), the upstream contribution workflow
  (`specs/03-upstream-workflows.md`), and the rest of the working set listed in
  `specs/README.md`
- [`.claude/agents/`](./.claude/agents), the nine agent configurations, each a prompt that
  defines a role, its authority and its constraints
- [`CLAUDE.md`](./CLAUDE.md), the standing instructions for the top-level session, hermes
- [`MASTER_TODO_LIST.md`](./MASTER_TODO_LIST.md), the build order, the gates and the
  current phase
- [`DECISIONS.md`](./DECISIONS.md), the running record of direction: every non-obvious call
  made during the build, the reasoning, and any standing objection an agent raised rather
  than being silently overruled

**what is not claimed.** there are no full session transcripts in this repository. the
standing prompts, `specs/`, `.claude/agents/`, `CLAUDE.md`, are committed in full, and the
per-session direction, corrections and reversals are recorded as they happened in
`DECISIONS.md`. that is a true and sufficient record of how the work was directed. it is not a
transcript, and this document does not pretend it is one.

---

## why this document exists

the work was directed by one person and written by AI agents. saying so plainly is more
credible than hedging it, and the on-chain record backs the one claim that matters most:
nobody but hao could have signed any of it.
