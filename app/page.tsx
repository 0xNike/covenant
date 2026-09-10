// covenant. the issuer and agent console.
//
// one page, the blocks in ship order. block A issued the note and is kept
// visible because the read-back is the G1 evidence; block B is the compliance
// leg; block C is the rate and coupon leg; block E is the collateral hold, which
// is where the work is now.

"use client";

import { useState } from "react";
import IssuePanel from "./issue-panel";
import BlockBPanel from "./block-b-panel";
import BlockCPanel from "./block-c-panel";
import BlockEPanel from "./block-e-panel";

type Tab = "e" | "c" | "b" | "a";

export default function Home() {
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
