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

status: **VERIFIED**. all nine checks below were run read-only against the mirror node
(`/contracts/results/{hash}`, `/transactions?timestamp=`) and the testnet JSON-RPC relay
(`eth_call`, both at `"latest"` and at specific historical block numbers), independent of
gamma's transcript and independent of hao's read-back. `GET
/contracts/0.0.10450229/results?order=asc&limit=100` returns **exactly nine** results against
this token, no `next` page, so the sequence below is the complete on-chain history for this
token, not a curated subset.

signed by `0.0.10424387` (issuer) throughout. token `0.0.10450229` /
`0xc10cac0e7afd175faf04572327c85e54f015ca87`, the G1 token, unchanged.

| step | tx hash | tx id | consensus timestamp (SGT) | result | fee (issuer) |
|---|---|---|---|---|---|
| `applyRoles` (ROLE_SSI_MANAGER, ROLE_KYC, ROLE_ISSUER → issuer) | `0xdb8b689f1864f8416b522a30f5719c2f2e65da08801733009ac2ede6331f3d5e` | `0.0.7314364-1789049490-802377808` | 2026-09-10 22:11:35 | SUCCESS | 0.47738884 HBAR |
| `addIssuer(issuer)` | `0xeb756de9fbddf6b15a6d1230a1c56eb31ed8c08532c7aae3e606d1b2b2effd4c` | `0.0.7314364-1789049505-548638116` | 2026-09-10 22:11:53 | SUCCESS | 0.14349757 HBAR |
| `grantKyc` (issuer, self) | `0x8a72deb24900b3ad6f95c5db013f58e1609605e2b162b548d36c272076f24cce` | `0.0.7314364-1789049530-077928530` | 2026-09-10 22:12:17 | SUCCESS | 0.25898583 HBAR |
| `issueByPartition` (mint, 1000.00 notes to issuer) | `0x69bcc8982fda4de4c8f485b0f18e1e6232daa5ef183b68444486404a431f095e` | `0.0.7314364-1789049578-449079435` | 2026-09-10 22:13:04 | SUCCESS | 0.53012368 HBAR |
| `transferByPartition` (issuer → holder, 250.00 notes) — **blocked** | `0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5` | `0.0.7314364-1789049856-069383438` | 2026-09-10 22:17:43 | **CONTRACT_REVERT_EXECUTED** | 0.12664136 HBAR (+ 0.00133173 HBAR relay operator `0.0.7314364`) |
| `grantKyc` (holder) | `0x15e3d2a0590741fa0b6f07c5966d88ba8f08c2753fdf08474b219e58720f375a` | `0.0.7314364-1789049923-950666796` | 2026-09-10 22:18:52 | SUCCESS | 0.23966283 HBAR |
| `grantKyc` (holder, again) — **reverted, see note below** | `0x79576e7d6dc6296c979fd14dc5d7e4729fd7c2b8d255b3d925d5990e81a1ac21` | `0.0.7314364-1789049991-776340497` | 2026-09-10 22:19:56 | **CONTRACT_REVERT_EXECUTED** | 0.08931972 HBAR (+ 0.00133173 HBAR relay operator) |
| `grantKyc` (lender) | `0x0bf73993e41423a9f7e65794fc1c13510bd4f241e70a4848ea7729c62c43ba39` | `0.0.7314364-1789050111-213954856` | 2026-09-10 22:21:58 | SUCCESS | 0.23964927 HBAR |
| `transferByPartition` (issuer → holder, 250.00 notes) — **same call, now permitted** | `0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5` | `0.0.7314364-1789050148-772169185` | 2026-09-10 22:22:35 | SUCCESS | 0.52558899 HBAR |

hashscan: replace the hash into `https://hashscan.io/testnet/transaction/{hash}` for each row
above, e.g. the blocked transfer is
https://hashscan.io/testnet/transaction/0x904d61ccdf76b03262f8cea279cffe16016e98856276b218ec6f61ab9849ade5
and the permitted transfer is
https://hashscan.io/testnet/transaction/0x582b822d7e8e99bd5c948211d55c464215e9a4265e38028265ce50a5b68ae6e5.

**a naming correction against the task framing, made plain so the writeup does not repeat
it.** the blocked and permitted transfers move 250.00 notes from the issuer to the account
labelled "note holder" (`0.0.10444395` / `0x7b3f6033...c502e1e`), decoded directly off both
transactions' calldata, not the account labelled "lender." the lender (`0.0.10444404` /
`0xb85d1ed5...af25970`) receives a `grantKyc` in this same block but is not a party to either
transfer here. anyone writing this gate up should say "issuer to holder," not "issuer to
lender."

**how each item was checked, against the chain, not the transcript:**

1. **all nine results, individually.** `GET /contracts/results/{hash}` for each hash above,
   cross-checked against `GET /transactions?timestamp={consensus_timestamp}` for the fee
   split. seven `SUCCESS`, two `CONTRACT_REVERT_EXECUTED`, exactly as expected: the forced
   transfer to an unverified holder, and one redundant `grantKyc` call explained in item 7.
   the two reverts are the only transactions on this token that pay a relay-operator split
   (`0.0.7314364`, 133,173 tinybar each); every successful call was charged entirely to the
   issuer, matching the pattern G1 already established for the deploy transaction.

2. **the revert reason, and the selector recomputed independently, not trusted.** the blocked
   transfer's `error_message` is `0xfc855b1b0000000000000000000000007b3f60333a54e03c4ee4240d2ba2f9600c502e1e`.
   `ethers.id("InvalidKycStatus()").slice(0,10)` computed fresh in this session returns
   `0xfc855b1b`, an exact match against
   `asset-tokenization-contracts/contracts/facets/kyc/IKyc.sol:57`. the trailing word is not a
   declared error argument: `ERC1594StorageWrapper.sol:610` returns
   `IKyc.InvalidKycStatus.selector` paired with `abi.encode(account)`, and
   `ERC1594StorageWrapper.sol:291` passes both to `LowLevelCall.revertWithData`, which
   concatenates them by hand for a richer revert. so the appended
   `0x7b3f60...c502e1e` is the offending account, encoded on purpose, and it identifies the
   holder, exactly the recipient of the transfer. confirmed a compliance failure, not gas
   (gas used 112,072 of a 1,200,000 limit, nowhere near exhausted) and not a bad address (the
   `to` address decodes to a real, funded, non-deleted account, see item 4 and item 6).

3. **final state, read live, not from a prior claim.** `eth_call` against
   `0xc10cac0e7afd175faf04572327c85e54f015ca87` at `"latest"`: `balanceOf(issuer) = 0x124f8 =
   75,000` raw, `balanceOf(holder) = 0x61a8 = 25,000` raw, `balanceOf(lender) = 0`,
   `totalSupply() = 0x186a0 = 100,000` raw, unchanged from the mint. at 2 decimals (G1): 750.00
   / 250.00 / 0.00 / 1000.00 notes. all four match the claim exactly.
   `getKycStatusFor(account)` returns `1` (`GRANTED`) for issuer, holder and lender, all
   three, at `"latest"`.

4. **the load-bearing check. decoded both transfers' calldata field by field, not just
   compared hex strings, though the hex strings are in fact byte-for-byte identical.**
   selector `0x3bc9bcd8` = `transferByPartition(bytes32,(address,uint256),bytes)`
   (`TransferByPartitionFacet.sol`, confirmed against the compiled ABI). decoding both
   transactions with `ethers.Interface.decodeFunctionData` gives, for both the blocked
   attempt and the permitted one: `partition = 1`, `to =
   0x7b3F60333a54e03c4eE4240d2bA2F9600C502E1e`, `value = 25000`, `data = 0x`. the full 330
   character calldata strings for `0x904d61cc...` and `0x582b822d...` are **identical**,
   confirmed with a direct string comparison in this session, not eyeballed. same sender
   (both `from` the issuer's EVM address), same partition, same recipient, same amount, same
   trailing data. the only thing that changed between the two is the holder's KYC status,
   verified by block number in item 6. the demo's central contrast holds.

5. **credential identifiers, decoded, not assumed.** all three `grantKyc` calls
   (`grantKyc(address,string,uint256,uint256,address)`, selector `0x81bea54d`, confirmed
   against `IKyc.sol:87-93`) were decoded in full:

   | account | `_vcId` | `_validFrom` | `_validTo` | `_issuer` |
   |---|---|---|---|---|
   | issuer (self) | `covenant-testnet-kyc-56a45ef1` | 1789049472 | 2104409532 | issuer |
   | holder | `covenant-testnet-kyc-7b3f6033` | 1789049864 | 2104409924 | issuer |
   | lender | `covenant-testnet-kyc-b85d1ed5` | 1789050052 | 2104410112 | issuer |

   every `vcId` is a placeholder string built from the account's own address prefix, not any
   verifiable credential, exactly D18's description. nothing in the calldata, the event, or
   the stored `KycData` asserts a verified real-world identity. **this is a compliance gate
   exercised, not a verified identity.** the writeup must say the second, not the first.

6. **ordering, proven by block number, not by current state, per the instruction that current
   state cannot prove ordering.** `getKycStatusFor(holder)` called via `eth_call` at specific
   historical block numbers on the testnet relay:

   | block | what happened in that block | holder's kyc status, read at that block |
   |---|---|---|
   | 40345230 | one before the blocked transfer | `0` (`NOT_GRANTED`) |
   | 40345231 | the blocked transfer itself | `0` (`NOT_GRANTED`) |
   | 40345263 | the `grantKyc(holder)` call | `1` (`GRANTED`) |
   | 40345368 | the permitted transfer | `1` (`GRANTED`) |

   the holder was genuinely `NOT_GRANTED` when the transfer was refused and genuinely
   `GRANTED` when the same transfer settled, read directly off chain state at those blocks,
   not inferred from the fact that it is `GRANTED` now.

7. **one thing gamma's summary omitted, found while reconstructing the sequence, recorded for
   honesty rather than because it changes the claim.** between the holder's successful
   `grantKyc` (block 40345263) and the lender's `grantKyc` (block 40345351), there is a
   fourth `grantKyc(holder, ...)` call, `0x79576e7d...`, that **reverted**. it decodes to the
   same holder address and the same issuer, and it reverted with the bare `InvalidKycStatus()`
   selector (no appended argument this time). `Kyc.sol:75`'s `grantKyc` is gated
   `onlyValidKycStatus(KycStatus.NOT_GRANTED, _account)` — the holder was already `GRANTED`,
   so a second grant attempt correctly fails. this is not a defect and not part of the core
   demo path; it reads as an accidental double-submit that cost 0.08931972 HBAR to discover.
   it is included in the table above because it is a genuine on-chain event on this token and
   because it independently corroborates item 6: for this call to fail on "must be
   `NOT_GRANTED`" at block 40345294, the holder had to already be `GRANTED`, consistent with
   the direct `eth_call` read at that same block.

8. **the three prerequisite transactions the task asked argus to find, found and decoded, not
   just located.** `applyRoles(bytes32[],bool[],address)` (selector `0xfcfffeec`) at block
   40345031 applies `[ROLE_SSI_MANAGER, ROLE_KYC, ROLE_ISSUER]`, each recomputed independently
   from `constants/roles.sol:78,84,127` and matching the decoded calldata exactly, all three
   set `true`, to the issuer. `addIssuer(address)` (selector `0x20694db0`) at block 40345052
   registers the issuer itself as an SSI issuer, the prerequisite D18 flagged:
   `KycStorageWrapper.sol:126` reads every grant as `NOT_GRANTED` if `isIssuer(record.issuer)`
   is false. `grantKyc` (issuer, self) follows immediately after, letting the issuer clear
   `Mint.sol:48`'s `onlyIdentifiedAddresses` gate before minting to itself, exactly the chain
   D19 traced. all three now carry hashes and are in the table above.

9. **client-side refusal, noted but not independently chain-verifiable, and flagged as
   such.** the instruction states the SDK refuses this transfer client-side before
   submission, so the blocked attempt exists in two forms and the on-chain revert above was
   forced deliberately, bypassing the SDK's own `port/in` validation, via a direct ethers
   call in the same pattern already used for `setCouponRateType` (D16) and `grantKyc` (D18).
   argus can confirm the on-chain half of that claim (the revert above) but not the client-side
   half, since that happens before any transaction is constructed and leaves nothing on
   chain to check. reported here as provided by gamma, not as independently verified,
   consistent with D3: argus verifies chain state, and a refusal that never reaches the
   network has no chain state to verify.

**running HBAR cost on the issuer account, `0.0.10424387`, across every transaction recorded
in this file to date:**

| what | HBAR |
|---|---|
| G1, bond deploy | 7.80696070 |
| friction log B8, failed issuance attempt (issuer's share of the split fee) | 0.07161660 |
| G2, this block, all nine transactions above (issuer's share) | 2.63085809 |
| **running total** | **10.50943539** |

cross-checked against the issuer's live balance on the mirror node,
`GET /accounts/0.0.10424387`: **964.25001256 HBAR** as of the last transaction in this gate
(consensus timestamp `1789050155.313797104`). this is a live read, not a claim; re-running the
same query will show a lower number once G3 spends further.

## G3. coupon distributed

status: **VERIFIED**. **a submittable hedera entry exists.**

signed by `0.0.10424387` (issuer) throughout, token `0.0.10450229` /
`0xc10cac0e7afd175faf04572327c85e54f015ca87`, unchanged since G1/G2. all eight transactions
below, not five: the task supplied five hashes and asked argus to locate the three that
preceded them. all three were found on the token's own contract-result history
(`GET /contracts/0.0.10450229/results?...timestamp=gt:...`, the window between the last G2
transaction and the first supplied hash) and decoded, not merely located.

**the central claim, checked from calldata against the real struct shape, not by counting
words: CONFIRMED.** `setCoupon`'s selector is `0xb16fd0cc`, independently recomputed in this
session as `id("setCoupon((uint256,uint256,uint256,uint256,uint256,uint256,uint8,uint8))")
.slice(0,10)`, an exact match. the `Coupon` struct's field order was read directly from
`contracts/facets/coupon/ICouponTypes.sol:39-47`: `recordDate, executionDate, startDate,
endDate, fixingDate, rate, rateDecimals, rateStatus` — eight fields, eight 32-byte words after
the selector. decoded against that order, the submitted calldata's last three words are `rate
= 0, rateDecimals = 0, rateStatus = 0 (PENDING)`. the transaction's own `CouponSet` event —
signature `CouponSet(bytes32,uint256,address,(uint256,uint256,uint256,uint256,uint256,uint256,
uint8,uint8))`, independently recomputed as `0xbeb7fdc8c5c160b79de3e9c869bf2f6b287cbe29eb05d76
23537a427231942ee` and matching the emitted `topics[0]` exactly, source at
`ICoupon.sol:36-41` — carries the coupon **as stored**, in the same eight-word order, and its
last three words are `rate = 600, rateDecimals = 4, rateStatus = 1 (SET)`. the caller sent the
pending triplet; the token emitted the FIXED-rate triplet from its own storage in the same
transaction. **the token refused a rate from its caller and priced the coupon from what
`FixedRate.setRate` had written 33 seconds earlier.** this is the strongest single piece of
evidence in the project and it now rests on a decode checked against source, not on a word
count.

### the eight transactions, in order

| step | tx hash | block | timestamp (SGT) | gas used/limit | fee (issuer) | result |
|---|---|---|---|---|---|---|
| `applyRoles` (INTEREST_RATE_MANAGER, CORPORATE_ACTION → issuer) | `0xa4af41d077915da2c819fe39ab92e8d38df86f7f3ff050c3e252e5c1d71a6399` | 40348672 | 2026-09-11 00:19:15 | 304,520 / 4,000,000 | 0.34106240 HBAR | SUCCESS |
| `setCouponRateType(FIXED)` | `0xb0677394cef05a6324b900e349e522e577c19f4b05dbaf10d8a0739d50f358cc` | 40348683 | 2026-09-11 00:19:38 | 60,149 / 7,000,000 | 0.06736688 HBAR | SUCCESS |
| `FixedRate.setRate(600, 4)` | `0x9c92091520459b23d95608e3d10e4466016f29550ebdc3f386c96ee62684439d` | 40348701 | 2026-09-11 00:20:16 | 104,430 / 7,000,000 | 0.11696160 HBAR | SUCCESS |
| `setCoupon` (pending triplet) | `0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1` | 40348717 | 2026-09-11 00:20:49 | 633,035 / 7,000,000 | 0.70899920 HBAR | SUCCESS |
| trigger pending scheduled tasks, internal EVM queue, not the Hedera Schedule Service | `0x7738f48b23aa9ae53132b28332addde8c09836311b9b43541644629af83576b0` | 40349417 | 2026-09-11 00:45:32 | 160,996 / 7,000,000 | 0.18031552 HBAR | SUCCESS |
| `grantRole` (ROLE_MATURITY_MANAGER → issuer) | `0x4a2c16f1eae577af8168de86b6942f2360dd6ba983cde39133efd8bb9fc0568d` | 40349422 | 2026-09-11 00:45:43 | 179,949 / 2,000,000 | 0.20154288 HBAR | SUCCESS |
| `updateMaturityDate` (compress) | `0x98e9a148cef1403825421a52f9f8f26571b553b20b9d3cf75a6596e4bcbb4b33` | 40349428 | 2026-09-11 00:45:56 | 67,331 / 7,000,000 | 0.07541072 HBAR | SUCCESS |
| settle in HBAR — **agent action, not an ATS operation, see below** | `0x98043075ddd2ddecb63a8b93f7a9c11b59c0e91e4e2cbfa016cd699dd87f8404` | 40349435 | 2026-09-11 00:46:10 | 21,000 / 22,828 | 0.02352000 HBAR + 3.69863014 HBAR paid | SUCCESS |

hashscan: replace the hash into `https://hashscan.io/testnet/transaction/{hash}` for each row,
e.g. the coupon declaration is
https://hashscan.io/testnet/transaction/0x436298a6b0573ea3fe55fcb28e2b018f09b3e4465b2305d24b3f324c1318adf1.

all eight transactions above are `SUCCESS`, `status: "0x1"`, `error_message: null`, confirmed
individually against `GET /contracts/results/{hash}`, and each carries real, non-trivial gas
(`gas_consumed` between 21,000 and 633,035, none at its limit, none a bare-revert-sized
stub) and a real HBAR fee charged entirely to the issuer, cross-checked against
`GET /transactions?timestamp=` for the fee split on every row. no relay-operator split on any
of the eight, matching the pattern established for every successful call in G1 and G2.

### how each item in the task was checked, against the chain

1. **the three prerequisite transactions, found and decoded, not just located.**
   `applyRoles(bytes32[],bool[],address)` (selector `0xfcfffeec`, recomputed) at consensus
   `1789057155.383099745` decodes to roles
   `[0xfa80c71f8de1628faf2c0e9bd02c2f4a3da1f16823b75e61e84b90164a07b4a4,
   0xa1acfc499025c99f55059195e6276f639d34a18aad7b8121b9192b7f438c55cd]` —
   `INTEREST_RATE_MANAGER` and `CORPORATE_ACTION`, exact match against `ROLES_C` in
   `lib/ats/coupon.ts:111-115` — `actives = [true, true]`, target `0x56a4...c742` (issuer).
   `setCouponRateType(uint8)` (selector `0x5f88f0d5`, recomputed) at `1789057178.750002328`
   sends `2` (`FIXED`). `FixedRate.setRate(uint256,uint8)` (selector `0xd1923502`, recomputed)
   at `1789057216.838020739` sends `(600, 4)`, exactly the engine's converted output — see
   item 3 below.

2. **`getCouponRateType() == 2` (FIXED), proven by block number that the switch happened
   while `getCouponCount()` was still 0, not inferred from current state.** `eth_call` at
   historical block tags on the testnet relay:

   | block | `getCouponRateType()` | `getCouponCount()` |
   |---|---|---|
   | 40348672 (`applyRoles` block) | `1` (STANDARD) | `0` |
   | 40348682 (one before the switch) | `1` (STANDARD) | `0` |
   | 40348683 (`setCouponRateType` block) | **`2` (FIXED)** | `0` |
   | 40348701 (`FixedRate.setRate` block) | `2` | `0` |
   | 40348716 (one before `setCoupon`) | `2` | `0` |
   | 40348717 (`setCoupon` block) | `2` | **`1`** |

   the type flipped to FIXED at block 40348683 while the coupon count was still zero, and
   stayed zero for 34 further blocks until `setCoupon` itself landed at 40348717. the switch
   happened strictly before any coupon existed, by the chain's own history, exactly the
   ordering `DECISIONS.md` D16 and `specs/05-coupon-rate-surface.md` §6 required and the only
   thing current state cannot prove.

3. **`getRate()` reads `(600, 4)` — 6.00% — and it equals `rateForKpi`'s output for the
   engine's KPI, checked as arithmetic, not asserted.** `expectedRateFromImpact` in
   `lib/ats/note-terms.ts:170-189` was run by hand for `impact = 200` (2.00x leverage, the
   `DEMO_KPI_VALUES.improved` constant): `delta = floor(1e6 * (300-200)/(300-100)) = 500000`,
   `rate = 800 - floor(400 * 500000 / 1e6) = 800 - 200 = 600`. `rateForKpi(200)` therefore
   returns `{ rate: "600", rateDecimals: 4 }`, and `engineRateForSdk` converts that to the
   `SetRateRequest` fields `rate: "0.06", rateDecimals: 4`, which is exactly what the decoded
   `FixedRate.setRate` calldata sent on chain (`600` at `4` decimals, item 1 above). live
   `getRate()` on the token at `"latest"` returns `Result [600n, 4n]`, matching. **the rate on
   chain is the engine's number for a leverage reading of 2.00x**, checked by recomputing the
   same integer arithmetic the contract runs, not by comparing before/after.

4. **`snapshotId` on coupon 1 is non-zero, and what it fixed was read, not assumed.**
   `getCoupon(1)` returns `RegisteredCoupon{ coupon: (1789057304, 1789057364, 1781281244,
   1789057244, 1789057304, 600, 4, 1), snapshotId: 1 }` — snapshot id **1**, non-zero. the
   trigger-tasks transaction's log carries `SnapshotTriggered(uint256,bytes)`
   (`facets/snapshot/ISnapshots.sol:68`, signature independently recomputed as
   `0xf256aa4705d42c3984e319d2b0a2d1eb0a18a8a820922b71ba13e37c7699828c`, an exact match against
   the emitted `topics[0]`), decoding to `snapshotId = 1`, confirming that transaction is what
   took the snapshot `getCoupon` now reports. `getCouponFor(1, holder) = 25000` (250.00 notes),
   `getCouponFor(1, issuer) = 75000` (750.00 notes), `getCouponFor(1, lender) = 0` — the
   register the snapshot fixed matches `balanceOf` for all three accounts exactly
   (`balanceOf(holder) = 25000`, `balanceOf(issuer) = 75000`, `balanceOf(lender) = 0`, all read
   live). `getCouponAmountFor(1, account)` returns a `(numerator, denominator)` pair, not a
   token amount — confirmed by reading `ICoupon.sol`'s four writer methods (`setCoupon`,
   `cancelCoupon`, `forceCancelCoupon`, `initializeCoupon`) and finding no payment method
   anywhere on the facet, matching `specs/05-coupon-rate-surface.md` §3's finding that the
   coupon facet computes an entitlement and moves no value. holder: `116640000000000000 /
   31536000000000 = 3698.630136986...`, USD cents at the token's own scale; issuer:
   `349920000000000000 / 31536000000000 = 11095.890410958...`, exactly three times the
   holder's figure, matching the 3:1 balance ratio (75000:25000). **so ATS declared the
   coupon, fixed the register by snapshot at record date, and made entitlements readable. it
   moved no value** — no `pay` function exists on the facet and none was called.

5. **the maturity compression, and the discrepancy recorded deliberately.**
   `updateMaturityDate(uint256)` (selector `0xc7a6ca35`) sent `1789059351`. the transaction's
   own state-change record shows the maturity slot going from `0x70458571` (`1883604337` =
   **2029-09-09 07:25:37 SGT**) to `0x6aa2e117` (`1789059351` = **2026-09-11 00:55:51 SGT**),
   confirmed a second way by the `MaturityDateUpdated(address,uint256,uint256)` log the same
   transaction emits (`Maturity.sol:84`, `(token, newDate, oldDate)`), which decodes to the
   identical pair. **the token's own `name()`, read live via `name()` on the deployed
   contract, still returns "Covenant KPI-Linked Private Credit Note 2029".** so the note
   is named for a 2029 maturity and was compressed, deliberately, to mature on 2026-09-11 —
   effectively immediately — for the purpose of this demo. a judge who reads the name and then
   reads the maturity date will see the mismatch in under a minute. it is recorded here first,
   plainly: the 2029 in the name is the original three-year tenor set at issuance
   (`buildNoteTerms`, `startingDate + THREE_YEARS_SECONDS`, `lib/ats/note-terms.ts:280`), and
   `updateMaturityDate` compresses the demo's timeline, not the name. any writeup or video
   script must say this, not let a viewer discover it.

6. **the HBAR settlement — a plain transfer, confirmed as a separate agent action, not an ATS
   operation.** the transaction's `to` is `0x7b3f60333a54e03c4ee4240d2ba2f9600c502e1e`, the
   note holder's own EVM address (`0.0.10444395`, the same account G2 labelled "note holder"),
   not the token contract `0xc10cac0e...ca87`. `function_parameters: "0x"`, `call_result:
   "0x"`, `gas_consumed: 21000` — the fixed base cost of a value transfer with no calldata and
   no contract code at the destination, nowhere near a contract call's gas floor. the mirror
   node's `/transactions?timestamp=` record for this consensus timestamp shows two transfers
   only: `0.0.10424387 -> -372215014` and `0.0.10444395 -> +369863014`, a direct
   account-to-account movement. **nothing about this transaction touched
   `0.0.10450229`.** the amount, checked against the holder's on-chain entitlement from item 4:
   `369863014` tinybar = `3.69863014` HBAR, against an entitlement of `3698.630136986...` (the
   token's own USD-cent-scaled unit from `getCouponAmountFor`). `3698.630136986... / 1000 =
   3.698630136986...`, which rounds to eight decimal places as `3.69863014` — an exact match.
   **the settlement scale is 1 HBAR per 1,000 of entitlement**, chosen because the facility's
   nominal is in USD and testnet HBAR is the only asset available to move on screen; it is a
   manual, off-protocol conversion the issuer/agent performs after reading `getCouponFor` /
   `getCouponAmountFor`, exactly as `lib/ats/coupon.ts`'s own header comment states no
   `Coupon.pay` exists. **the issuer holds 750.00 notes, is entitled to the equivalent of
   3,698.63 (at 100x the settlement unit, i.e. USD 11,095.89 at the token's own scale), and
   was not paid** — no transaction anywhere in this file or on the token's history moves HBAR
   or any other value to `0.0.10424387`. this is a deliberate demo simplification (the issuer
   does not pay itself) and it must be stated as such, not left for a judge to notice as an
   omission.

**running HBAR cost on the issuer account, `0.0.10424387`, across every transaction recorded
in this file to date:**

| what | HBAR |
|---|---|
| G1, bond deploy | 7.80696070 |
| friction log B8, failed issuance attempt (issuer's share of the split fee) | 0.07161660 |
| G2, nine transactions (issuer's share) | 2.63085809 |
| G3, seven network fees (`applyRoles` through `updateMaturityDate`) | 1.69165920 |
| G3, settlement transaction fee | 0.02352000 |
| G3, settlement value paid to the holder (not a network fee, a value transfer) | 3.69863014 |
| **running total debited from the issuer** | **15.92324473** (of which **5.41380934** was this gate) |

cross-checked against the issuer's live balance on the mirror node, `GET
/accounts/0.0.10424387`: **958.83620322 HBAR** as of the last transaction in this gate
(consensus timestamp `1789058770.190111778`). `964.25001256 - 958.83620322 = 5.41380934`
HBAR, matching the sum of this gate's seven network fees, the settlement fee, and the
settlement value **to the tinybar** (`171,517,920 + 2,352,000 + 369,863,014 = 541,380,934`
tinybar `= 5.41380934` HBAR). this is a live read cross-checked against an independent sum,
not a running total taken on faith; re-running the same query will show a lower number once
G4 spends further.

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

**`BUG.md` is canonical.** it holds the analysis, the severity, the file-and-line citations
and the suggested fix for every defect. this table is a pointer only: the defect number, a
one-line description, and the on-chain evidence where there is any. no duplicated prose, read
`BUG.md` for the reasoning.

| defect | what | on-chain evidence |
|---|---|---|
| B1 | `Bond.createKpiLinkedRate` cannot reach any real deployment; config 4 is registered in the deployed resolver and unreachable by any working path | none. client-side `TypeError`, no transaction constructed. facet readiness re-derived live against resolver `0.0.9212226`, see G1 item 6 above |
| B2 | the sdk cannot be loaded in any browser bundler without hand-written shims | none, build-time finding |
| B3 | the published ESM build cannot be loaded by node | none, build-time finding |
| B4 | `RequestAccount.privateKey` is exposed on the public request interface and consumed by nothing | none, source-only finding |
| B5 | `@hashgraph/hedera-wallet-connect@2.1.2` has an undeclared dependency | none, dependency-tree finding |
| B6 | `Bond.createKpiLinkedRate`'s declared return type does not match its runtime value | none, source-only finding |
| B7 | `ROLE_MATURITY_MANAGER` is missing from the sdk's role enum | none, source-only finding |
| B8 | `Security.checkISIN` accepts an ISIN the deployed factory rejects, costing gas to discover | reverted transaction `0x305fbb1a04946a5c4e18dd98675f0891934b8db699633fba0579e4a345a02a0b`, selector `0x342c92db` = `WrongISINChecksum(string)`, consensus timestamp `1788996044.808119873` (2026-09-10 07:20:44 SGT), tx id `0.0.7314364-1788996041-506049004`, `error_message` decodes to the offending string `XS9999COV001`. cost `18,855,433` tinybar total (`0.18855433` HBAR), split across relay operator `0.0.7314364` (`11,693,773` tinybar) and issuer `0.0.10424387` (`7,161,660` tinybar / `0.0716166` HBAR). the reissue five minutes later with a valid checksum, `XS9999COV006`, is the live token in G1 above. hashscan: https://hashscan.io/testnet/transaction/0x305fbb1a04946a5c4e18dd98675f0891934b8db699633fba0579e4a345a02a0b |
| W1 | withdrawn, not filed. `HoldDetails` constructor param named `executionTimeStamp`, assigned to `expirationTimeStamp`. cosmetic rename, zero behavioural effect, see `BUG.md` for why | none, source-only finding, no defect |
| W2 | withdrawn, not filed. `scheduledTask` briefly misread as the hedera schedule service. our misreading, the docs are accurate, see `BUG.md` for why | none, source-only finding, no defect |
