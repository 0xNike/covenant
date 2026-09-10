// covenant. turning ATS revert data into a named solidity error.
//
// ATS does not revert with a plain `Error(string)` on a compliance failure. it
// calls `LowLevelCall.revertWithData(bytes4(reasonCode), details)`
// (`contracts/domain/asset/ERC1594StorageWrapper.sol:291`), where `details` is
// `abi.encode(account)` for the KYC case (`:610`). so the revert payload names
// the address the token rejected, and that is the part worth putting on screen.
//
// the same selectors come back three ways and all three are decoded here:
// - as the `reason` word of `canTransferByPartition`, an eth_call
// - as the `error_message` field on a mirror node contract result
// - as the revert data attached to an ethers CALL_EXCEPTION
//
// this file is separate from diagnostics.ts and compliance.ts because both of
// them need it and neither should import the other.

import { ethers } from "ethers";

function sel(signature: string): string {
  return ethers.id(signature).slice(0, 10);
}

/**
 * the errors a compliance rejection can carry. sources, all in
 * `packages/ats/contracts/contracts`:
 * `IKyc.InvalidKycStatus` at `facets/kyc/IKyc.sol:57`,
 * `IERC3643Types.AddressNotVerified` and the rest from the error surface listed
 * in `facets/**` and `domain/**`.
 *
 * `args` is present only where the contract encodes details alongside the
 * selector. an entry without `args` decodes to the name alone.
 */
export const REVERT_SELECTORS: Record<
  string,
  { name: string; args?: string[] }
> = {
  [sel("InvalidKycStatus()")]: { name: "InvalidKycStatus()", args: ["address"] },
  [sel("AddressNotVerified()")]: {
    name: "AddressNotVerified()",
    args: ["address"],
  },
  [sel("ComplianceNotAllowed()")]: { name: "ComplianceNotAllowed()" },
  [sel("AccountIsBlocked(address)")]: { name: "AccountIsBlocked(address)" },
  [sel("ClearingIsActivated()")]: { name: "ClearingIsActivated()" },
  [sel("IsPaused()")]: { name: "IsPaused()" },
  [sel("Deactivated()")]: { name: "Deactivated()" },
  [sel("WalletRecovered()")]: { name: "WalletRecovered()" },
  [sel("InsufficientBalance(address,uint256,uint256,bytes32)")]: {
    name: "InsufficientBalance(address,uint256,uint256,bytes32)",
  },
  [sel("InvalidPartition(address,bytes32)")]: {
    name: "InvalidPartition(address,bytes32)",
  },
  [sel("InsufficientAllowance(address,address)")]: {
    name: "InsufficientAllowance(address,address)",
  },
  [sel("AccountHasNoRole(address,bytes32)")]: {
    name: "AccountHasNoRole(address,bytes32)",
    args: ["address", "bytes32"],
  },
  // `onlyAnyRole` reverts with the plural form and the whole accepted set.
  // seen live from `issue` before ROLE_ISSUER was granted.
  [sel("AccountHasNoRoles(address,bytes32[])")]: {
    name: "AccountHasNoRoles(address,bytes32[])",
    args: ["address", "bytes32[]"],
  },
  [sel("AccountIsNotIssuer(address)")]: {
    name: "AccountIsNotIssuer(address)",
    args: ["address"],
  },
  [sel("MaxSupplyReached(uint256)")]: { name: "MaxSupplyReached(uint256)" },
  [sel("InvalidDates()")]: { name: "InvalidDates()" },
  // the rate-type family, `CouponRateDispatch.validateAndStamp`
  // (`domain/asset/coupon/CouponRateDispatch.sol:85,97`). the FIXED one is the
  // error block C offers the token on purpose: a coupon carrying a
  // caller-supplied rate, refused by name.
  // `IFixedRate.InterestRateIsFixed` at `facets/fixedRate/IFixedRate.sol:43`,
  // `ICoupon.InterestRateIsStandard` at `facets/coupon/ICoupon.sol:83`,
  // `ICoupon.InterestRateIsKpiLinked` at `:77`.
  [sel("InterestRateIsFixed()")]: { name: "InterestRateIsFixed()" },
  [sel("InterestRateIsStandard()")]: { name: "InterestRateIsStandard()" },
  [sel("InterestRateIsKpiLinked()")]: { name: "InterestRateIsKpiLinked()" },
  // the date guards on `setCoupon`, `infrastructure/errors/ICommonErrors.sol:68,80`.
  // present so a malformed window is named rather than reported as an
  // unrecognised selector next to a rate claim it would undermine.
  [sel("WrongDates(uint256,uint256)")]: {
    name: "WrongDates(uint256,uint256)",
    args: ["uint256", "uint256"],
  },
  [sel("InvalidTimestamp()")]: { name: "InvalidTimestamp()" },
  [sel("AssetNotOperational(bytes32,uint256)")]: {
    name: "AssetNotOperational(bytes32,uint256)",
  },
  [sel("FunctionNotFound(bytes4)")]: { name: "FunctionNotFound(bytes4)" },
};

export interface DecodedRevert {
  /** the revert data exactly as it came off the chain */
  raw: string;
  selector: string;
  /** the solidity error name, or null when the selector is not one we know */
  name: string | null;
  /** decoded arguments where the error carries any */
  args: string[];
  /** one line fit to put on screen */
  summary: string;
}

/**
 * decodes revert data, or a bare bytes32 reason word.
 *
 * `canTransferByPartition` returns the selector left-aligned in a bytes32
 * (`facets/complianceByPartition/ComplianceByPartition.sol:43`), so a 66
 * character input is handled as selector-only.
 */
export function decodeRevert(
  data: string | null | undefined,
): DecodedRevert | null {
  if (!data || !data.startsWith("0x") || data.length < 10) return null;
  const selector = data.slice(0, 10).toLowerCase();
  const known = REVERT_SELECTORS[selector];
  const out: DecodedRevert = {
    raw: data,
    selector,
    name: known?.name ?? null,
    args: [],
    summary: known?.name ?? `unrecognised revert selector ${selector}`,
  };
  // a bytes32 reason word carries the selector and nothing else
  const isReasonWord = data.length === 66 && /^0x[0-9a-f]{8}0{56}$/i.test(data);
  if (known?.args && data.length > 10 && !isReasonWord) {
    try {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        known.args,
        "0x" + data.slice(10),
      );
      out.args = decoded.map((v) => String(v));
      out.summary = `${known.name} ${out.args.join(", ")}`;
    } catch {
      // the details blob is not always present. the selector alone is the claim.
    }
  }
  return out;
}
