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
// order after that is fixed: the situation in the market as it stands, what is
// wrong with it, what changes. no term is introduced unless the sentence after
// it uses it.
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
// facility, `sees` is what their view actually renders.
const ROLES = [
  {
    href: "/holder",
    who: "note holder",
    line: "owns a participation and wants cash against it without selling it",
    sees: "the position, what can be borrowed against it, and what happens on default",
  },
  {
    href: "/lender",
    who: "cash lender",
    line: "would advance that cash, and has no right to read the borrower’s books",
    sees: "the verdict and the percentage to advance. the figures behind them, never",
  },
  {
    href: "/engine",
    who: "agent",
    line: "holds the borrower’s filing, and no longer decides the number",
    sees: "the filing going in, and the decision coming out",
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
        covenant makes a private credit note financeable for a lender who may
        not see the borrower&rsquo;s books, by moving the collateral valuation
        out of an agent bank&rsquo;s judgement and into published code.
      </h1>

      <p className="mt-6 max-w-[62ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
        for the fund that originated the loan, that is the difference between a
        participation its buyers must hold to maturity and one they can borrow
        against.
      </p>

      <section className="mt-16">
        <SectionLabel>the situation</SectionLabel>
        <div className="mt-4 max-w-[62ch] space-y-4 leading-relaxed">
          <p>
            private credit is roughly 1.7 trillion dollars of loans held outside
            the banking system. a fund lends to a company and sells
            participations in that loan to pension funds and family offices. a
            participation is a note, and its buyer holds an illiquid claim for
            three years.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            a note holder who wants cash before maturity does not have to sell
            at a discount. it can pledge the note and borrow against it. the
            cash lender on the other side has to set one number: what percentage
            of the note it will advance.
          </p>
        </div>
      </section>

      <section className="mt-14">
        <SectionLabel>what is wrong with it</SectionLabel>
        <div className="mt-4 max-w-[62ch] space-y-4 leading-relaxed">
          <p>
            that percentage depends on the borrower&rsquo;s financials, and the
            lender has no right to see them. so an agent bank reads the books
            and announces a number. nobody else can check it, and the borrower
            pays the agent bank.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            that is the loudest standing criticism of the asset class, not a
            contrivance for a demonstration: the marks are self-reported and
            unverifiable, and the party producing them is never independent of
            the party being marked.
          </p>
        </div>
      </section>

      <section className="mt-14">
        <SectionLabel>what changes</SectionLabel>
        <div className="mt-4 max-w-[62ch] space-y-4 leading-relaxed">
          <p>
            covenant gives that job to a program, published before the facility
            is struck, so both sides read the test before either side relies on
            it. the borrower&rsquo;s filing goes in. two things come out:
            whether the covenant passed, and what percentage of the note to
            advance against it.
          </p>
        </div>

        <div className="mt-8">
          <DisclosureDiagram />
        </div>

        <div className="mt-6 max-w-[62ch] space-y-4 leading-relaxed">
          <p className="text-zinc-600 dark:text-zinc-400">
            the advance rate is a published function of the borrower&rsquo;s
            leverage, so a lender can work back to that one ratio. that is
            intended. leverage is the covenant it agreed to and the thing it is
            lending against. it cannot recover the revenue, earnings, debt or
            cash behind that ratio, because one ratio in several unknowns fixes
            none of them.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            and once the note is pledged, the power to seize it on default sits
            on chain with a named party that is not the agent bank. the token
            refuses the call from anyone else.
          </p>
        </div>
      </section>

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
            views below read the same live state and will say the same thing
            until it does.
          </p>
        )}
        <p className="mt-6 max-w-[62ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
          a full lifecycle has run on this note: issued, a transfer refused for
          want of a compliance grant and then settled unchanged once granted, a
          coupon declared and priced by the token itself, and the note pledged
          as collateral twice, released once and seized once. every transaction
          is listed in{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/0xNike/covenant/blob/main/EVIDENCE.md"
          >
            EVIDENCE.md
          </a>{" "}
          with its hash.
        </p>
      </section>

      <section className="mt-14">
        <SectionLabel>reading the evidence</SectionLabel>
        <p className="mt-4 max-w-[62ch] leading-relaxed">
          every gate in this project was executed through the operator panels at{" "}
          <Link className="underline underline-offset-2" href="/console">
            /console
          </Link>
          . they are kept, unchanged, so the calls and their results can be read
          directly rather than taken on our word. they are the
          transaction-level surface, not the product.
        </p>
      </section>

      <footer className="mt-20 max-w-[62ch] border-t border-zinc-200 pt-5 text-sm leading-relaxed text-zinc-500 dark:border-zinc-800">
        hedera testnet. no contracts deployed by us: the note is issued through
        the asset tokenization studio against its deployed resolver and factory.
        the engine runs as a local service, not in an enclave.
      </footer>
    </main>
  );
}
