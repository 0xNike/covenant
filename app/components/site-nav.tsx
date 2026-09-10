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
// root layout that throws takes down every route, including /engine and /lender,
// which need no ATS configuration at all. next inlines NEXT_PUBLIC_ values at
// build time, so this is the same variable, read without the blast radius.
const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "network not configured";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "console" },
  { href: "/engine", label: "engine" },
  { href: "/lender", label: "lender view" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav
      data-site-nav
      className="border-b border-zinc-300 font-mono text-sm dark:border-zinc-700"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-3">
        <span className="font-semibold">covenant</span>
        <div className="flex flex-wrap gap-2">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`border px-3 py-1 ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-400 dark:border-zinc-600"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <span className="text-zinc-500">hedera {NETWORK}</span>
      </div>
    </nav>
  );
}
