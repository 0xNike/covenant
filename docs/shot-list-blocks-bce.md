# shot lists: blocks B, C, E

owner: iris. companion to `docs/video-script.md`, which tells the story; this file tells hao
exactly what to click, in what order, with which MetaMask account connected, and how long to
hold each result on screen. read `docs/capture-protocol.md` first — every rule in it applies
to all three blocks below without restatement: recorder starts before the block's first click
and stays on until the gate closes, say the account out loud before every confirm, HashScan
opens while the recorder is still running.

block B's UI exists today (`app/block-b-panel.tsx`) and every step below is copied from its
actual button labels and step numbers, not guessed. block C and block E do not have a console
built yet at the time this is written. their shot lists describe the exact on-chain call, the
signer, and what must be legible on screen; if the eventual UI is not a numbered-step panel
like block B's, adapt only the click target, never the sequence, the account, or the required
on-screen values.

---

## block B. compliance. nine steps.

**screen:** `http://localhost:3007`, "block B, compliance" tab (the default tab).
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

what must be in frame, held for a minimum of **8 seconds, static, no scroll**:
- the "blocked" verdict card at the top of the page, now live (red)
- the error text in the step's own result panel: `SDK refused before submitting: ...`
- the "the token's own answer, canTransferByPartition" panel below, showing `allowed: false`
  and the reason word

this produces no HashScan link. per capture-protocol.md, this is the one shot with **no
transaction to fall back on if the recorder was not rolling** — the console state is the
entire evidence. if this state is not captured live, it cannot be recovered by replaying
anything on HashScan afterward.

### step 6. force it on chain — optional, droppable

click **"force it on chain"**. MetaMask will show a warning that the transaction is likely to
fail. **confirm anyway.** this is expected to revert.

hold 6 seconds on the result: `refused on chain: ...` and the HashScan link. click the
HashScan link, let it load, hold 4 more seconds on the reverted transaction status.

**if this step misbehaves on the day** (succeeds when it should not, or the wallet blocks the
send entirely), **drop it and move straight to step 7.** the video's blocked-transfer shot
(step 5) already carries the evidence on its own; step 6 is a bonus HashScan link, not a
load-bearing one. do not spend more than one retry on it.

### step 7. grant kyc to the note holder — second of the four shots that matter

click **"grant kyc to the note holder"**. confirm as the issuer. say "signing as issuer,
account 0.0.10424387" before confirming.

hold 6 seconds on the result line and the HashScan link. the "granted" verdict card at the
top should now be live (amber) — get it in frame too, either in the same shot or a 2-second
cutaway immediately after.

### step 8. grant kyc to the lender

click **"grant kyc to the lender"**. confirm. hold 4 seconds. this grant is needed for block
E later (`executeHoldByPartition` requires the lender to be identified), not for the transfer
story in this block. quick cut, no dedicated narration line in the script.

### step 9. transfer again — third of the four shots that matter

click **"transfer again"**. confirm as the issuer. hold on the result **for a minimum of 8
seconds**: the success line, the HashScan link, and the "permitted" verdict card at the top
now live (emerald).

**immediately after this lands:** open the HashScan link in a new tab while the recorder is
still running, per capture-protocol.md. hold 5 seconds on the HashScan transaction page
before stopping the recorder.

### what must be visible somewhere in this block's footage, not necessarily all at once

- the three verdict cards (blocked / granted / permitted) each transitioning from idle grey
  to their live colour — this is a two-second, high-value cutaway available after steps 5, 7
  and 9 respectively
- the "state read back off chain" panel's per-account table, at least once, showing the note
  holder's kyc status flip from a red status to `GRANTED`

---

## block C. coupon and rate.

**screen:** the block C console once built (expected as a third tab alongside "block A,
issuance" and "block B, compliance", following the same pattern — numbered steps, a button
per step, a HashScan link per result). if it does not exist as a tab-panel by shoot day, use
whatever interface fires these exact calls; the sequence, signer and required on-screen
values below are unchanged either way.

**account for every step in this block:** issuer `0.0.10424387`. same account as block B,
same warning applies if the wrong one is connected.

**one continuous recording for the whole block**, per capture-protocol.md, from before the
first signature to the HashScan link for the last one.

### prerequisite. grant `ROLE_INTEREST_RATE_MANAGER`

confirm as the issuer. one `grantRole` transaction. hold 3 seconds. needed for both
`setCouponRateType` and `FixedRate.setRate` below — one grant covers both.

no dedicated narration line; this can be a quick cut in the edit, but do not skip filming it.

### step 1. `setCouponRateType(FIXED)`

this is a direct ethers call through `IAsset__factory`, not an SDK port call — see
`specs/05-coupon-rate-surface.md` §1. it is not exposed in `port/in`, so whatever console
control triggers it is our own code, not a stock SDK method with a matching button in the ATS
reference app.

**this must happen before step 4 (`setCoupon`) in this block, and before any coupon has
already been set on this token.** if a coupon already exists on this token from an earlier
take, do not run this step against it — re-verify against `EVIDENCE.md` before filming.

confirm as the issuer, value `2` (FIXED). hold 5 seconds on the transaction result.

**read-back, same shot or immediately after:** call `getCouponRateType()` and show it returns
`2`. hold 4 seconds on this value, legible. this read-back is the on-screen proof the switch
took effect — the narration in `docs/video-script.md` §4 depends on this being visible, not
merely asserted.

### step 2. grant `ROLE_CORPORATE_ACTION`

confirm as the issuer. one `grantRole` transaction, needed for `setCoupon` in step 4. hold 3
seconds. quick cut, no dedicated narration.

### step 3. `FixedRate.setRate(rate, decimals)`

**the value to enter is `600` at `4` decimals.** this is not a placeholder — it is the exact
output of `rateForKpi` for the "q2 filing, covenant headroom" fixture's net leverage of
2.00x (`lib/ats/note-terms.ts`, `lib/engine/fixtures.ts`), and it is what `600 / 10^4 = 0.06`,
6.00 percent, means on screen. if the engine console (`/engine`) has already been used to run
that fixture before this block is filmed, screenshot or note its "post as rate" line
(`600 at 4 decimals, through FixedRate.setRate`) so the value entered here visibly matches
what the engine produced — this is the thread the video's section 4 narration pulls on.

confirm as the issuer. hold **6 seconds minimum** on the HashScan link, and once it loads,
find and hold on the `RateUpdated` event in the log — that event is the on-chain evidence
that the rate now in storage came from this transaction, which is what `setCoupon` will
stamp into the next coupon.

### step 4. `setCoupon`

fill the pending triplet: `rate: "0"`, `rateStatus: 0` (PENDING). the other required fields
(`recordTimestamp`, `executionTimestamp`, `startTimestamp`, `endTimestamp`,
`fixingTimestamp`) follow the ordering constraints in `specs/05-coupon-rate-surface.md` §3 —
this is not a video concern, it is a correctness concern gamma owns; by the time this is
filmed the values should already be known-good from a prior non-recorded dry run, not worked
out live on camera.

confirm as the issuer. hold 5 seconds on the HashScan link and the transaction result.

### step 5. read the coupon entitlement

a view call, no wallet popup: `getCouponFor` (or the console's equivalent read) for a holder
account, showing an amount is now computed. hold 5 seconds.

**say on screen, in the console copy or in the narration, not just in this document:** this
is a declared entitlement, not a payment. there is no transfer here. if the console has no
copy making this explicit, the narration in `docs/video-script.md` §4 carries it instead —
either way, do not let this shot look like money moved, because it did not.

---

## block E. the collateral hold. two holds, one released, one executed.

**screen:** the block E console once built, same caveat as block C — if it is not a
dedicated panel by shoot day, adapt only the click target.

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

hold 8 seconds on the transaction result and the HashScan link.

### hold B. create, then execute. the strongest single shot in the video.

**switch MetaMask back to the note holder `0.0.10444395`.** say the account out loud.

**step B1. `createHoldByPartition`**, identical parameters to step A1: escrow =
`0.0.10445014`, target = `0.0.10444404`. confirm as the note holder.

hold 6 seconds on the transaction result and the HashScan link.

**bridge, no signature, this is a narration beat not a click:** if the confidentiality
reveal footage exists (block D / the `/engine` console), a quick cutaway to the "q3 filing,
covenant breached" fixture's engine output — net leverage 4.50x, coupon rate 12.00 percent,
verdict **breach** — sets up why this hold resolves differently from hold A's. hold 4-5
seconds. if that footage does not exist yet or does not fit the edit, skip the cutaway and
let the narration alone carry the "this one defaults" framing; do not fabricate a screen that
was not filmed.

**switch MetaMask to the engine/escrow account `0.0.10445014`.** this is the single
highest-stakes click in the entire shoot — see the risk note below. say "signing as engine
escrow, account 0.0.10445014" out loud, clearly, before confirming. pause half a second after
selecting the account in MetaMask's own UI to visually confirm the correct address is shown
before clicking confirm — this is worth the half second, the alternative is a wasted
signature on the one hold instrument the video's climax depends on.

**step B2. `executeHoldByPartition`.** confirm as the escrow account.

**this is the shot. hold on it longer than anything else in the video.** minimum 12 seconds
static once the transaction confirms, on the HashScan transaction page, then a slow scroll
through the event log to find and hold on the transfer event showing the collateral moving to
the lender `0.0.10444404`. total for this single result: **15-18 seconds**, more than any
other individual result shot in the entire shoot list. this is deliberate — per
`docs/video-script.md`, this is the peak of the video and the pacing should feel like it.

**immediately after:** open the HashScan link in a new tab while the recorder is still
rolling, per capture-protocol.md, before stopping the recorder.

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

---

## the single riskiest moment across all three blocks, named plainly

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
