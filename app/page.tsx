// covenant. the front door.
//
// three parties see three different things, and that asymmetry is the product,
// so the landing page is organised by party rather than by feature.
//
// the headline figures are read off the chain through the same reader /holder
// uses, not hardcoded, so this page cannot drift from the token. if the read
// fails it says so and still renders, because a landing page that 500s is worse
// than one that admits a mirror node is slow.
//
// the operator panels moved to /console. they are not hidden, they are framed
// as what they are: the transaction-level surface every gate was executed
// through, kept so the calls can be read directly rather than taken on trust.

import type { Metadata } from "next";
import Link from "next/link";
import { readHolderPosition } from "./holder/read-position";

export const metadata: Metadata = { title: "covenant" };

export const dynamic = "force-dynamic";

const ROLES = [
  {
    href: "/holder",
    who: "note holder",
    line: "you hold the note and want cash against it without selling it",
    sees: "your position, the advance available, and what happens on default",
  },
  {
    href: "/lender",
    who: "cash lender",
    line: "you will lend against the note but may not see the borrower's books",
    sees: "a covenant verdict and a haircut. the financials behind them, never",
  },
  {
    href: "/engine",
    who: "agent",
    line: "you run the facility and hold the borrower's filings",
    sees: "the filing going in, and the decision coming out",
  },
];

export default async function Landing() {
  const env = await readHolderPosition();
  const p = env.ok ? env.position : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-mono text-sm">
      <h1 className="text-2xl">covenant</h1>

      <p className="mt-4 max-w-2xl leading-relaxed">
        a tokenised private credit note whose collateral haircut is set by
        confidential compute, so a cash lender can price a risk it is not
        permitted to inspect.
      </p>

      <p className="mt-3 max-w-2xl leading-relaxed text-zinc-600 dark:text-zinc-400">
        the borrower&rsquo;s revenue, earnings and borrowings go into an engine.
        a covenant verdict and a haircut come out. the lender prices the advance
        on those two numbers and never receives the figures behind them. when
        the note is pledged, the party who decides release or seizure is named
        on chain and is not the agent, and the token enforces it.
      </p>

      <section className="mt-10">
        <h2 className="text-zinc-500">three parties, three views</h2>
        <div className="mt-3 grid gap-3">
          {ROLES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="block border border-zinc-300 p-4 hover:border-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-100"
            >
              <div className="text-base">{r.who}</div>
              <div className="mt-1 text-zinc-600 dark:text-zinc-400">
                {r.line}
              </div>
              <div className="mt-2">
                <span className="text-zinc-500">sees: </span>
                {r.sees}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-zinc-500">what is live</h2>
        {p ? (
          <table className="mt-3 w-full">
            <tbody>
              {[
                ["note", `${p.token.name} (${p.token.symbol})`],
                ["token", p.token.id],
                ["network", p.network],
                ["in issue", `${p.token.totalSupply} notes`],
                [
                  "the holder in these views",
                  `${p.holder.id}, ${p.notes.held} notes, ${p.notes.sharePercent} of the issue`,
                ],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-1 pr-4 align-top text-zinc-500">{k}</td>
                  <td className="py-1">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            the chain read did not come back: {env.ok ? "" : env.error}. the
            views below read live state and will say the same thing until it
            does.
          </p>
        )}
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          a full lifecycle has run on this note: issued, a transfer refused for
          want of a compliance grant and then settled unchanged once granted, a
          coupon declared and priced by the token itself, and the note pledged
          as collateral twice, released once and seized once. every transaction
          is listed in{" "}
          <a
            className="underline"
            href="https://github.com/0xNike/covenant/blob/main/EVIDENCE.md"
          >
            EVIDENCE.md
          </a>{" "}
          with its hash.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-zinc-500">reading the evidence</h2>
        <p className="mt-3 max-w-2xl leading-relaxed">
          every gate in this project was executed through the operator panels at{" "}
          <Link className="underline" href="/console">
            /console
          </Link>
          . they are kept, unchanged, so the calls and their results can be read
          directly rather than taken on our word. they are the transaction-level
          surface, not the product.
        </p>
      </section>

      <footer className="mt-12 border-t border-zinc-200 pt-4 text-zinc-500 dark:border-zinc-800">
        hedera testnet. no contracts deployed by us: the note is issued through
        the asset tokenization studio against its deployed resolver and factory.
        the engine runs as a local service, not in an enclave.
      </footer>
    </main>
  );
}
