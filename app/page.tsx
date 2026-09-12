// covenant. the front door.
//
// ---------------------------------------------------------------------------
// WHO THIS PAGE IS WRITTEN FOR
// ---------------------------------------------------------------------------
//
// an institutional asset manager. a firm that originates private credit loans
// and sells participations in them, and would like those participations to be
// financeable by their buyers.
//
// that is not the note holder, and the page used to open in the second person,
// "you own a slice of a loan", which seated the reader as the holder. a reader
// in the wrong chair does not translate, they leave. so nothing above the role
// cards says "you", the opening states the whole product in one sentence in the
// third person, and the parties are named: the fund, the note holder, the cash
// lender, the agent bank.
//
// the opening sentence says "published code" and it must not become "attested
// code". we have no attestation: /lender prints "attestation: none. this
// computation is not attested and did not run in an enclave", and the CRE leg
// was cut. published is the property we actually have, because the program is
// published before the facility is struck, so both sides read the test before
// either relies on it. the first sentence of the site cannot claim something a
// page two clicks away denies.
//
// ---------------------------------------------------------------------------
// WHY THE ARGUMENT IS NOT ON THIS PAGE ANY MORE
// ---------------------------------------------------------------------------
//
// this page carried three sections of essay: the state of the market, what is
// wrong with it, and what changes. the argument is good and it is not deleted,
// it is in README.md under "why this exists", with the same figures.
//
// it is not here because a judge reads the argument in the README and the
// writeups, and opens the application to see whether the thing works. an
// application that opens by explaining itself for six hundred words reads as a
// pitch deck with a demo attached. so this page is the product, the live
// figures, and the three doors, and one line pointing at the argument for a
// reader who wants it.
//
// ---------------------------------------------------------------------------
// THE FIGURES
// ---------------------------------------------------------------------------
//
// read off the chain through the same reader /holder uses, not hardcoded, so
// this page cannot drift from the token. if the read fails it says so and still
// renders: a landing page that 500s is worse than one that admits a testnet
// relay is slow, and a landing page that prints a plausible zero is worse than
// both.
//
// ---------------------------------------------------------------------------
// THE TYPOGRAPHY
// ---------------------------------------------------------------------------
//
// prose in the proportional face, every figure and identifier in monospace.
// the page was entirely monospace, which reads as a terminal, and a terminal is
// the wrong register for the first screen shown to a credit investor. monospace
// is kept where it earns its keep: account ids, token ids, amounts, and the
// section labels, which are navigational rather than prose.
//
// no accent colour anywhere on this page. the only colour in the application is
// the three covenant states on /lender and /engine, and it means something
// there. spending it here on decoration would spend it.

import type { Metadata } from "next";
import Link from "next/link";
import DisclosureDiagram from "./disclosure-diagram";
import { readHolderPosition } from "./holder/read-position";

export const metadata: Metadata = { title: "covenant" };

export const dynamic = "force-dynamic";

// third person throughout. `who` is the party, `line` is their position in the
// facility, `example` is the kind of institution that actually sits in that
// chair, and `sees` is what their view renders. the three names here are the
// same three in the site navigation, on purpose: a reader should meet the set
// twice and have it reinforce rather than compete.
//
// `example` is an institution type and never a named firm. a named firm implies
// a relationship this project does not have, and the type places a reader
// faster anyway. it comes before `sees` because who you are should land before
// what you get.
//
// the cash lender's desk is called a fund-financing desk here, which is what
// such a desk is genuinely called and avoids the term CLAUDE.md §8 bans in its
// finance sense.
const ROLES = [
  {
    href: "/holder",
    who: "note holder",
    line: "owns a slice of the loan, and wants cash without selling it",
    example: "a pension fund or family office holding a $1m slice",
    sees: "the position, and the pledge that raises cash against it",
  },
  {
    href: "/lender",
    who: "cash lender",
    line: "advances that cash, with no right to the borrower’s books",
    example: "a bank’s fund-financing desk",
    sees: "the verdict and the advance rate, never the figures behind them",
  },
  {
    href: "/engine",
    who: "agent",
    line: "holds the borrower’s figures, and no longer decides the number",
    example: "the administrative agent on the facility",
    sees: "the figures going in, the decision coming out",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-t border-zinc-200 pt-3 font-mono text-xs tracking-[0.12em] text-zinc-500 dark:border-zinc-800">
      {children}
    </h2>
  );
}

export default async function Landing() {
  const env = await readHolderPosition();
  const p = env.ok ? env.position : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      {/* the opening. one sentence, the whole product, before anything else. */}
      <h1 className="max-w-[44ch] text-2xl leading-snug tracking-tight text-balance sm:text-[1.75rem]">
        covenant makes a private credit note financeable for a lender who is
        not entitled to see the borrower&rsquo;s books. the collateral
        valuation moves out of an agent bank&rsquo;s judgement and into
        published code.
      </h1>

      {/*
        "its" and "it" refer back to the note in the sentence above, so this
        line introduces no new noun. it said "a participation" and then "a
        slice", and both had the same defect: a term whose defining sentence
        this pass cut.

        "sell it or wait three years" names both bad options a holder actually
        faces. the honest fallback today is not waiting, it is selling at a
        discount, and a credit reader recognises that instantly. do not trim
        that clause for length.
      */}
      <p className="mt-6 max-w-[62ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
        its holder can borrow against it rather than sell it or wait three
        years. the case is in the{" "}
        <a
          className="underline underline-offset-2"
          href="https://github.com/0xNike/covenant#why-this-exists"
        >
          README
        </a>
        .
      </p>

      <div className="mt-12">
        <DisclosureDiagram />
      </div>

      {/*
        the two words a reader has to carry to every other page, defined once
        here so nothing later needs translating: the advance rate is what is
        lent, the haircut is what is held back, and they are one number.
        "leverage" is deliberately not used. it was defined by the situation
        paragraph this pass cut, and a developer reading asynchronously cannot
        translate up to it, while a credit reader translates down from the plain
        wording instantly.
      */}
      <p className="mt-6 max-w-[62ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
        the advance rate is the percentage of the note a lender will lend
        against, and the haircut is the rest. it is a published function of what
        the borrower owes against what it earns, so a lender can recover that
        one ratio and none of the five figures behind it.
      </p>

      <section className="mt-14">
        <SectionLabel>three parties, three views</SectionLabel>
        <ul className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {ROLES.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="group grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6"
              >
                <div className="font-mono text-sm group-hover:underline">
                  {r.who}
                </div>
                <div className="max-w-[52ch] leading-relaxed">
                  <div>{r.line}</div>
                  <div className="mt-1 text-zinc-600 dark:text-zinc-400">
                    <span className="font-mono text-xs text-zinc-500">
                      for example{" "}
                    </span>
                    {r.example}
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    <span className="font-mono text-xs text-zinc-500">
                      sees{" "}
                    </span>
                    {r.sees}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <SectionLabel>what is live</SectionLabel>
        {p ? (
          <dl className="mt-4 space-y-3">
            {[
              ["note", `${p.token.name} (${p.token.symbol})`],
              ["token", p.token.id],
              ["network", `hedera ${p.network}`],
              ["in issue", `${p.token.totalSupply} notes`],
              [
                "held by the note holder",
                `${p.notes.held} notes, ${p.notes.sharePercent} of the issue, at ${p.holder.id}`,
              ],
              // the lifecycle as a row of states rather than a sentence about
              // them. it is a list of things that happened, and a paragraph
              // was spending forty words to say what eight say here.
              [
                "run so far",
                "issued, transfer refused, compliance granted, transfer settled, coupon priced, pledged, released, seized",
              ],
            ].map(([k, v]) => (
              <div
                key={k}
                className="sm:grid sm:grid-cols-[11rem_1fr] sm:gap-6"
              >
                <dt className="font-mono text-xs text-zinc-500 sm:pt-0.5">
                  {k}
                </dt>
                <dd className="font-mono text-sm tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 max-w-[62ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
            the chain read did not come back: {env.ok ? "" : env.error} the
            views above read the same live state and will say the same thing
            until it does.
          </p>
        )}
        <p className="mt-6 max-w-[62ch] font-mono text-sm text-zinc-500">
          every hash in{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/0xNike/covenant/blob/main/EVIDENCE.md"
          >
            EVIDENCE.md
          </a>
          , signed through{" "}
          <Link className="underline underline-offset-2" href="/console">
            /console
          </Link>
          .
        </p>
      </section>

      <footer className="mt-20 max-w-[62ch] border-t border-zinc-200 pt-5 text-sm leading-relaxed text-zinc-500 dark:border-zinc-800">
        hedera testnet. we deploy no contracts: the note runs on the asset
        tokenization studio&rsquo;s deployed resolver and factory. the engine is
        a local service, not an enclave.
      </footer>
    </main>
  );
}
