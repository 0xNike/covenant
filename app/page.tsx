// covenant. the issuer and agent console.
//
// one page, the blocks in ship order. block A issued the note and is kept
// visible because the read-back is the G1 evidence; block B is the compliance
// leg and is where the work is now.

"use client";

import { useState } from "react";
import IssuePanel from "./issue-panel";
import BlockBPanel from "./block-b-panel";

type Tab = "b" | "a";

export default function Home() {
  const [tab, setTab] = useState<Tab>("b");

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
        {button("b", "block B, compliance")}
        {button("a", "block A, issuance")}
      </nav>
      {tab === "b" ? <BlockBPanel /> : <IssuePanel />}
    </div>
  );
}
