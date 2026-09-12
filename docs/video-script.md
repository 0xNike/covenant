# video script

owner: iris. written against the current state of the build: `specs/00-mission.md`,
`PROJECT_BRIEF.md` §3/§4/§9.3 as rewritten, `DECISIONS.md` D10-D19, `EVIDENCE.md`, `BUG.md`,
`docs/architecture.md`, `docs/capture-protocol.md`, `docs/shot-list-g1.md`.

this script assumes the flows it narrates have landed and have a HashScan link in
`EVIDENCE.md` before the corresponding section is cut into the final edit. do not cut a
section in ahead of its evidence. if a gate is still red when editing starts, use the
fallback at the bottom of this document, not an improvised patch.

**hard constraint: five minutes, no exceptions.** the core cut below totals **4:23** — up 8
seconds from the version of this document written before block C was shot, entirely spent on
step 4b in section 4 below; see the note there. that buys **37 seconds of margin** against
the 5:00 cap, of which up to 30 seconds (down from 35, to hold the mandatory 5-second margin
below) may be spent on the optional CRE insert (§5A) if the CRE timebox lands. if it does not
land, §5A is simply not filmed and the 37 seconds stays as margin, or gets redistributed as
extra hold-time on the shots below, at iris's discretion during the edit.

**register for every spoken line below:** lowercase, terse, plain words, no em-dashes, no
exclamation marks, no crypto slang. read the line as written or trim it, do not embellish it.
if a line names the confidential leg, and it is a CRE CLI simulation rather than a live
deployment, the line must say "simulation" — never let a cut imply more than what ran.

narration word counts below are a **guide**, not a script hao must hit exactly. the on-screen
hold time is the fixed constraint. if the words run long, trim words, never extend the hold
past what capture-protocol.md prescribes for that shot.

---

## time budget, core cut

| section | content | on-screen time | cumulative |
|---|---|---|---|
| 1 | hashscan, the issuance transaction | 0:15 | 0:15 |
| 2 | issuance recap, the note and its configuration | 0:20 | 0:35 |
| 3 | block B, compliance: blocked, granted, permitted | 0:50 | 1:25 |
| 4 | block C, coupon and rate: configuration, plus the refusal | 0:48 | 2:13 |
| 5 | the confidentiality reveal | 0:30 | 2:43 |
| 5A | CRE insert, **conditional**, up to 0:30 | +0:00 to +0:30 | 2:43-3:13 |
| 6 | block E, the collateral hold: release and execute | 1:20 | 4:03-4:33 |
| 7 | closing card | 0:20 | 4:23-4:53 |

**core cut without §5A: 4:23. core cut with the full, now-30-second §5A: 4:53.** both are
under the 5:00 cap. if §5A runs, hold section 6 at exactly 1:20 and do not let the edit creep
past 4:53 — leave at least five seconds of hard margin against the cap, always.

---

## section 1. open on a real transaction (0:00-0:15)

**screen:** HashScan, the issuance transaction.
`https://hashscan.io/testnet/transaction/0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078`

reuse `docs/shot-list-g1.md` shot 1: static 8 seconds on the top of the page (hash, network
badge **testnet**, status **success**, `from` = `0.0.10424387`, timestamp), then one slow
scroll through the contract-created section and back up. total 15 seconds. this is the
literal first frame of the video. no logo, no title card, no market-size slide before it.

**narration (≈30 words):**
> this is a transaction on hedera testnet. it issues a private credit note through the asset
> tokenization studio. everything in this video is on chain at a link like this one, or it is
> labelled plainly as something that is not.

## section 2. issuance recap (0:15-0:35)

**screen:** HashScan contract page `0.0.10450229` (4-5s), then cut to the console read-back
panel at `http://localhost:3007` per `docs/shot-list-g1.md` shot 3: the "3. read the rate
configuration back" section, token id `0.0.10450229` entered, **active config: bond variable
rate (2)**, **operational: true**, the facet readiness grid, and the notes line explaining
the kpi-linked facet is absent. hold on the notes text until it is legible, do not cut early.

**narration (≈55 words, trim if it runs long):**
> the note is called covenant, a kpi-linked private credit instrument. the configuration
> that carries the on-chain kpi mechanism is registered in the studio's deployed resolver and
> unreachable by any working path. that is a real defect, filed upstream, in this
> repository's `BUG.md`. we issued on the configuration that works, and moved the
> kpi-to-rate conversion off chain instead.

do not say "kpi-linked rate mechanism runs on chain." it does not. see `BUG.md` B1 and
`DECISIONS.md` D16. the sentence above is the honest version and it is still a strong claim:
a real, reproducible defect in someone else's shipped software, found by building against it.

**a decision, not an oversight: the token's own name.** after block C's maturity compression
(`docs/shot-list-blocks-bce.md` §C step 8), the note's registered name still reads "Covenant
KPI-Linked Private Credit Note 2029" while its maturity reads 2026-09-10 16:55 — permanently,
publicly, on chain. **the core cut avoids the frame rather than narrating the mismatch.**
nothing in this script opens a HashScan "token info" page, where a name field and other
registered token properties sit together; every HashScan open in this script is scoped to one
transaction. **do not add a token-overview cutaway during editing to fill time or to make a
point look prettier** — that is the one frame this decision depends on staying out of the
cut. if a future cut needs one anyway, the honest line is short and belongs here, in section
2, not as an aside somewhere later: "the note's name still reads 2029. we compressed its
maturity for this recording, and the name did not follow it." write it in only if the frame
is unavoidable, not as a proactive flourish — an unprompted disclosure of a thing no viewer
would otherwise see is its own kind of noise.

## section 3. block B, compliance (0:35-1:25). **shot**, footage in hand.

see `docs/shot-list-blocks-bce.md` §B for the click-by-click and the captured transaction
hashes. summary for pacing:

**screen:** `http://localhost:3007`, block B tab, MetaMask connected as the issuer
`0.0.10424387` throughout.

**correction against the original plan below: the blocked transfer was captured in two
forms, not one, and both are usable.** the SDK's client-side refusal (step 5, no transaction,
console state only) and a forced raw attempt (step 6) that produced a genuinely **reverted**
transaction on HashScan, `0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5`,
revert selector `0xfc855b1b` = `InvalidKycStatus()`. the reverted transaction is the stronger
frame for this open because a judge can verify it on HashScan without trusting anything the
console says. lead with it; use the client-side refusal as the second beat, since it is the
one thing in this section with no on-chain link at all and is worth naming as such.

- **0:35-0:47 (12s).** step 6's reverted transaction. cold open on the HashScan page:
  **status: reverted**, the selector, the `InvalidKycStatus()` decode. this replaces the
  original plan of opening on the console error state alone.
  narration (≈25 words): *"a transfer to an unverified holder is refused by the token
  itself. forced on chain anyway, it reverts, and that failure is a transaction anyone can
  check on hashscan."*
- **0:47-0:55 (8s).** cut to the console, step 5's result panel: the SDK's own client-side
  refusal, `SDK refused before submitting: ...`, then the scripted scroll up (per the shot
  list) to the "blocked" verdict card, held live and red. **this pair, steps 5 and 6 together,
  is the first of the four shots that matter.**
  narration (≈20 words): *"before it even reaches the network, the sdk asks the token the
  same question and gets the same answer, with no transaction at all."*
- **0:55-1:10 (15s).** step 7, "grant kyc to the note holder." MetaMask confirm, then the
  HashScan link for the grant transaction, `1789049932.186440373`, then the scripted scroll to
  the "granted" card. **the second of the four shots that matter.**
  narration (≈30 words): *"kyc is granted through the token's own internal compliance
  registry. the credential is a placeholder identifier. the contract stores it and never
  verifies it. we are exercising the gate, not verifying anyone's identity."*
- **1:10-1:16 (6s).** quick cut, step 8, "grant kyc to the lender,"
  `0x0bf73993e41423a9f7e65794fc1c13510bd4f241e70a4848ea7729c62c43ba39`. no dedicated
  narration, this one is needed for block E later, not for the story here. b-roll only,
  MetaMask confirm visible, HashScan link opens and closes fast.
- **1:16-1:25 (9s).** step 9, "transfer again." same accounts, same amount. success,
  `0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5`, and the scripted
  scroll to the "permitted" card, live and emerald. **the third of the four shots that
  matter.**
  narration (≈20 words): *"the same transfer. same accounts, same amount. this time the
  token permits it, and it settles."*

verdict cards (blocked / granted / permitted) are reached by a scripted scroll after each
landing step, not a cutaway — `app/block-b-panel.tsx` pins them at the top of the page, well
above the step buttons, and the block B shoot confirmed that scroll has to be deliberate or
the card ends up off screen. see `docs/shot-list-blocks-bce.md` §B for the exact choreography;
the timings above assume it.

the section runs 50 seconds in the plan above against 3 shots plus one extra HashScan cold
open; if the edit runs long, the b-roll cut (step 8) is the one to trim first, not the
compliance pair or the scroll holds.

## section 4. block C, coupon and rate (1:25-2:13)

see `docs/shot-list-blocks-bce.md` §C for the click-by-click and the captured hashes. block C
is **shot**, footage in hand, same status as block B.

**screen:** the block C console (`app/block-c-panel.tsx`), MetaMask connected as the issuer
`0.0.10424387`, same account as block B.

- `setCouponRateType(FIXED)` fires, then a read-back confirming `getCouponRateType() == 2`.
  hold 5 seconds on the confirmed value.
- `FixedRate.setRate(600, 4)` fires, signed by the issuer. the value **600 at 4 decimals is
  6.00 percent**, the rate the confidential engine computed for the "q2 filing, covenant
  headroom" fixture (`lib/engine/fixtures.ts`, net leverage 2.00x). the HashScan `RateUpdated`
  event must be visible. hold 6 seconds.
- **new: step 4b, the refusal.** added after this section was first drafted, against a
  console that did not exist yet at the time — see `docs/shot-list-blocks-bce.md` §C for why
  it landed and why it is worth the seconds. no wallet, no HashScan link, no scroll: the same
  `setCoupon` call, once carrying a rate chosen for this call alone — 6 at 2 decimals,
  deliberately not 600 at 4, so the refusal cannot read as an echo — and it is refused by
  name, `InterestRateIsFixed()`. the identical call carrying nothing but the pending flag,
  `rate 0, rateDecimals 0, rateStatus PENDING`, passes. hold 4 seconds on the refusal, 3 on
  the pass. **this is the shot that turns the paragraph below from something the narration
  claims into something the token does on camera**, in the same red visual language as block
  B's blocked transfer.
- `setCoupon` fires with the pending triplet. hold 4 seconds on the HashScan link, then cut to
  the console's own "what we sent, and what the token stamped" table: engine output, what was
  sent, what is in storage, what got stamped, four lines in one frame. hold 4 seconds. **this
  is the proof that 600 was never named a second time** — the coupon asks the token for
  nothing and the token stamps 600 onto it anyway, read from its own storage.
- a read of `getCouponFor` for a holder, showing the entitlement is now readable. hold 3
  seconds. **do not show a payment.** there is none, on this facet.

section 4's running order inside itself changed — 4b sits where it actually happens on chain,
between posting the rate and declaring the coupon — but its position in the overall video (1
through 7) did not move. compliance still opens the video's middle third: whether a note can
move is still the more legible first question for a viewer meeting this instrument for the
first time, and nothing about 4b's arrival argues for reordering that.

**narration (≈95 words, this is the densest section, trim aggressively if needed):**
> before the first coupon, the token is switched to a fixed rate type. from this point the
> token refuses any rate a caller hands it and pays only from its own storage. the rate in
> storage came from the confidential engine, six hundred at four decimals, six percent,
> posted by a role-gated transaction. we hand it a different rate to test that claim, and it
> refuses, by name. the coupon we declare next asks the token for nothing — rate zero, status
> pending. the token stamps six hundred onto it anyway, from storage, because that is the
> only number it has. the studio declares what a holder is owed. moving the money is a
> separate step, off chain.

**a protection note, added now that block E has landed and this is no longer the video's
only candidate for "the" strongest thirty seconds.** section 4 carries the densest narration
in the script and, unlike sections 3 and 6, has no built-in scroll or long static hold to
anchor a viewer's attention on one frame — 4b's own panel and the "what we sent, and what the
token stamped" table are the two shots doing that job here, and they are exactly the two a
rushed edit would compress first, because neither has a HashScan link forcing a minimum hold.
if this section has to give up seconds, cut the narration in the block quoted above before
either of those two holds — 4 seconds on 4b's refusal panel and 6 on the stamped table are the
floor, not a suggestion.

## section 5. the confidentiality reveal (2:13-2:43)

**this is iris's section and the most important thirty seconds after the hold execution.**
`docs/shot-list-blocks-bce.md` does not cover this one; it is engine-console footage, not a
Hedera transaction, and it should already exist from whenever the engine work landed. if it
does not exist yet, capture it before editing starts, per `docs/capture-protocol.md`'s rule
that a working flow gets recorded the moment it works.

**screen, first half (12-15s):** the agent console at `/engine`, "agent view" panel. the
"q2 filing, covenant headroom" fixture loaded: borrower financials visible on screen
(revenue, ebitda, total debt, cash, interest expense, all populated), the engine output panel
showing net leverage **2.00x**, coupon rate **6.00%**, haircut **22.00%**, advance rate
**78.00%**, verdict **pass**.

**hard cut, no wipe, no fade (this matters, per PROJECT_BRIEF.md §9.3):**

**screen, second half (12-15s):** the lender view at `/lender`, same moment. the dashed
"borrower's financials are not on this page" region, empty, in frame. only haircut **22.00%**
and advance rate **78.00%** visible, plus the verdict badge. no revenue field, no ebitda
field, no leverage field anywhere on screen. that absence is real and worth filming exactly
as written — it just is not the whole claim. the narration below has to carry the rest,
because the blank field alone reads as more privacy than the screen actually provides.

**narration (≈75 words):**
> this is the agent's screen. the borrower's revenue, ebitda and total debt are entered here,
> and never leave this server, verified. now the lender's screen, same moment. it sees the
> verdict and the haircut, and it can work those straight back to the exact net leverage
> ratio. we are not hiding that, and we are saying so on screen. what it never sees is the
> revenue, the ebitda or the debt that ratio comes from.

**one fact that must not get simplified away, and it is the reason the narration above is
worded exactly this way.** the haircut is a lossless encoding of net leverage:
`haircut = 1500 + 7 * (kpi - 100) + addon`, where `addon` is fixed by the disclosed verdict.
one equation, one unknown, no clamp in the operating range — checked against both demo
fixtures, pass at 2200bps inverts to exactly 2.00x, breach at 4950bps to exactly 4.50x. see
`docs/architecture.md` and `DECISIONS.md` D17. **the boundary this project claims is the
financials behind the ratio, not the ratio itself.** do not let the narration drift into "the
lender only sees the haircut" or "the lender cannot recover the leverage" as if either hides
the ratio — both are false, both are checkable from `lib/engine/kernel.ts` and
`lib/engine/policy.ts` by anyone who reads them, and Apollo will catch it if it ships. the
version above says the true thing instead: the ratio is recoverable and we say so, the
statements behind it are not.

## section 5A. CRE insert, conditional (up to 0:30)

**only film and cut this in if the CRE timebox (`CLAUDE.md` §5, hours 26-30) produces
simulation or live evidence with a line in `EVIDENCE.md` G5.** if it does not land, skip this
section entirely and do not mention CRE in the video at all — an unfulfilled mention is worse
than silence.

**screen:** CRE CLI terminal output, the `handlerInTee` run, log lines visible.

**narration, live deployment (≈20 words):**
> the same computation also ran behind a chainlink cre handler in tee, inside a live
> hardware-isolated enclave. the log is on screen.

**narration, CLI simulation, the honest fallback (≈25 words):**
> the same computation also ran behind a chainlink cre handler in tee, as a cre cli
> simulation, not a live enclave deployment. the log is on screen and we say so plainly.

pick exactly one of the two lines above based on what `EVIDENCE.md` G5 actually records. never
say "enclave" without the word "simulation" attached if that is what ran.

## section 6. block E, the collateral hold (2:43/3:13-4:03/4:33, 80 seconds). **shot.**

recorded and signed on testnet, one continuous take, both mid-recording account switches
landed clean, no `IsNotEscrow` retake needed. the lifecycle is complete on chain: every
section of this script from 1 through 6 now has a real transaction behind it, and the
"fallback: if block E does not land" section at the bottom of this document is superseded —
kept for the record, not for use.

| step | what | signer | evidence |
|---|---|---|---|
| A1 | create hold A | note holder `0.0.10444395` | `0x46c5fbaa4c88d04f53cbdaeb36979a7d8b6c6c2609beef9d3807b28d15cc919d` |
| A2 | release hold A | engine/escrow `0.0.10445014` | `0x224eb5384684e450039153eeb521bbb39ac9aabe5edc1d34d4a86f5634ed09e0` |
| B1 | create hold B | note holder `0.0.10444395` | `0xea01d72c1c3f13b06be59b2c2e2219a9ead90e9da61cee56f3fca3d733647800` |
| B2 | execute hold B | engine/escrow `0.0.10445014` | `0xed43e199b78b21069f6bd0f5536cf2c42b3ad34ddb5d211de69407c32ba490c5` |

final state: note holder 250.00 to 150.00, lender 0 to 100.00, supply unchanged. pending
argus's independent verification before `EVIDENCE.md` carries these as final — see
`docs/shot-list-blocks-bce.md` §E for the same caveat.

see `docs/shot-list-blocks-bce.md` §E for the click-by-click. **this is the strongest single
shot in the video.** two holds: one released, one executed. use the "improved" fixture's
story (6.00 percent, pass) for the released hold and the "deteriorated" fixture's story
(12.00 percent, breach) for the executed one, so the video's own numbers justify why one
resolves one way and the other resolves the other way.

**hold A, release (≈30s).**
- note holder `0.0.10444395` signs `createHoldByPartition`, escrow = the engine's account
  `0.0.10445014`, target = the lender `0.0.10444404`. hold 8s on the confirm and the
  resulting HashScan link.
- MetaMask switches to the escrow account `0.0.10445014`. say the account out loud before
  confirming, per `docs/capture-protocol.md`.
- escrow signs `releaseHoldByPartition`. hold 8s on the HashScan link.

narration (≈35 words): *"the note holder pledges the note as collateral. the account that
can decide what happens to it is not the issuer. it is the engine's own hedera account, set
once, and enforced by the contract. on repayment, that account releases the hold."*

**hold B, execute, the peak of the video (≈50s).**
- note holder signs a second, identical `createHoldByPartition`. hold 6s.
- narration bridges to the breach: *"a second, identical note. the borrower's filing this
  quarter shows leverage at four and a half times, a covenant breach, twelve percent on the
  coupon instead of six."* (≈25 words, over a quick cut back to the engine's "deteriorated"
  fixture output, 4-5s)
- MetaMask switches to the escrow account `0.0.10445014`. **say the account out loud before
  confirming.** this is the single highest-stakes click in the shoot; see the risk note in
  the accompanying shot list.
- escrow signs `executeHoldByPartition`. **hold on this. do not cut away before the HashScan
  link is fully loaded and the transfer event is visible.** minimum 12 seconds static, then a
  slow scroll through the event log.

narration, spoken as the transaction confirms and the page loads, then trailing into
silence over the held shot (≈35 words): *"on default, the same account executes the hold
instead. the collateral moves to the lender. the number that decided this is a number the
lender never saw the inputs to. only the contract checks who is allowed to send this
transaction, and it just confirmed."*

## section 7. closing card (0:20)

**screen:** a plain title card or the README, showing the GitHub link, the `EVIDENCE.md`
link, and one line of status.

**narration (≈35 words):**
> every transaction in this video is on hedera testnet, linked from `EVIDENCE.md` in the
> repository. the studio is erc-1400 compliant with partial erc-3643 support. we deploy no
> contracts. this is covenant.

**optional, zero added seconds: a third link on the card, `/holder`.** `app/holder/page.tsx`
is a read-only page, no wallet, that reads a real account's position live off testnet,
including both hold outcomes from section 6 the moment they land. it costs nothing to add as
a third line of text next to the GitHub and `EVIDENCE.md` links already on this card — no new
footage, no narration change required. do not give it a dedicated section or cutaway: every
figure it shows is already proven live, on camera, by hashscan links elsewhere in this video
(sections 3, 4 and 6), so a section built around it would be evidence the video has already
presented, told a second time. its value is to a judge after the video, reading the
repository with no wallet of their own — that is a README pointer, not a shot.

---

## things this script must never say

pulled forward from `specs/00-mission.md` and `PROJECT_BRIEF.md` §8, restated here because a
script is exactly where these slip in under time pressure:

- never "repurchase agreement" or "repo" in the finance sense
- never "risk-free"
- never "zero-knowledge" or "ZK", anywhere, for any reason
- never "trustless"
- never "vesting" for the hold
- never "APY" or "yield farming"
- never imply on-chain interpolation of the KPI (`addKpiData` did not run, see §2 above)
- never imply the lender cannot recover the net leverage ratio from the verdict and the
  haircut it is shown — it can, exactly, with no clamp in the operating range, see §5 above
  and `docs/architecture.md`
- never imply "only the haircut is visible" means the ratio is hidden — the haircut and the
  ratio are the same information twice over. the boundary is the financials behind the
  ratio, not the ratio itself; say that, do not say the weaker thing that sounds similar
- never say "enclave" for the CRE leg without "simulation" attached, unless G5 in
  `EVIDENCE.md` genuinely records a live deployment
- never claim we performed KYC on a real identity (we exercised the token's compliance gate
  with a placeholder credential, see `DECISIONS.md` D18)
- never cut to the token's HashScan token-info page (name and registered properties together)
  without the section 2 disclosure line in the same cut — the note's name reads 2029, its
  compressed maturity reads 2026, and the default in this script is to avoid that frame
  entirely rather than explain it; see the note after section 2

---

## fallback: if block E does not land — superseded, block E landed

**this section is dead.** block E landed on testnet, both holds, both outcomes; see section 6
above for the hashes and `docs/shot-list-blocks-bce.md` §E for the click-by-click. the core
cut (4:23 / 4:53 with §5A) is the one to edit against. everything below is kept only as the
record of the plan that was made for the case where it did not land, in case a future retake
ever needs to know what that plan was.

written now, per hao's instruction, so nothing gets improvised on the day this becomes real.

**what does not change.** the Hedera prize gate only requires issuance, configuration, and
**at least one** lifecycle operation. block B's permitted transfer and block C's coupon
declaration are each independently a lifecycle operation with a HashScan link. **the
submission is not at risk if block E is dropped.** what is lost is the video's strongest
shot and its closing beat.

**what the video becomes.** sections 1 through 5 (and 5A, if CRE landed) are unchanged. section
6 is deleted outright, not replaced with a hold that "almost worked" or a description of what
a hold would do. do not narrate an unexecuted flow. section 5, the confidentiality reveal,
becomes the video's climax and gets the room that block E would have used.

**revised time budget, no block E:**

| section | content | on-screen time | cumulative |
|---|---|---|---|
| 1 | hashscan, the issuance transaction | 0:15 | 0:15 |
| 2 | issuance recap | 0:20 | 0:35 |
| 3 | block B, compliance | 0:50 | 1:25 |
| 4 | block C, coupon and rate, plus the refusal | 0:48 | 2:13 |
| 5 | confidentiality reveal, **extended** | 1:00 | 3:13 |
| 5A | CRE insert, conditional | +0:30 max | 3:13-3:43 |
| 7 | closing card, **extended** | 0:30 | 3:43-4:13 |

total **3:43 without §5A, 4:13 with the (now 30-second) §5A.** both leave close to a minute of
slack against the 5:00 cap. do not fill that slack with new content under time pressure.
spend it on holding every remaining shot longer, at capture-protocol.md's pace, so nothing on
screen needs a second look to read.

**section 5, extended (60s instead of 30s).** run both fixtures, not one. agent view loads
"q2 filing, covenant headroom" (pass, 6.00 percent, 22.00 percent haircut), cut to lender
view showing the same, hold 10s. cut back to agent view, load "q3 filing, covenant breached"
(breach, 12.00 percent, 49.50 percent haircut), cut to lender view again. the second cut is
the one that lands the point: the lender's screen changed, by exactly the same absent fields,
twice, and the viewer can watch the haircut move from 22.00 to 49.50 percent without ever
seeing why.

narration for the second pass (≈55 words): *"the borrower's numbers changed. the lender's
screen still shows no revenue, no ebitda, no debt. the verdict and the haircut did move, from
twenty-two percent to forty-nine point five, and the lender can read the exact leverage
straight back out of that move. what it still cannot read is the statements behind it. that
gap, not the blank field, is the whole point of this project."*

**section 7, extended (30s instead of 20s).** add one sentence naming what is specified but
not executed on chain, honestly, rather than pretending block E does not exist in the plan:

> a collateral hold, pledge and release or default, is specified against the studio's Hold
> facet and is not filmed here. everything else in this video is on chain, linked, and
> verified.

this sentence is optional, not load-bearing. include it only if there is room without
crowding the closing card. do not include it if it reads as an apology; the closing card's
job is confidence in what did ship, not an inventory of what did not.
