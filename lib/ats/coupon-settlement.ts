"use client";

// covenant block C, the settlement leg.
//
// -----------------------------------------------------------------------------
// READ THIS BEFORE USING ANYTHING IN THIS FILE
// -----------------------------------------------------------------------------
// **nothing in this file is an ATS operation, and no copy anywhere may imply
// that ATS paid anybody.**
//
// the coupon facet contains no transfer. the full `ICoupon.sol` interface
// declares four writers, `setCoupon`, `cancelCoupon`, `forceCancelCoupon` and
// `initializeCoupon`, and no payment method. `getCouponFor` and
// `getCouponAmountFor` are `view`: they compute what a holder is owed, as a
// numerator and a denominator, and move nothing. a grep of
// `contracts/facets/coupon/` for `pay` and `transfer` returns doc-comment prose
// and no function.
//
// so ATS does the part that is hard to do honestly off chain: it fixes the
// holders of record at a snapshot, and makes each holder's entitlement a public,
// recomputable read. paying it is left to whatever settles cash for the issuer,
// which in a real facility is a bank wire and here is this file.
//
// the console must show these as two things, because they are two things. the
// coupon is a declaration by the token. the payment is a transfer by the agent.
//
// -----------------------------------------------------------------------------
// the unit problem, stated rather than hidden
// -----------------------------------------------------------------------------
// the entitlement is denominated in the note's nominal currency, USD, because
// the nominal value is 1000.00 per note. testnet HBAR is not USD and there is no
// exchange rate involved anywhere in this project.
//
// so the payment is the entitlement divided by a **stated demo scale**, printed
// next to every payment, and it exists so that a viewer sees value move in
// proportion to what the token computed. it is not a price, not a conversion and
// not a claim about what HBAR is worth. the alternative, paying a round number
// nobody derived, would look tidier on screen and mean less.

import { ethers } from "ethers";
import type { CovenantConfig } from "@/lib/config";
import { requireSigner, type TxResult } from "@/lib/ats/compliance";

/**
 * an entitlement as ATS reports it, and what we will pay against it.
 *
 * `numerator` and `denominator` are exactly the pair returned by
 * `getCouponAmountFor`. they are kept whole rather than pre-divided so the
 * console can show the fraction the token computed and the decimal it works out
 * to, and a reader can check one against the other.
 */
export interface Settlement {
  label: string;
  evm: string;
  numerator: string;
  denominator: string;
  /** the entitlement in the note's nominal currency, to `dp` places */
  amount: string;
  /** what will actually be sent, in HBAR, at the stated scale */
  hbar: string;
  /** true when this holder is the paying account, so no transfer is made */
  isSelf: boolean;
}

/** entitlement as a decimal string. integer arithmetic, no float anywhere. */
export function amountFromFraction(
  numerator: string | bigint,
  denominator: string | bigint,
  dp = 6,
): string {
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  if (d === BigInt(0)) return "0";
  const scale = BigInt(10) ** BigInt(dp);
  return ethers.formatUnits((n * scale) / d, dp);
}

/**
 * turns entitlements into payments at a stated scale.
 *
 * `scale` is how many units of coupon one HBAR stands for in the demo. it is
 * carried through to the console and printed beside every figure. self-payment
 * is dropped rather than sent: the issuer holds the unsold notes and would
 * otherwise pay itself, which is noise on the ledger and confusing on screen.
 */
export function buildSettlements(
  holders: {
    label: string;
    evm: string;
    numerator: string;
    denominator: string;
  }[],
  payerEvm: string,
  scale: number,
): Settlement[] {
  return holders.map((h) => {
    const amount = amountFromFraction(h.numerator, h.denominator);
    const hbar = (Number(amount) / scale).toFixed(8);
    return {
      ...h,
      amount,
      hbar,
      isSelf: h.evm.toLowerCase() === payerEvm.toLowerCase(),
    };
  });
}

export interface SettlementResult extends TxResult {
  label: string;
  evm: string;
  hbar: string;
}

/**
 * pays each holder of record, one transfer each, from the agent's own account.
 *
 * a plain value transfer. no contract, no ATS call, no token movement. the
 * agent signs each one in the wallet exactly as it would authorise a payment
 * run, and each lands on hashscan as what it is.
 *
 * payments are sent one at a time on purpose. a wallet queues concurrent
 * signature prompts in an order the user cannot predict, and this operation is
 * filmed.
 */
export async function payCouponsInHbar(
  cfg: CovenantConfig,
  settlements: Settlement[],
  onHash?: (hash: string, label: string) => void,
): Promise<SettlementResult[]> {
  const signer = await requireSigner(cfg.accounts.issuer.evm);
  const out: SettlementResult[] = [];

  for (const s of settlements) {
    if (s.isSelf) continue;
    const value = ethers.parseEther(s.hbar);
    if (value === BigInt(0)) {
      out.push({
        label: s.label,
        evm: s.evm,
        hbar: s.hbar,
        hash: "",
        success: false,
        note: "the entitlement rounds to zero at this scale. nothing was sent.",
      });
      continue;
    }
    const tx = await signer.sendTransaction({ to: s.evm, value });
    onHash?.(tx.hash, s.label);
    const receipt = await tx.wait();
    out.push({
      label: s.label,
      evm: s.evm,
      hbar: s.hbar,
      hash: tx.hash,
      success: receipt?.status === 1,
      note: "cash settlement by the agent. this is not an ATS operation.",
    });
  }

  return out;
}
