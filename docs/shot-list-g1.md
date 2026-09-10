# shot list: g1, captured after the fact

the issuance signature already happened, unrecorded. this is not the issuance shot. it is
the strongest evidence still recoverable from the state that exists: the transaction on
hashscan, the deployed contract on hashscan, and the console reading the live configuration
back off chain. treat this as the g1 footage for the video's opening beat.

```
transaction   0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078
hashscan tx   https://hashscan.io/testnet/transaction/0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078
security id   0.0.10450229
hashscan ctr  https://hashscan.io/testnet/contract/0.0.10450229
console       http://localhost:3007
```

start the recorder before shot 0. do not skip shot 0.

---

## shot 0. bonus, check first, do not disturb it

before touching anything else: find the browser tab that was open when the note was issued.
**do not reload it. do not click anything in it yet.** if it is still open, the green
"issued" box in the console may still show `clearingActive` and `internalKycActivated` read
back off chain. those two flags are readable nowhere else — there is no button in the console
that re-fetches them independently, only the one-time read that happens inside the issuance
call itself. if that tab is gone or has been reloaded, those two values are not recoverable
for this token, and this shot does not exist. do not force it.

if the tab is alive: point the recorder at it, hold 6 seconds on the green "issued" section
with `transaction id`, `security id`, `clearingActive: false`, and
`internalKycActivated: true` all visible in frame. then move to shot 1. if the tab is gone,
skip straight to shot 1 and say nothing about it on the video.

## shot 1. hashscan, the transaction

new browser tab. go to the hashscan tx url above.

what must be in frame:
- the transaction hash at the top
- network badge reading **testnet**
- status: success
- the "from" address — this is the issuer, `0.0.10424387` /
  `0x56a45ef1d79a3a6fd6cfa6b833612705d2edc742`
- the timestamp

hold 8 seconds static on the top of the page. then scroll down once, slowly, through the
logs / contract-created section, then back up. total shot: 15-20 seconds.

this can be the video's opening shot. it satisfies "open on a hashscan transaction inside
twenty seconds" on its own.

## shot 2. hashscan, the contract

same tab or a new one. go to the hashscan contract url above, `0.0.10450229`.

what must be in frame:
- the contract id `0.0.10450229` and its evm address
- any "created by" / linked transaction reference back to shot 1's tx hash, if hashscan
  renders one

hold 6-8 seconds. no scrolling needed unless the page is tall enough that the contract id and
evm address are not both visible at once — if so, one slow scroll to fit both in frame across
the shot.

## shot 3. console, read the configuration back off chain

new tab (or the same one, does not matter — this view does not need the signing tab or a
connected wallet at all). go to `http://localhost:3007`.

no metamask connection needed for this step. do not click "connect wallet" — it adds a wallet
popup to the frame for no reason, since this read is a view call, not a signature.

1. scroll to the section headed **"3. read the rate configuration back"**.
2. click into the text input, type `0.0.10450229`.
3. click **"read back"**.
4. wait for the panel below to populate.

what must be in frame once it populates, hold 10-12 seconds:
- **active config**: should read `bond variable rate (2)` — this is the config actually used,
  see `BUG.md` B1, not the kpi-linked config the token's display name implies
- **operational**: `true`
- the **facet readiness** grid — this is the direct on-screen evidence for B1: the
  kpi-linked-rate facet reads not-ready while the facets config 2 actually carries read ready
- the **notes** block at the bottom of the panel. it will contain a line reading
  "KPI-linked rate not readable on this token... expected when the active configuration is
  not bond kpi-linked rate (4)". **hold on this line specifically.** it is the console
  admitting, on screen, exactly the gap the script needs to say out loud: this token's name
  says kpi-linked, the chain says variable rate, and here is why.

this is also the shot that earns the b1 sentence in the script. do not cut away before the
notes text is legible.

---

## what this sequence does and does not prove

it proves: a real transaction landed on testnet, from the issuer account, deploying a real
contract, and the contract's own configuration read-back matches what `BUG.md` B1 says
happened. it does not show the moment of signing, and the script should not imply that it
does — say plainly that the note was issued via `Bond.create` against the variable-rate
config, per the on-screen read-back, not narrate a signing moment that was not filmed.
