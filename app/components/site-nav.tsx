"use client";

// covenant. the only navigation in the application.
//
// it exists for one reason: iris was typing urls into the address bar on camera
// to get from the console to the engine and from the engine to the lender view.
// that is several seconds of a five minute budget spent watching someone type,
// and it reads as a prototype rather than a product.
//
// three destinations, no menus, no icons, no dropdown. the active one is filled
// rather than underlined so it survives a scrub at 1.5x.
//
// ---------------------------------------------------------------------------
// WHY THIS DISAPPEARS INSIDE THE LENDER IFRAME
// ---------------------------------------------------------------------------
//
// the console embeds /lender in an iframe. this bar is in the root layout, so
// without intervention it would render again inside that frame: a second set of
// navigation controls stacked inside the panel, pushing the lender's content
// down so it no longer lines up with the agent's, which is exactly the alignment
// the reveal depends on.
//
// it is suppressed by a css rule in app/globals.css keyed on the
// `data-embedded` attribute the lender view sets, not by a `window.self !==
// window.top` check in javascript. an iframe test can only run after hydration,
// so the bar would paint inside the frame and then vanish, and that flicker
// would be on the recording. the css rule applies at first paint.

import Link from "next/link";
import { usePathname } from "next/navigation";

// read directly rather than through `readConfig()`. that helper calls
// `required()` on a dozen variables and throws if any one is missing, which is
// correct where a transaction depends on them and wrong here: a nav bar in the
// root layout that throws takes down every route, including /agent and /lender,
// which need no ATS configuration at all. next inlines NEXT_PUBLIC_ values at
// build time, so this is the same variable, read without the blast radius.
const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "network not configured";

// ---------------------------------------------------------------------------
// THE LABELS, AND HOW THEY RELATE TO THE ROUTE NAMES
// ---------------------------------------------------------------------------
//
// the bar used to read: covenant, note holder, lender view, engine, console.
// two of those mean nothing to someone arriving cold. "engine" is our internal
// word for the service, not a party, and it left a reader asking whose. and
// "console" describes the furniture rather than the content.
//
// so the three role views carry the same three words the landing page uses for
// the parties, note holder, cash lender and agent, and a reader meets the set
// twice. "lender view" said view where its siblings said role; the view is what
// the page is, not who it is for.
//
// the routes then followed the labels. /engine became /agent and /console
// became /transactions, because a label and a url that are different words, not
// shortenings, are two things to say out loud while presenting with the address
// bar in shot. /holder and /lender stay as they are: "note holder" and "cash
// lender" shorten to them, so there is nothing to reconcile.
//
// note that the ROUTE renamed, not the service. lib/engine and /api/engine are
// untouched and should stay that way. the engine is the thing that computes,
// the agent is the party that operates it, and /agent is that party's view of
// it. collapsing the two words would lose a distinction that is real.
//
// `rule` marks the item as a different kind of thing rather than a fourth
// party: three parties, a vertical rule, then the surface where the
// transactions were signed. a divider rather than a dropdown, because five
// items is not noisy and the three roles are the product. hiding them behind a
// click costs a tired reader a decision to reach the thing we most want them to
// open. revisit if this ever passes seven items.
const LINKS: { href: string; label: string; rule?: boolean }[] = [
  { href: "/", label: "covenant" },
  { href: "/holder", label: "note holder" },
  { href: "/lender", label: "cash lender" },
  { href: "/agent", label: "agent" },
  { href: "/transactions", label: "transactions", rule: true },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav
      data-site-nav
      className="border-b border-zinc-300 font-mono text-sm dark:border-zinc-700"
    >
      {/*
        there is no separate wordmark. there used to be, and next to it the
        first link also said "covenant", so the bar opened "covenant covenant".
        one word doing both jobs is less noise and loses nothing: the first item
        is the brand, and it is the home link, and it takes the filled active
        state on / like every other item.
      */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-3">
        <div className="flex flex-wrap gap-2">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <span key={l.href} className="flex items-stretch gap-2">
                {l.rule && (
                  <span
                    aria-hidden
                    className="my-0.5 w-px self-stretch bg-zinc-300 dark:bg-zinc-700"
                  />
                )}
                <Link
                  href={l.href}
                  className={`border px-3 py-1 ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-400 dark:border-zinc-600"
                  }`}
                >
                  {l.label}
                </Link>
              </span>
            );
          })}
        </div>
        <span className="text-zinc-500">hedera {NETWORK}</span>
      </div>
    </nav>
  );
}
