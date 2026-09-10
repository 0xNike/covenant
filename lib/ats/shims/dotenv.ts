// browser shim for dotenv.
//
// `@hashgraph/asset-tokenization-sdk@8.0.0`'s entry point calls dotenv at module
// scope (`packages/ats/sdk/src/index.ts:4-6`, `import { config } from "dotenv";
// config();`). dotenv reads the filesystem, which does not exist in a browser.
//
// next inlines NEXT_PUBLIC_ variables at build time, so nothing here needs to
// do any work. same fix as the ATS reference application, which aliases dotenv
// to `apps/ats/web/src/dotenv-mock.js` at `apps/ats/web/vite.config.ts:42`.
//
// aliased in `next.config.ts` via `turbopack.resolveAlias`.

export const config = () => ({ parsed: {} });

const dotenvShim = { config };

export default dotenvShim;
