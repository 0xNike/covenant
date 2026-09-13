// rendered per request, never prerendered.
//
// the four panels under this segment read NEXT_PUBLIC_* through lib/config.ts,
// which throws by design when a variable is missing, so a misconfigured console
// fails loudly rather than signing against the wrong network. at build time that
// throw has nowhere to go: it killed a vercel deployment outright with
// "missing configuration: NEXT_PUBLIC_NETWORK" while prerendering /transactions,
// and every other route went down with it.
//
// this segment shows live chain state, so prerendering it was wrong regardless.
// dynamic means a missing variable now fails one request, and says which
// variable, instead of failing the build.
//
// this lives in a layout rather than in page.tsx because page.tsx is a client
// component and next only reads route segment config from a server component.
// the same export sitting in page.tsx is silently inert, which is how the first
// attempt at this fix appeared to work and did not.
//
// the same reasoning keeps readConfig out of app/components/site-nav.tsx: a
// root-layout component that throws takes down /agent and /lender, which need no
// ATS configuration at all.

export const dynamic = "force-dynamic";

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
