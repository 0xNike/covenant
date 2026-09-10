import type { NextConfig } from "next";

// `@hashgraph/asset-tokenization-sdk@8.0.0` ships one entry point for both node
// and the browser, and that entry pulls winston (which requires 'fs') and dotenv
// in unconditionally. see lib/ats/shims/winston.ts for the full import trace.
//
// the ATS maintainers alias the same four modules in their own reference
// application at `apps/ats/web/vite.config.ts:38-45`. this is the turbopack
// equivalent. the `browser` condition means the shims apply to the client bundle
// only, so anything running on the node side keeps the real modules.
const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      winston: { browser: "./lib/ats/shims/winston.ts" },
      "winston-daily-rotate-file": { browser: "./lib/ats/shims/winston.ts" },
      "winston-transport": { browser: "./lib/ats/shims/winston.ts" },
      dotenv: { browser: "./lib/ats/shims/dotenv.ts" },

      // `@terminal3/verify_vc` -> `@terminal3/bbs_vc` -> `@mattrglobal/bbs-signatures`
      // reaches the SDK through `GrantKycCommandHandler`, which
      // `core/injectable/Handlers.js` registers unconditionally.
      // `@mattrglobal/bbs-signatures/lib/index.js:27-39` guards the native
      // require in a try/catch and falls back to WASM, and in a browser it never
      // takes the native branch at all, but the bundler still statically
      // resolves `require(path.join(__dirname, "../native/index.node"))` at
      // `@mattrglobal/node-bbs-signatures/lib/bbsSignature.js:59` and reports a
      // missing native binary. the package is not even installed here. stub it
      // so the dead branch stops appearing as a build error.
      "@mattrglobal/node-bbs-signatures": {
        browser: "./lib/ats/shims/empty.ts",
      },
    },
  },
};

export default nextConfig;
