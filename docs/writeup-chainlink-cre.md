# chainlink, best confidential workflow

**prize:** chainlink, best confidential workflow ($2,000, 2 slots). the secondary submission,
and an expendable one. `CLAUDE.md` §5 places this leg after the video and the other two
writeups, on a hard four-hour timebox, precisely so it can fail without taking anything else
down with it. if you are reading this and `EVIDENCE.md` G5 still says "not started," we did not
pursue this prize, and nothing above this line in the submission changes as a result.

**status at time of writing, 12 sep 2026.** the timebox has not opened. hedera tokenization
gates G1 through G4 are verified (issuance, the compliance gate, the coupon, and the
collateral hold released and executed), so a complete, submittable hedera entry exists
independent of this prize, and is unaffected by whatever happens below. what is true today for
this leg specifically is everything below "what is built today." everything under "what the
timebox targets" is a plan, not a claim.

---

## the gate, §6 of `PROJECT_BRIEF.md`

- [ ] CRE workflow using confidential workflows
- [ ] registers and uses `handlerInTee` (typescript) or `cre.HandlerInTee` (go)
- [ ] processes at least one sensitive input inside the enclave
- [ ] meaningfully integrated into core functionality, not a placeholder handler
- [ ] evidence via CRE CLI simulation or live deployment

`[G5 evidence: pending]`.

---

## what is built today

the confidential compute engine, the component that reads the borrower's revenue, EBITDA,
total debt, cash and interest expense and returns a covenant verdict, a kpi value and a
haircut, runs as a plain local service (`lib/engine/providers/local.ts`) behind a single
interface, `CovenantEngine` (`lib/engine/types.ts`). the entire swap surface for a different
implementation is one file, `lib/engine/registry.ts`: no component, no route handler and no
caller names an implementation directly, all of them name the interface, and the concrete
provider is chosen by an environment variable read server-side only, never exposed to the
browser.

this is not an assertion about the design. the swap was proven, not asserted: a CRE-shaped
provider implementing the same `CovenantEngine` interface was written, typechecked as
assignable to it, and then removed before commit, because the timebox this document describes
had not opened yet. `lib/engine/registry.ts` still names the shape of that swap directly, in a
commented-out case:

```ts
// block F lands here:
// case "cre-simulation":
//   engine = createCreSimulationEngine();
//   break;
```

today, `lib/engine/registry.ts:19` types `EngineProviderId` as exactly one value: `"local"`.
one file in the codebase names a concrete provider. that is deliberate: adding a second means
adding a file under `./providers` and one case in the switch, and nothing else changes.

the lender-view / agent-view split that makes the confidentiality boundary visible is built and
independent of which engine implementation runs. `/engine` shows the borrower's inputs; `/lender`
renders a narrowed result computed server-side, before the page reaches the client. the
disclosure boundary is enforced by `npm run scan:disclosure`
(`scripts/scan-disclosure.mjs`), which scans a production build, not the dev server, and
carries a mandatory control scan against the agent view, so a broken search cannot report a
false clean result. this check does not depend on which engine provider is selected, and it
would need to pass regardless of whether the provider behind it is the local service or a CRE
handler.

---

## what the timebox targets

swap the local provider for one behind a chainlink CRE `handlerInTee`, running the same
computation, with the borrower's financials as the input processed inside the enclave and only
the verdict, kpi value and haircut crossing back out. this is meaningful integration, not a
placeholder handler: the enclave would be doing the one computation the entire submission's
thesis depends on, the same three private figures, the same three public outputs, behind the
same interface the local provider already implements.

evidence, per the gate above, is `cre workflow simulate`, not a live deployment. the simulator
prints an explicit box naming the resolved TEE type and region ("AWS Nitro in `us-west-2`"), a
warning that the simulator is not a real enclave, and the `[USER LOG]` lines a real deployment
would never surface, since node-operator visibility into enclave logs is exactly what a real
deployment removes. that box, and the final `Workflow Simulation Result:` line, is what the
template's own documentation treats as the artifact worth capturing, and it needs neither
deploy access nor confidential-workflows beta enrollment, both of which are separate,
invite-gated approvals this project does not have and did not pursue, since simulation alone
satisfies the prize's evidence requirement.

**typescript, not go, is the implementation path**, and this was checked rather than assumed.
every typescript confidential-workflow template pins `@chainlink/cre-sdk` to a released semver,
`1.18.0`. the go side's confidential-workflow-specific submodules are pinned to unreleased
commit pseudo-versions, not tagged releases. the templates' own `go.mod` comments and
readmes disagree with each other about whether go confidential workflows are in a tagged
release at all. there is no finding that points toward typescript being the thinner or
less-supported sdk; if anything, the asymmetry runs the other way.

full research trail, every claim sourced to a shipped `.d.ts`, a cloned template, or a live
docs fetch: `specs/04-cre-confidential-workflows.md`.

---

## a limitation we found, not a limitation we are hiding

**there is no CRE-native path from an enclave's output to a hedera transaction, and this is
true regardless of whether the timebox succeeds.** verified from the shipped sdk's own
supported-chain constant, not from documentation prose: `ClientCapability.SUPPORTED_CHAIN_SELECTORS`
(`package/dist/generated-sdk/capabilities/blockchain/evm/v1alpha/client_sdk_gen.d.ts:29-125`)
is a hardcoded object literal of roughly fifty-five chain entries, and neither `hedera-mainnet`
nor `hedera-testnet` is among them. a broader chain-metadata registry in the same package does
know hedera, as an evm-family chain with chain id `296` on testnet, but that registry is not
the one `ClientCapability.writeReport` checks against. hedera is known to the sdk's chain
metadata and not enabled for the capability that would deliver a signed report on chain.
cross-checked live against `docs.chain.link/cre/supported-networks-ts`: hedera appears in
neither the mainnet nor the testnet table there either.

**what this means concretely.** the output of a CRE confidential workflow, live or simulated,
is a value a human reads and then signs into a transaction the same way every other value in
this project reaches the chain, through a person clicking MetaMask, on the same accounts, with
no private key anywhere in this repository. CRE does not shorten that relay for us. what it
would change, if the timebox lands, is what happens to the borrower's financials before the
number comes out: computed inside an attested, hardware-isolated enclave rather than in a
plain server process. that is a real difference in what a node operator or an observer of the
workflow's infrastructure can see. it is not a difference in how the result reaches hedera.

we say this plainly rather than let the diagram imply an automated bridge that does not exist.
`docs/architecture.md` draws the same dashed, human-relayed arrow out of the confidential
compute stage regardless of which engine implementation is behind it, for exactly this reason:
the diagram is true whether the enclave is a genuine CRE workflow, a CRE CLI simulation, or the
local service running today.

---

## the boundary this leg would enforce, and what it would not

if the CRE leg lands, it changes where the computation runs. it does not change the claim
`PROJECT_BRIEF.md` §4 already makes about what an enclave proves: attested execution, not
verified inputs. the enclave, real or simulated, would prove that the published computation ran
on the data it was given. it says nothing about whether the borrower's revenue and EBITDA
figures were themselves accurate, and a borrower's incentive to inflate them is larger and more
direct than an agent bank's incentive to shade a haircut. that is not a gap specific to the CRE
leg, it is the boundary of what a hardware-isolated enclave does for any input a counterparty
supplies, and it holds whether the engine behind `/api/engine/run` is the local service, a CRE
simulation, or a live CRE deployment.

---

## register, restated because this is the section most likely to slip

CRE confidential workflows are TEE-based. **never zero-knowledge, never ZK, anywhere, for any
reason.** if what ran was a CRE CLI simulation rather than a live deployment, every sentence
that names it says "simulation" plainly. we do not write "enclave" alone when a simulator, not
a real enclave, is what produced the evidence. this is the one prize in this submission where
getting that word wrong costs the whole leg's credibility, so it is restated here rather than
assumed carried over from `specs/00-mission.md`.

---

## if this document still reads "pending" at submission time

that is not a failure to be explained away in this document. the hedera tokenization writeup
does not depend on this one, `PROJECT_BRIEF.md`'s ship order says so explicitly, and the video
script's fallback section treats the CRE insert as purely additive. this writeup exists so that
if the leg lands, there is somewhere honest to say so, and if it does not, there is nothing
here that needs walking back.
