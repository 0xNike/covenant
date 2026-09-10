# 05. coupon and rate surface — block C

ground truth: `~/projects/hackathon/hedera/asset-tokenization-studio` (clone), tag `v.8.0.0-ats`.
every claim below is read from that clone or from `node_modules/@hashgraph/asset-tokenization-contracts`
and `node_modules/@hashgraph/asset-tokenization-sdk` in this repo, both installed at the matching
version. no interpolation. "NOT FOUND" is used where a search came back empty and the search is
described.

token is on config `0x...02` (bond variable rate). `addKpiData` / `KpiLinkedRateFacet` are
unavailable — see `BUG.md` B1 and `DECISIONS.md` D16. this spec covers the fixed-rate path only.

---

## 0. the critical blocker (item 2) — checked, the path is alive

apollo's read is correct on every point. the pending triplet **can** be constructed through the
sdk.

`CouponRateDispatch.validateAndStamp` (`packages/ats/contracts/contracts/domain/asset/coupon/CouponRateDispatch.sol:84-89`):
```solidity
if (rateType == IInterestRate.RateType.FIXED) {
    if (!_isPendingRate(resolved_)) revert IFixedRate.InterestRateIsFixed();
    (resolved_.rate, resolved_.rateDecimals) = InterestRateStorageWrapper.getRate();
    resolved_.rateStatus = ICouponTypes.RateCalculationStatus.SET;
    return resolved_;
}
```
`_isPendingRate` (`:110-115`) requires `rateStatus == PENDING && rate == 0 && rateDecimals == 0`.

**`BigDecimal.fromString("0")` yields `decimals === 0`.** traced through the actual constructor,
not inferred:

- `BigDecimal.fromString(value, format)` (`packages/ats/sdk/src/domain/context/shared/BigDecimal.ts:161-166`):
  when `format` is `undefined`, it computes `format = BigDecimal.getDecimalsFromString(value)`,
  then calls `new BigDecimal(value, format)`.
- `getDecimalsFromString("0")` (`:148-154`): `val.length === 0`? no (`"0"` has length 1). splits on
  `"."` → `["0"]`, so `dec` is `undefined` → `if (!dec) return 0;`. **returns `0`.**
- constructor (`:29-37`): `dec = typeof format === "number" ? format : (decimals ?? 0)`. format is
  the number `0` from the step above, so `dec = 0`. `this.#decimals = 0`.
- `.toBigInt()` (`:106-108`) calls `parseUnits(this.value, this.#decimals)` = `parseUnits("0", 0)`
  = `0n`.

so `rate.toBigInt() === 0n` and `rate.decimals === 0`, which is exactly what
`SetCouponCommandHandler.execute` sends as the on-chain `rateDecimals`:

`SetCouponCommandHandler.ts:32-41` (`packages/ats/sdk/src/app/usecase/command/bond/coupon/set/SetCouponCommandHandler.ts`):
```ts
const res = await handler.setCoupon(
  securityEvmAddress,
  BigDecimal.fromString(recordDate),
  BigDecimal.fromString(executionDate),
  BigDecimal.fromString(rate),          // rate = "0"
  BigDecimal.fromString(startDate),
  BigDecimal.fromString(endDate),
  BigDecimal.fromString(fixingDate),
  rateStatus,
  address,
);
```
and `RPCTransactionAdapter.setCoupon` (`:606-640`) builds:
```ts
const couponStruct = {
  ...
  rate: rate.toBigInt(),          // 0n
  rateDecimals: rate.decimals,    // 0
  ...
  rateStatus: CastRateStatus.toNumber(rateStatus),
};
```

**`rateStatus` must be `0` (PENDING).** `RateStatus` enum (`packages/ats/sdk/src/domain/context/bond/RateStatus.ts:3-21`):
`PENDING = "PENDING"`, `SET = "SET"`; `CastRateStatus.toNumber(PENDING) === 0`. on-chain,
`ICouponTypes.RateCalculationStatus` (`packages/ats/contracts/contracts/facets/coupon/ICouponTypes.sol:20-23`)
is `{ PENDING, SET }` — `PENDING == 0` too. the encodings agree.

**validation does not reject `rate: "0"`.** `SetCouponRequest.rate` is checked by
`FormatValidation.checkAmount(true)` (`SetCouponRequest.ts:39`, `zeroIsValid = true`). traced
(`packages/ats/sdk/src/port/in/request/FormatValidation.ts:173-193`): for `val = "0"`,
`valueDecimals = 0`, `zero = BigDecimal.fromString("0", 0)`, `value = BigDecimal.fromString("0")`
(decimals 0 per above). `zeroIsValid && value.isLowerThan(zero)` → `0 < 0` → `false`, no error.
`valueDecimals(0) > decimals(18)` → `false`, no error. **`rate: "0"` passes.**

**conclusion: the pending triplet `{ rate: "0", rateStatus: 0 }` reaches the contract intact.
the fixed-rate path is not dead.** the `SetCouponRequest` field passed to the sdk is literally
`rate: "0", rateStatus: 0` — see §4 below for the full field list.

---

## 1. `setCouponRateType(RateType)`

### contract

`packages/ats/contracts/contracts/facets/interestRate/IInterestRate.sol:67`:
```solidity
function setCouponRateType(RateType rateType) external;
```
implementation, `InterestRate.sol:36-42`:
```solidity
function setCouponRateType(
    IInterestRate.RateType rateType
) external override onlyOperational onlyActivated onlyRole(ROLE_INTEREST_RATE_MANAGER) onlyValidRateType(rateType) {
    // TODO: check if changing the rate type is allowed after existing coupons have been issued
    InterestRateStorageWrapper.setCouponRateType(rateType);
    emit CouponRateTypeSet(msg.sender, rateType);
}
```
modifiers: `onlyOperational`, `onlyActivated`, `onlyRole(ROLE_INTEREST_RATE_MANAGER)`,
`onlyValidRateType(rateType)` (reverts `InvalidRateType` if `rateType == NONE`,
`IInterestRate.sol:50,56,64`). role: **`ROLE_INTEREST_RATE_MANAGER`**
(`0xfa80c71f8de1628faf2c0e9bd02c2f4a3da1f16823b75e61e84b90164a07b4a4`, `roles.sol:47-48`;
sdk mirror `SecurityRole._INTEREST_RATE_MANAGER_ROLE`, same hex, `SecurityRole.ts:35`).

enum `RateType` (`IInterestRate.sol:24-29`):
```
NONE = 0        // implicit default, coupon rate forced to (0,0), setCouponRateType(NONE) reverts
STANDARD = 1
FIXED = 2
KPI_LINKED = 3
```

### not exposed in port/in — confirmed

`grep -rln "setCouponRateType" packages/ats/sdk/src/` returns **zero matches**.
`grep -rn "InterestRateFacet" packages/ats/sdk/src/` returns **zero matches** — the sdk has no
port/in, no command, no query anywhere in `src` that touches this facet's writer surface. only
`FixedRate.setRate`/`getRate` and `Coupon.setCoupon`/`getCoupon` exist, both of which read the
*result* of a rate type that must already be set. apollo's finding confirmed.

### what a direct ethers call needs — and there is a shortcut

`IAsset.sol` (`packages/ats/contracts/contracts/facets/IAsset.sol:281`) inherits `IInterestRate`
alongside `ICoupon` and `IFixedRate` (lines 209, 230). the sdk itself calls every coupon/rate
method through `IAsset__factory.connect(security, signer)` (`RPCTransactionAdapter.ts:63,
322, 339, 606-640, 2404-2418`) — so the aggregated `IAsset` ABI the sdk already uses **contains**
`setCouponRateType`, it is simply never called from `src`.

**that factory is already in this repo's `node_modules`**, via
`@hashgraph/asset-tokenization-contracts` (a transitive dependency of
`@hashgraph/asset-tokenization-sdk@8.0.0`, resolved at
`node_modules/@hashgraph/asset-tokenization-contracts`). confirmed present:
`node_modules/@hashgraph/asset-tokenization-contracts/typechain-types/factories/contracts/facets/IAsset__factory.ts`,
which contains the ABI fragment (line 17981):
```ts
{
  inputs: [{ internalType: "enum IInterestRate.RateType", name: "rateType", type: "uint8" }],
  name: "setCouponRateType",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}
```
and `getCouponRateType` at line 10875.

**gamma does not need to hand-write an ABI fragment.** import `IAsset__factory` from
`@hashgraph/asset-tokenization-contracts` (package main:
`./build/typechain-types/index.js`, types at `./build/typechain-types/index.d.ts`) and call:
```ts
IAsset__factory.connect(tokenEvmAddress, signer).setCouponRateType(2) // FIXED
```
this is a MetaMask-signed transaction like every other call in this repo — no local key, per
`specs/00-mission.md`.

gas: no `GAS.SET_COUPON_RATE_TYPE` constant exists in `packages/ats/sdk/src/core/Constants.ts` —
searched, not present, because the sdk never calls this method. do not invent one; gamma should
either estimate or reuse a comparable constant (`GAS.SET_RATE: 7000000`,
`packages/ats/sdk/src/core/Constants.ts:166`) and note in `EVIDENCE.md` that it is not an
upstream-sanctioned figure.

### the maintainer TODO and whether a late switch is safe

`InterestRate.sol:38` (inside `setCouponRateType`, immediately before the storage write):
```solidity
// TODO: check if changing the rate type is allowed after existing coupons have been issued
```
nothing in `InterestRateStorageWrapper.setCouponRateType` (checked — it is an unconditional
storage write, no guard against existing coupons) or in `CouponRateDispatch` prevents the type
from being changed after coupons exist. the switch itself always succeeds if the caller holds
the role.

what breaks is downstream, in `CouponRateDispatch.validateAndStamp` and `.resolveRate`, and it
is real:

- **existing FIXED coupons already stamped `SET`** are unaffected at read time —
  `getCoupon`/`CouponStorageWrapper.getCoupon` (`CouponStorageWrapper.sol:250-251`) only calls
  `resolveRate` `if (registeredCoupon_.coupon.rateStatus != SET)`. a coupon that was already
  stamped keeps its stamped rate regardless of what the type is switched to later.
- **existing coupons still `PENDING`** (e.g. a KPI-linked coupon scheduled before a switch away
  from KPI_LINKED) will resolve under the *current* type at read/trigger time via
  `CouponRateDispatch.resolveRate` (`CouponRateDispatch.sol:43-54`), which dispatches purely on
  `InterestRateStorageWrapper.getCouponRateType()` — the live value, not the value at the time the
  coupon was scheduled. a coupon created while `FIXED` and left pending would, after a switch to
  `KPI_LINKED`, resolve as KPI-linked; there is no per-coupon record of "the type in effect when
  I was scheduled."
- switching **into** `FIXED` after a coupon already exists as `STANDARD` (`rateStatus == SET`,
  arbitrary caller-supplied rate) does not retroactively touch that coupon — `resolveRate` skips
  `SET` coupons entirely — but any *new* `setCoupon` call after the switch will hit the `FIXED`
  branch and reject a non-pending triplet.

**net: the maintainers' own uncertainty is warranted. nothing in the code prevents a late switch,
but a switch changes how any still-pending coupon resolves, silently, because resolution is
type-keyed to live storage, not to the type at schedule time.** this is D16's ordering constraint
independently verified from source, not just accepted on faith — see §7. it is also a clean line
for the writeup's feedback section.

---

## 2. `FixedRate.setRate(newRate, newRateDecimals)`

### contract

`packages/ats/contracts/contracts/facets/fixedRate/FixedRate.sol:29-36`:
```solidity
function setRate(
    uint256 _newRate,
    uint8 _newRateDecimals
) external override onlyOperational onlyActivated onlyUnpaused onlyRole(ROLE_INTEREST_RATE_MANAGER) {
    InterestRateStorageWrapper.setRate(_newRate, _newRateDecimals);
    emit RateUpdated(EvmAccessors.getMsgSender(), _newRate, _newRateDecimals);
}
```
role: `ROLE_INTEREST_RATE_MANAGER` (same constant as §1 — one grant covers both operations).
modifiers: `onlyOperational`, `onlyActivated`, `onlyUnpaused`, `onlyRole(ROLE_INTEREST_RATE_MANAGER)`.
event: `RateUpdated(address indexed operator, uint256 newRate, uint8 newRateDecimals)`
(`IFixedRate.sol:39`).

**no `InterestRateIsFixed` guard on `setRate` itself** — that error is thrown by `CouponRateDispatch`
on `setCoupon`, not here. `setRate` can be called at any time the role holder likes, repeatedly;
`IFixedRate.sol`'s own doc comment ("once set, the rate may be updated ... at any time") is
accurate for this function. the `InterestRateIsFixed` error name is misleading — it does not mean
"the rate is locked and cannot be changed," it means "coupon creation cannot carry its own rate
because the type is FIXED."

### exposed in port/in — yes

`packages/ats/sdk/src/port/in/interestRates/fixedRate/FixedRate.ts:24-29`:
```ts
async setRate(request: SetRateRequest): Promise<{ payload: boolean; transactionId: string }> {
  ValidatedRequest.handleValidation("SetRateRequest", request);
  return await this.commandBus.execute(new SetRateCommand(request.securityId, request.rate, request.rateDecimals));
}
```
`SetRateRequest` (`packages/ats/sdk/src/port/in/request/interestRates/SetRateRequest.ts:6-21`):
```ts
{ securityId: string; rate: string; rateDecimals: number }
```
all three fields required, no `@OptionalField`. validation: `securityId` via
`checkHederaIdFormatOrEvmAddress`, `rate` via `checkNumber({ min: 0 })`, `rateDecimals` via
`checkNumber({ min: 0 })` (`SetRateRequest.ts:13-15`) — no upper bound on either.

`SetRateCommandHandler.execute` (`packages/ats/sdk/src/app/usecase/command/interestRates/setRate/SetRateCommandHandler.ts:29-50`)
additionally: calls `validationService.checkPause(securityId)` and
`validationService.checkRole(SecurityRole._INTEREST_RATE_MANAGER_ROLE, account.id, securityId)`
client-side before sending the tx (so a missing role fails fast with a clear sdk error, not just
a bare revert), then `BigDecimal.fromString(rate, rateDecimals)` — **decimals here are exactly
what the caller passes**, not auto-derived (contrast with `SetCouponRequest.rate`, §0, which has
no `rateDecimals` field and is always auto-derived to match the string's own decimal places).

`RPCTransactionAdapter.setRate` (`:2404-2418`) sends `[rate.toBigInt(), rateDecimals]` to
`IAsset.setRate`. gas: `GAS.SET_RATE: 7000000` (`Constants.ts:166`).

---

## 3. `setCoupon` end to end

### request — `SetCouponRequest`

`packages/ats/sdk/src/port/in/request/bond/SetCouponRequest.ts:9-71`. **every field is
required — no `@OptionalField` anywhere on this class**, but three are effectively load-bearing
in ways not obvious from the type alone:

| field | type | validated by | gotcha |
|---|---|---|---|
| `securityId` | `string` | `checkHederaIdFormatOrEvmAddress` | — |
| `rate` | `string` | `checkAmount(true)` (zero valid) | **must be `"0"` under FIXED**, see §0 |
| `recordTimestamp` | `string` | `checkDateTimestamp(val, nowSeconds, executionTimestamp)` | must be `>= now` and `<= executionTimestamp` |
| `executionTimestamp` | `string` | `checkDateTimestamp(val, recordTimestamp, undefined)` | must be `>= recordTimestamp`, no upper bound |
| `startTimestamp` | `string` | **not validated directly** — only referenced as the min bound for `endTimestamp` | there is no constructor check that rejects a bad `startTimestamp` on its own; it silently anchors the `endTimestamp` check |
| `endTimestamp` | `string` | `checkDateTimestamp(val, startTimestamp, undefined)` | must be `>= startTimestamp` |
| `fixingTimestamp` | `string` | `checkDateTimestamp(val, undefined, executionTimestamp)` | must be `<= executionTimestamp`, no lower bound |
| `rateStatus` | `number` | `Bond.checkRateStatus(val)` | **must be `0` (PENDING) under FIXED**, see §0 |

`rate` has no `rateDecimals` sibling field — it is auto-derived from the string's own decimal
places via `BigDecimal.fromString(rate)` inside `SetCouponCommandHandler` (§0). sending `"0"`
is what makes `rateDecimals` come out `0`, which is required for the pending triplet.

### port/in

`packages/ats/sdk/src/port/in/coupon/Coupon.ts:57-83`:
```ts
async setCoupon(request: SetCouponRequest): Promise<{ payload: number; transactionId: string }> {
  const { rate, recordTimestamp, executionTimestamp, securityId, startTimestamp, endTimestamp, fixingTimestamp, rateStatus } = request;
  ValidatedRequest.handleValidation("SetCouponRequest", request);
  return await this.commandBus.execute(
    new SetCouponCommand(securityId, recordTimestamp, executionTimestamp, rate, startTimestamp, endTimestamp, fixingTimestamp, CastRateStatus.fromNumber(rateStatus)),
  );
}
```
exported as `CouponToken` (`Coupon.ts:271-272`, default export name is `CouponToken`, not
`Coupon`).

### role and contract-side gate

**`ROLE_CORPORATE_ACTION`**, not `ROLE_INTEREST_RATE_MANAGER`. `Coupon.sol:52-73`:
```solidity
function setCoupon(
    ICouponTypes.Coupon calldata _newCoupon
) external override onlyOperational onlyActivated onlyUnpaused onlyRole(ROLE_CORPORATE_ACTION)
    onlyValidDates(_newCoupon.startDate, _newCoupon.endDate)
    onlyValidDates(_newCoupon.recordDate, _newCoupon.executionDate)
    onlyValidDates(_newCoupon.fixingDate, _newCoupon.executionDate)
    onlyValidTimestamp(_newCoupon.recordDate)
    onlyValidTimestamp(_newCoupon.fixingDate)
    onlyValidCouponEndDate(_newCoupon.endDate)
    returns (uint256 couponID_)
{ ... }
```
sdk mirror: `SecurityRole._CORPORATEACTIONS_ROLE =
"0xa1acfc499025c99f55059195e6276f639d34a18aad7b8121b9192b7f438c55cd"` (`SecurityRole.ts:12`),
same hex as `ROLE_CORPORATE_ACTION` (`roles.sol:44-45`).

on-chain date checks (`DatesValidation.sol:11-22`, `DateValidationModifiers.sol:27-49`,
`CouponModifiers.sol:23-26`):
- `checkDates(first, second)`: reverts `WrongDates` if `second < first`. applied to
  `(startDate, endDate)`, `(recordDate, executionDate)`, `(fixingDate, executionDate)`.
- `checkTimestamp(t)`: reverts `InvalidTimestamp` if `t == 0`. applied to `recordDate`,
  `fixingDate`.
- `checkEndDateAgainstMaturity(endDate)` (`CouponStorageWrapper.sol:183-188`): if the security's
  maturity date is non-zero, `endDate` must be `<=` it (`DatesValidation.checkDates`).
  **the sdk request has no field for maturity date and does not check this client-side** —
  searched `SetCouponRequest.ts` and `SetCouponCommandHandler.ts`, no maturity cross-check
  present. a coupon `endDate` past maturity will pass sdk validation and revert on-chain.
  set `endTimestamp` before the bond's maturity date.

**note: `checkDates` allows `first == second`** (only rejects `second < first`), so
`recordDate == executionDate` and `startDate == endDate` are both accepted on-chain, unlike
what "must be strictly before" would imply.

### what `validateAndStamp` does per rate type (`CouponRateDispatch.sol:71-102`)

| type | behaviour |
|---|---|
| `NONE` | forces `rate=0, rateDecimals=0, rateStatus=SET` regardless of input — coupon always pays zero |
| `STANDARD` | passes the caller's `rate`/`rateDecimals` through unchanged, but **requires `rateStatus == SET`** already — reverts `InterestRateIsStandard` if you send a pending triplet |
| `FIXED` | **rejects any non-pending triplet** with `InterestRateIsFixed`, then stamps `rate`/`rateDecimals` from `InterestRateStorageWrapper.getRate()` (i.e. whatever `FixedRate.setRate` last wrote) |
| `KPI_LINKED` | rejects any non-pending triplet with `InterestRateIsKpiLinked`; stays `PENDING`, resolved lazily at read time — unreachable on our config-2 token, `BUG.md` B1 |

### how holders are determined, and what a holder actually receives

`setCoupon` schedules a snapshot task at `recordDate`
(`CouponStorageWrapper.initCoupon`, `:124-138`:
`ScheduledTasksStorageWrapper.addScheduledCrossOrderedTask(recordDate, SCHEDULED_TASK_TYPE_SNAPSHOT)`
+ `addScheduledSnapshot`). a holder's entitlement is read via `getCouponFor(couponId, account)`
(`CouponStorageWrapper.sol:262-300`): once `recordDate < block.timestamp` and the coupon is not
disabled, the holder's balance is read either from the snapshot (if one was taken) or from
`TokenCoreOps.getTotalBalanceForAdjustedAt` as a fallback, then combined with `rate`/`rateDecimals`
and the security's nominal value to compute `couponAmountFor` (a numerator/denominator pair, not
a token amount, via `_calculateCouponAmount`, not shown here).

**there is no on-chain payment.** grepped `packages/ats/contracts/contracts/facets/coupon/` for
`pay`/`transfer` — the only hits are doc comments describing amounts as "payable," never a
transfer call. `getCouponAmountFor`/`getCouponFor` are `view` functions. the coupon facet
computes what is owed; it does not move value. **whatever "a holder receives a coupon" means for
the demo, it is a separate, manual transfer** (HBAR or otherwise) that the issuer/agent must
perform after reading `getCouponFor`/`getCouponAmountFor` — there is no `Coupon.pay` or similar
method anywhere in `port/in`. confirmed by reading the full `ICoupon.sol` interface (4 writer
methods: `setCoupon`, `cancelCoupon`, `forceCancelCoupon`, `initializeCoupon` — no payment
method) and the full `CouponStorageWrapper.sol`.

gas: `GAS.SET_COUPON: 7000000` (`Constants.ts:59`).

---

## 4. `updateMaturityDate`

### contract

`packages/ats/contracts/contracts/facets/maturity/Maturity.sol:71-87`:
```solidity
function updateMaturityDate(
    uint256 _newMaturityDate
) external override onlyOperational onlyActivated onlyUnpaused onlyRole(ROLE_MATURITY_MANAGER)
    onlyValidMaturityDate(_newMaturityDate) returns (bool success_)
{
    emit MaturityDateUpdated(address(this), _newMaturityDate, MaturityDateStorageWrapper.getMaturityDate());
    MaturityDateStorageWrapper.setMaturityDate(_newMaturityDate);
    return true;
}
```
role: **`ROLE_MATURITY_MANAGER`** (`0xc20b7fd7efe1a2c9f69003a21c2c55c79ef84e16252b62599246ff01f6207314`,
`roles.sol:20-21`).

**contract-level constraint is weaker than the interface doc claims.**
`IMaturity.sol:64-67`'s natspec says "the new date must be strictly greater than the current
maturity date." the actual modifier, `onlyValidMaturityDate` →
`MaturityDateStorageWrapper.checkValidMaturityDate` (`MaturityDateStorageWrapper.sol:56-60`):
```solidity
function checkValidMaturityDate(uint256 _maturityDate) internal view {
    if (_maturityDate <= TimeTravelStorageWrapper.getBlockTimestamp()) {
        revert IMaturity.MaturityDateInvalid();
    }
}
```
**only checks `_maturityDate > now`. it does not compare against the existing maturity date at
all.** `MaturityModifiers.sol:16-18`'s own doc comment on the same modifier gets this right
("strictly greater than the current block timestamp") — so the two doc comments in the codebase
disagree with each other, and `MaturityModifiers.sol` is the one that matches the code.

**the "must be later than current maturity" rule is enforced only in the sdk, client-side, not
on-chain.** `ValidationService.checkMaturityDate` (`packages/ats/sdk/src/app/service/validation/ValidationService.ts:357-364`):
```ts
async checkMaturityDate(securityId: string, maturityDate: string): Promise<void> {
  const bondDetails = (await this.queryBus.execute(new GetBondDetailsQuery(securityId))).bond;
  if (parseInt(maturityDate) <= bondDetails.maturityDate) {
    throw new OperationNotAllowed("The maturity date cannot be earlier or equal than the current one");
  }
}
```
called from `UpdateMaturityDateCommandHandler.execute` (`:31`) before the transaction is sent.
so going through the sdk, both constraints apply (new date `> now` on-chain, new date `>` current
maturity date in the sdk); going around the sdk with a raw `IAsset__factory` call, only the
weaker on-chain constraint applies.

### exposed in port/in — yes

`Bond.updateMaturityDate(request: UpdateMaturityDateRequest)`
(`packages/ats/sdk/src/port/in/bond/Bond.ts:59` interface, `:341` implementation).
`UpdateMaturityDateRequest` (`packages/ats/sdk/src/port/in/request/bond/UpdateMaturityDateRequest.ts:8-23`):
```ts
{ securityId: string; maturityDate: string }
```
both required, no `@OptionalField`. `maturityDate` validated by
`SecurityDate.checkDateTimestamp(parseInt(val))` — with no `minTimeStamp`/`maxTimeStamp` args,
so `minDate = 0, maxDate = 0` and the `maxTimeStamp &&` guard short-circuits: **this client-side
check only rejects `value < 0`, i.e. it is a no-op for any non-negative timestamp.** the real
lower bound (`> now`) is enforced later by `checkMaturityDate` inside the command handler, not by
this request-level validator.

gas: `GAS.UPDATE_MATURITY_DATE: 7000000` (`Constants.ts:90`).

### `ROLE_MATURITY_MANAGER` missing from the sdk's `SecurityRole` enum — confirmed

`packages/ats/sdk/src/domain/context/security/SecurityRole.ts:6-41` lists 30 role members. it has
`_MATURITY_REDEEMER_ROLE` (line 33) but **no `_MATURITY_MANAGER_ROLE` entry at all.** confirmed by
reading the full enum body, not by search failure alone.

**raw hex to pass to `grantRole` directly** (from `roles.sol:20-21`, `/// @custom:hash role
MaturityManager`):
```
0xc20b7fd7efe1a2c9f69003a21c2c55c79ef84e16252b62599246ff01f6207314
```
this is a `bytes32` string, and `RoleRequest.role` is validated only by
`FormatValidation.checkBytes32Format()` (`RoleRequest.ts:16`) — a regex on shape, not a lookup
against `SecurityRole` — so passing this literal hex string works even though the TS enum has no
name for it.

---

## 5. every `grantRole` call block C needs

`Role.grantRole(request: RoleRequest)` — `packages/ats/sdk/src/port/in/role/Role.ts:57-62`:
```ts
async grantRole(request: RoleRequest): Promise<{ payload: boolean; transactionId: string }> {
  const { securityId, targetId, role } = request;
  ValidatedRequest.handleValidation("RoleRequest", request);
  return await this.commandBus.execute(new GrantRoleCommand(role!, targetId, securityId));
}
```
`RoleRequest` (`packages/ats/sdk/src/port/in/request/security/roles/RoleRequest.ts:7-22`):
```ts
{ securityId: string; targetId: string; role: string }
```
all required, no `@OptionalField`. `role` validated by `checkBytes32Format()` only (shape check,
not a member-of-enum check — this is why the missing-from-enum `ROLE_MATURITY_MANAGER` still
works when passed as a raw hex literal). gas: `GAS.GRANT_ROLES: 2000000`
(`Constants.ts:38`, used at `RPCTransactionAdapter.ts:408`).

`SecurityDataBuilder.ts:35-38` grants only `_DEFAULT_ADMIN_ROLE` to the diamond owner at creation
— confirmed, read the full `buildSecurityData` construction, the `rbacs` array contains exactly
one entry (`rbacAdmin`). every role below is a separate post-issuance `grantRole` call.

roles block C needs, in the order they are first used:

| role | constant name | hex | needed for | sdk enum member |
|---|---|---|---|---|
| interest rate manager | `ROLE_INTEREST_RATE_MANAGER` | `0xfa80c71f8de1628faf2c0e9bd02c2f4a3da1f16823b75e61e84b90164a07b4a4` | `setCouponRateType` (§1, direct ethers), `FixedRate.setRate` (§2, via sdk) | `SecurityRole._INTEREST_RATE_MANAGER_ROLE` |
| corporate action | `ROLE_CORPORATE_ACTION` | `0xa1acfc499025c99f55059195e6276f639d34a18aad7b8121b9192b7f438c55cd` | `setCoupon` / `cancelCoupon` (§3, via sdk) | `SecurityRole._CORPORATEACTIONS_ROLE` |
| maturity manager | `ROLE_MATURITY_MANAGER` | `0xc20b7fd7efe1a2c9f69003a21c2c55c79ef84e16252b62599246ff01f6207314` | `updateMaturityDate` (§4, via sdk) | **missing — pass the hex literal directly, see §4** |

no other role is required for the coupon/rate/maturity surface. `ROLE_CORPORATE_ACTION_FORCE_CANCEL`
exists (`roles.sol:36-38`) but is only needed for `forceCancelCoupon`, which is out of scope for
block C.

---

## 6. ordering constraints

1. **grant `ROLE_INTEREST_RATE_MANAGER` to the issuer/agent account** before anything else in
   this list — needed by both step 2 and step 4.
2. **`setCouponRateType(FIXED)`** (direct ethers via `IAsset__factory`, §1) — **must happen before
   the first `setCoupon` call.** not because the contract blocks a later switch (it does not,
   `InterestRateStorageWrapper.setCouponRateType` is an unconditional write, §1), but because:
   - any coupon already `setCoupon`'d under `STANDARD` or before a type is set at all (`NONE`,
     which forces `rate=0` permanently, §3 table) cannot be un-stamped — `resolveRate` only
     touches coupons still `PENDING`
   - switching **after** a coupon exists forecloses nothing technically, but D16's point stands:
     it collapses the differentiator if done wrong, and the maintainer TODO at
     `InterestRate.sol:38` is unresolved upstream, so there's no authoritative answer for what a
     late switch does to a coupon still pending under the old type other than what's traced in
     §1 (it resolves under the *new* type, silently, since resolution is keyed to live storage)
3. **grant `ROLE_CORPORATE_ACTION`** to the issuer/agent — needed for step 5.
4. **`FixedRate.setRate(rate, decimals)`** via `FixedRate.setRate` sdk port (§2) — must happen
   before step 5, because `CouponRateDispatch.validateAndStamp` under `FIXED` reads
   `InterestRateStorageWrapper.getRate()` **at `setCoupon` time** and stamps whatever is there. if
   `setRate` was never called, the stamped rate is the storage default (`0, 0`, since
   `InterestRateStorageWrapper` is a fresh slot and `FixedRate.initializeFixedRate` was never
   called on this config — config 2 does not carry `FixedRateData` init through `deployBond`,
   confirmed by `BUG.md` B1's finding that `initializeFixedRate` is what config 2 *does* expose,
   but the factory-supplied initial value is whatever `BondFixedRateDetailsData` would have
   supplied on the fixed-rate deploy path — **not independently verified for our actual
   deployment; check `getRate()` after issuance before assuming it is non-zero**).
5. **`setCoupon`** with the pending triplet (§0, §3) — requires steps 2 and 3 done, benefits from
   step 4 being done (otherwise the coupon stamps a `0` rate, which is valid but not useful).
6. **`updateMaturityDate`**, if used, has no ordering dependency on the above — it only needs
   `ROLE_MATURITY_MANAGER` (§4/§5) — but any `setCoupon` whose `endTimestamp` would land after a
   *reduced* maturity date is not itself blocked by `updateMaturityDate` (maturity only ever
   increases, §4), so no conflict is possible in that direction. a coupon scheduled with
   `endTimestamp` close to the current maturity date should be scheduled **after** any planned
   `updateMaturityDate` call, since `checkEndDateAgainstMaturity` (§3) is checked against
   whatever maturity date is live at `setCoupon` time.

**what breaks if `setCouponRateType(FIXED)` is called after a coupon already exists:** nothing
reverts. the call itself always succeeds for a role holder. what changes is read-time behaviour
for any coupon still `PENDING` at the moment of the switch (§1) — it will resolve under `FIXED`
even though it was scheduled expecting `STANDARD`/`KPI_LINKED`/`NONE` semantics, because
`CouponRateDispatch.resolveRate` dispatches on the *current* `getCouponRateType()`, not a
per-coupon record of the type at scheduling time. coupons already `SET` are unaffected. this is
inference from tracing `resolveRate` and `validateAndStamp` together, not a runtime observation —
it has not been reproduced against testnet by this session.

---

## 7. gotchas not already covered above, checked against the "four missed things" pattern

- `SetCouponRequest.startTimestamp` has **no independent validator** in the constructor — it is
  only ever read as the `minTimeStamp` argument inside the `endTimestamp` validator closure. a
  malformed `startTimestamp` (e.g. `"abc"`, which `parseInt` turns into `NaN`) will not be caught
  by `SetCouponRequest`'s own validation and will surface downstream as a `NaN` comparison or an
  on-chain revert instead of a clean sdk validation error.
- `CouponToken` is the actual default export name for the coupon port (`Coupon.ts:271`,
  `const CouponToken = new CouponInPort()`), not `Coupon` — importing `Coupon` from that module
  will not resolve.
- `FixedRate` (`FixedRate.ts:43`, `const FixedRate = new FixedRateInPort()`) is the sdk's fixed-rate
  port default export; do not confuse with `IFixedRate` (the contract interface) or
  `BondFixedRateDetails` (an unrelated issuance-time type from the dead `createBondFixedRate` path,
  `BUG.md` B1).
- `checkAmount`/`checkNumber` validators throughout this surface (`SetRateRequest.rate`,
  `SetRateRequest.rateDecimals`) have `min: 0` but **no upper bound** — the sdk will happily
  validate an absurd rate or decimals value; the contract itself has no explicit bound either
  (searched `FixedRate.sol` and `InterestRateStorageWrapper.sol` — `setRate` takes raw
  `uint256`/`uint8`, `uint8` for decimals caps it at 255 by type, nothing else).
- `SecurityDate.checkDateTimestamp` (used by both `SetCouponRequest` and
  `UpdateMaturityDateRequest`) treats an **omitted** `maxTimeStamp` as "no upper bound" via a
  falsy short-circuit (`maxTimeStamp &&`), not via `undefined` semantics — passing `0` explicitly
  as `maxTimeStamp` would also be treated as "no upper bound" rather than "reject everything,"
  which is a footgun if anyone parameterises this call generically. not currently exercised by
  either call site in this repo's scope, noted for gamma's awareness.

---

## sources checked and came back empty (documented per the "NOT FOUND" standard)

- `grep -rln "setCouponRateType" packages/ats/sdk/src/` → no matches (§1)
- `grep -rn "InterestRateFacet" packages/ats/sdk/src/` → no matches (§1)
- `find packages/ats/sdk/src -iname "IInterestRate*" -o -iname "InterestRateFacet*"` (excluding
  the `contracts` clone paths) → no matches — the sdk ships no local typechain/ABI binding for
  this facet at all; it is only reachable through the aggregated `IAsset` interface
- `grep -n "pay\|transfer" packages/ats/contracts/contracts/facets/coupon/*.sol` → only doc-comment
  prose ("payable"), no function (§3, holder payment)
- `grep -n "SET_COUPON_RATE_TYPE" packages/ats/sdk/src/core/Constants.ts` → not present, no gas
  constant exists for this operation since the sdk never calls it (§1)
