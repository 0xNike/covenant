# capture protocol

owner: iris. read this before every block from B onward. it exists because block A's
issuance was signed with nobody recording, and that shot is gone for good. we are not
spending a second token to redo it.

## the rule

**recording starts before the wallet popup, not after the transaction lands.**

every one of the four shots that matter (blocked transfer, kyc grant, permitted transfer,
`executeHoldByPartition`) is a single irreversible signature. there is no retake. if the
recorder is not already rolling when hao clicks the button that opens metamask, the shot is
gone the moment he clicks confirm.

## the default, not a reminder

a reminder that hao has to remember under pressure will fail under pressure. so the fix is
not "iris says start recording" before each step. it is a habit that removes the decision:

**the screen recorder starts once, at the top of each block, and stays on until the block's
gate closes.** not per-transaction. one continuous take per block, covering every setup step,
every misfire, every retry, and every signature in that block. iris cuts the video later.
hao never has to judge in the moment whether *this* click is the one that matters, because
the answer is always yes and the recorder is already running.

concretely, at the start of block B, C, D, E, and the CRE block if it runs:

1. hao opens the screen recorder and starts it, pointed at the browser window and the
   metamask extension popup area.
2. hao says the block name out loud on mic ("block B, compliance") so iris can find the cut
   point later without guessing from timestamps.
3. hao does not stop recording until gamma or hercules confirms the gate's transactions are
   on hashscan, or the block is abandoned for the session.
4. if a take is long and awkward, that is fine. raw footage is cheap. a missing shot is not.

## before every signature, say the account out loud

`IsNotEscrow` and similar reverts happen because the wrong account was connected. saying the
account id before clicking confirm gives iris a clean audio marker for editing and gives
gamma a chance to catch a wrong-account mistake before it becomes a wasted transaction.
say: "signing as [role], account [0.0.x]" before every metamask confirm.

## immediately after a flow lands

per `MASTER_TODO_LIST.md`'s gate ritual, iris captures footage immediately, before polish and
before the next task. "immediately" means: do not close the recorder, do not switch to
argus's verification step, do not let hao move to the next line in the todo list first. the
sequence is landed → hashscan link opens in a new tab while the recorder is still running →
only then does the recorder stop.

## before every take, read the figures the shot depends on

`attempt()` in `lib/ats/diagnostics.ts` swallows a failed contract read into a zero rather than
an error. every "read state off chain" / "state read back" panel in the block A, B, C and E
consoles goes through it. a slow relay can make one of those reads time out and render a
plausible-looking zero next to a figure that is genuinely non-zero — this already happened
once: the landing page showed `in issue 0.00 notes` next to a non-zero holding, traced to one
read that came back after 22 request timeouts. the front page and `/holder` were rewritten
afterward to read chain state directly instead of through the diagnostics module, specifically
to remove this failure mode from those two routes. the console panels at `/transactions` were not
rewritten and still carry the risk.

the chain truth is independently verified in `EVIDENCE.md`, so nothing recorded is ever wrong
in fact — but a wrong figure can still appear on screen during a take, and a viewer watching
the video has no way to know it is wrong from the frame alone. so:

**before each take, read the figures the shot depends on and confirm them against
`EVIDENCE.md` or a direct chain read, before the recorder rolls.** if a panel shows a zero
where a number is expected, stop and re-read rather than filming it — a second `attempt()` call
a few seconds later, once the relay has caught up, is the fix, not filming around the bad
number and hoping the edit does not land on that frame.

**this applies to footage already shot, not just new takes.** blocks B and C are recorded and
their signing moments cannot be re-taken. before cutting that footage into the final edit,
check every diagnostics-backed figure that appears on screen — `totalSupply`, the facet
readiness grid, any KYC-status or balance read inside a "read state" panel — frame by frame
against `EVIDENCE.md`'s numbers for the same moment. see `docs/video-script.md`'s "a filming
risk" section and `docs/shot-list-blocks-bce.md`'s route note for where this applies inside
each block's footage.

## the two things that cannot be recovered if this is skipped

- **an on-chain transaction.** re-doing it costs a new signature and, for issuance or a hold
  creation, a new instrument. every irreversible action is exactly one take.
- **the blocked-transfer error state**, per `TransferCommandHandler.ts:42`. this one produces
  no hashscan link at all — the sdk throws client-side before submitting anything — so the
  console error screen and the `CanTransferByPartition` eth_call returning false *are* the
  entire evidence. if the recorder is not running when gamma attempts the blocked transfer,
  there is nothing to go back and check on hashscan. it has to be caught live.

## one-line summary

the recorder runs continuously from the top of each block to its gate, not per click, so
"start recording before you sign" is never a step hao has to remember.
