# video script

owner: iris. written against the current state of the build: `specs/00-mission.md`,
`PROJECT_BRIEF.md` §3/§4/§9.3 as rewritten, `DECISIONS.md` D10-D19, `EVIDENCE.md`, `BUG.md`,
`docs/architecture.md`, `docs/capture-protocol.md`, `docs/shot-list-g1.md`,
`docs/shot-list-blocks-bce.md`.

**recut, hour ~28.** the submission rule is **2-4 minutes**, upload fails above 4:00, and
`PROJECT_BRIEF.md` §7's "five minutes" was wrong — that is where the earlier 4:23/4:53 cut
came from. this version targets **3:30 with real margin below it**, not 3:59. CRE (§5A) is
cut outright: the deadline moved 12 hours earlier, 30 hours remain, and spending 4 of them on
the weakest prize to make an over-length video worse is not defensible. do not film §5A, do
not mention CRE anywhere in this video.

this script assumes the flows it narrates have landed and have a HashScan link in
`EVIDENCE.md` before the corresponding section is cut into the final edit. do not cut a
section in ahead of its evidence.

**before filming or cutting in any block B or block C footage, read the note under "a filming
risk" below.** it applies to already-shot footage, not just new takes.

---

## time budget, recut

| section | content | on-screen time | cumulative |
|---|---|---|---|
| 1 | hashscan, the issuance transaction | 0:11 | 0:11 |
| 2 | issuance recap | 0:12 | 0:23 |
| 3 | block B, compliance | 0:39 | 1:02 |
| 4 | block C, coupon and rate | 0:30 | 1:32 |
| 5 | the confidentiality reveal | 0:22 | 1:54 |
| 6 | block E, the collateral hold | 1:10 | 3:04 |
| 7 | closing card | 0:10 | 3:14 |

**total 3:14.** sixteen seconds under the 3:30 target, forty-six seconds under the 4:00 hard
cap. that is the margin: a cut landing at 3:14 on the editing timeline surviving export a few
seconds long, or a narration beat running a little over its guide, still clears 4:00 with room
to spare — which a cut landing at 3:58 would not.

**register for every spoken line below:** lowercase, terse, plain words, no em-dashes, no
exclamation marks, no crypto slang. read the line as written or trim it further, do not
embellish it. narration word counts are a guide; **the on-screen hold time is the fixed
constraint, and every hold time below is a floor, not a target** — if a take runs a second or
two long because a phrase needed the extra beat, that is fine, the margin above absorbs it.
what is not fine is narration that requires extending a hold past what is written here.

**what changed from the 4:23/4:53 version, and why, is not repeated inline below — see "what
was cut and what it costs" at the bottom of this document for the full account.**

---

## section 1. open on a real transaction (0:00-0:11)

**screen:** HashScan, the issuance transaction.
`https://hashscan.io/testnet/transaction/0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078`

reuse `docs/shot-list-g1.md` shot 1: static hold on the top of the page (hash, network badge
**testnet**, status **success**, `from` = `0.0.10424387`, timestamp) — **hold 6 seconds, not
8** — then one slow scroll through the contract-created section and back up, **5 seconds**.
total 11 seconds. this is the literal first frame of the video. no logo, no title card, no
market-size slide before it.

**narration (≈22 words):**
> this is a transaction on hedera testnet. it issues a private credit note through the asset
> tokenization studio. everything in this video is on chain, linked, or labelled as
> simulation.

## section 2. issuance recap (0:11-0:23)

**screen:** HashScan contract page `0.0.10450229`, **3 seconds**, then cut to the console
read-back panel — **route fixed: this panel now lives at `http://localhost:3007/console`,
block A tab ("block A, issuance"), not the site root.** the operator panels moved off `/` when
the landing page was rewritten; `/` is the institutional front door now, and it does not carry
this panel. go to `/console`, click the "block A, issuance" tab, per `docs/shot-list-g1.md`
shot 3: the "3. read the rate configuration back" section, token id `0.0.10450229` entered,
**active config: bond variable rate (2)**, **operational: true**, the facet readiness grid,
and the notes line explaining the kpi-linked facet is absent. **9 seconds total on this half,
enough for the notes line to be legible once, not lingered on.**

**narration (≈30 words, cut hard from the 55-word original):**
> the note is a kpi-linked private credit instrument. the on-chain kpi mechanism is
> unreachable through any working path in the studio, a real defect filed in this
> repository's `BUG.md`. we issued on the configuration that works.

do not say "kpi-linked rate mechanism runs on chain." it does not. see `BUG.md` B1 and
`DECISIONS.md` D16.

**the token-name / maturity mismatch stays out of frame, as before.** nothing in this script
opens a HashScan "token info" page. do not add one to fill time.

## section 3. block B, compliance (0:23-1:02). shot, footage in hand.

see `docs/shot-list-blocks-bce.md` §B for the click-by-click and the captured hashes.

**screen:** `http://localhost:3007/console`. **route fixed: block E is now the default tab on
this page, not block B** — click the "block B, compliance" tab explicitly before this
section's footage starts. MetaMask connected as the issuer `0.0.10424387` throughout.

**this section is where the protection rule bites hardest: the refused/settled pair below does
not lose a second of hold time in this recut. everything trimmed in this section comes out of
the KYC-grant beat's narration and hold, and the unnarrated b-roll cut is dropped outright.**

- **0:23-0:35 (12s), unchanged.** step 6's reverted transaction. cold open on the HashScan
  page: **status: reverted**, the selector, the `InvalidKycStatus()` decode.
  narration (≈22 words): *"a transfer to an unverified holder is refused by the token itself.
  forced on chain anyway, it reverts, a failure anyone can check on hashscan."*
- **0:35-0:43 (8s), unchanged.** cut to the console, step 5's result panel: the SDK's own
  client-side refusal, `SDK refused before submitting: ...`, then the scripted scroll up to
  the "blocked" verdict card, held live and red. **this pair is the block B contrast — the
  first of the three shots this recut protects in full.**
  narration (≈18 words): *"before it even reaches the network, the sdk asks the same question
  and gets the same answer, with no transaction at all."*
- **0:43-0:53 (10s), trimmed from 15s.** step 7, "grant kyc to the note holder." MetaMask
  confirm, hold on the HashScan link **4 seconds** (down from 6), then the scripted scroll to
  the "granted" card, held **4 seconds** (down from 6 — still enough for the card, both account
  ids, and the link to register at normal playback speed, not enough to linger).
  narration (≈16 words, cut from 30): *"kyc is granted through the token's own compliance
  registry. we are exercising the gate, not verifying anyone's identity."*
- **step 8 (grant kyc to the lender) is cut from the video entirely.** it still has to happen
  on chain before block E — it is unnarrated setup, not a shot that matters, and it is the one
  beat in this section with the lowest evidentiary weight per word of screen time. see "what
  was cut" below.
- **0:53-1:02 (9s), unchanged.** step 9, "transfer again." success,
  `0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5`, scripted scroll to the
  "permitted" card, live and emerald. **the second half of the protected contrast — byte-
  identical calldata, refused, then settled.**
  narration (≈18 words): *"the same transfer. same accounts, same amount. this time the token
  permits it, and it settles."*

section total: 39 seconds, down from 50. all 29 seconds of the protected refused/settled pair
(steps 5, 6, 9) are untouched. the 21 seconds cut came from step 7's hold and narration (-11s)
and step 8's full removal (-6s), plus incidental trims elsewhere in the block's framing.

## section 4. block C, coupon and rate (1:02-1:32)

see `docs/shot-list-blocks-bce.md` §C for the click-by-click and the captured hashes.

**screen:** `http://localhost:3007/console`, "block C, rate and coupon" tab. MetaMask
connected as the issuer `0.0.10424387`, same account as block B.

**the protection rule again: step 4b's refusal panel and the "what we sent, what got stamped"
table do not lose a second here. this recut's cuts come from steps 1, 2, 4, 5 and 9's holds and
narration, compressed to the minimum each needs to read as a real transaction on screen.**

- `setCouponRateType(FIXED)` fires, read-back confirms `getCouponRateType() == 2`. **4 seconds
  total** (down from a 5s hold plus a separate 4s read-back and a 6s scroll-hold — one held
  frame carrying both the transaction result and the read-back value, not three).
- `FixedRate.setRate(600, 4)` fires — **600 at 4 decimals is 6.00 percent**, the confidential
  engine's output for the "q2 filing, covenant headroom" fixture. HashScan `RateUpdated` event
  visible. **5 seconds** (down from 6+6).
- **step 4b, the refusal — untouched, 11 seconds.** the same `setCoupon` call, once carrying a
  rate chosen for this call alone (6 at 2 decimals) and refused by name, `InterestRateIsFixed()`
  — hold 4s; then the identical call carrying only the pending flag, which passes — hold 4s;
  then the one-line control statement — hold 3s. **this is the block C contrast — the second
  of the three shots this recut protects in full.**
- `setCoupon` fires with the pending triplet. **4 seconds** on the HashScan link (down from 4,
  unchanged), then cut straight to **the "what we sent, and what the token stamped" table —
  untouched, 6 seconds.** four lines in one frame: engine output, what was sent, what is in
  storage, what got stamped. **this is the proof that 600 was never named a second time, and
  the third of the three protected shots.**
- the `getCouponFor` read-back **is cut from this section.** it showed the entitlement is
  readable; the stamped table already carries that weight on its own. see "what was cut" below.

**narration (≈55 words total for the section, cut hard from 95 — trim further before the
refusal panel or the stamped table, never on them):**
> before the first coupon, the token switches to a fixed rate type. from this point it refuses
> any rate a caller hands it and pays only from its own storage. we hand it a different rate to
> test that. it refuses, by name. the coupon we declare next asks the token for nothing. it
> stamps six hundred onto it anyway, from storage, the only number it has.

section total: 30 seconds (was 48). the three protected beats — 4b's refusal (11s) and the
stamped table (6s), 17 seconds together — are exactly as long as before. the other 13 seconds
carry the rate-type switch (4s), the rate post (5s) and the pending-coupon transaction (4s),
each compressed to one held frame instead of a hold-plus-scroll-plus-read-back.

## section 5. the confidentiality reveal (1:32-1:54)

**this remains the most important thirty seconds in the submission after the hold execution —
it is now 22, not 30, and it is shorter for a real reason, not a rushed one: see the note
below before assuming this is a straight trim.**

**the shot itself changed since the last version of this script, because the build did.**
`/engine` no longer requires a cut between two full-screen routes to make this point. as built
(`app/engine/agent-console.tsx`), `/engine` opens in "both views" mode by default: the agent's
form and engine output on the left, a live iframe of `/lender` on the right, **on screen at
the same time, from the same load.** there is no click between them to film. this is a
stronger reveal than the hard cut the original script called for, not a weaker one — the
absence on the right is visible for the entire shot, not only after an edit point, and a judge
watching does not have to trust that the cut was not hiding a beat where the fields briefly
overlapped.

**screen:** `http://localhost:3007/engine`, "both views" mode (the default). the "q2 filing,
covenant headroom" fixture loaded on the left: revenue, ebitda, total debt, cash, interest
expense, all populated. click "run the engine." **hold 8 seconds** as the left panel populates
— verdict **pass**, net leverage **2.00x**, coupon rate **6.00%**, haircut **22.00%**, advance
rate **78.00%** — and the right panel, the live `/lender` iframe, updates in the same frame:
haircut **22.00%**, advance rate **78.00%**, verdict badge, and the empty "borrower's
financials are not on this page" region, visible and blank, the whole time. **hold 10 seconds**
static once both sides have settled, long enough for a viewer to read both panels side by side
and register that one has five figures the other does not.

no hard cut is needed and none is filmed. if this exact build is not what is on screen on
shooting day, revert to the two-route version below rather than improvise a cut against a
layout that no longer exists — but the "both views" layout is what shipped, and it is the
shot to use.

**narration (≈40 words, cut from 75):**
> this is the agent's screen and the lender's screen, live, at the same time. the borrower's
> financials, on the left, never reach the right. the lender sees the verdict and the haircut,
> and can work those back to the exact leverage ratio. what it never sees is the revenue, the
> ebitda, or the debt behind it.

**the fact that must not get simplified away is unchanged from the prior version of this
script and still governs the wording above:** the haircut is a lossless encoding of net
leverage, `haircut = 1500 + 7 * (kpi - 100) + addon`, one equation, one unknown, no clamp in
the operating range — see `docs/architecture.md` and `DECISIONS.md` D17. the boundary this
project claims is the financials behind the ratio, not the ratio itself. never say "the lender
only sees the haircut" or "cannot recover the leverage" as if either hides the ratio — both are
false and both are checkable from `lib/engine/kernel.ts` and `lib/engine/policy.ts`.

**fallback, if the "both views" layout is not what ships on shooting day:** open on `/engine`,
"agent only" mode, the fixture loaded, engine run, hold 10s. hard cut, no wipe, no fade, to
`/lender` in a new tab, same moment, hold 10s on the empty region and the haircut. narration
unchanged. this costs no extra time against the budget above; it is the same 22 seconds spent
as two holds instead of one.

## section 6. block E, the collateral hold (1:54-3:04, 70 seconds). shot.

recorded and signed on testnet, one continuous take. see `docs/shot-list-blocks-bce.md` §E for
the click-by-click and the captured hashes.

| step | what | signer | evidence |
|---|---|---|---|
| A1 | create hold A | note holder `0.0.10444395` | `0x46c5fbaa4c88d04f53cbdaeb36979a7d8b6c6c2609beef9d3807b28d15cc919d` |
| A2 | release hold A | engine/escrow `0.0.10445014` | `0x224eb5384684e450039153eeb521bbb39ac9aabe5edc1d34d4a86f5634ed09e0` |
| B1 | create hold B | note holder `0.0.10444395` | `0xea01d72c1c3f13b06be59b2c2e2219a9ead90e9da61cee56f3fca3d733647800` |
| B2 | execute hold B | engine/escrow `0.0.10445014` | `0xed43e199b78b21069f6bd0f5536cf2c42b3ad34ddb5d211de69407c32ba490c5` |

final state: note holder 250.00 to 150.00, lender 0 to 100.00, supply unchanged.

**screen:** `http://localhost:3007/console`. **route note: block E is the default tab on this
page** — no tab click needed to reach it, unlike blocks B and C above.

**this is where the recut protects the most and cuts the least.** `executeHoldByPartition`
firing is the strongest single shot in the video and the third of the three protected beats.
the minutes cut from this section come from hold A and the fixture-cutaway bridge, not from
hold B's execute.

**hold A, release (≈18s, down from ≈30s).**
- note holder `0.0.10444395` signs `createHoldByPartition`, escrow = the engine's account
  `0.0.10445014`, target = the lender `0.0.10444404`. **hold 5s** (down from 8) on the confirm
  and the HashScan link.
- MetaMask switches to the escrow account `0.0.10445014`. say the account out loud before
  confirming, per `docs/capture-protocol.md` — this instruction is not cut, ever, anywhere in
  this shoot.
- escrow signs `releaseHoldByPartition`. **hold 5s** (down from 8) on the HashScan link, then
  the scripted scroll to the "released" card, **hold 4s** (down from 6).

narration (≈24 words, cut from 35): *"the note holder pledges the note. the account that
decides what happens to it is not the issuer, it is the engine's own hedera account. on
repayment, that account releases the hold."*

**hold B, execute, the peak of the video.** every hold duration below is unchanged from the
prior version of this script; only the fixture cutaway ahead of it is removed.
- note holder signs a second, identical `createHoldByPartition`. **hold 6s, unchanged.**
- **the fixture cutaway bridge to the "deteriorated" fixture is cut from the video.** section 5
  already showed the engine moving between a pass and — if the fallback above is used — a
  second state; re-showing a fixture here repeats a beat the video already made. the narration
  below carries the breach in one sentence instead.
- MetaMask switches to the escrow account `0.0.10445014`. **say the account out loud before
  confirming.** this is the single highest-stakes click in the shoot; see
  `docs/shot-list-blocks-bce.md`'s risk note, unchanged and still in force.
- escrow signs `executeHoldByPartition`. **hold on this exactly as long as the prior cut did —
  nothing here is trimmed.** the console's own "executed" card: hold 4s, then the scripted
  scroll, hold 4s. then HashScan: **minimum 12 seconds static** once the transaction confirms,
  then a slow scroll through the event log to the transfer event. total for the HashScan
  portion alone: 15-18 seconds, unchanged from the prior cut, still the longest individual hold
  in the entire video.

narration (≈40 words, said as the transaction confirms and the page loads, then trailing into
silence over the held shot): *"a second note. this quarter's filing shows a covenant breach,
twelve percent on the coupon instead of six. on default, the same account executes the hold
instead. the collateral moves to the lender, decided by a number the lender never saw the
inputs to."*

section total: 70 seconds, down from 80. the ten seconds cut came from hold A's trimmed holds
and the removed fixture bridge; hold B's execute sequence — create, switch, execute, card,
HashScan — keeps every duration from the version of this script written before the length
limit was corrected. nothing about the video's strongest shot got faster.

## section 7. closing card (3:04-3:14)

**screen:** a plain title card or the README, showing the GitHub link, the `EVIDENCE.md` link,
and one line of status.

**narration (≈22 words, cut from 35):**
> every transaction in this video is on hedera testnet, linked in `EVIDENCE.md`. we deploy no
> contracts. this is covenant.

**one line dropped from the prior version: the ERC-1400/ERC-3643 compliance-scope sentence.**
it is true and worth keeping in the README and the writeups, but it is a credential claim, not
evidence, and this is the one sentence in the closing card this recut could not protect without
missing the length target. it is not in `docs/architecture.md`'s or the writeups' remit to
drop it — they still state it in full.

**optional, zero added seconds:** a third line of text on the card pointing to `/holder`, next
to the GitHub and `EVIDENCE.md` links. no new footage, no narration change. its value is to a
judge reading the repository afterward, not to the video itself.

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
  ratio are the same information twice over. the boundary is the financials behind the ratio,
  not the ratio itself
- never mention CRE, chainlink, an enclave, or a TEE anywhere in this cut. the CRE timebox was
  cut before it ran; there is no evidence to show and no honest sentence to say about it that
  is worth the seconds. silence is the correct answer here, not a caveated mention.
- never claim we performed KYC on a real identity (we exercised the token's compliance gate
  with a placeholder credential, see `DECISIONS.md` D18)
- never cut to the token's HashScan token-info page (name and registered properties together)
  — the note's name reads 2029, its compressed maturity reads 2026, and this cut avoids that
  frame entirely

---

## a filming risk that is new in this recut, and applies to footage already in hand

`attempt()` in `lib/ats/diagnostics.ts` swallows a failed contract read into a zero rather
than an error. every "state read back off chain" panel in blocks A, B, C and E's console goes
through this function (confirmed at `app/console/issue-panel.tsx`,
`app/console/block-b-panel.tsx`, `app/console/block-c-panel.tsx`,
`app/console/block-e-panel.tsx`). a slow relay can make one of those reads time out and render
a plausible-looking zero next to a genuinely non-zero figure — this already happened once, on
the landing page, before that page was rewritten to read `/holder`'s position directly instead
of through the diagnostics module specifically to remove this failure mode from `/` and
`/holder`. **the console panels this script still points the camera at were not rewritten and
still carry the risk.** the chain truth is independently verified in `EVIDENCE.md`, so nothing
this script claims is wrong — but a wrong figure could still appear on screen during a take,
and a viewer has no way to know it is wrong from the frame alone.

`docs/capture-protocol.md` now carries the rule this implies: read the figures a shot depends
on against `EVIDENCE.md` or a direct chain read before filming it, and if a panel shows a zero
where a number is expected, stop and re-read rather than filming it.

**blocks B and C are already shot.** their footage cannot be re-taken — the signing moments
in it are irreversible, one-time signatures. before cutting that footage into the final edit,
review it specifically for this failure mode: any diagnostics-backed figure on screen
(`totalSupply`, the facet readiness grid, any KYC-status or balance read shown in a "read
state" panel) should be checked frame by frame against `EVIDENCE.md`'s numbers for the same
moment. the transaction results and HashScan links this script actually uses in sections 3 and
4 are not diagnostics reads — they come from the transaction receipts themselves — so the
shots this recut protects are not at risk from this specific bug. the risk sits in the
b-roll-adjacent state panels around them, which is one more reason this recut trims those
panels' screen time rather than the protected shots.

---

## what was cut and what it costs

the honest account, not a summary that makes every section look equally thinned. cuts fell
into three kinds: whole sections dropped, whole beats dropped, and hold time trimmed on beats
that survived.

**dropped outright: §5A, the CRE insert (was up to 30s).** the CRE timebox did not run; there
is nothing to show. cost: none to the submission — the insert was always conditional and never
carried required evidence. cost to the pitch: no Chainlink-prize beat in the video at all,
which matches dropping the prize itself.

**dropped outright: block B step 8, "grant kyc to the lender" (was 6s, unnarrated b-roll).**
the transaction still has to happen on chain before block E — it is not skipped in the build,
only in the video. cost: none to the on-chain story; a viewer never sees the lender's KYC grant
directly, only its consequence (the lender receiving collateral in block E, which requires it).
this was the single lowest-value beat in the script per second of screen time, and it is the
first thing cut for a reason.

**dropped outright: block C's final `getCouponFor` read-back (was 3s).** it demonstrated the
entitlement is now readable. cost: small and real — a viewer sees the coupon declared and
stamped, but not a direct read confirming a holder can query it. the "what we sent, and what
the token stamped" table, which is not cut, already carries the stronger version of this claim
(the stamped rate matches the engine's rate to the raw integer), so this is judged an acceptable
loss, not a free one.

**dropped outright: the fixture cutaway bridging into hold B's execute (was 4-5s).** it showed
the "deteriorated" fixture's engine output before the hold that acts on it. cost: the video no
longer shows the breach's own numbers a second time before executing on them — it only states
them in narration ("twelve percent instead of six"). section 5 already showed the engine
computing a verdict once; this cutaway would have been the second time, and the recut judges
that repetition affordable to lose before the protected shots are touched.

**trimmed, not dropped: section 5, the confidentiality reveal, 30s to 22s.** this is the
largest single trim in seconds and the one most worth explaining plainly, per the instruction
not to thin every section until none of them land. it is not a straight cut of the same shot —
the shot itself changed, because `/engine` now renders both views simultaneously rather than
requiring a navigated cut between two routes. the simultaneous layout makes the same point in
less time with no loss of clarity: both panels are visible together for the entire 18-second
hold, not only after a cut point, which is arguably a more legible reveal than the sequential
version, not a compromised one. if a judge freezes the frame at any point in this shot, the
absence is already visible — it does not depend on having seen the "before" half a moment
earlier. the words cut (75 to 40) are cut for the same reason as everywhere else in this
recut: the panel does the work, the narration only has to name it once.

**trimmed, not dropped: block B's KYC-grant beat, 15s to 10s; block C's rate-type-switch and
rate-post beats, roughly 11s combined to 9s; block E's hold A, roughly 30s to 18s; the closing
card, 20s to 10s; sections 1 and 2, 35s combined to 23s.** none of these lost their HashScan
link, their MetaMask confirm, or their verdict card — each still shows a real transaction
landing and its result. what they lost is the second, separate hold-and-scroll-and-read-back
sequence some of them had layered on top of the transaction result, compressed instead into one
held frame that shows the same evidence in less time. narration on every one of these beats was
cut harder than the screen time was, on purpose, per the instruction that seconds come out of
talking first.

**not touched, anywhere in this recut:** the block B refused/settled contrast (steps 5, 6, 9 —
29 seconds), block C's step 4b refusal and the "what we sent, what got stamped" table (17
seconds), and block E's hold B execute sequence from account switch through the HashScan event
log (roughly 30-32 seconds, including the single longest static hold in the video). these three
are the shots the submission is judged on. nothing above them was worth protecting more.

**if this is still too long once cut against real footage:** the next beat to drop, in order,
is block C's rate-type-switch read-back (fold its 4 seconds into the rate-post beat's hold,
naming both values in one line of narration), then section 2's HashScan contract-page cutaway
(cut straight from section 1 to the console read-back, losing the standalone contract-page
frame but not the read-back itself). do not go further than that without asking hermes — the
next cut after those two starts touching the protected beats.

---

## remaining takes, in shooting order

1. **section 5, the confidentiality reveal, if not already captured against the current
   `/engine` "both views" build.** check first whether existing engine-console footage shows
   the simultaneous layout or the older two-route layout; if it is the older layout, the
   fallback in section 5 above still cuts to the same 22-second budget, so this is not
   necessarily a reshoot. if no engine-console footage exists yet at all, this is the one
   genuinely new capture this recut requires.
2. **section 7, the closing card.** a static screen, not a live capture — confirm the GitHub
   link, the `EVIDENCE.md` link, and (optionally) the `/holder` line are current before
   recording the voiceover over it.
3. **sections 1 and 2, HashScan and the console read-back at `/console`, block A tab.** likely
   already in hand from the original shoot; re-confirm the route (`/console`, not `/`) before
   assuming existing footage still matches what is on screen.
4. **no new capture needed for sections 3, 4 or 6.** blocks B, C and E are shot. editing work
   only: trim to the durations above, and complete the frame-by-frame diagnostics-figure check
   described in "a filming risk" above before those cuts go into the final edit.

---

## fallback: if block E does not land — retained for the record only

block E landed; this fallback never ran and is not reproduced in this recut. it remains in
git history in the pre-recut version of this file if it is ever needed again.
