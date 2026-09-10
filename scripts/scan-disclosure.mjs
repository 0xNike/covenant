#!/usr/bin/env node
//
// covenant. the disclosure scan.
//
// ===========================================================================
// WHAT THIS PROTECTS
// ===========================================================================
//
// the whole project rests on one claim: the borrower's financials never reach
// the lender's side. `lib/engine/disclosure.ts` narrows the engine result on the
// server, `/lender` is a separate document with its own bundle, and the two
// views share presentational code in `app/components/covenant-ui.tsx`.
//
// nothing in typescript enforces any of that. a single import added to a shared
// module pulls the agent's code into the lender's bundle, every type still
// checks, every test still passes, the page still looks correct, and the claim
// is silently false. this script is the only thing that catches it.
//
// run it after any change to the engine, either view, or anything they share.
//
//   npm run scan:disclosure
//
// ===========================================================================
// WHY IT SCANS A PRODUCTION BUILD AND NOT THE DEV SERVER
// ===========================================================================
//
// dev-mode chunk boundaries are not production chunk boundaries. dev serves
// modules split finely for hot reload; `next build` merges them by usage, and
// that merge is exactly where a shared module can drag the agent's code into the
// lender's payload. a clean scan against `next dev` says nothing about what
// ships. so this builds first, every time.
//
// ===========================================================================
// WHY THE CONTROL SCAN IS NOT OPTIONAL
// ===========================================================================
//
// a search that finds nothing and a search that is broken produce the identical
// result. so the identical scan runs against /engine, the agent view, which
// MUST return hits, because the agent legitimately holds every one of these
// values. if the control comes back clean the search itself has failed and this
// script exits non-zero without reporting anything about /lender at all.
//
// do not add a flag that skips the control. a negative result without it is
// worthless and would be worse than not running the check, because someone would
// believe it.
//
// exit codes:
//   0  lender clean, control fired
//   1  a real disclosure found in the lender payload
//   2  could not build, serve or reach the application
//   3  the control failed, so the scan proves nothing either way

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.SCAN_PORT ?? 3011);
const DEV_PORT = Number(process.env.SCAN_DEV_PORT ?? 3007);
const BASE = `http://127.0.0.1:${PORT}`;

const LENDER = "/lender";
const AGENT = "/engine";

// ---------------------------------------------------------------------------
// the needles, derived from the source rather than copied into this file
// ---------------------------------------------------------------------------

/**
 * read the fixtures the agent console loads, and take the borrower name, the
 * field names and the figures straight out of them.
 *
 * deliberately parsed rather than hardcoded. a hardcoded copy goes stale the
 * first time someone edits a fixture, and it goes stale silently: the scan keeps
 * passing because it is searching for numbers that are no longer in the
 * application. parsing means changing a fixture changes what this looks for.
 */
function readFixtureFacts() {
  const path = join(REPO, "lib", "engine", "fixtures.ts");
  const src = readFileSync(path, "utf8");

  const values = new Set();
  const fields = new Set();
  // `revenue: 120_000_000,` and friends. the underscores are the source's own
  // digit separators.
  for (const m of src.matchAll(/^\s{4,}(\w+):\s*([\d_]+),/gm)) {
    const n = Number(m[2].replace(/_/g, ""));
    if (!Number.isFinite(n) || n === 0) continue;
    fields.add(m[1]);
    values.add(n);
  }

  const borrowers = new Set();
  for (const m of src.matchAll(/borrower:\s*"([^"]+)"/g)) {
    if (m[1].trim() !== "") borrowers.add(m[1]);
  }

  if (values.size === 0 || fields.size === 0) {
    fail(3, `could not parse any fixture figures out of ${path}. the scan has nothing to look for.`);
  }
  return {
    values: [...values],
    fields: [...fields],
    borrowers: [...borrowers],
  };
}

/**
 * every written form a number can take after minification.
 *
 * this is the part that makes the scan work where a plain grep would not.
 * turbopack rewrites `120000000` as `12e7`, and `6800000` as `68e5`, so a search
 * for the decimal form alone returns clean against a bundle that contains the
 * value in full. all mantissa/exponent pairs are generated, not guessed.
 *
 * DO NOT SIMPLIFY THIS to a decimal search. it will keep passing and stop
 * meaning anything.
 */
function numericForms(n) {
  const forms = new Set([String(n), n.toLocaleString("en-US")]);

  const e = n.toExponential();
  forms.add(e);
  forms.add(e.replace("+", ""));

  // 120000000 -> 12e7, 1.2e8, 45000000 -> 45e6, 4.5e7, ...
  for (let exp = 1; exp <= 15; exp++) {
    const p = 10 ** exp;
    if (n % p !== 0) break;
    forms.add(`${n / p}e${exp}`);
  }
  return [...forms];
}

function buildNeedles(facts) {
  /** @type {{id:string,kind:"value"|"name",match:(text:string)=>number[]}[]} */
  const needles = [];

  const literal = (id, kind, s) =>
    needles.push({
      id,
      kind,
      match: (text) => {
        const out = [];
        let i = text.indexOf(s);
        while (i !== -1) {
          out.push(i);
          i = text.indexOf(s, i + 1);
        }
        return out;
      },
      length: s.length,
      text: s,
    });

  // numeric forms are matched as standalone tokens. `4e6` as a substring of an
  // identifier is not the fixture value, and in minified code that happens.
  const token = (id, s) =>
    needles.push({
      id,
      kind: "value",
      text: s,
      length: s.length,
      match: (text) => {
        const out = [];
        const re = new RegExp(
          `(?<![\\w.$])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.$])`,
          "g",
        );
        for (const m of text.matchAll(re)) out.push(m.index);
        return out;
      },
    });

  for (const n of facts.values) {
    for (const form of numericForms(n)) token(`value ${n} as "${form}"`, form);
  }
  for (const f of facts.fields) literal(`field name "${f}"`, "name", f);

  // the human-readable labels the agent view renders next to those fields.
  for (const s of [
    "total debt",
    "interest expense",
    "trailing twelve months",
    "period end, usd",
    "EngineInputs",
    "/api/engine/run",
    "net leverage",
    "coupon rate",
    "kpiX100",
  ]) {
    literal(`label "${s}"`, "name", s);
  }

  for (const b of facts.borrowers) literal(`borrower name "${b}"`, "name", b);

  // "cash" is a substring of "cached" and "no-cache", so it is matched as a word.
  needles.push({
    id: 'field name "cash" (whole word)',
    kind: "name",
    text: "cash",
    length: 4,
    match: (text) => [...text.matchAll(/\bcash\b/g)].map((m) => m.index),
  });

  return needles;
}

// ---------------------------------------------------------------------------
// the five known-benign hits, each with the reason it is benign
// ---------------------------------------------------------------------------

/**
 * a hit is benign only when a specific, narrow rule says so. the rules key off
 * WHERE the hit is and WHAT surrounds it, never on the needle alone, so the same
 * string appearing anywhere else still fails the run.
 *
 * these were each read by hand and confirmed against the production bundle.
 */
const BENIGN = [
  {
    why:
      "the borrower's NAME is a disclosed field. `LenderDisclosure.borrower` " +
      "carries it on purpose: a lender knows who it lends against. benign only " +
      "in the rendered document, where it is the disclosure being displayed. " +
      "the same name inside a javascript chunk would be the fixtures module " +
      "having been bundled in, which is a real failure.",
    test: (hit, facts) =>
      hit.kind === "name" &&
      facts.borrowers.some((b) => hit.id.includes(b)) &&
      hit.source.endsWith("(document)"),
  },
  {
    why:
      'the english phrase "the cash lender", which is prose about who the ' +
      "counterparty is, not the balance-sheet field. benign only when those " +
      "exact surrounding words are present.",
    test: (hit) => hit.id.startsWith('field name "cash"') && /cash lender/.test(hit.context),
  },
  {
    // a backstop, and it should normally never fire. react-dom contains hex bit
    // masks such as 0x20000000 and 0x4000000 whose digits coincide with fixture
    // values, and an earlier version of this scan raised them on both routes.
    // the token boundary in `token()` already excludes them, because the `x` of
    // `0x` is a word character and the lookbehind rejects it. this stays as a
    // second line of defence: if that boundary is ever loosened, these come back
    // and would otherwise read as a real leak.
    why:
      "a hexadecimal literal whose digits coincide with a fixture figure, " +
      "typically a react-dom bit mask. not the value. normally already excluded " +
      "by the token boundary, so seeing this means that boundary was loosened.",
    test: (hit) => hit.kind === "value" && /0x[0-9a-fA-F]*$/.test(hit.before),
  },
];

function classify(hit, facts) {
  for (const rule of BENIGN) {
    let ok = false;
    try {
      ok = rule.test(hit, facts);
    } catch {
      ok = false;
    }
    if (ok) return rule;
  }
  return null;
}

// ---------------------------------------------------------------------------
// fetching and scanning
// ---------------------------------------------------------------------------

async function get(url) {
  const res = await fetch(url, { cache: "no-store" });
  return { status: res.status, body: await res.text() };
}

function scanText(source, text, needles) {
  const hits = [];
  for (const n of needles) {
    for (const at of n.match(text)) {
      hits.push({
        source,
        id: n.id,
        kind: n.kind,
        before: text.slice(Math.max(0, at - 24), at),
        context: text
          .slice(Math.max(0, at - 70), at + n.length + 70)
          .replace(/\s+/g, " "),
      });
    }
  }
  return hits;
}

/**
 * scan a route: its html, the RSC flight payload next inlines into that html,
 * and every javascript chunk the document references.
 */
async function scanRoute(pathname, needles) {
  const page = await get(BASE + pathname);
  if (page.status !== 200) fail(2, `${pathname} returned ${page.status}`);

  const assets = [{ name: `${pathname} (document)`, bytes: page.body.length }];
  let hits = scanText(`${pathname} (document)`, page.body, needles);

  const refs = new Set();
  for (const m of page.body.matchAll(/<script[^>]+src="([^"]+)"/g)) refs.add(m[1]);
  for (const m of page.body.matchAll(/static\/chunks\/[A-Za-z0-9_.\-]+\.js/g)) {
    refs.add("/_next/" + m[0]);
  }

  for (const ref of refs) {
    const url = ref.startsWith("http") ? ref : BASE + (ref.startsWith("/") ? ref : "/" + ref);
    const c = await get(url);
    const name = url.replace(BASE, "");
    if (c.status !== 200) {
      assets.push({ name: `${name} (${c.status})`, bytes: 0 });
      continue;
    }
    assets.push({ name, bytes: c.body.length });
    hits = hits.concat(scanText(name, c.body, needles));
  }

  return { assets, hits };
}

// ---------------------------------------------------------------------------
// build and serve
// ---------------------------------------------------------------------------

const cleanups = [];
function cleanup() {
  while (cleanups.length) {
    try {
      cleanups.pop()();
    } catch {
      // best effort. never let teardown mask the result.
    }
  }
}
function fail(code, message) {
  console.error(`\nFAILED: ${message}`);
  cleanup();
  process.exit(code);
}

function portBusy(port) {
  const r = spawnSync("bash", ["-c", `ss -lntH 'sport = :${port}' 2>/dev/null | head -1`], {
    encoding: "utf8",
  });
  return (r.stdout ?? "").trim() !== "";
}

/**
 * decide where to build.
 *
 * `next build` and `next dev` both own `.next`, so building in the repository
 * while a dev server is running corrupts the dev server's state. when one is
 * detected this builds an isolated copy instead, so the check never disturbs
 * work in progress and never needs a human to stop anything first.
 *
 * node_modules is hard-linked rather than symlinked: turbopack rejects a symlink
 * that leaves the project root with "Symlink [project]/node_modules is invalid,
 * it points out of the filesystem root".
 */
function prepareBuildDir() {
  if (!portBusy(DEV_PORT)) return REPO;

  console.log(`a dev server is listening on ${DEV_PORT}, building an isolated copy so it is not disturbed`);
  const dir = mkdtempSync(join(tmpdir(), "covenant-scan-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

  for (const entry of ["app", "lib", "public"]) {
    if (existsSync(join(REPO, entry))) {
      cpSync(join(REPO, entry), join(dir, entry), { recursive: true });
    }
  }
  for (const f of [
    "next.config.ts",
    "package.json",
    "package-lock.json",
    "postcss.config.mjs",
    "tsconfig.json",
    "next-env.d.ts",
    "eslint.config.mjs",
    ".env.local",
    ".env.example",
  ]) {
    if (existsSync(join(REPO, f))) cpSync(join(REPO, f), join(dir, f));
  }

  const link = spawnSync("cp", ["-al", join(REPO, "node_modules"), join(dir, "node_modules")]);
  if (link.status !== 0) {
    fail(
      2,
      "could not hard-link node_modules into the isolated build directory " +
        `(${dir} may be on a different filesystem from the repository).\n` +
        "stop the dev server and re-run, and the check will build in place.",
    );
  }
  return dir;
}

function build(dir) {
  console.log("building for production, this is the only build that proves anything");
  const r = spawnSync("npx", ["next", "build"], { cwd: dir, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stdout ?? "");
    console.error(r.stderr ?? "");
    fail(2, "next build failed");
  }
}

async function serve(dir) {
  if (portBusy(PORT)) {
    fail(2, `port ${PORT} is already in use. set SCAN_PORT to a free port and re-run.`);
  }
  const child = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: dir,
    detached: true,
    stdio: "ignore",
  });
  cleanups.push(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  });

  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}${LENDER}`, { cache: "no-store" });
      if (r.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail(2, `the production server did not become ready on ${PORT} within 60s`);
}

/**
 * publish a run, so /lender is scanned POPULATED.
 *
 * scanning the empty state would be the easiest possible pass and would prove
 * nothing: a page with no report on it obviously carries no figures. the state
 * that matters is the one on camera, with a covenant report on screen.
 */
async function publishRun(facts) {
  const inputs = { borrower: facts.borrowers[0] ?? "Scan Borrower", period: "SCAN" };

  // take the last fixture verbatim out of the source, so the published run uses
  // real fixture figures and the scan is looking for values that are genuinely
  // in flight.
  const src = readFileSync(join(REPO, "lib", "engine", "fixtures.ts"), "utf8");
  const blocks = [...src.matchAll(/inputs:\s*\{([\s\S]*?)\},?\s*\n\s*\},/g)];
  const last = blocks[blocks.length - 1]?.[1] ?? "";
  for (const m of last.matchAll(/(\w+):\s*([\d_]+)/g)) {
    inputs[m[1]] = Number(m[2].replace(/_/g, ""));
  }
  for (const m of last.matchAll(/(\w+):\s*"([^"]*)"/g)) inputs[m[1]] = m[2];
  for (const f of facts.fields) {
    if (typeof inputs[f] !== "number") fail(3, `could not build a usable run, ${f} missing`);
  }

  const res = await fetch(`${BASE}/api/engine/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inputs }),
    cache: "no-store",
  });
  if (!res.ok) fail(2, `could not publish a run, /api/engine/run returned ${res.status}`);

  const check = await get(`${BASE}/api/engine/disclosure`);
  if (!check.body.includes("haircutBps")) {
    fail(2, "a run was published but the disclosure endpoint did not return one");
  }
  console.log(`published a run for ${inputs.borrower}, ${inputs.period}`);
}

// ---------------------------------------------------------------------------

function report(title, result) {
  console.log(`\n=== ${title} ===`);
  const total = result.assets.reduce((a, b) => a + b.bytes, 0);
  console.log(`${result.assets.length} assets, ${(total / 1024 / 1024).toFixed(2)} MB`);
  for (const a of result.assets) {
    console.log(`  ${(a.bytes / 1024).toFixed(1).padStart(9)} KB  ${a.name}`);
  }
  console.log(`hits: ${result.hits.length}`);
}

async function main() {
  const facts = readFixtureFacts();
  const needles = buildNeedles(facts);
  console.log(
    `scanning for ${needles.length} needles built from ${facts.values.length} fixture figures ` +
      `and ${facts.fields.length} field names, read out of lib/engine/fixtures.ts`,
  );

  const dir = prepareBuildDir();
  build(dir);
  await serve(dir);
  await publishRun(facts);

  const lender = await scanRoute(LENDER, needles);
  const control = await scanRoute(AGENT, needles);

  report(`LENDER  ${LENDER}`, lender);
  report(`CONTROL ${AGENT}  (must return hits)`, control);

  // -- the control gate, first. a broken search must never read as a pass. -----
  const controlFields = new Set(
    control.hits.filter((h) => h.kind === "name").map((h) => h.id),
  );
  const controlValues = new Set(
    control.hits.filter((h) => h.kind === "value").map((h) => h.id.split(" as ")[0]),
  );
  const missingFields = facts.fields.filter(
    (f) => ![...controlFields].some((id) => id === `field name "${f}"` || id.startsWith(`field name "${f}"`)),
  );

  console.log(
    `\ncontrol found ${controlFields.size} field-name needles and ` +
      `${controlValues.size} of ${facts.values.length} fixture figures`,
  );

  if (missingFields.length > 0 || controlValues.size < Math.ceil(facts.values.length * 0.8)) {
    console.error("\nthe agent view did not contain values it is supposed to contain.");
    if (missingFields.length) console.error(`  field names not found: ${missingFields.join(", ")}`);
    fail(
      3,
      "THE CONTROL FAILED. the search is not working, so the clean result against " +
        "/lender proves nothing. fix the scan before trusting any result from it.",
    );
  }
  console.log("control fired. the search works, so a clean lender result means something.");

  // -- now the lender ---------------------------------------------------------
  const real = [];
  const benign = [];
  for (const hit of lender.hits) {
    const rule = classify(hit, facts);
    if (rule) benign.push({ hit, rule });
    else real.push(hit);
  }

  console.log(`\nlender hits: ${lender.hits.length} total, ${benign.length} known benign, ${real.length} unexplained`);
  const seen = new Set();
  for (const { hit, rule } of benign) {
    const key = hit.id + hit.source;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  benign  ${hit.id}  in ${hit.source}`);
    console.log(`          ${rule.why}`);
  }

  if (real.length > 0) {
    console.error("\n--------------------------------------------------------------");
    console.error("DISCLOSURE FOUND IN THE LENDER PAYLOAD");
    console.error("--------------------------------------------------------------");
    for (const h of real) {
      console.error(`  [${h.kind}] ${h.id}`);
      console.error(`     in ${h.source}`);
      console.error(`     ...${h.context}...`);
    }
    console.error(
      "\nthe borrower's financials, or the shape of them, are being served to the\n" +
        "lender's side. the claim this project rests on is currently false.\n" +
        "usual cause: a module imported by app/lender reached something that\n" +
        "imports lib/engine/fixtures.ts or names EngineInputs.",
    );
    cleanup();
    process.exit(1);
  }

  console.log(
    "\nCLEAN. no borrower figure and no input field name reaches the lender's\n" +
      "document, its inlined RSC payload, or any chunk it loads, in a production\n" +
      "build, with the control confirming the search fires.",
  );
  cleanup();
  process.exit(0);
}

process.on("SIGINT", () => fail(2, "interrupted"));
main().catch((e) => fail(2, e?.stack ?? String(e)));
