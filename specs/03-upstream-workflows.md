# 03. upstream workflows, how the ATS maintainers actually work

source: `~/projects/hackathon/hedera/asset-tokenization-studio`, tag `v.8.0.0-ats`, read-only.
every claim below cites a path. anything not found is stated as not found, not guessed.

---

## checklist for rudolph: preparing a PR that passes on the first attempt

read top to bottom, in order. each item cites where the requirement lives.

1. **fork the repo, branch off `develop`, not `main`.**
   PR target branch is `develop`/`development`, enforced by
   `.github/workflows/000-flow-changeset-check.yaml:5-9` (`on.pull_request.branches`) and
   stated in `CONTRIBUTING.md:214` ("Create a Pull Request targeting the **`develop`** branch").

2. **branch name** `feature/<name>`, `fix/<name>`, or `docs/<name>`,    `CONTRIBUTING.md:83-89`. Not machine-enforced anywhere found in `.github/workflows` or
   husky hooks; it is a convention only.

3. **every commit needs DCO sign-off AND a GPG signature.** Both are hard-blocked at push
   time, not just requested:
   - `commit-msg` hook auto-adds `Signed-off-by:` if missing and runs commitlint,      `.husky/commit-msg:24-89`.
   - `pre-push` hook rejects the push if **any** commit in the range lacks
     `Signed-off-by:` (DCO) or has git's `%G?` signature status `N` (no GPG signature),      `.husky/pre-push:35-56` for the checks, `:109-124` for the loop, `:131-139` for the
     pass/fail gate. This is a real blocker for an outside contributor with no GPG key
     configured locally: the maintainers ship a setup script,
     `.github/scripts/setup-git.sh` (referenced `CONTRIBUTING.md:119`, `:194`), which sets
     `format.signoff=true` and `commit.gpgsign=true` and walks through GPG key creation.
     **Rudolph must run this script (or configure GPG manually) before the first commit
     intended for upstream**, retrofitting sign-off/signatures onto already-made commits
     requires an interactive `git rebase -i` per `CONTRIBUTING.md:151-161`, which conflicts
     with our house rule of never using `-i` rebases. Plan to sign correctly from commit one.

4. **commit message format**: Conventional Commits, `<type>(<scope>): <subject>`,    `CONTRIBUTING.md:91-99`. `commitlint.config.ts:1-3` extends only
   `@commitlint/config-conventional`, no custom type/scope enum is enforced by tooling.
   Allowed `type`s per CONTRIBUTING.md: `feat`, `fix`, `docs`, `style`, `refactor`, `test`,
   `chore`. Scopes are freeform in the config, but **actual usage from `git log --oneline
   --all` on this checkout** skews heavily toward `contracts`, `sdk`, `web`, `deps`,
   `scripts`, `mp` (mass-payout), `ats`, and compound scopes like `contracts+sdk` when a
   commit touches more than one package. Top real counts: `refactor(contracts)` x77,
   `fix(deps)` x34, `fix(contracts)` x17, `chore(deps)` x16, `test(contracts)` x11,
   `chore(contracts)` x11, `feat(contracts)` x8, `docs(contracts)` x6. For a `sdk`-scoped
   change matching our work, use `feat(sdk):`, `fix(sdk):`, `docs(sdk):`, etc, this
   pattern is attested at commit `1539fd1f` ("fix(sdk): replace uuid with crypto.randomUUID
   to fix Jest ESM incompatibility (#1000)").

5. **PR title also runs through a semantic-commit checker** in CI, not just local
   commitlint, `.github/workflows/001-flow-pull-request-formatting.yaml:24-32`, job
   `title-check`, uses `step-security/action-semantic-pull-request@v6.1.1`. Same
   conventional-commit shape applies to the PR title
   (`CONTRIBUTING.md:230-236` gives examples: `feat: add batch transfer functionality`).

6. **PR must have at least one assignee**, or CI fails, same workflow, job
   `assignee-check`, `.github/workflows/001-flow-pull-request-formatting.yaml:34-46`,
   which hard-fails if `github.event.pull_request.assignees` is empty.

7. **a changeset is required for any package change**, unless a bypass label is applied.
   Enforced by CI, not just convention: `.github/workflows/000-flow-changeset-check.yaml`
   diffs `.changeset/*.md` additions against the base branch (`:60-84`) and fails the job if
   none exist (`:79-84`). Bypass labels: `no-changeset`, `docs-only`, `chore`, `hotfix`
   (`:15`, `:74`, and `CONTRIBUTING.md:199`). Create with `npm run changeset`
   (`CONTRIBUTING.md:177-195`); the CI also validates the changeset's package name against
   `.changeset/config.json`'s `fixed` groups and fails with a specific remediation message
   if it doesn't match (`.github/workflows/000-flow-changeset-check.yaml:117-133`), e.g. it
   flags `@asset-tokenization-studio/ats-contracts` as wrong, wanting
   `@hashgraph/asset-tokenization-contracts`.
   For a docs-only or SDK-usage-notes PR (which is what our upstream contribution is likely
   to be, since we write no Solidity, see mission `specs/00-mission.md`), apply the
   `docs-only` label to skip this requirement, or add a changeset if the PR touches actual
   `packages/ats/sdk` or `packages/ats/contracts` source.

8. **pre-commit runs `lint-staged`** (`package.json` script `"pre-commit": "lint-staged"`,
   `.husky/pre-commit:1` invokes `npm run pre-commit`). The `lint-staged` config in
   `package.json`:
   - `*.sol` → `node check-license.js`, `npm run lint:staged:sol`, `npm run format:staged`
   - `*.{ts,tsx}` → `node check-license.js`, `npm run lint:staged:js -- --fix`, `npm run format:staged`
   - `*.{js,mjs,cjs,mts}` → `npm run lint:staged:js -- --fix`, `npm run format:staged`
   - `*.{json,md,yml,yaml}` → `npm run format:staged`

   `check-license.js:1-40` requires the literal first-5-lines match of
   `// SPDX-License-Identifier: Apache-2.0` on every non-test `.ts`/`.sol` file it touches
   (`shouldExcludeFile` at `check-license.js:14-23` exempts `.test.ts`, `.test.tsx`,
   `.spec.ts`, `.spec.tsx`, and anything under `/test/` or `/__tests__/`). **Any new
   non-test source file we contribute upstream needs this header on line 1 or line ≤5.**

9. **node version**: `.nvmrc` pins `24.15.0`. `CONTRIBUTING.md:19` states "Node.js v20.19.4+
   (ATS) or v24.0.0+ (Mass Payout backend)", the `.nvmrc` value is the actual enforced one
   for CI (`actions/setup-node` reads `.nvmrc`, see
   `.github/workflows/000-flow-changeset-check.yaml:47-49`).

10. **run before opening the PR**: `npm run lint:fix`, and tests
    (`CONTRIBUTING.md:205-209`). PR checklist template
    (`.github/pull_request_template.md:49-56`) self-reports: style guidelines followed,
    documentation updated, no new linter warnings, local tests pass, effective tests added,
    no coverage reduction. It is a checkbox list a submitter ticks themselves, not proven
    to be independently verified by a bot beyond the CI workflows listed above (I found no
    CI job that greps the PR body for these checkboxes; `.github/workflows/*.yaml` were
    scanned and none reference `pull_request_template.md`).

11. **fill in `.github/pull_request_template.md`**: `## Description` (what/why, `Fixes
    #(issue)`), `## Type of change` checkboxes, `## Testing` (how verified, node version
    used), `## Checklist` (see item 10). Full template at
    `.github/pull_request_template.md:1-56`.

12. **CODEOWNERS**: default owners for the whole repo are
    `@hashgraph/asset-tokenization-studio-committers`,
    `@hashgraph/developer-advocates`, `@hashgraph/iobuilders-hedera`
    (`.github/CODEOWNERS:2`), this determines who gets auto-requested for review; an
    outside contributor cannot change this.

---

## 1. `.claude/commands/docs/update-docs.md`, the maintainers' own docs workflow

Full path: `.claude/commands/docs/update-docs.md`.

**What it does.** A Claude Code slash command (`/update-docs`) that keeps
`docs/{ats,mass-payout}/**` in sync with two upstream artefact types:

- **Enhancement Proposals (EPs)**, expected at `docs/references/proposals/*.md`, filtered
  by status `Implemented` or `🚀 Implemented` (`:37-39`, `:524-526`).
- **Architecture Decision Records (ADRs)**, expected at `docs/references/adr/*.md`, filtered
  by status `Accepted` or `✅ Accepted` (`:42-45`, `:528-529`).

It also optionally scans `git log` for `feat:`/`feature:`/`add:`/`implement:` commits
(`:109-114`), reads (but never writes) package `CHANGELOG.md` files to infer version bump
type (`:54-58`, `:116-128`), then maps the discovered feature to specific documentation
files to update (user guides, developer guides, API reference, getting-started, intro/index
pages, `:141-204`), and finishes by suggesting (not applying) CHANGELOG entries
(`:227-265`).

**Convention encoded.** Documentation is meant to be *derived from* EPs and ADRs, which are
the actual unit of design record, code changes alone are treated as a fallback signal
(`:471-475`: "If no implemented EPs or accepted ADRs are found ... Suggest: Creating an EP
retroactively"). This tells us the maintainers' intended workflow is proposal-first: write
the EP or ADR, get it accepted/implemented, *then* docs follow mechanically. CHANGELOGs are
explicitly a manual, human step even inside this automation (`:58`, `:235`, `:555`
"does NOT commit them automatically").

**Gotcha for us: neither directory it depends on exists in this checkout.**
`docs/references/proposals` and `docs/references/adr` are both absent, confirmed with `ls` (both return "No such file or directory") and with
`git log --all --oneline -- docs/references/proposals` and
`... -- docs/references/adr` (both return empty, i.e. these paths have **never** existed in
this repo's history, not even a deleted historical file). The only thing actually present
under `docs/references/` is `docs/references/guides/` (containing
`monorepo-migration.md` and `ci-cd-workflows.md`) and `docs/references/index.md`. So this
command's own configuration section (`:532-549`, which draws the expected tree including
`references/proposals/`) is aspirational relative to the actual repo state at this tag, the EP/ADR process is documented in tooling but not yet populated with content.
`CONTRIBUTING.md:260` also references `docs/references/adr/` for architecture changes,
same gap applies.

**Practical implication for our upstream PR:** there is no existing EP/ADR template file to
copy in this checkout. If Hermes/Zeus want to write one, it must be authored from scratch, there is nothing here to pattern-match against. Say so plainly rather than inventing a
format.

---

## 2. `.claude/skills/solidity-natspec/`, the contract documentation bar

Paths: `.claude/skills/solidity-natspec/SKILL.md`,
`.claude/skills/solidity-natspec/scripts/check_natspec.mjs`.

We write no Solidity (mission hard rule, `specs/00-mission.md:42-43`), so this is read only
to calibrate their review bar, per the task brief.

**Required tags, by element** (`SKILL.md:17-41`, cross-checked against the checker's
enforcement in `check_natspec.mjs:298-333`):
- `contract` / `interface` / `library`: `@title`, `@author`, `@notice` are **mandatory**,   "solhint's `use-natspec` rule flags each missing tag" (`SKILL.md:21-22`). Enforced in the
  checker at `check_natspec.mjs:298-303` (`CONTRACTISH` set, all three required).
- every other element (functions, events, custom errors, `CALLABLE` set in
  `check_natspec.mjs:39`, `:304-330`): `@notice` mandatory; one `@param` per named parameter
  and one `@return` per named return value, **with matching names**, checked positionally
  (`check_natspec.mjs:310-329`, `arraysEqual` at `:280-286`).
- `@author Asset Tokenization Studio Team` unless the file is a fork of upstream code
  (OpenZeppelin, ERC references) (`SKILL.md:23-24`).
- elements carrying `@inheritdoc X` are exempt from further tag checks
  (`SKILL.md:39-41`, `check_natspec.mjs:43`, `:295`).
- storage structs following ERC-7201 need `@custom:storage-location
  erc7201:<namespace>` as the **last tag inside** the NatSpec block, not a free `///` line
  above it (`SKILL.md:44-60`), explicitly justified by what solc's parser, `forge inspect
  storage-layout`, Slither, and the OZ upgrades plugin all expect.
- **British English spelling is enforced by convention** (not by the checker script, which
  is silent on spelling), `decentralised`, `behaviour`, `initialised`, `optimise`,
  `authorised`, `organisation`, `serialise`, `analyse`, `licence` (noun),
  never American spelling (`SKILL.md:68-69`).
- ≤100 chars per comment line, present tense descriptions, precise smart-contract
  terminology (reentrancy, invariant, storage slot, delegatecall, selector, EIP-xxx, diamond
  facet) (`SKILL.md:70-72`).
- explicitly forbidden: explaining Solidity syntax itself, narrating self-explanatory code,
  inventing undocumented behaviour, referencing the current task/PR/commit in NatSpec (it
  "lives with the code"), duplicating interface NatSpec onto the implementation
  (`SKILL.md:82-87`).

**Validation gate before a contract change is considered done**
(`SKILL.md:89-116`): run `node .claude/skills/solidity-natspec/scripts/check_natspec.mjs
<file.sol>` (heuristic tag-presence check, exit 0/1/2, see `check_natspec.mjs:19-21`), then
`cd packages/ats/contracts && npx solhint <file.sol>` and treat any `use-natspec` warning as
blocking; `ordering`/`gas-*`/`no-unused-import` warnings are explicitly out of this skill's
scope and should be flagged rather than silently fixed.

Takeaway for us: this is an audit-grade documentation bar (auditors/maintainers/analysis
tools as stated audience, `SKILL.md:9`). We never touch `.sol` files, but if we ever quote
or reference ATS contract behaviour in our own writeups, match this register (precise,
present-tense, no restating of code) rather than a looser style.

---

## 3. `CONTRIBUTING.md`, the contribution process in full

Full path: `CONTRIBUTING.md`, 298 lines. Summary with line references; see the checklist
above for the parts that gate a PR.

- **Setup**: fork, clone, `npm ci`, `npm run setup`, `npm test` (`:23-38`). Env files copied
  from `.env.example` under `apps/ats/web`, `apps/mass-payout/backend`,
  `apps/mass-payout/frontend` (`:44-53`).
- **Dev loop**: `npm run ats:build` / `ats:test` / `ats:start` (and `mass-payout:*`
  equivalents) (`:59-70`); `npm run lint:fix`, `npm run format` (`:74-77`).
- **Branch naming**: `feature/`, `fix/`, `docs/` prefixes (`:79-89`), convention only, not
  found enforced by any workflow.
- **Commits**: Conventional Commits, DCO sign-off, GPG signature, all covered in checklist
  items 3-4 above. Troubleshooting for retrofitting missing sign-off/signature via
  interactive rebase is given at `:151-161` (conflicts with our own "never use `-i`
  rebase" rule, plan ahead instead of fixing after the fact).
- **Changesets**: required for all package changes, `npm run changeset`, bypass labels
  (`:173-199`), covered in checklist item 7.
- **PR submission**: push branch, PR **targets `develop`** (`:211-220`), fill description
  (summary / motivation / testing / related issues), request maintainer review. PR title
  format examples given at `:230-236` mirror Conventional Commits without a scope
  requirement at the title level (`feat: add batch transfer functionality`).
- **Automated checks listed** (`:222-229`): tests pass (only for changed modules), changeset
  exists (or bypass label), DCO compliance. (GPG signature enforcement is not mentioned in
  this summary list even though the `pre-push` hook enforces it locally, the CI-side
  enforcement of GPG specifically was not found in any `.github/workflows/*.yaml` file
  during this pass; it appears to be a **local, husky-hook-only gate**, not re-verified by
  GitHub Actions. Not found = not found; I did not exhaustively grep every workflow line for
  a GPG check, but none of the three PR-facing workflows read
  [`001-flow-pull-request-formatting.yaml`, `000-flow-changeset-check.yaml`] reference GPG.)
- **Testing**: `npm test`, `npm run ats:test`, `npm run mass-payout:test`, or scoped via
  `npm run test --workspace=packages/ats/sdk` (`:242-251`).
- **Documentation expectations**: update inline comments/JSDoc/TSDoc for code changes, add
  user guides under `docs/ats/` or `docs/mass-payout/` for new features, "consider creating
  an ADR in `docs/references/adr/`" for architecture changes (`:256-260`), note again this
  directory does not exist yet in this checkout (see section 1 and 5).
- **DCO/GPG setup automation**: `bash .github/scripts/setup-git.sh` (`:116-127`), sets
  `format.signoff=true`, `commit.gpgsign=true`, and walks through GPG key creation if
  needed. Manual alternative given at `:129-137`.
- **Release process** is maintainers-only (`:268-280`), not relevant to an outside PR but
  explains why `develop`, not `main`, is the PR target: `main` only receives release PRs
  from `develop`.
- Code of Conduct: Contributor Covenant, report to `oss@hedera.com` (`:5-7`).

---

## 4. commit hygiene, what they actually do, not just what the config allows

`commitlint.config.ts:1-3` is minimal: `export default { extends:
["@commitlint/config-conventional"] };`, no custom `type-enum` or `scope-enum` override was
found in this file, so in principle any string is a legal scope under commitlint. But
**actual practice**, sampled with `git log --oneline --all | grep -oP
'(?<=^\w{7,9} )\w+\([^)]*\)' | sort | uniq -c | sort -rn`, shows a real, narrow convention:

```
 77 refactor(contracts)
 34 fix(deps)
 17 fix(contracts)
 16 chore(deps)
 11 test(contracts)
 11 chore(contracts)
  8 test(scripts)
  8 fix(deps-dev)
  8 feat(contracts)
  6 docs(contracts)
  4 fix(scripts)
  2 refactor(ats), refactor(architecture), fix(contracts+mass-payout), fix(ci),
    feat(sdk+web), feat(sdk), chore(docs)
  1 (each) test(sdk), test(orchestrator), style(contracts), refactor(web),
    refactor(voting), refactor(sdk), refactor(scripts), refactor(erc1410),
    refactor(contracts-scripts), refactor(ats-style-guide),
    refactor(contracts+sdk+web), refactor(contracts+sdk), refactor(contracts+scripts),
    fix(test), fix(sdk), fix(recovery), fix(mp), fix(maturity), fix(mass-payout),
    fix(loans-portfolio), fix(interfaces), fix(hooks)
```

Full list captured, not truncated by me, this is the actual `uniq -c` output (top ~40
rows, remainder is singletons of the pattern above). Reading it: `contracts` and `deps` (bot
dependency bumps) dominate by volume; scope names are package-shaped
(`contracts`, `sdk`, `scripts`, `web`, `ats`, `mp`/`mass-payout`), and compound scopes with
`+` are used when one commit spans packages (`contracts+sdk+web`). `types` used: `feat`,
`fix`, `chore`, `refactor`, `test`, `docs`, `style`, `ci`, a superset consistent with, but
not exceeding, the seven types CONTRIBUTING.md lists (`feat`, `fix`, `docs`, `style`,
`refactor`, `test`, `chore`) plus one extra observed (`ci`). Also many top-level commits have
**no scope at all**, e.g. `feat: v8.0.0 (#1298)` (the tag-defining commit itself, current
`HEAD`), `feat: add full redeem and enhance bond & equity features (#737)`,
`feat: sync infrastructure files from develop (#712)`, visible in `git log --oneline -60`.
Squash-merge PR titles (which become the merge commit subject, carrying `(#NNNN)` suffix)
are the dominant shape in the log for feature-level work; scoped conventional commits are
more common for narrower, single-package changes.

**Recommendation for our own upstream commits**: use `feat(sdk):` / `fix(sdk):` /
`docs(sdk):` for anything inside `packages/ats/sdk`, matching the one directly comparable
precedent found, `1539fd1f fix(sdk): replace uuid with crypto.randomUUID to fix Jest ESM
incompatibility (#1000)`. If a change is genuinely docs-only outside the SDK package
(e.g. a new guide), plain `docs:` with no scope is also attested
(`fe664c02 docs: update README files to add and update ERC364 related documentation (#558)`,
`8613784b docs: update pull request template with hidden hints (#559)`,
`9302d104 chore: improve documentation (#543)`).

---

## 5. `docs/references/proposals`, does not exist

Checked directly: `ls docs/references/proposals` → `No such file or directory`.
Checked history: `git log --all --oneline -- docs/references/proposals` → empty output,
meaning the path has never been created, modified, or deleted anywhere in this repository's
git history (not just absent at this tag).

The only thing under `docs/references/` at this tag:
```
docs/references/guides/monorepo-migration.md
docs/references/guides/ci-cd-workflows.md
docs/references/index.md
```
(confirmed with `find docs/references -maxdepth 5`). `docs/references/adr/` is equally
absent, same method, same result.

Both `.claude/commands/docs/update-docs.md` (section 1 above) and `CONTRIBUTING.md:260`
reference `docs/references/adr/` and (the update-docs command only)
`docs/references/proposals/` as if populated. They are not, in this checkout, at this tag.
**If we file an enhancement proposal upstream, there is no existing example file to follow
the format of, do not guess at a template; either ask the maintainers for one via the PR
description, or write a plain, self-describing Markdown doc (problem, proposal, status)
without claiming to match a house EP format that isn't demonstrated anywhere in the repo.**

---

## 6. SDK test layout, worked examples for hold and KPI operations

Real source (not `build/`) confirmed present for both areas:

**Hold.** Unit tests sit next to the command handler they test, suffixed
`.unit.test.ts`, under
`packages/ats/sdk/src/app/usecase/command/security/operations/hold/<verb>ByPartition/`.
Confirmed present for all the create-family verbs plus execute:
- `hold/createHoldByPartition/CreateHoldByPartitionCommandHandler.unit.test.ts`
- `hold/protectedCreateHoldByPartition/ProtectedCreateHoldByPartitionCommandHandler.unit.test.ts`
- `hold/controllerCreateHoldByPartition/ControllerCreateHoldByPartitionCommandHandler.unit.test.ts`
- `hold/executeHoldByPartition/ExecuteHoldByPartitionCommandHandler.unit.test.ts`
  (read in full: `ExecuteHoldByPartitionCommandHandler.unit.test.ts:1-121`)

Shared fixtures for hold commands live at
`packages/ats/sdk/__tests__/fixtures/hold/HoldFixture.ts` (imported as
`@test/fixtures/hold/HoldFixture`, see the `execute` test's import at
`ExecuteHoldByPartitionCommandHandler.unit.test.ts:12`, `HandleHoldCommandFixture`).

**Pattern demonstrated by `ExecuteHoldByPartitionCommandHandler.unit.test.ts`**: the handler
is constructed with five mocked services (`SecurityService`, `TransactionService`,
`AccountService`, `ContractService`, `ValidationService`, `:37-43`), and the success case (`:69-118`) shows the exact validation sequence the SDK
performs before calling the transaction adapter:
`validationServiceMock.checkPause` → `checkDecimals` → `checkHoldBalance` → `checkKycAddresses`
(with `KycStatus.GRANTED` expected, `:103-108`), then
`transactionServiceMock.getHandler().executeHoldByPartition` is called positionally with
`(sourceEvmAddress, targetEvmAddress, ... evmAddress, BigDecimal-wrapped amount,
partitionId, holdId, securityId)` (`:109-117`). Useful confirmation that hold execution is
gated on KYC status of **both** source and target addresses, not just one.

**KPI-linked rate.** Real source, not build output, at:
- `packages/ats/sdk/src/port/in/interestRates/kpiLinkedRate/KpiLinkedRate.ts` (the port-level
  class) and its test
  `packages/ats/sdk/src/port/in/interestRates/kpiLinkedRate/KpiLinkedRate.unit.test.ts`
  (read in full, `:1-308`)
- `packages/ats/sdk/src/app/usecase/command/kpis/addKpiData/AddKpiDataCommand.ts` and
  `AddKpiDataCommandHandler.ts` (handler-level, `addKpiData` specifically)
- `packages/ats/sdk/src/app/usecase/command/bond/createkpilinkedrate/` holds
  `CreateBondKpiLinkedRateCommand.ts`, `CreateBondKpiLinkedRateCommandHandler.ts`, and its
  own `.unit.test.ts` (this is where `createKpiLinkedRate` itself lives, distinct from
  `KpiLinkedRate.ts`'s `setInterestRate`/`setImpactData`/`getInterestRate`/`getImpactData`
  methods, which configure an *already created* KPI-linked rate)
- request types: `port/in/request/kpis/AddKpiDataRequest.ts`,
  `port/in/request/bond/CreateBondKpiLinkedRateRequest.ts`,
  `port/in/request/kpiLinkedRate/` (directory containing further request types, e.g.
  `GetImpactDataRequest.ts` referenced at `KpiLinkedRate.unit.test.ts:17`)
- domain types: `domain/context/bond/BondKpiLinkedRateDetails.ts`,
  `domain/context/factory/BondKpiLinkedRateDetailsData.ts`

**Pattern demonstrated by `KpiLinkedRate.unit.test.ts`**: this port-level class does not
call services directly, it validates the request (`ValidatedRequest.handleValidation`,
asserted at e.g. `:97`) then dispatches through a static `commandBus`/`queryBus`
(`:68-69` inject the mocks onto the class as static properties, a pattern specific to this
port-level class rather than the handler-level test style seen for hold). `setInterestRate`
takes a `SetInterestRateRequest` with fields `securityId, maxRate, baseRate, minRate,
startPeriod, startRate, missedPenalty, reportPeriod, rateDecimals` (constructed at
`:79-89`) and wraps them into a `SetInterestRateCommand` with the same fields in
constructor-positional order (`:100-110`). `setImpactData` takes `securityId,
maxDeviationCap, baseLine, maxDeviationFloor, impactDataDecimals, adjustmentPrecision`
(`:155-162`). Both `getInterestRate` and `getImpactData` are query-side, each taking only
`securityId` (`:222-224`, `:266-268`) and returning fields matching the request's shape
minus validation of the return payload (mocked, not schema-checked in this test).

This confirms the SDK's general shape for command handlers (validate → build typed Command
positionally from Request fields → dispatch via bus → services perform checks before the
transaction adapter fires) is consistent between the hold family and the KPI-linked-rate
family, even though hold tests exercise the handler directly and KPI tests exercise the
port-level facade with a mocked bus. A developer writing either kind of call should expect:
construct the `*Request` object with named fields, pass it to the static port method, expect
a `{ payload, transactionId }`-shaped response back (both test files assert this shape,
`ExecuteHoldByPartitionCommandHandler.unit.test.ts:80-82`,
`KpiLinkedRate.unit.test.ts:33-41`).

**Not covered by this pass**: I did not read `createKpiLinkedRate`'s or `addKpiData`'s
`.unit.test.ts` files line by line in this session, only located and confirmed they exist
as real source. If a developer needs the exact field list for `AddKpiDataRequest` or
`CreateBondKpiLinkedRateRequest`, read those files directly; not reproduced here to avoid
guessing at content not actually opened.

---

## out of scope for this note

The `HoldDetails` constructor / `executionTimeStamp` vs `expirationTimeStamp` trap
(mission brief, `specs/00-mission.md`, and `CLAUDE.md` §"Gamma") was **not investigated in
this pass**, a targeted search for `HoldDetails` under `packages/ats/sdk/src` (excluding
`build/`) returned no results in this checkout; it either lives under a different name or in
`packages/ats/contracts`, and verifying it was not part of this task's brief (upstream
workflow tooling only). Flag for a dedicated pass before anyone builds a maturity countdown
on it.
