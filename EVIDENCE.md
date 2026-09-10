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

status: **VERIFIED**, with one open item (STANDARD coupon rate type, see below) and one
naming caveat (config-2 token, see below). all checks below were run read-only against the
mirror node and the testnet JSON-RPC relay (`https://testnet.hashio.io/api`), independent of
`lib/ats/diagnostics.ts` and independent of hao's or gamma's read-back. where our own
`RESOLVER_KEYS` constants in `lib/ats/diagnostics.ts` were used to select which facet id to
query, that reliance is called out explicitly below, and the constants were independently
re-derived from the live resolver rather than trusted.

| | |
|---|---|
| token (contract) id | `0.0.10450229` |
| token evm address | `0xc10cac0e7afd175faf04572327c85e54f015ca87` |
| transaction hash | `0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078` |
| transaction id (payer/relay form) | `0.0.7314364-1788996339-656644200` |
| hashscan, transaction | https://hashscan.io/testnet/transaction/0xb13a78518922d1ba1c40966db9cc5e34174db85946f030e84eff03737e7fa078 |
| hashscan, contract | https://hashscan.io/testnet/contract/0.0.10450229 |
| consensus timestamp | `1788996347.220699692` -> 2026-09-10 07:25:47 SGT (2026-09-09 23:25:47 UTC) |
| signed by | `0.0.10424387` (issuer), confirmed as the ECDSA sender, not just the console's claim |
| result | `SUCCESS`, EVM status `0x1` |
| cost | `780,696,070` tinybar = **7.80696070 HBAR**, charged entirely to `0.0.10424387` (no relay-operator split on this transaction, unlike the reverted attempt below) |
| gas used / limit | `7,097,237` / `15,000,000` |
| created contract id | `0.0.10450229`, matches `created_contract_ids` on the mirror node contract-result record for this exact hash |

**how each item was checked, against the chain, not the console:**

1. **transaction success and cost.** `GET /api/v1/contracts/results/{hash}` returns
   `result: "SUCCESS"`, `status: "0x1"`, `error_message: null`, `created_contract_ids:
   ["0.0.10450229"]`, `from: 0x...9f1043` (= `10424387` decimal, the issuer). cross-checked
   against `GET /api/v1/transactions?timestamp=1788996347.220699692`, which returns
   `result: "SUCCESS"` and a `transfers` array showing `0.0.10424387` debited the full
   `780,696,070` tinybar fee. two independent mirror-node endpoints agree.

2. **contract exists, not deleted, created by that transaction.**
   `GET /api/v1/contracts/0.0.10450229` returns `deleted: false`,
   `created_timestamp: "1788996347.220699693"` (matches the transaction's consensus
   timestamp to the microsecond), and `evm_address:
   0xc10cac0e7afd175faf04572327c85e54f015ca87`, matching the claim exactly.

3. **the two irreversible flags, read off chain via the relay.** direct `eth_call` against
   the token's EVM address, `isClearingActivated()` and `isInternalKycActivated()`
   (`facets/clearing/IClearing.sol:49`, `facets/kyc/IKyc.sol:132`), not through the console
   and not through `lib/ats/diagnostics.ts` (that file does not even read these two — it was
   scoped to rate/facet diagnostics). result:
   `clearingActive = false`, `internalKycActivated = true`. **matches hao's read-back
   exactly**, independently confirmed.

4. **active configuration id and version.** `getConfigInfo()` on the token returns
   `configurationId_ = 0x...02` (bond variable rate), `version_ = 1`, and
   `resolver_ = 0xBA2D5FC2083A0b8f164c50e65d782087fBA18E0a`. that resolver address was checked
   against `GET /api/v1/contracts/0.0.9212226`, which reports
   `evm_address: 0xba2d5fc2083a0b8f164c50e65d782087fba18e0a` — the token is on our pinned
   resolver, not some other one. **matches the claim: config 2, version 1.**

5. **coupon rate type. OPEN ISSUE, not a defect, flagging per apollo.**
   `getCouponRateType()` returns `1` = `STANDARD`
   (`facets/interestRate/IInterestRate.sol:25-30`). **matches the claim.** left open because
   apollo has established `setCouponRateType(FIXED)` must be called before the first
   `setCoupon`, and `InterestRate.sol:38` carries a maintainer TODO that changing the rate
   type after coupons exist may not be safe. gamma has not yet called
   `setCouponRateType`. G3 (coupon distribution) cannot proceed safely until this is resolved
   one way or the other; recording it here so it is not lost between gates.

6. **facet readiness. verified two ways, not one.** first, `getFacetVersionStatus(key, 1)`
   called directly on the token for each of the seven `RESOLVER_KEYS` constants from
   `lib/ats/diagnostics.ts`:

   | facet | expected | actual |
   |---|---|---|
   | `fixedRate` | 1 | **1** |
   | `proceedRecipients` | 1 | **1** |
   | `scheduledTasks` | 1 | **1** |
   | `kpiLinkedRate` | 0 | **0** |
   | `kpis` | 0 | **0** |
   | `proceedRecipientsKpiLinkedRate` | 0 | **0** |
   | `scheduledTasksKpiLinkedRate` | 0 | **0** |

   all seven match. second, because the facet-id constants themselves are our own code,
   they were **independently re-derived from the resolver**, not taken on trust:
   `resolver.getFacetIdByConfigurationIdVersionAndSelector(configId, version, selector)`
   was called live for known selectors.
   - `getRate()` on config 2 → `0x82f13d95...af521`, exactly the `fixedRate` key.
   - `getProceedRecipientsCount()` on config 2 → `0x63388aa1...b2b0bb7`, exactly the
     `proceedRecipients` key.
   - `getKpiLinkedRateInterestRate()` on config 2 → `0x000...000` (unregistered), confirming
     `KpiLinkedRateFacet` is genuinely absent from config 2, not just unready.
   - `getKpiLinkedRateInterestRate()` on config 4 → `0x47cd76ae...9593`, exactly the
     `kpiLinkedRate` key (cross-config confirmation the key itself is correct).
   - `getRate()` on config 4 → `0x000...000`, corroborating `BUG.md` B1's finding that
     `FixedRateFacet` is absent from config 4.

   so the facet-id constants are not taken on faith from our own file; they were checked
   against the resolver directly and they check out.

7. **identity fields, read via `getERC20Metadata()` and `getMaxSupply()`, not the console.**

   | field | expected | actual |
   |---|---|---|
   | name | "Covenant KPI-Linked Private Credit Note 2029" | **matches** |
   | symbol | "CVNT29" | **matches** |
   | isin | (valid checksum) | **`XS9999COV006`** |
   | decimals | — | **2** |
   | maxSupply | — | **100000** |
   | issuer holds `DEFAULT_ADMIN_ROLE` | true | **`hasRole(0x00, 0x56a4...c742)` = true** |

**config-2 caveat, stated plainly.** this token is on config `0x...02`, bond variable rate,
confirmed above. it carries `KpisFacet` status 0 and `KpiLinkedRateFacet` status 0 — both
genuinely unregistered on this configuration, not merely uninitialised. `addKpiData` is not
callable on this token. the "KPI-Linked" language in the token's own `name` field is product
naming; the on-chain rate mechanism is `FixedRateFacet`/`InterestRateFacet` (config 2's
actual facet set is `CouponFacet` + `InterestRateFacet` per `DECISIONS.md` D10), not a KPI
mechanism. this was necessary because `Bond.createKpiLinkedRate` cannot reach any real
deployment (`BUG.md` B1) and config 4 is registered but unreachable by any working path. any
writeup sentence that leans on "KPI-linked" for this instrument's on-chain rate-setting must
be checked against this fact before it ships. block D (KPI posting, rate stepping) will need
its own plan given this; that is outside G1's scope and is flagged for hermes, not resolved
here.

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
| F4 | **verified against chain, real friction, feeds B1 territory but distinct.** `CreateBondRequest.validate()` (`Security.checkISIN`, `domain/context/security/Security.ts:186-194`) returns **zero errors** on any 12-character non-empty string. it checks length and emptiness only, no digit-check validation at all. the deployed factory does enforce one: `Factory.sol:283`'s `onlyValidISIN` modifier calls `isinValidator.sol:30-36`'s `_checkChecksum`, an ISO 6166 Luhn/mod-10 check digit over the converted ISIN body. the first issuance attempt used isin `XS9999COV001`, checksum invalid, and reverted on chain: selector `0x342c92db`, independently recomputed as `keccak256("WrongISINChecksum(string)")[:4]` and matched exactly. mirror node: `result: CONTRACT_REVERT_EXECUTED` at consensus timestamp `1788996044.808119873` (2026-09-10 07:20:44 SGT), tx hash `0x305fbb1a04946a5c4e18dd98675f0891934b8db699633fba0579e4a345a02a0b`, tx id `0.0.7314364-1788996041-506049004`, `error_message` decodes to the offending string `XS9999COV001`. **cost: `18,855,433` tinybar total charged (`0.18855433` HBAR), not `0.18` flat** — the claim rounds down slightly. the total splits across two payers: relay operator `0.0.7314364` absorbed `11,693,773` tinybar and issuer `0.0.10424387` paid `7,161,660` tinybar (`0.0716166` HBAR) of it. the successful reissue five minutes later used `XS9999COV006`, confirmed as the live token's isin in G1 above. hashscan: https://hashscan.io/testnet/transaction/0x305fbb1a04946a5c4e18dd98675f0891934b8db699633fba0579e4a345a02a0b | ATS sdk v8.0.0, `Security.checkISIN` | open, candidate for the writeup feedback section alongside B1 |
