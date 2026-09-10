# scripts

## `scan-disclosure.mjs`

```
npm run scan:disclosure
```

### what it protects

covenant rests on one claim: **the borrower's financials never reach the lender's side.**
everything else in the project is a demonstration of that claim. the haircut is interesting
because the lender could not have computed it. the two views are worth showing side by side
because one of them genuinely does not have the numbers.

if that claim is false, the project is a bond with a privacy story bolted on, which
`PROJECT_BRIEF.md` §4 says explicitly is the thing we moved away from being.

this script is what establishes the claim is true.

### why nothing else can protect it

the boundary is real and it is enforced in three places:

- `lib/engine/disclosure.ts` narrows `EngineResult` to `LenderDisclosure` on the server, by
  explicit field-by-field construction rather than by omission, so a new field is undisclosed
  until someone writes a line to disclose it
- `/lender` is a separate document with its own bundle and its own request, not the agent's
  page with fields hidden
- `lib/engine/disclosure-client.ts` is the only client module the lender's side imports, and
  it knows one endpoint and no input shape

**none of that is enforced by the type system, and none of it can be.** typescript checks
what a module *says*. it has nothing to say about what a bundler *ships*. the failure looks
like this:

1. someone adds an import to `app/components/covenant-ui.tsx`, which both views use
2. that import transitively reaches `lib/engine/fixtures.ts`
3. every type still checks, the linter is quiet, both pages render correctly
4. turbopack, merging modules by usage, puts the borrower's figures in a chunk `/lender`
   loads
5. the claim is now false, the demonstration is now dishonest, and **nothing has gone red**

there is no test that catches this, because the values are not on the screen and no
assertion about the rendered output would notice. the only way to know is to look at the
bytes that are actually served.

### how it works

it builds for production, serves the build, publishes a covenant report so `/lender` is
scanned in its **populated** state, then fetches the lender document, the RSC payload next
inlines into it, and every javascript chunk it references, and searches the lot.

three properties are load-bearing. do not remove any of them.

**1. it scans a production build, never the dev server.** dev-mode chunk boundaries are not
production chunk boundaries. dev splits modules finely for hot reload; `next build` merges
them by usage, and that merge is exactly where the leak happens. a clean scan against
`next dev` says nothing about what ships.

**2. it runs a control scan against `/engine` and requires it to return hits.** a search that
finds nothing and a search that is broken produce the identical result. the agent view
legitimately holds every value being searched for, so it must come back dirty. if it comes
back clean, the search has failed and the script exits 3 without reporting anything about
`/lender` at all. **a clean lender result without a firing control is worthless**, and
believing one would be worse than never running the check.

**3. it searches for minified numeric forms, not just decimals.** turbopack writes
`120000000` as `12e7` and `6800000` as `68e5`. a decimal-only search returns clean against a
bundle that contains every figure in full. the script generates all mantissa/exponent forms.

it also derives what to search for by **parsing `lib/engine/fixtures.ts` at runtime** rather
than holding its own copy. a hardcoded list goes stale the moment someone edits a fixture,
and it goes stale silently: the check keeps passing while searching for numbers the
application no longer contains.

### reading the result

```
exit 0   clean, and the control fired. this is the only result that means anything good.
exit 1   a real disclosure is in the lender payload. the claim is currently false.
exit 2   could not build, serve or reach the application. infrastructure, not a verdict.
exit 3   the control failed. the scan proves nothing either way. fix the scan.
```

six hits against `/lender` are expected and are printed as **known benign**, each with the
reason:

- the borrower's **name**, in the rendered document. `LenderDisclosure.borrower` carries it
  on purpose, because a lender knows who it lends against. the same name inside a javascript
  chunk is *not* benign, and the rule is written to fire in that case
- the english phrase **"the cash lender"**, which is prose about the counterparty, not the
  balance-sheet field. benign only when those surrounding words are present

the benign rules key off where the hit is and what surrounds it, never on the string alone,
so the same text appearing anywhere else still fails the run. **if a new benign hit appears,
do not add a rule to silence it until you have established what it is.**

### it has been tested in both directions

a check that has only ever passed is not a check. this one was verified by deliberately
adding `import { FIXTURES } from "@/lib/engine/fixtures"` to `app/lender/lender-view.tsx` and
rendering a figure from it. the scan exited 1 and named the offending chunk, which turbopack
had created fresh and served only to `/lender`. the import was then reverted. **if you change
this script, re-do that test.**

### notes

- it takes about a minute, most of it `next build`
- if a dev server is listening on 3007 it builds an isolated copy instead of overwriting
  `.next`, so it is safe to run while working. that copy hard-links `node_modules`, because
  turbopack rejects a symlink that leaves the project root
- ports are overridable with `SCAN_PORT` and `SCAN_DEV_PORT`
- it needs no wallet, no network access to hedera, and no credential of any kind

### related

`app/api/engine/disclosure/route.ts` is deliberately unauthenticated, and that is not an
oversight. read the comment at the top of it before adding a guard. the short version: a
guard would mean the data exists and something stands in front of it. nothing stands in front
of that endpoint because there is nothing behind it, and this script is what proves it.
