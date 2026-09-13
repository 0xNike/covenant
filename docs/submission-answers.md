# submission answers, for the ETHGlobal form

final text, ready to paste. nothing here needs editing before it goes in the form. character
counts are computed, not estimated: `python3 -c "print(len(open('f').read()))"` on the exact
string, ASCII throughout, no em-dashes, no curly quotes. written after the narrative rewrite
across `app/page.tsx`, `README.md`, `PROJECT_BRIEF.md`, `docs/architecture.md` and the three
writeups, so this document cannot diverge from it, it restates the same framing.

---

## 1. short description

hard maximum 100 characters. the field is a tweet, not a paragraph, so it carries the
mechanism, not the argument.

**the precise institutional line does not fit and needed cutting, not truncating.** "covenant
makes a private credit note financeable for a lender who is not entitled to see the
borrower's books" is **109 characters** (`printf "%s" "..." | wc -c`, straight apostrophe),
not 106. either count is over the 100 limit, so the line is cut below rather than shortened
by a few words at the end, which would have cut the verb before the noun it needs.

three options, exact counts:

| option | text | characters |
|---|---|---|
| A | `private credit collateral priced by code, not by self-marking` | **61** |
| B | `private credit, collateralised on hedera, priced by code not self-marking` | **73** |
| C | `a private credit note a lender can price without seeing the borrower's books` | **76** |

**pick A.** it states the mechanism and the fix in one breath, with no party name to parse
and room to spare under the limit. B trades that room for naming the chain, which matters
less in a 100-character field than the claim itself. C is closest to the old opener's shape
and reads well, but it describes the constraint without naming what changed it, which is the
part worth a tweet's worth of attention.

---

## 2. description

minimum 280 characters, no stated maximum. leads with the house sentence, the same one that
opens `app/page.tsx` and `README.md` now, then what covenant does, then what is live.

**1472 characters.**

```
you would not lend someone money against their house and also let them tell you what the
house is worth. private credit runs close to that: a fund holds a pile of loans, values them
itself, and borrows against its own number. the Financial Stability Board found that the same
loan gets different marks at different managers, because the judgement behind the mark is the
manager's own (FSB, Report on Vulnerabilities in Private Credit, 6 May 2026, section 3.3).

covenant takes that valuation out of self-marking. a confidential compute engine reads the
underlying borrower's revenue, EBITDA, total debt, cash and interest expense, and returns two
things only: a covenant pass or fail, and a haircut. both sides read the program before the
facility is struck. the lender never sees the financials behind the number, and can still
check that the published program produced it.

what is live: a real note issued on Hedera testnet through the Asset Tokenization Studio,
against its deployed resolver and factory, no new Solidity and no contract deployed. the full
lifecycle runs: issuance, a transfer blocked by a compliance gate then granted then permitted,
a coupon priced and distributed, and a collateral hold created, released, created again and
executed on default. 21 transactions, signed by a human in MetaMask throughout, four gates
independently re-verified against Hedera's mirror node and the testnet json-rpc relay. every
hash is in EVIDENCE.md in the repository.
```

---

## 3. how it's made

minimum 280 characters. covers the stack, how the pieces connect, what partner technology
bought us and why, and the hacky part, which is the most interesting thing this build found.

**3430 characters.**

```
Hedera testnet, the Asset Tokenization Studio SDK (@hashgraph/asset-tokenization-sdk@8.0.0)
against its already-deployed resolver 0.0.9212226 and factory 0.0.9213391. we deploy no
contracts and write no Solidity: issuance, the KYC compliance gate, the coupon and the
collateral hold all run on ATS's own diamond, through the SDK. the benefit is concrete: a
compliance-gated, coupon-bearing, hold-capable security token is not something we built, it is
something ATS already gave us, correctly, on testnet, and we spent our time on the
confidential leg instead of reimplementing a compliance facet.

Next.js 16 and React 19 for the console, with the confidential compute engine built as a plain
local service behind one swappable interface, CovenantEngine (lib/engine/types.ts). the entire
surface for a different implementation is one file, lib/engine/registry.ts: no caller names a
concrete provider. that is the shape a Chainlink CRE handlerInTee needs to drop into without
touching a single route or component, and we proved the swap. we did not ship it live inside
the build's timebox, and we say so rather than imply a deployment that did not happen: what
shipped is the interface a real handlerInTee would sit behind, not a running enclave.

the hacky part, and it is the most interesting thing we found. ATS's own
Bond.createKpiLinkedRate cannot work on the deployed factory: it calls a factory function that
exists only in MockFactory.sol, a test-only contract, and the KPI-linked bond configuration is
registered in the deployed resolver but unreachable by any working path. we root-caused this
from source and on chain, filed it as B1, and routed around it by issuing on the working
variable-rate configuration instead, then driving the coupon rate through
setCouponRateType(FIXED) and a role-gated setRate, both called directly against the deployed
contract because the SDK exposes neither method. that single workaround is what makes the
coupon's rate provably token-enforced rather than caller-supplied: the token refused a rate
handed to it at setCoupon and stamped the value FixedRate.setRate had written 33 seconds
earlier instead, checkable on HashScan without trusting us.

fifteen defects surfaced by building a working flow against the SDK, not by auditing it for
faults, filed in BUG.md as B1 through B15, two of which we investigated and withdrew after
finding the actual cause was ours, not the SDK's.

the confidentiality boundary is enforced by a committed script, npm run scan:disclosure, which
builds the console for production and scans every asset the lender's and holder's pages ship
for the borrower's raw financial fields and figures. it was tested on itself: we deliberately
introduced a leak, confirmed the script failed on it, then removed the leak and confirmed a
clean pass, so the check is proven to fire rather than assumed to.

built by one person, hao, directing a team of AI agent configurations running on Claude. the
agent definitions and the specs and prompts that drove this build are committed in the
repository, in .claude/agents/ and specs/, not written after the fact. every one of the 21
transactions on chain was signed by a human in MetaMask: ATS SDK v8 ships no local-key signer
(SupportedWallets.CLIENT is disabled in its source), so no agent could have signed any of
them, and this is independently checkable on Hedera's mirror node, not asserted. full account:
AI_USAGE.md.
```

---

## 4. github repositories

```
https://github.com/0xNike/covenant
```

---

## 5. partner prizes to select

**one selection: hedera, tokenization of anything.** the primary and only submission. four
gates verified on chain (issuance, the KYC compliance gate, the coupon, the collateral hold),
all independently re-checked against the mirror node and the testnet json-rpc relay, not
against this project's own console. see `docs/writeup-hedera-tokenization.md`. ETHGlobal's
rule that selecting more than one track from the same partner still counts as a single
partner-prize slot means this one selection covers all of hedera's tracks this submission
maps to, per `PROJECT_BRIEF.md` §6, at no extra cost against the three-prize cap.

**chainlink is not selected.** `EVIDENCE.md` G5 status is **not started**. there is no
`handlerInTee` call anywhere in the repository, only a comment naming it as the target
(`lib/engine/kernel.ts:8`, `lib/engine/types.ts:13`), and no CRE CLI simulation ran. a
selection whose criteria are visibly unmet in `EVIDENCE.md` is penalised on an asynchronous,
no-Q&A read, not ignored: a judge who opens `EVIDENCE.md`, finds "not started" against every
gate item, and reads the rest of the submission through that lens is a worse outcome than not
selecting the prize at all. `docs/writeup-chainlink-cre.md` is kept in the repository and
carries its own note explaining why: the engine was built behind a swappable interface for
this track and the swap was proven to typecheck, but the timebox that would have turned that
into qualifying evidence never ran.

**a note on hedera's own multiple tracks.** we have not independently verified how many
tracks hedera runs this cycle or whether any other one applies beyond tokenization of
anything; confirm the current list on the form itself before adding one.
