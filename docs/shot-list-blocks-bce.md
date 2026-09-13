# shot lists: blocks B, C, E

owner: iris. companion to `docs/video-script.md`, which tells the story; this file tells hao
exactly what to click, in what order, with which MetaMask account connected, and how long to
hold each result on screen. read `docs/capture-protocol.md` first — every rule in it applies
to all three blocks below without restatement: recorder starts before the block's first click
and stays on until the gate closes, say the account out loud before every confirm, HashScan
opens while the recorder is still running.

block B's UI exists today (`app/transactions/block-b-panel.tsx`) and every step below is copied
from its actual button labels and step numbers, not guessed. block C and block E do not have a
console built yet at the time this is written. their shot lists describe the exact on-chain
call, the signer, and what must be legible on screen; if the eventual UI is not a numbered-step
panel like block B's, adapt only the click target, never the sequence, the account, or the
required on-screen values.

**status.** block B: **shot**, see the panel below its heading. block C: **shot**, see the
panel below its heading — landed with an extra step, 4b, that did not exist when this
document's block C draft was first written against a console that did not exist yet; see the
note at the top of that step. block E: **shot** — both holds, both outcomes, signed on
testnet, see the panel below its heading. the lifecycle is now complete on chain: every block
this document describes has landed exactly as scripted, including the two mid-recording
account switches block E required. all three share block B's layout — verdict cards at the
top of the page, step buttons well below the fold — so the scroll choreography below applies
throughout; see the notes inside each block's section.

**route note, added after the operator panels moved.** all three blocks now live at
`http://localhost:3007/transactions`, not at the site root — `/` is the institutional landing page
and carries none of these panels. the console page also changed its default tab: **block E is
now the default tab, not block B.** block B and block C both require an explicit tab click
("block B, compliance" / "block C, rate and coupon") before their first scripted click; block
E needs no tab click. every "screen:" line below is corrected to say so.

**before cutting block B or block C footage into the final edit, read `docs/video-script.md`'s
"a filming risk" section.** `attempt()` in `lib/ats/diagnostics.ts` swallows a failed contract
read into a zero, and every "read state off chain" panel in these two blocks' already-shot
footage goes through it. that footage cannot be re-taken — check it frame by frame against
`EVIDENCE.md` before trusting a diagnostics-backed figure on screen, per the rule now in
`docs/capture-protocol.md`.

---

## block B. compliance. nine steps. **shot.**

recorded and signed on testnet. all nine steps landed in one continuous take. the two
irreversible shots are both on tape:

| step | what | evidence |
|---|---|---|
| 4 | mint 1000 notes | `0x69bcc8982fda4de4c8f485b0f18e1e6232daa5ef183b68444486404a431f095e` |
| 5 | forced blocked transfer, **reverted, deliberately** | `0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5` |
| 7 | grant kyc, note holder | `1789049932.186440373` |
| 8 | grant kyc, lender | `0x0bf73993e41423a9f7e65794fc1c13510bd4f241e70a4848ea7729c62c43ba39` |
| 9 | permitted transfer | `0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5` |

final state: issuer 750.00 notes, holder 250.00, all three accounts GRANTED, supply unchanged
at 1000.00. the blocked transfer exists in **two forms**, both captured: the SDK's
client-side refusal (no transaction, console state only) and a raw forced attempt that
produced a genuinely reverted transaction, selector `0xfc855b1b` = `InvalidKycStatus()`,
verifiable on HashScan by anyone without trusting us. see `docs/video-script.md` §3 for how
the two are cut together.

**the one thing the shoot exposed:** the three verdict cards sit above the step buttons.
clicking a step button and then looking for its result leaves the verdict card, which is the
shot that carries the meaning, off screen unless the scroll up is deliberate. every step below
that lights a card now scripts the scroll explicitly. this is not a layout fix — the reveal
(click, then scroll up to a large card lighting) reads well on camera. it just cannot be left
to whoever is holding the mouse.

**screen:** `http://localhost:3007/transactions`, "block B, compliance" tab — click it, it is no
longer the default tab on this page.
**account for every step in this block:** issuer `0.0.10424387`. connect before step 1 and do
not switch for the rest of the block — the panel refuses to build a transaction from any
other connected account and shows an amber warning if you do.

**before anything:** click "connect wallet", confirm as issuer `0.0.10424387`. say the
account out loud. then click "read state off chain" once so the diagnostics panel populates
before the numbered steps begin — this is a read, no wallet popup.

recorder is already rolling per capture-protocol.md. do not stop it until step 9's HashScan
link is open in a new tab.

### step 1. apply roles

click **"apply roles"**. confirm in MetaMask as the issuer. one transaction,
`AccessControl.applyRoles`. hold 4 seconds on the green "done" state and the transaction line
once it appears.

### step 2. add credential issuer

click **"add credential issuer"**. confirm. `SsiManagement.addIssuer`. hold 4 seconds.

### step 3. grant kyc to the issuer

click **"grant kyc to the issuer"**. confirm. hold 4 seconds. this one is necessary before
step 4 — `Mint.sol` requires the recipient to be identified — but it is not a shot that
matters on its own; do not linger past 4 seconds.

### step 4. issue the notes

click **"issue the notes"**. confirm. `Security.issue`. hold 4 seconds on the resulting
supply figure in the diagnostics panel below (it should move from 0 to the issued amount).

### step 5. attempt the blocked transfer — first of the four shots that matter

click **"attempt the blocked transfer"**. **no MetaMask popup appears — this is expected and
is the point.** the SDK refuses client-side before anything is submitted.

**scroll choreography, scripted because the block B shoot proved it cannot be improvised.**
the mouse is on the "attempt the blocked transfer" button at the moment of the click. step 5's
own result panel renders directly under that button, well below the "blocked" verdict card at
the top of the page — the two do not fit in the same frame on this build. do not try to hold
both at once. instead:

1. after the click, leave the mouse where it is. hold **3 seconds, static**, on step 5's own
   result panel as soon as its text appears: `SDK refused before submitting: ...` and, in the
   same panel, `canTransferByPartition: ...` with the reason word.
2. scroll up. **one continuous, smooth motion — no stopping halfway, no series of short
   flicks.** roughly **2 seconds** of travel from step 5's panel to the top of the page.
3. once the "blocked" card is centred and fully in frame, stop scrolling completely. hold **6
   seconds minimum, static**, on the red card, its detail line, and the reason word
   (`InvalidKycStatus()`).

total for the shot: roughly 11 seconds of held frame plus the 2-second scroll. this supersedes
the earlier instruction to hold "8 seconds, static, no scroll" with all three elements in one
frame — on the actual build they are not in one frame, and writing the shot list as if they
were is exactly what produced the miss on the day.

this step alone produces no HashScan link. per capture-protocol.md, it is the one shot with
**no transaction to fall back on if the recorder was not rolling** — the console state is the
entire evidence for this half of the story. step 6 below supplies the second, independently
verifiable half: the same refusal, forced on chain and reverted for real.

### step 6. force it on chain — captured, and it turned out to be the stronger frame

click **"force it on chain"**. MetaMask will show a warning that the transaction is likely to
fail. **confirm anyway.** this is expected to revert.

hold 6 seconds on the result: `refused on chain: ...` and the HashScan link. click the
HashScan link, let it load, hold 4 more seconds on the reverted transaction status.

**actual capture:** `0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5`,
status **reverted**, revert selector `0xfc855b1b` = `InvalidKycStatus()`. this is now the
lead frame for the compliance sequence in `docs/video-script.md` §3 — a judge can check it on
HashScan without trusting anything we say, which step 5 alone cannot offer.

it was originally written up here as "optional, droppable" — that call is withdrawn now that
it has landed and produced the stronger evidence. if a future retake needs to drop something
under time pressure, drop something else first.

### step 7. grant kyc to the note holder — second of the four shots that matter

click **"grant kyc to the note holder"**. confirm as the issuer. say "signing as issuer,
account 0.0.10424387" before confirming.

hold 6 seconds on the result line and the HashScan link, mouse still where it was for the
confirm. then run the same scroll choreography as step 5: one continuous, smooth scroll up,
roughly 2 seconds, no stopping halfway. once the "granted" card is centred and live (amber),
stop and hold **6 seconds minimum, static**, on the card, its detail line (both account ids),
and the HashScan link inside it.

**actual capture:** `1789049932.186440373`.

### step 8. grant kyc to the lender

click **"grant kyc to the lender"**. confirm. hold 4 seconds. this grant is needed for block
E later (`executeHoldByPartition` requires the lender to be identified), not for the transfer
story in this block. no scroll needed — this one lights no card of its own; "granted" already
went live at step 7.

**cut from the video in the current recut** (`docs/video-script.md` §3, "what was cut and what
it costs"). still shoot it — the transaction still has to land on chain before block E — but
the editor drops this clip from the final cut; it is not narrated and carried the lowest
evidentiary weight per second of anything in block B.

**actual capture:** `0x0bf73993e41423a9f7e65794fc1c13510bd4f241e70a4848ea7729c62c43ba39`.

### step 9. transfer again — third of the four shots that matter

click **"transfer again"**. confirm as the issuer. hold on the result line and the HashScan
link **for 6 seconds, mouse still**, then run the scroll choreography once more: one
continuous, smooth scroll up, roughly 2 seconds, no stopping halfway. once the "permitted"
card is centred and live (emerald), stop and hold **8 seconds minimum, static** — the card,
the balance detail, and the HashScan link inside it.

**actual capture:** `0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5`.

**immediately after this lands:** open the HashScan link in a new tab while the recorder is
still running, per capture-protocol.md. hold 5 seconds on the HashScan transaction page
before stopping the recorder.

### what must be visible somewhere in this block's footage, not necessarily all at once

- the three verdict cards (blocked / granted / permitted) each transitioning from idle grey
  to their live colour — reached by the scripted scroll after steps 5, 7 and 9 respectively,
  not a quick cutaway; hold each one static once it is in frame, per the durations above
- the "state read back off chain" panel's per-account table, at least once, showing the note
  holder's kyc status flip from a red status to `GRANTED`

---

## block C. coupon and rate. **shot.**

recorded on testnet, one continuous take. hashes below, from hermes's landing report; the
first three (the role grant, the rate-type switch, the rate post) are pending confirmation
from argus and are not yet in `EVIDENCE.md` — do not treat them as final on that front, argus
owns that file, not this one.

| step | what | evidence |
|---|---|---|
| 1 | apply the two roles (interest rate manager + corporate action) | pending, argus |
| 2 | switch coupon rate type to FIXED | pending, argus |
| 4 | post the engine's rate, `FixedRate.setRate(600, 4)` | pending, argus |
| 5 | `setCoupon`, pending triplet | `0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1` |
| 6 | trigger scheduled tasks | `0x7738f48b23aa9ae53132b28332addde8c09836311b9b43541644629af83576b0` |
| 7 | grant maturity manager role | `0x4a2c16f1eae577af8168de86b6942f2360dd6ba983cde39133efd8bb9fc0568d` |
| 8 | compress maturity | `0x98e9a148cef1403825421a52f9f8f26571b553b20b9d3cf75a6596e4bcbb4b33` |
| 9 | settle in HBAR | `0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404` |

final state: coupon rate 600 at 4 decimals, status SET, snapshotId 1, maturity compressed to
2026-09-10 16:55 (was 2029), issuer 750.00 notes, holder 250.00. step 3, running the engine,
signs nothing and produces no transaction — it is the local call that decides what step 4
sends.

**the one thing that changed the shape of this block after this document's draft was first
written.** step 4b: a read-only refusal check, between "post the rate" and "declare the
coupon," that did not exist as a plan when this section was drafted against a console that
had not been built yet. the console that shipped built it as its own numbered step,
`"refusal"` / `"4b"` in `app/block-c-panel.tsx`, in the same visual language as block B's
blocked-transfer card. it is a stronger shot than anything else in this block — see the
dedicated note under step 4b.

**screen:** `http://localhost:3007/transactions`, "block C, rate and coupon" tab — click it, it is
not the default tab on this page. the panel's own step numbering — 1, 2, 3, 4,
4b, 5, 6, 7, 8, 9 — is what is used below. an earlier draft of this section numbered a
"prerequisite" and two separate role grants; that numbering did not survive contact with the
shipped panel, which grants both roles in a single transaction at step 1. the draft is
withdrawn; the steps below are read off the component, not guessed.

**account for every signed step in this block:** issuer `0.0.10424387`, the same account as
block B. two steps, 3 and 4b, sign nothing and switch no account — say so on camera rather
than leaving a silent gap where a MetaMask popup was expected and none appears.

**one continuous recording for the whole block**, per capture-protocol.md, from before step
1's signature to the HashScan link for step 9.

### step 1. apply the two roles

click **"apply the two roles"**. confirm as the issuer. one transaction, both roles:
`ROLE_INTEREST_RATE_MANAGER`, needed for steps 2 and 4, and `ROLE_CORPORATE_ACTION`, needed
for step 5 — a different role, and a common mistake to grant only one. hold 4 seconds.

### step 2. set rate type to FIXED

this is a direct ethers call through `IAsset__factory`, not an SDK port call — see
`specs/05-coupon-rate-surface.md` §1. it is not exposed in `port/in`.

click **"set rate type to FIXED"**. confirm as the issuer. hold 5 seconds, mouse still, on
the transaction result directly under the button. this lights the "protocol owned" card at
the top of the page. **scroll choreography, same pattern as block B:** one continuous, smooth
scroll up, roughly 2 seconds, no stopping halfway; once "protocol owned" is centred and live,
stop and hold **6 seconds minimum, static**.

**read-back, same shot or immediately after:** `getCouponRateType()` returns `2`. hold 4
seconds on this value, legible, wherever the panel shows it.

### step 3. run the engine

click **"run the engine"**. **no MetaMask popup — no wallet, no signature, no gas.** select
the "q2 filing, covenant headroom" fixture first, if it is not already selected. hold 5
seconds on the result: `verdict pass, kpi 2.00x, rate 6.00%`, and the line naming the exact
value the next step will post — `"600" at 4 decimals`. this is the thread section 4 of
`docs/video-script.md` pulls on: the number on screen here is the number that lands on chain
at step 4, with no person retyping it in between.

### step 4. post the rate

click **"post the rate"**. confirm as the issuer. hold **6 seconds minimum** on the HashScan
link, and once it loads, find and hold on the `RateUpdated` event in the log — the on-chain
evidence that `600` at `4` decimals now in storage came from this transaction. this lights
the "engine priced" card. scroll choreography: one continuous, smooth scroll up, roughly 2
seconds, no stopping halfway; hold **6 seconds minimum, static** on the card and its rate
detail once centred and live.

### step 4b. offer the token a rate it did not ask for, and watch it refuse — added after this document's first draft, and it is the strongest shot in this block

**not in the original plan.** it exists because the console that shipped built it as its own
step, and it converts the FIXED mechanism from something the narration asserts into something
the token visibly does on screen — the same argument that made the forced, reverted transfer
the lead frame of block B's compliance section.

click **"offer a rate and read the refusal"**. **no MetaMask popup — this is the point, same
as block B step 5.** it is an `eth_call`, twice, no signature, no gas, no state change:

- first, `setCoupon` carrying a rate of `6` at `2` decimals, marked SET — a rate chosen for
  this call and nothing else, deliberately different from the `600` at `4` decimals actually
  in storage, so the refusal cannot be read as the token merely echoing back whatever number
  it is handed.
- second, the identical call carrying the pending triplet, `rate 0, rateDecimals 0,
  rateStatus PENDING`.

**no scroll for this step.** unlike every other landing in this block, the whole proof sits in
one static panel directly under the button — keep it tight, there is nowhere useful for a
scroll to go.

1. hold **4 seconds, static**, on the offered-rate line as it renders: `offered rate 6 at 2
   decimals, rateStatus SET`.
2. directly below it, the red panel: **"the token refused our rate"**, the decoded revert
   `InterestRateIsFixed()`, and the raw revert data. hold **4 seconds, static** — the same
   red-panel visual language as block B's blocked-transfer card, deliberately: a caller hands
   the token something it will not take, and the token says so by name.
3. without a click, the control line directly beneath: *"the identical call with rate 0 and
   rateStatus PENDING simulates cleanly. the rate is the only difference."* hold **3 seconds,
   static**.

total for the shot: roughly 11 seconds, no MetaMask, no gas, no HashScan link — the same
category as block B step 5, the one shot in that block with nothing to fall back on if the
recorder missed it. **catch it live.**

**the proof this sets up, paid off two steps later.** step 4 just wrote `600` at `4` decimals
into the token's storage. this step shows the token refusing anything else offered in its
place. step 5 sends the token nothing — `rate "0", rateStatus PENDING` — and the token stamps
`600` onto the coupon anyway, read from its own storage. nobody on either side of the camera
names `600` a second time after step 4. the read-back panel after step 9, "what we sent, and
what the token stamped," is where that pairing becomes visible on screen rather than only
asserted — see the note there.

### step 5. declare the coupon

click **"declare the coupon"**. confirm as the issuer. fields sent: `rate "0"`, `rateStatus
PENDING`. the other required fields (`recordTimestamp`, `executionTimestamp`,
`startTimestamp`, `endTimestamp`, `fixingTimestamp`) follow the ordering constraints in
`specs/05-coupon-rate-surface.md` §3 — a correctness concern gamma owns, not a video concern;
the values were known-good before this was filmed.

hold 5 seconds on the HashScan link and the transaction result. this lights the "stamped"
card — the read-back resolves live, since `CouponRateDispatch` dispatches on the rate type in
storage at read time. scroll choreography: one continuous, smooth scroll up, roughly 2
seconds, no stopping halfway; hold **6 seconds minimum, static** once "stamped" is centred and
live, showing `600 at 4 decimals, status SET` on the card.

**actual capture:** `0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1`.

### step 6. trigger scheduled tasks

click **"trigger scheduled tasks"**. confirm as the issuer. `setCoupon` queues a snapshot at
the record date; this call drains the queue and needs no role. no dedicated narration line,
quick cut. hold 3 seconds.

**actual capture:** `0x7738f48b23aa9ae53132b28332addde8c09836311b9b43541644629af83576b0`.
final snapshotId: 1.

### step 7. grant the maturity manager role

click **"grant maturity manager"**. confirm as the issuer. `ROLE_MATURITY_MANAGER` is missing
from the SDK's role enum, so this grant goes through a raw hex literal, not `applyRoles` —
`BUG.md` B7, worth one sentence of narration if the edit has room, otherwise a quick cut. hold
3 seconds.

**actual capture:** `0x4a2c16f1eae577af8168de86b6942f2360dd6ba983cde39133efd8bb9fc0568d`.

### step 8. compress maturity

click **"compress maturity"**. confirm as the issuer. hold 5 seconds on the HashScan link.
**this step moves the note's maturity from 2029 to 2026-09-10 16:55, permanently.** read the
token-name decision in `docs/video-script.md`, immediately after its section 2, before
deciding whether this step's footage appears in the final cut and what frame it is shown in —
do not improvise that call on the day.

**actual capture:** `0x98e9a148cef1403825421a52f9f8f26571b553b20b9d3cf75a6596e4bcbb4b33`.

### step 9. pay the coupon

click **"pay the coupon"**. confirm as the issuer. **say on camera, or make sure the console
copy is legible:** this is not an ATS operation. `ICoupon` declares no payment method; this is
a plain HBAR value transfer, one per holder, at a stated demo scale. hold 5 seconds.

**actual capture:** `0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404`.

### after step 9. "what we sent, and what the token stamped" — the pairing worth its own thirty seconds

this panel renders itself once a coupon exists, no click needed, no scroll needed — four lines
in one frame:

- engine output: `6.00%, raw 600 at 4 decimals`
- what we sent with the coupon: `rate "0", rateDecimals 0, rateStatus PENDING`
- token rate storage, `getRate()`: `600 at 4 decimals, 6.00%`
- stamped on the coupon: `600 at 4 decimals, 6.00%, status SET`
- match, live in emerald: `the stamped rate equals the engine's rate, to the raw integer and
  the decimals`

hold **6 seconds minimum, static**, on this table. this is the on-screen version of the claim
that `600` was never named twice — it does not need narration to carry the point alone once
this panel is in frame; it just needs the camera to hold on it.

**the `getCouponFor` read-back that follows this table in an earlier draft is cut from the
video in the current recut** (`docs/video-script.md` §4, "what was cut and what it costs") —
still worth capturing for completeness, but the stamped table above already carries the
stronger version of the same claim, so the editor does not need this clip to land the point.

### what must be visible somewhere in this block's footage, not necessarily all at once

- the three verdict cards ("protocol owned" / "engine priced" / "stamped") each reached by
  the scripted scroll, transitioning from idle grey to live colour
- step 4b's own panel, on screen with no scroll — the offered rate, the refusal by name, and
  the control call that passes, all three legible together, since this step has no HashScan
  link to fall back on if the recorder missed it
- the "what we sent, and what the token stamped" table, at least once, all four lines
  legible together

---

## block E. the collateral hold. two holds, one released, one executed. **shot.**

recorded and signed on testnet, one continuous take, both holds, both mid-recording account
switches executed as scripted. this is the item that closes the project: every flow this
document promises now has a real transaction behind it.

| step | what | signer | evidence |
|---|---|---|---|
| A1 | `createHoldByPartition`, hold A | note holder `0.0.10444395` | `0x46c5fbaa4c88d04f53cbdaeb36979a7d8b6c6c2609beef9d3807b28d15cc919d` |
| A2 | `releaseHoldByPartition`, hold A | engine/escrow `0.0.10445014` | `0x224eb5384684e450039153eeb521bbb39ac9aabe5edc1d34d4a86f5634ed09e0` |
| B1 | `createHoldByPartition`, hold B | note holder `0.0.10444395` | `0xea01d72c1c3f13b06be59b2c2e2219a9ead90e9da61cee56f3fca3d733647800` |
| B2 | `executeHoldByPartition`, hold B | engine/escrow `0.0.10445014` | `0xed43e199b78b21069f6bd0f5536cf2c42b3ad34ddb5d211de69407c32ba490c5` |

**pending confirmation from argus, not yet in `EVIDENCE.md` on that basis** — do not treat
this table as final on that front, same caveat as block C's table above. this file records
what iris was told for shot-marking purposes; `EVIDENCE.md` is the file of record.

final state as reported: note holder 250.00 to 150.00, lender 0 to 100.00, supply unchanged.
step B2 was signed by the engine account `0.0.10445014` — neither the agent `0.0.10424387`
nor the lender `0.0.10444404` — and the contract would have reverted `IsNotEscrow` for either
of those. that revert-shaped negative space is not on tape, but the escrow field on hold B and
the signer of step B2 being the same, uninvolved third account is, and that is the claim this
block exists to prove.

**screen:** `http://localhost:3007/transactions`, "block E, collateral hold" tab — this is now the
**default tab** on the console page, so no tab click is needed to reach it, unlike block B and
block C above. the panel (`app/transactions/block-e-panel.tsx`) shares the same layout as block B
and block C — two outcome cards ("released" / "executed") pinned at the top of the page, the
step sections well below them, plus a "prerequisites" panel and a "state read back" panel
further down still. **the same above-the-fold problem applies here too, scripted below rather
than left for the day.** if it is not this exact panel by shoot day, adapt only the click
target.

**this block needs two account switches mid-recording**, which block B and block C do not.
say the account out loud before every single confirm in this block without exception — this
is the rule in `docs/capture-protocol.md` and it matters more here than anywhere else in the
shoot, because a wrong-account click produces `IsNotEscrow`, a real revert, on a signature
that cannot be cheaply redone.

**recorder starts before hold A's first click and does not stop until hold B's execute
transaction is on HashScan.** one continuous take for the entire block, both holds.

### hold A. create, then release.

**account: note holder `0.0.10444395`.** connect, say the account out loud.

**step A1. `createHoldByPartition`.** fields: escrow = the engine's account
`0.0.10445014`, target = the lender `0.0.10444404`, amount = whatever the console pre-fills
or the demo has settled on (check `EVIDENCE.md` before filming; do not invent a number on
camera). confirm as the note holder.

hold 8 seconds on the transaction result and the HashScan link. **get the `escrow` field
value visible in the same shot if the console shows a read-back of the hold's own data** —
`0.0.10445014`, a different account from the issuer `0.0.10424387`, is the on-screen proof of
the escrow separation `DECISIONS.md` D5 is built around.

**switch MetaMask to the engine/escrow account `0.0.10445014`.** say "signing as engine
escrow, account 0.0.10445014" before confirming the next step. this switch is visible in
frame — do not cut away during the MetaMask account switcher UI, let it show which account is
being selected.

**step A2. `releaseHoldByPartition`.** confirm as the escrow account.

hold 8 seconds, mouse still, on the transaction result and the HashScan link directly under
the button. this lights the "released" card at the top of the page. **scroll choreography,
same pattern as blocks B and C:** one continuous, smooth scroll up, roughly 2 seconds, no
stopping halfway; once "released" is centred and live, stop and hold **6 seconds minimum,
static** on the card and its detail line naming the escrow account, not the issuer.

### hold B. create, then execute. the strongest single shot in the video.

**switch MetaMask back to the note holder `0.0.10444395`.** say the account out loud.

**step B1. `createHoldByPartition`**, identical parameters to step A1: escrow =
`0.0.10445014`, target = `0.0.10444404`. confirm as the note holder.

hold 6 seconds on the transaction result and the HashScan link.

**bridge — cut from the video in the current recut** (`docs/video-script.md` §6, "what was cut
and what it costs"). the earlier plan was a no-signature cutaway to the "q3 filing, covenant
breached" fixture's engine output — net leverage 4.50x, coupon rate 12.00 percent, verdict
**breach** — before the escrow account switch. section 5 already shows the engine computing a
verdict once; the current cut judges a second showing of a fixture affordable to lose ahead of
the length limit, and carries the breach in one line of narration instead ("this quarter's
filing shows a covenant breach"). if a future cut has room again, the cutaway is still the
right shot to reach for first — it is not wrong, only cut for time.

**switch MetaMask to the engine/escrow account `0.0.10445014`.** this is the single
highest-stakes click in the entire shoot — see the risk note below. say "signing as engine
escrow, account 0.0.10445014" out loud, clearly, before confirming. pause half a second after
selecting the account in MetaMask's own UI to visually confirm the correct address is shown
before clicking confirm — this is worth the half second, the alternative is a wasted
signature on the one hold instrument the video's climax depends on.

**step B2. `executeHoldByPartition`.** confirm as the escrow account.

**this is the shot. hold on it longer than anything else in the video.** the console's own
"executed" card goes live at the top of the page the moment the transaction lands — capture
that too, briefly, before the HashScan climax: hold 4 seconds, mouse still, on the transaction
result under the button, then one continuous smooth scroll up, roughly 2 seconds, no stopping
halfway, and hold **4 seconds, static**, on the red "executed" card and its detail line naming
the escrow, not the agent.

then the main event. open the HashScan link in a new tab while the recorder is still rolling,
per capture-protocol.md. minimum 12 seconds static once the transaction confirms, on the
HashScan transaction page, then a slow scroll through the event log to find and hold on the
transfer event showing the collateral moving to the lender `0.0.10444404`. total for the
HashScan portion alone: **15-18 seconds**, more than any other individual result shot in the
entire shoot list — this is deliberate, per `docs/video-script.md`, this is the peak of the
video and the pacing should feel like it. total for the whole step, console card plus
HashScan: roughly **25-30 seconds**.

### what must be visible somewhere in this block's footage

- the `escrow` field on at least one hold, reading `0.0.10445014`, distinct and legible from
  the issuer `0.0.10424387` — this is the on-screen proof of the whole "the engine decides,
  not the agent" claim
- the MetaMask account switcher UI, visibly, at least twice — once note holder to escrow,
  once escrow back to note holder (or however many switches the actual take needs) — because
  a viewer who does not see the switch has no reason to believe two different accounts are
  actually involved
- both HashScan links, hold A's release and hold B's execute, each fully loaded with status
  **success** in frame
- the "released" and "executed" outcome cards each reached by the scripted scroll above, not
  a cutaway — held static once in frame, per the durations in each step

---

## the single riskiest moment across all three blocks, named plainly

**landed clean.** both account switches in block E happened without a wrong-account revert;
the execute signature came from `0.0.10445014` on the first take. the warning below stays in
this document unedited because it is still the correct account of why the moment was
dangerous, and because a retake — a second engine-console pass, a reshoot for a cutaway, or a
future extension of this block — carries the identical risk on the identical click.

`docs/capture-protocol.md` already flags it in general terms: *"`IsNotEscrow` and similar
reverts happen because the wrong account was connected."* block E is where this stops being a
general warning and becomes the specific risk of the shoot.

**the moment:** switching MetaMask from the note holder `0.0.10444395` to the engine escrow
`0.0.10445014` immediately before confirming hold B's `executeHoldByPartition`.

**why it is the worst place for this mistake to happen, specifically:**
- it is the last signature in the block, so any recovery costs redoing everything before it
  in that take, not just the one click
- `docs/video-script.md` D15's plan is **two** holds, not three — there is no pre-built third
  hold instrument to fall back on if this one is burned by a wrong-account revert. recovering
  means a fresh `createHoldByPartition` (a new signature, and depending on remaining supply,
  possibly a fresh issuance), not a retry of the same transaction
- it is also, per this document's own instruction above, the shot the video holds longest on
  and builds the most narrative weight toward — a failure here is not just a wasted
  transaction, it is the loss of the video's climax

**the mitigation, already written into the block E shot list above and worth repeating
here:** say the account out loud, pause after MetaMask's account switcher shows the selected
address, confirm the address matches `0.0.10445014` by eye before clicking confirm. this is
the one click in the entire shoot where "say the account out loud" from
`docs/capture-protocol.md` is not a nice-to-have habit, it is the difference between the
video having its intended ending or not.
