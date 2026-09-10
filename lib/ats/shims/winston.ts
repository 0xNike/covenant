// browser shim for winston.
//
// WHY THIS FILE EXISTS
//
// `@hashgraph/asset-tokenization-sdk@8.0.0` has a single browser entry point,
// `build/esm/src/index.js`, and that entry unconditionally reaches node-only
// code. the import trace is:
//
//   build/esm/src/index.js
//     -> build/esm/src/port/in/index.js
//       -> build/esm/src/port/in/Common.js
//         -> winston
//           -> winston/dist/winston/transports/file.js
//             -> require('fs')
//
// `port/in/Common.ts:3-5` imports `transports` from winston,
// `DailyRotateFile` from winston-daily-rotate-file and `TransportStream` from
// winston-transport, purely to re-export them as public logging configuration
// (`Common.ts:25-26`). `app/service/log/LogService.ts:4` also imports
// `createLogger`, `transports` and `format` and constructs a `Console`
// transport at module scope. none of that is guarded by an environment check,
// so any bundler targeting the browser resolves winston's file transport and
// fails on `fs`.
//
// this is not a next.js problem. the ATS maintainers hit the same thing in
// their own reference application and solved it the same way, aliasing winston,
// winston-daily-rotate-file and winston-transport to a hand-written stub at
// `apps/ats/web/vite.config.ts:41-44` with the stub at
// `apps/ats/web/src/winston-mock.js`. the SDK ships no browser build and no
// `"browser"` field in its package.json to do this automatically, so every
// browser consumer has to rediscover and re-solve it.
//
// aliased in `next.config.ts` via `turbopack.resolveAlias`.

/* eslint-disable @typescript-eslint/no-explicit-any */

export const format = {
  combine: () => ({}),
  timestamp: () => ({}),
  errors: () => ({}),
  json: () => ({}),
  printf: (fn?: any) => fn ?? (() => ({})),
};

class ConsoleTransport {}
class FileTransport {}

export const transports = {
  Console: ConsoleTransport,
  File: FileTransport,
};

export const createLogger = () => ({
  log: (level: string, message: any, meta?: any) => {
    const method =
      level === "ERROR" ? "error" : level === "TRACE" ? "debug" : "info";
    (console as any)[method](`[ats:${level}] ${String(message)}`, meta ?? "");
  },
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  trace: () => {},
});

const winstonShim = { createLogger, format, transports };

export default winstonShim;
