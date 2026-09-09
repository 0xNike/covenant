# 00. mission. the shared brief every covenant agent reads first

not an agent definition. the context block every agent carries. agent definitions live in
`.claude/agents/`.

## project

**covenant.** a tokenised private credit note whose interest rate and collateral haircut are
set by a confidential compute engine reading the borrower's private financials, so a cash
lender can price a risk it is not permitted to inspect.

- event: ETHGlobal ETHOnline 2026
- deadline: **monday 14 september 2026, 11:59am SGT**
- builder: hao, solo, assisted by the hermes agent team

## read these before your first action

`PROJECT_BRIEF.md` what and why. `CLAUDE.md` how. `MASTER_TODO_LIST.md` the plan and the
gates. `DECISIONS.md` calls already made, do not relitigate them. `EVIDENCE.md` what is
actually proven.

## chain of command

you report to **hermes**. you never message hao directly. you never commit, rudolph commits.
you never spawn another agent unless your charter says you may. you hand work back to hermes
and hermes integrates.

## ship order, and the prime directive

1. bond issued on testnet, on hashscan
2. kyc blocks a transfer, grant, same transfer succeeds
3. coupon distributed
4. kpi posted via `addKpiData`, rate steps
5. hold created, then executed on default
6. confidential engine behind a CRE `handlerInTee`
7. video, README, writeups, links, upstream PR

**1 to 3 alone is a complete submittable entry. never risk 1 to 3 to reach 4 to 7.**

## hard rules

- **no new solidity. no contract deployment.** we use the deployed resolver `0.0.9212226`
  and factory `0.0.9213391`. escalate to hermes if this looks unavoidable
- **testnet only.** never mainnet
- **evidence or it didn't happen.** a hashscan link or it is not done
- **no guessing.** cite a file path and line, or a url. "i believe the sdk supports x" is a
  failure. "`Hold.ts:41` exposes `executeHoldByPartition`" is the standard. when you cannot
  find an answer, say so. do not interpolate
- **no silent scope growth.** if a task is bigger than planned, stop and tell hermes
- gas constants live in `@core/Constants`. do not invent limits

## ground truth

the ATS clone at `~/projects/hackathon/hedera/asset-tokenization-studio` is tag
`v.8.0.0-ats`, an exact match for our installed `@hashgraph/asset-tokenization-sdk@8.0.0`.
so `packages/ats/sdk/src` there is ground truth for what we actually run. **it is read-only.
we never modify it.** the published docs lag behind it. our own code lives in this repo.

## accounts, all hedera testnet, all ECDSA_SECP256K1

| role | account | evm |
|---|---|---|
| issuer / agent | `0.0.10424387` | `0x56a45ef1d79a3a6fd6cfa6b833612705d2edc742` |
| note holder | `0.0.10444395` | `0x7b3f60333a54e03c4ee4240d2ba2f9600c502e1e` |
| lender | `0.0.10444404` | `0xb85d1ed5da74d656d00cecbc352e5b513af25970` |
| engine, as `Hold.escrow` | `0.0.10445014` | `0xe03d10ae975fa1bd8b5d17e322d68fd4fe9c8222` |

**there is no private key and there will never be one.** `SupportedWallets.CLIENT` is
commented out at `packages/ats/sdk/src/domain/context/network/Wallet.ts:9`, so sdk v8 has no
local-key signer. every signature is hao clicking MetaMask in the browser. no key enters
`.env`, this repo, or your context. if you find yourself wanting one, you have taken a wrong
turn, stop and tell hermes.

## language rules, enforced by apollo on every artifact

**never write:** repurchase agreement, risk-free, zero-knowledge, ZK, trustless,
vesting (for a hold), APY, yield farming, or any crypto slang.

**"repo" is banned in the finance sense only** (repurchase agreement). where you mean a code
repository, write "repository" in full in judge-facing artifacts. the blanket ban was
unenforceable and narrowed per D15.

**write instead:** collateralised facility, NAV-based lending, overcollateralised financing
with daily margining, confidential compute, hardware-isolated enclave, attested execution,
collateral hold.

**register:** lowercase, terse, plain words. no em-dashes. no exclamation marks. no emojis.

**accuracy:** ATS is ERC-1400 compliant with *partial* ERC-3643 support, never claim full.
CRE confidential workflows are TEE-based, **not ZK**. if our confidential leg is a CRE CLI
simulation, say so plainly. honest and still qualifying.
