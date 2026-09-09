# 02. ATS SDK v8.0.0 operation surface

athena's research notes for the covenant ship order. every claim below cites a path and line
in the read-only clone at `~/projects/hackathon/hedera/asset-tokenization-studio`, tag
`v.8.0.0-ats`, exact match for our installed `@hashgraph/asset-tokenization-sdk@8.0.0`. paths
below are relative to `packages/ats/sdk/src` unless marked `contracts/...`, which is relative
to `packages/ats/contracts`. anything not found is marked NOT FOUND with where i looked.

no narrative except where a gotcha needs one sentence of why. gamma should be able to write
every call from this file without reopening the sdk.

---

## 0. network configuration (needed before any of the below)

the sdk resolves factory and resolver addresses from `NetworkService.configuration`, an
object typed `Configuration` at `domain/context/network/Configuration.ts:3-6`:

```ts
interface Configuration {
  factoryAddress: string;
  resolverAddress: string;
}
```

set via `SetConfigurationCommand`
(`app/usecase/command/network/setConfiguration/SetConfigurationCommand.ts`). our values:
`factoryAddress = 0.0.9213391`, `resolverAddress = 0.0.9212226`. `BondInPort.create` /
`createFixedRate` / `createKpiLinkedRate` all read `this.networkService.configuration.factoryAddress`
and `.resolverAddress` directly (`port/in/bond/Bond.ts:91-92`, `:161-162`, `:233-234`) and
wrap them in `ContractId` before passing to the command. if these are unset, the corresponding
`ContractId` arg is `undefined` and `CreateBondCommand` receives `undefined` for both.

**`port/in/factory/Factory.ts` is not the issuance entry point.** it only exposes
`getRegulationDetails` (`port/in/factory/Factory.ts:14-16`), a read query against
`GetRegulationDetailsQuery`. it does not have a `create` method. do not call it expecting to
deploy a bond.

---

## 1. issuance

### class / method
`BondInPort` (default export `BondToken`) at `port/in/bond/Bond.ts`. three creation methods,
all against the deployed factory/resolver, differentiated by rate model:

| method | line | request type | use for covenant |
|---|---|---|---|
| `create` | `Bond.ts:87` | `CreateBondRequest` | plain bond, no rate model |
| `createFixedRate` | `Bond.ts:155` | `CreateBondFixedRateRequest` | fixed coupon rate |
| `createKpiLinkedRate` | `Bond.ts:227` | `CreateBondKpiLinkedRateRequest` | **our differentiator, see §5** |

all three: build a `SecurityProps` object, then `commandBus.execute(new Create...Command(...))`
passing `securityFactory ? new ContractId(securityFactory) : undefined` and same for resolver
(`Bond.ts:123-124`, `:195-196`, `:278-279`). response is
`{ security: SecurityViewModel; transactionId: string }`; `security` is `{}` if
`createResponse.securityId.toString() === ContractId.NULL.toString()` (`Bond.ts:138-139`).

### request type: `CreateBondKpiLinkedRateRequest`
`port/in/request/bond/CreateBondKpiLinkedRateRequest.ts:13`. required fields (no
`@OptionalField()` decorator = required):

```
name: string                    checkName                          :182-184
symbol: string                  checkSymbol                        :185-187
isin: string                    checkISIN                          :188-190
decimals: number|string         checkInteger (setter parses)        :17-23, 191-193
isWhiteList: boolean
erc20VotesActivated: boolean
isControllable: boolean
arePartitionsProtected: boolean
isMultiPartition: boolean
clearingActive: boolean
internalKycActivated: boolean   -- see §2, gates verifyKycStatus
currency: string                 checkBytes3Format                  :195
numberOfUnits: string            checkNumber                         :196
nominalValue: string             checkNumber                         :197
nominalValueDecimals: number
startingDate: string             unix-ish string, checked vs now/maturity :198-204
maturityDate: string             checked vs startingDate             :205-207
configId: string                 checkBytes32Format                  :215  -- our 0x...0002
configVersion: number            checkNumber({min: MIN_CONFIG_VERSION}) :216, MIN_CONFIG_VERSION from @core/Constants
maxRate: number
baseRate: number                 checkNumber({max:maxRate,min:minRate}) :217-220
minRate: number
startPeriod: number
startRate: number
missedPenalty: number
reportPeriod: number
rateDecimals: number              checkNumber                         :225
maxDeviationCap: number
baseLine: number                  checkNumber({max:maxDeviationCap,min:maxDeviationFloor}) :221-224
maxDeviationFloor: number
impactDataDecimals: number
adjustmentPrecision: number
```

optional: `externalPausesIds?`, `externalControlListsIds?`, `externalKycListsIds?`,
`diamondOwnerAccount?`, `complianceId?`, `identityRegistryId?`, `regulationType?`,
`regulationSubType?`, `isCountryControlListWhiteList?`, `countries?`, `info?`,
`proceedRecipientsIds?`, `proceedRecipientsData?` (must be equal-length arrays,
`CreateBondKpiLinkedRateRequest.ts:241-252`).

`CreateBondRequest` and `CreateBondFixedRateRequest` are structurally identical minus the KPI
fields (`CreateBondFixedRateRequest` adds only `rate: number` and `rateDecimals: number`,
`CreateBondFixedRateRequest.ts:68-69`). same file locations, offset by class name.

### role required
NOT FOUND at the SDK command-handler layer — `app/usecase/command/bond/createkpilinkedrate/CreateBondKpiLinkedRateCommandHandler.ts`
has no `checkRole` call (`grep checkRole` on that file returns nothing). issuance goes through
the factory contract itself; role enforcement (if any) is on-chain in the factory/diamond
deployment path, not pre-checked client-side. did not trace the factory contract's deployment
function for a modifier — out of scope for this pass, flag to gamma if it reverts.

### gotcha
`configId`/`configVersion` are the bond **config template** on the deployed factory
(`0.0.9213391`), not something issuance creates — they must already exist on that factory.
`configVersion` has a floor of `MIN_CONFIG_VERSION` from `@core/Constants`
(`CreateBondKpiLinkedRateRequest.ts:7, 216`) — read that constant, don't hardcode.

---

## 2. kyc

### grant / revoke (internal kyc registry, per-security)
`KycInPort` (default export `Kyc`) at `port/in/kyc/Kyc.ts`.

- `grantKyc(GrantKycRequest)` — `Kyc.ts:52`, request at
  `port/in/request/security/kyc/GrantKycRequest.ts:6`: `securityId: string`,
  `targetId: string`, `vcBase64: string` (must pass `checkBase64Format`, line 15).
- `revokeKyc(RevokeKycRequest)` — `Kyc.ts:59`, request at
  `port/in/request/security/kyc/RevokeKycRequest.ts:6`: `securityId`, `targetId`.

**major gotcha, verify before building the demo flow around this.** `grantKyc`'s command
handler (`app/usecase/command/security/kyc/grantKyc/GrantKycCommandHandler.ts:34-42`) does not
just register an account — it decodes `vcBase64` via `Terminal3Vc.vcFromBase64`, then calls
`verifyVc(signedCredential)` from the `@terminal3/verify_vc` package, and throws `InvalidVc`
(`domain/context/security/error/operations/InvalidVc.ts`) if verification fails. **`vcBase64`
must be a genuine, cryptographically valid Terminal3 verifiable credential**, not an arbitrary
string. this is a real integration cost if we go this route.

role required: `SecurityRole._KYC_ROLE`, checked client-side at
`GrantKycCommandHandler.ts:60` and `RevokeKycCommandHandler.ts:39` via
`validationService.checkRole(SecurityRole._KYC_ROLE, ...)`.
`GrantKycCommandHandler.ts:61` also pre-checks the target is currently `KycStatus.NOT_GRANTED`
before submitting.

### external kyc list (the mock path — no VC required)
`ExternalKycListsManagement` (`port/in/externalKycListsManagement/ExternalKycListsManagement.ts`),
implements both `IExternalKycListsInPort` (real external list management) and
`IExternalKycListsMocksInPort` (`:43-48`). the mock path is dramatically simpler and does not
call `verifyVc` at all:

- `createExternalKycMock()` — `ExternalKycListsManagement.ts:143`, no request object, returns
  the new mock list contract address as `string`. wraps `CreateExternalKycListMockCommand`.
- `grantKycMock(GrantKycMockRequest)` — `ExternalKycListsManagement.ts:119`, request at
  `port/in/request/security/externalKycLists/mock/GrantKycMockRequest.ts:7`:
  `contractId: string` (the mock list contract, from `createExternalKycMock()`),
  `targetId: string`. handler (`.../mock/grantKycMock/GrantKycMockCommandHandler.ts:23-37`)
  has no `checkRole` and no VC check — it's a direct write to the mock list contract.
- `revokeKycMock(RevokeKycMockRequest)` — same file, `:127`.
- `getKycStatusMock(GetKycStatusMockRequest)` — `:135`, returns `number`.
- registering a mock (or any) external list on a security: `addExternalKycList(AddExternalKycListRequest)`
  (`:69`, fields `securityId`, `externalKycListAddress`) or `updateExternalKycLists(UpdateExternalKycListsRequest)`
  (`:57`, fields `securityId`, `externalKycListsAddresses: string[]`, `actives: boolean[]`).

**recommend the mock path for the demo** — it produces a real on-chain grant/revoke tx and a
real blocked→granted→permitted transfer sequence without needing a Terminal3 VC issuer
integration. the two mechanisms are independent and both feed the same on-chain check (below).

### what actually gates a transfer
`contracts/domain/core/KycStorageWrapper.sol:206-210`:

```solidity
function verifyKycStatus(IKyc.KycStatus _kycStatus, address _account) internal view returns (bool) {
    bool internalKycValid = !kycStorage().internalKycActivated ||
        getKycStatusFor(_account, TimeTravelStorageWrapper.getBlockTimestamp()) == _kycStatus;
    return internalKycValid && ExternalListManagementStorageWrapper.isExternallyGranted(_account, _kycStatus);
}
```

both legs must pass: internal KYC (only checked if `internalKycActivated` was set `true` at
issuance, see §1) AND external-list KYC. `isExternallyGranted`
(`contracts/domain/core/ExternalListManagementStorageWrapper.sol:224-235`) loops every
registered external list and requires `getKycStatus(account) == status` on **every** one; if
**zero** external lists are registered it returns `true` vacuously (loop never runs, falls
through to `return true;` at line 234). **so with no external list attached, only internal
KYC gates the transfer** — plan the demo bond's `internalKycActivated` / external-list wiring
deliberately, don't assume both checks are live by default.

### failure mode and revert reason
- error: `IKyc.InvalidKycStatus()` — `contracts/facets/kyc/IKyc.sol:57`, thrown from
  `KycStorageWrapper.requireKyc`-family at `KycStorageWrapper.sol:107` and, for the ERC-1594
  `canTransfer` path specifically, from `_validateIdentifiedAccount` at
  `contracts/domain/asset/ERC1594StorageWrapper.sol:606-609` (`return (false, Eip1066.DISALLOWED_OR_STOP, IKyc.InvalidKycStatus.selector, ...)`).
- related: `IERC3643Types.AddressNotVerified()` if the ERC-3643 identity registry check fails
  separately (`ERC1594StorageWrapper.sol:611-613`) — different failure, don't conflate.
- **the plain `transfer()` flow never reaches the chain when KYC is missing.**
  `TransferCommandHandler.execute` (`app/usecase/command/security/operations/transfer/TransferCommandHandler.ts:42`)
  calls `validationService.checkCanTransfer(...)` *before* calling `handler.transfer(...)`.
  `checkCanTransfer` (`app/service/validation/ValidationService.ts:180-203`) issues a
  `CanTransferByPartitionQuery` — an `eth_call`/view query, not a consensus transaction — and
  if `payload[0] != "0x01"` throws a mapped JS error immediately (line 200-202), via
  `ContractsErrorMapper.mapError` (`.../error/mapper/ContractsErrorMapper.ts:19-30`, selector
  table `:36-48`) which for the KYC case returns
  `InvalidKycStatus` (`domain/context/security/error/operations/InvalidKycStatus.ts:5-8`,
  message `"Invalid KYC status"`). **this means the "blocked transfer" will not appear as a
  failed transaction on hashscan** — it's rejected client-side before any tx is submitted. plan
  the video/evidence capture around this: screenshot the thrown SDK error, not a hashscan
  failure link, for the blocked-transfer beat.

---

## 3. transfer

`SecurityInPortTransfer`, mixed into `SecurityInPort` (`port/in/security/Security.ts:29, 95`),
methods at `port/in/security/transfer/Transfer.ts`:

| method | line | request | fields |
|---|---|---|---|
| `transfer` | `:37` | `TransferRequest` | `securityId`, `amount`, `targetId` |
| `transferAndLock` | `:45` | `TransferAndLockRequest` | + `expirationDate` |
| `controllerTransfer` | `:53` | `ForceTransferRequest` | + `sourceId` |
| `forcedTransfer` | `:61` | `ForcedTransferRequest` | `securityId`, `amount`, `targetId`, `sourceId` |
| `batchTransfer` | `:69` | `BatchTransferRequest` | `securityId`, `amountList[]`, `toList[]` |
| `batchForcedTransfer` | `:76` | `BatchForcedTransferRequest` | + `fromList[]` |
| `protectedTransferFromByPartition` | `:84` | `ProtectedTransferFromByPartitionRequest` | `securityId`, `partitionId`, `sourceId`, `targetId`, `amount`, `deadline`, `nonce`, `signature` |

these are ERC-1400/partition-aware at the contract level (`transferByPartition` underneath),
but only `protectedTransferFromByPartition` takes an explicit `partitionId` at the sdk
request layer — the other transfer methods default to the single/default partition
internally (matches `checkCanTransfer`'s fallback `partitionId ?? _PARTITION_ID_1`,
`ValidationService.ts:195`).

### role required
- `transfer` — self-serve, no role check in `TransferCommandHandler.ts` (holder moving their
  own balance).
- `controllerTransfer` / `forcedTransfer` — on-chain only, `Controller.sol:31-46` (`controllerTransfer`)
  and `:84-97` (`forcedTransfer`) both carry `onlyAnyRole(_buildRoles(ROLE_CONTROLLER, ROLE_AGENT))`
  plus `onlyControllable` plus `onlyWithoutMultiPartition`. **no client-side pre-check** — the
  sdk command handlers (`ControllerTransferCommandHandler.ts`, `ForcedTransferCommandHandler.ts`)
  have no `checkRole` call (confirmed by grep, zero matches), so a caller without
  `_CONTROLLER_ROLE`/`_AGENT_ROLE` will get an on-chain revert, not a friendly sdk error.

---

## 4. coupon, scheduledTask, updateMaturityDate

### setCoupon / cancelCoupon
`CouponInPort` (default export `CouponToken`), `port/in/coupon/Coupon.ts`.

- `setCoupon(SetCouponRequest)` — `Coupon.ts:58`, request
  `port/in/request/bond/SetCouponRequest.ts:9`: `securityId`, `rate: string`
  (`checkAmount(true)`), `recordTimestamp: string`, `executionTimestamp: string`,
  `startTimestamp: string`, `endTimestamp: string`, `fixingTimestamp: string`,
  `rateStatus: number` (`Bond.checkRateStatus`). ordering enforced by validators:
  `recordTimestamp < executionTimestamp`, `startTimestamp < endTimestamp`,
  `fixingTimestamp <= executionTimestamp` (`SetCouponRequest.ts:40-56`).
- `cancelCoupon(CancelCouponRequest)` — `Coupon.ts:86`, fields `securityId`, `couponId`.

role required: on-chain `onlyRole(ROLE_CORPORATE_ACTION)` at
`contracts/facets/coupon/Coupon.sol:52-60` (`_CORPORATEACTIONS_ROLE` in the sdk enum). **no
client-side pre-check** — `SetCouponCommandHandler.ts` has no `checkRole` call.

### distribution — NOT a discrete "distribute" command
searched `port/in/coupon/Coupon.ts` and `port/in/bond/Bond.ts` for a distribute/pay method:
none exists. the coupon port only registers coupon *terms* (`setCoupon`) and exposes readers:
`getCouponFor`, `getCouponsFor`, `getCouponAmountFor`, `getCoupon`, `getAllCoupons`,
`getCouponHolders` (`Coupon.ts:247`, returns `string[]` of holder addresses for a
`couponId`), `getTotalCouponHolders`. "distribution to holders of record" in the ship order
is a **read + off-chain payment** pattern here, not an on-chain push transaction — gamma should
confirm this against the actual bond redemption/payment flow before promising an on-chain
"distributed" transaction to Zeus/Iris for the video.

### scheduledTask
found at `port/in/scheduledTask/scheduledCouponListing/ScheduledCouponListing.ts`. **this is
read-only.** two methods, both queries:
- `scheduledCouponListingCount(ScheduledCouponListingCountRequest)` — `:27`, returns `number`.
- `getScheduledCouponListing(GetScheduledCouponListingRequest)` — `:38`, fields `securityId`,
  `pageIndex`, `pageLength`, returns `any` (untyped — `Promise<any>` at `ScheduledCouponListing.ts:20, 38`).

NOT FOUND: any write-side "execute"/"trigger" scheduled task command in `port/in`. grepped
`port/in` for `scheduledTask`/`ScheduledTask` (case-insensitive) — only the listing port above
and its request/query pair (`port/in/request/scheduledTasks/`,
`app/usecase/query/scheduledTasks/`) exist. the on-chain dispatch machinery
(`contracts/domain/orchestrator/ScheduledTasksDispatchOps.sol`,
`contracts/facets/scheduledCrossOrderedTask/ScheduledCrossOrderedTasksKpiLinkedRateFacet.sol`)
appears to fire from ordinary token operations synchronizing balances
(`ERC1410StorageWrapper.triggerAndSyncAll`, referenced from hold creation at
`contracts/domain/asset/HoldStorageWrapper.sol` and elsewhere), not from an sdk-callable
entry point. treat "scheduled coupon executes" as an emergent effect of other calls, not a
button gamma can press — did not trace this further, flag to hermes if the demo needs an
explicit trigger.

### updateMaturityDate
`BondInPort.updateMaturityDate(UpdateMaturityDateRequest)` — `port/in/bond/Bond.ts:341`,
request `port/in/request/bond/UpdateMaturityDateRequest.ts:8`: `securityId: string`,
`maturityDate: string`. role required: on-chain `onlyRole(ROLE_MATURITY_MANAGER)`,
`contracts/facets/maturity/Maturity.sol:72-83`. **`ROLE_MATURITY_MANAGER`
(`0xc20b7fd7efe1a2c9f69003a21c2c55c79ef84e16252b62599246ff01f6207314`,
`contracts/constants/roles.sol:35`) is not a named member of the sdk's `SecurityRole` enum**
(`domain/context/security/SecurityRole.ts:6-41` — only `_MATURITY_REDEEMER_ROLE` is present,
a different role/constant, `0x433f48f8...`). `RoleRequest.role` is typed as a plain
`checkBytes32Format()` string (`port/in/request/security/roles/RoleRequest.ts:10, 16`), so
you can still `grantRole` with the raw hex literal above — just don't look for a
`SecurityRole._MATURITY_MANAGER_ROLE` constant, it doesn't exist. no client-side `checkRole`
in `UpdateMaturityDateCommandHandler.ts` either — purely on-chain enforced.

---

## 5. kpi and repricing — `createKpiLinkedRate` / `addKpiData`

### configuring the rate model (at issuance)
see §1 `createKpiLinkedRate`. the on-chain shape is two structs defined at
`contracts/facets/kpiLinkedRate/IKpiLinkedRate.sol`:

```solidity
struct InterestRate {           // :21-30
    uint256 maxRate;
    uint256 baseRate;           // reference rate; minRate <= baseRate <= maxRate
    uint256 minRate;
    uint256 startPeriod;        // unix ts, before this: startRate applies unconditionally
    uint256 startRate;
    uint256 missedPenalty;      // added to previous rate if no kpi report found in window
    uint256 reportPeriod;       // seconds; lookback window width for a report
    uint8 rateDecimals;
}
struct ImpactData {             // :44-50
    uint256 maxDeviationCap;    // upper kpi-value bound -> maps to maxRate
    uint256 baseLine;           // kpi value that maps to baseRate
    uint256 maxDeviationFloor;  // lower kpi-value bound -> maps to minRate
    uint8 impactDataDecimals;
    uint256 adjustmentPrecision; // scale factor (10**adjustmentPrecision) in the interpolation math
}
```

invariant enforced on write: `maxDeviationFloor < baseLine < maxDeviationCap` (strict, equality
rejected — would zero the denominator, doc comment `IKpiLinkedRate.sol:36`).
`minRate <= baseRate <= maxRate` enforced client-side too
(`CreateBondKpiLinkedRateRequest.ts:217-220`, `baseRate` checked against `min: minRate, max: maxRate`).

### addKpiData — posting a kpi value
`BondInPort.addKpiData(AddKpiDataRequest)` — `port/in/bond/Bond.ts:427`, wraps
`AddKpiDataCommand(securityId, date, value, project)` (`Bond.ts:429-431`). request at
`port/in/request/kpis/AddKpiDataRequest.ts:6`:

```
securityId: string   checkHederaIdFormatOrEvmAddress
date: number          checkNumber                    -- unix timestamp of the data point
value: string          checkString({emptyCheck:true}) -- decimal string, scale = impactDataDecimals
project: string        checkEvmAddressFormat()        -- MUST be an EVM address, not a hedera id
```

on-chain: `contracts/facets/kpi/IKpis.sol:68`, `addKpiData(uint256 _date, uint256 _value, address _project)`.
reverts `InvalidDate` if `_date` outside `[minDate, maxDate]` window (`IKpis.sol:32-37, 61`),
`KpiDataAlreadyExists` if a value is already recorded for that exact `(project, date)` pair
(`IKpis.sol:39-43, 62`). role required: `SecurityRole._KPI_MANAGER_ROLE`, checked client-side
at `AddKpiDataCommandHandler.ts:33`.

**gotcha: `project` must already be a registered proceed recipient**, or the value is never
read. see below.

### what actually triggers the rate to change
the rate is **not recomputed when `addKpiData` is called.** it is computed lazily, once per
coupon, at that coupon's `fixingDate`, by
`contracts/domain/asset/KpiLinkedRateLib.sol:40-64` (`calculateKpiLinkedInterestRate`):

1. if `coupon.fixingDate > now`: rate status `PENDING`, no rate yet (`:44-46`).
2. if `coupon.fixingDate < kpiData.startPeriod`: rate = `startRate` (`:50-53`).
3. else, collect impact data: `_collectImpactData` (`:87-111`) sums `KpisStorageWrapper.getLatestKpiData`
   over **every registered proceed recipient project**
   (`ProceedRecipientsStorageWrapper.getProceedRecipients`, looped `:97-110`), each queried
   over the window `[fixingDate - reportPeriod, fixingDate]`. **a kpi value posted for a
   `project` address that was never added via `BondInPort.addProceedRecipient`
   (`port/in/bond/Bond.ts:391`, request `AddProceedRecipientRequest`) is never summed** —
   `_collectImpactData` only iterates `getProceedRecipients()`, it does not scan all kpi data
   ever posted.
4. if no report found in the window (`reportFound_ == false`): rate = previous coupon's rate
   (or `baseRate` if this is the first coupon) `+ missedPenalty`, capped at `maxRate`
   (`_getRateWhenNoReport`, `:66-85`).
5. if a report is found: linear interpolation between `minRate`/`baseRate`/`maxRate` based on
   where the summed impact value falls relative to `maxDeviationFloor`/`baseLine`/`maxDeviationCap`
   (`_getRateFromImpact`, `:143-186` — below baseline decreases toward `minRate`, above
   increases toward `maxRate`, each side clamped to its bound).

practical sequence for the demo: `addProceedRecipient` first (register the project address),
then `addKpiData` for that same address within the coupon's `[fixingDate - reportPeriod, fixingDate]`
window, then read the rate via `getCoupon`/`getCouponFor` at or after `fixingDate` — the
contract computes it on that read, there is no separate "apply the new rate" transaction.

---

## 6. hold — all six verbs

`SecurityInPortHold`, mixed into `SecurityInPort` (`Security.ts:17, 84`), methods at
`port/in/security/hold/Hold.ts`. all by-partition.

| verb | method | line | request type | fields (beyond securityId/partitionId) |
|---|---|---|---|---|
| create | `createHoldByPartition` | `:58` | `CreateHoldByPartitionRequest` | `amount`, `escrowId`, `targetId`, `expirationDate` |
| createFrom | `createHoldFromByPartition` | `:70` | `CreateHoldFromByPartitionRequest` | + `sourceId` |
| controllerCreate | `controllerCreateHoldByPartition` | `:89` | `ControllerCreateHoldByPartitionRequest` | `amount`, `escrowId`, `sourceId`, `targetId`, `expirationDate` |
| protectedCreate | `protectedCreateHoldByPartition` | `:108` | `ProtectedCreateHoldByPartitionRequest` | + `deadline`, `nonce`, `signature` |
| release | `releaseHoldByPartition` | `:211` | `ReleaseHoldByPartitionRequest` | `amount`, `targetId`, `holdId` |
| reclaim | `reclaimHoldByPartition` | `:223` | `ReclaimHoldByPartitionRequest` | `targetId`, `holdId` |
| execute | `executeHoldByPartition` | `:233` | `ExecuteHoldByPartitionRequest` | `sourceId`, `amount`, `holdId`, `targetId` |

request field sources (all under `port/in/request/security/operations/hold/`):
`CreateHoldByPartition.ts:7-46`, `CreateHoldFromByPartition.ts:7-52`,
`ControllerCreateHoldFromByPartition.ts:8-53` (class name inside is
`ControllerCreateHoldByPartitionRequest`), `ProtectedCreateHoldFromByPartition.ts:7-68`
(class name inside is `ProtectedCreateHoldByPartitionRequest`),
`ExecuteHoldByPartitionRequest.ts:6-44`; release at
`port/in/request/security/operations/release/ReleaseHoldByPartitionRequest.ts:6-40`; reclaim
at `port/in/request/security/operations/hold/ReclaimHoldByPartitionRequest.ts:6-35`. all
`amount` fields are `checkAmount()`-validated strings; `expirationDate`/`deadline` are unix-ish
strings checked to be `>= now` (`SecurityDate.checkDateTimestamp`).

### the `Hold` struct and `escrow`
on-chain struct, `contracts/facets/hold/IHoldTypes.sol:51-58`:

```solidity
struct Hold {
    uint256 amount;
    uint256 expirationTimestamp;  // 0 = never expires, can only be released/executed, not reclaimed
    address escrow;               // the ONLY address authorised to execute or release this hold
    address to;                   // intended recipient on execute; address(0) = any recipient allowed
    bytes data;
}
```

for covenant, `escrowId`/`escrowId` request fields map to `Hold.escrow` and must resolve to
our dedicated engine account `0.0.10445014`. **`escrow` is set once at hold creation and is
immutable for that hold's lifetime** — there is no "reassign escrow" call in `port/in/security/hold/Hold.ts`
(only create/release/reclaim/execute/getters, confirmed by reading the full file).

### who can call what — on-chain enforcement (this is the trap to get right)
traced `contracts/domain/asset/HoldStorageWrapper.sol`:

- **execute** (`releaseHoldByPartition` too) — `_validateExecuteHold`
  (`:1074-1092`) and `_validateNonReclaimHold` (`:1113-1125`) both call
  `isEscrow(holdData.hold, EvmAccessors.getMsgSender())` (`:826-828`,
  `return _escrow == _hold.escrow`) and **revert `IHoldTypes.IsNotEscrow()`** if the caller
  is not the recorded escrow. also reverts `IHoldTypes.HoldExpirationReached()` if past
  expiration (execute and release both require *not yet expired*).
- **reclaim** — `_validateReclaimHold` (`:1099-1105`) checks **only** `isHoldExpired`, reverts
  `IHoldTypes.HoldExpirationNotReached()` if called before expiration. **no escrow check on
  reclaim** — confirmed by reading the function body, it has no `isEscrow` call, unlike
  execute/release. anyone (subject to whatever the facet-level modifiers require — see below)
  can reclaim once expired, it is not escrow-gated.
- **sdk-side pre-checks are inconsistent across the six verbs.** grepped every hold command
  handler in `app/usecase/command/security/operations/hold/*/`:
  - `createHoldByPartition` — no `checkRole` (self-serve hold on your own balance,
    `CreateHoldByPartitionCommandHandler.ts`, confirmed no `SecurityRole` import at all).
  - `createHoldFromByPartition` — no `checkRole` either; on-chain requires the caller be an
    ERC-1410 **operator** for `_from`/`_partition`
    (`contracts/domain/asset/HoldStorageWrapper.sol`, `checkCreateHoldFromByPartitionWithOperator`
    calls `ERC1410StorageWrapper.requireOperator(_partition, _from)`), not a role.
  - `controllerCreateHoldByPartition` — **does** pre-check client-side:
    `validationService.checkRole(SecurityRole._CONTROLLER_ROLE, ...)`
    (`ControllerCreateHoldByPartitionCommandHandler.ts:56`).
  - `protectedCreateHoldByPartition` — pre-checks `checkProtectedPartitionRole` (partition
    participant role, not a plain `SecurityRole`) plus a valid EIP-712 signature/nonce
    (`ProtectedCreateHoldByPartitionCommandHandler.ts:65-75`).
  - `executeHoldByPartition` — **no `checkRole` pre-check for the escrow requirement.** the sdk
    only pre-checks `checkHoldBalance` and `checkKycAddresses(securityId, [sourceId, targetId], KycStatus.GRANTED)`
    (`ExecuteHoldByPartitionCommandHandler.ts:49-51`). the escrow check is purely on-chain
    (`IsNotEscrow()` above) — **if the caller signing the tx is not our engine account
    `0.0.10445014`, this will revert on-chain, not fail client-side.** unlike the kyc-blocked
    transfer (§2), this *will* produce a hashscan failed-transaction link, which is useful for
    evidence but means: make sure hao's MetaMask session is the engine account, or grant
    something else the escrow role, before demoing execute.
  - `releaseHoldByPartition` / `reclaimHoldByPartition` — no `checkRole` pre-check either;
    same "on-chain only" situation, escrow-gated for release, expiry-gated (no caller
    restriction) for reclaim per above.

---

## 7. roles

sdk enum: `SecurityRole`, `domain/context/security/SecurityRole.ts:6-41`. relevant subset for
covenant (all values are `bytes32` role hashes used directly against `AccessControl`):

```
_ISSUER_ROLE                  :8
_CONTROLLER_ROLE              :9    -- controllerTransfer, forcedTransfer (+ _AGENT_ROLE), controllerCreateHoldByPartition
_KYC_ROLE                     :23   -- grantKyc, revokeKyc (internal registry)
_KYC_MANAGER_ROLE             :28   -- NOT FOUND wired to a specific command in this pass; likely external-kyc-list add/remove
_INTERNAL_KYC_MANAGER_ROLE    :29   -- likely activateInternalKyc / deactivateInternalKyc, NOT verified this pass
_AGENT_ROLE                   :31   -- alternate to _CONTROLLER_ROLE for controllerTransfer/forcedTransfer (_buildRoles(ROLE_CONTROLLER, ROLE_AGENT), Controller.sol:45,96)
_KPI_MANAGER_ROLE             :36   -- addKpiData, AddKpiDataCommandHandler.ts:33
_CORPORATEACTIONS_ROLE        :12   -- setCoupon, Coupon.sol:60 (onlyRole(ROLE_CORPORATE_ACTION))
_MATURITY_REDEEMER_ROLE       :33   -- NOT the same as ROLE_MATURITY_MANAGER, see §4 updateMaturityDate gotcha
_PROTECTED_PARTITION_ROLE     :19
_PROTECTED_PARTITIONS_PARTICIPANT_ROLE  :20   -- protectedCreateHoldByPartition, via getProtectedPartitionRole() helper (:43-58), a derived per-partition role hash, not a flat constant
```

`role` on `Role.ts`'s `RoleRequest` is a plain `checkBytes32Format()` string
(`RoleRequest.ts:10,16`), so any 32-byte hex role (including ones missing from the enum, e.g.
`ROLE_MATURITY_MANAGER`) can still be granted/revoked/checked via
`RoleInPort.grantRole`/`revokeRole`/`hasRole` (`port/in/role/Role.ts:57-70`) — just pass the
literal hex string.

**escrow is not an `AccessControl` role at all.** it's a per-hold field
(`Hold.escrow`, `IHoldTypes.sol:51-58`) set at hold-creation time, enforced by direct address
comparison (`isEscrow`, `HoldStorageWrapper.sol:826-828`), not by `onlyRole`/`hasRole`. do not
look for a `SecurityRole._ESCROW_ROLE` — it does not exist, confirmed by reading the full enum
above (41 entries, none named escrow).

---

## F1 — HoldDetails constructor, verified

**verdict: not a functional bug. the returned value is correct. the constructor's parameter
name is misleading, which is the actual defect — cosmetic, not a data-integrity problem.**

constructor, `domain/context/security/Hold.ts:23-48`:

```ts
export class HoldDetails {
  expirationTimeStamp: number;
  amount: bigint;
  escrowAddress: string;
  tokenHolderAddress: string;
  destinationAddress: string;
  data: string;
  operatorData: string;
  constructor(
    executionTimeStamp: number,   // <-- parameter named "execution", line 32
    amount: bigint,
    escrowAddress: string,
    tokenHolderAddress: string,
    destinationAddress: string,
    data: string,
    operatorData: string,
  ) {
    this.expirationTimeStamp = executionTimeStamp;  // <-- assigned to "expiration" field, line 40
    ...
  }
}
```

traced the one and only call site, `port/out/rpc/RPCQueryAdapter.ts:872-895`
(`getHoldForByPartition`):

```ts
const hold = await this.connect(IAsset__factory, address.toString()).getHoldForByPartition({...});
return new HoldDetails(
  Number(hold.expirationTimestamp_),   // line 887 — raw contract field, correctly named
  hold.amount_,
  hold.escrow_,
  targetId.toString(),
  hold.destination_,
  hold.data_,
  hold.operatorData_,
);
```

the raw value passed in is `hold.expirationTimestamp_`, which is the contract's actual return
field — confirmed at the solidity interface,
`contracts/facets/holdByPartition/IHoldByPartition.sol:139,153`
(`@return expirationTimestamp_ The expiration timestamp of the hold.`). **there is only one
timestamp on a `Hold`** (`IHoldTypes.sol:51-58` — no separate execution timestamp exists on
the struct at all), so there is no possibility of two values being swapped. the constructor
has a single timestamp parameter that is simply named `executionTimeStamp` instead of
`expirationTimeStamp`; it is assigned to the correctly-named class field
(`this.expirationTimeStamp`), and every downstream consumer reads the correctly-named field:
`port/in/security/hold/Hold.ts:199` (`expirationDate: new Date(res.expirationTimeStamp * ONE_THOUSAND)`)
and the unit test `port/in/security/hold/Hold.unit.test.ts:970` both read `.expirationTimeStamp`,
not `.executionTimeStamp` — there's no field named `executionTimeStamp` on `HoldDetails` to
misread in the first place.

**nothing downstream depends on the wrong value** because there is no wrong value — the
number that comes back from a read IS the true on-chain expiration timestamp.

this is still a legitimate, precise upstream PR candidate: rename the constructor parameter
at `Hold.ts:32` from `executionTimeStamp` to `expirationTimeStamp` for consistency with the
field it's assigned to and with the contract's own naming. low severity, real, worth filing —
just not a workaround-requiring bug. do not build defensive code against this; build the
rename PR instead if time allows.

---

## appendix — sources not used but checked, for the record

- `~/projects/hackathon/hedera/asset-tokenization-studio/.claude/commands/` — only
  `docs/update-docs.md` present, no kyc/hold/issuance workflow docs.
- `~/projects/hackathon/hedera/asset-tokenization-studio/.claude/skills/` — only
  `solidity-natspec/` (a natspec linter), not relevant to sdk call construction.
- published docs (`https://docs.tokenization-studio.hedera.com/ats/`) — not consulted this
  pass; per mission brief the local checkout outranks docs, and every claim above is sourced
  directly from `v.8.0.0-ats`. flag to hermes if a docs cross-check is wanted before gamma
  starts wiring calls.
