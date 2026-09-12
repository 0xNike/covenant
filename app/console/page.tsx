// covenant. the operator console.
//
// this is the transaction-level surface. every gate in this project was executed
// through these panels, and they are kept so the calls and their results can be
// read directly rather than taken on our word. the blocks are in ship order:
// A issued the note, B is the compliance leg, C is the rate and coupon leg,
// E is the collateral hold.
//
// the role-shaped views live at /holder, /lender and /engine. this page is the
// evidence surface, not the product.

"use client";

import { useState } from "react";
import IssuePanel from "./issue-panel";
import BlockBPanel from "./block-b-panel";
import BlockCPanel from "./block-c-panel";
import BlockEPanel from "./block-e-panel";

type Tab = "e" | "c" | "b" | "a";

export default function Console() {
  const [tab, setTab] = useState<Tab>("e");

  const button = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={
        "border px-3 py-1 " +
        (tab === id
          ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-400 dark:border-zinc-600")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="font-mono text-sm">
      <nav className="mx-auto flex max-w-4xl gap-2 px-6 pt-6">
        {button("e", "block E, collateral hold")}
        {button("c", "block C, rate and coupon")}
        {button("b", "block B, compliance")}
        {button("a", "block A, issuance")}
      </nav>
      {tab === "e" ? (
        <BlockEPanel />
      ) : tab === "c" ? (
        <BlockCPanel />
      ) : tab === "b" ? (
        <BlockBPanel />
      ) : (
        <IssuePanel />
      )}
    </div>
  );
}
