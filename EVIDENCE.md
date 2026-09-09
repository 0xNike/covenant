# EVIDENCE.md

owned by **argus**. every transaction id, hashscan url and screenshot.

**evidence or it didn't happen.** no claim reaches a writeup without a line in this file.
zeus writes the submission from here, so if a fact is not below, it does not get written.

network: **hedera testnet**, always. mainnet appears nowhere in this project.

- mirror node `https://testnet.mirrornode.hedera.com/api/v1/`
- json-rpc `https://testnet.hashio.io/api`
- hashscan `https://hashscan.io/testnet/`

---

## accounts

verified on mirror node 10 sep 2026, 03:5x SGT. all ECDSA_SECP256K1, none deleted.

| role | account | evm | balance at check |
|---|---|---|---|
| issuer / agent | `0.0.10424387` | `0x56a45ef1d79a3a6fd6cfa6b833612705d2edc742` | 974.76 HBAR |
| note holder | `0.0.10444395` | `0x7b3f60333a54e03c4ee4240d2ba2f9600c502e1e` | 1000.00 HBAR |
| lender | `0.0.10444404` | `0xb85d1ed5da74d656d00cecbc352e5b513af25970` | 1000.00 HBAR |
| engine, as `Hold.escrow` | `0.0.10445014` | `0xe03d10ae975fa1bd8b5d17e322d68fd4fe9c8222` | 1000.00 HBAR |

## deployed infrastructure, not ours

we deploy no contracts. these were already on testnet.

| what | id |
|---|---|
| business logic resolver | `0.0.9212226` |
| factory | `0.0.9213391` |
| bond config id | `0x0000000000000000000000000000000000000000000000000000000000000002` |
| equity config id | `0x0000000000000000000000000000000000000000000000000000000000000001` |

---

## G1. bond issued on testnet

status: **not started**

| | |
|---|---|
| token address | |
| transaction id | |
| hashscan | |
| signed by | |
| argus confirmed | |

## G2. kyc blocked transfer, grant, permitted transfer

status: **not started**

the blocked transfer is evidence. record the revert reason, and confirm it is a compliance
failure, not gas and not a bad address.

| step | transaction id | hashscan | result | argus confirmed |
|---|---|---|---|---|
| transfer to unverified party | | | must fail | |
| kyc grant | | | | |
| same transfer again | | | must succeed | |

## G3. coupon distributed

status: **not started**

**a submittable hedera entry exists once this gate is green.**

| | |
|---|---|
| `updateMaturityDate` | |
| coupon set | |
| coupon distributed | |
| `scheduledTask` | |

## G4. kpi posted, rate steps, hold created and executed

status: **not started**

| step | transaction id | hashscan | argus confirmed |
|---|---|---|---|
| `createKpiLinkedRate` | | | |
| `addKpiData` | | | |
| rate before / after | | | |
| `createHoldByPartition`, escrow = `0.0.10445014` | | | |
| `releaseHoldByPartition` | | | |
| `executeHoldByPartition` | | | |

## G5. CRE confidential workflow

status: **not started**

record honestly whether this was a CRE CLI simulation or a live deployment.

## G6. submission

status: **not started**

| | |
|---|---|
| video, under 5 min | |
| architecture diagram | |
| README | |
| three writeups | |
| upstream PR | |

---

## friction log

ATS problems found during our own build. feeds the writeup feedback section and the upstream
PR. a reproducible friction point is a contribution, not just a problem.

| # | what | where | status |
|---|---|---|---|
| F1 | **verified, NOT A BUG. demoted, see D12.** `Hold.ts:23-48` does misname the constructor param `executionTimeStamp` while assigning to `this.expirationTimeStamp`, but the only call site `RPCQueryAdapter.ts:886-894` passes `hold.expirationTimestamp_`, and `IHoldTypes.sol:51-58` carries only one timestamp so no swap is possible. **the returned value is correct.** cosmetic rename, zero behavioural effect. apollo and athena concluded this independently | ATS sdk v8.0.0 | closed, naming nit only |
| F2 | **promoted to primary candidate, see D12.** `RequestAccount.privateKey` at `port/in/request/BaseRequest.ts:9` is exposed but consumed by nothing, since `SupportedWallets.CLIENT` is commented out at `Wallet.ts:9`. a dead field that invites you to hand the sdk a key it will silently ignore. real developer trap, security-shaped | ATS sdk v8.0.0 | open, **primary** |
| F3 | **withdrawn as a PR candidate. not a documentation gap, our misreading.** rudolph checked the docs rather than accepting the framing: `docs/ats/user-guides/corporate-actions.md:283-337` documents the queue mechanism thoroughly and accurately, including force-cancel semantics and what happens when a failing task blocks the queue. `ScheduledTasksOps.sol` natspec says "internal task queue", "trigger every pending cross-ordered task whose timestamp has elapsed". greps for "hedera schedule service", "schedule service", "HSS" and `0x16b` across `docs/` and `README.md` return **zero hits**: ATS never claims native scheduling anywhere. we conflated "scheduled" plus "built on hedera" into "Hedera Schedule Service" without reading past the facet name. **keep as one honest sentence in the writeup feedback section, not as a PR** | our error, not ATS's | closed |
