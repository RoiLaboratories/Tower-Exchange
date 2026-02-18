// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// /**
//  * @title IFeeController
//  * @dev Interface for managing platform fees
//  */
// interface IFeeController {
//     /// @dev Get the platform fee in basis points (max 30 = 0.3%)
//     function getPlatformFee() external view returns (uint256);
//
//     /// @dev Get referral reward percentage
//     function getReferralReward(address referrer) external view returns (uint256);
//
//     /// @dev Check if an address is whitelisted for fee exemption
//     function isWhitelisted(address account) external view returns (bool);
//
//     /// @dev Distribute fees to treasury and referrer
//     function distributeFees(
//         address token,
//         uint256 feeAmount,
//         address referrer
//     ) external;
// }
//
// /**
//  * @title IPermit2
//  * @dev Interface for Uniswap's Permit2 contract
//  */
// interface IPermit2 {
//     struct PermitTransferFrom {
//         TokenPermissions permitted;
//         uint256 nonce;
//         uint256 deadline;
//     }
//
//     struct TokenPermissions {
//         address token;
//         uint160 amount;
//     }
//
//     function permitTransferFrom(
//         PermitTransferFrom memory permit,
//         SignatureTransferDetails calldata transferDetails,
//         address owner,
//         bytes calldata signature
//     ) external;
//
//     function transferFrom(
//         address from,
//         address to,
//         uint160 amount,
//         address token
//     ) external;
// }
//
// struct SignatureTransferDetails {
//     address to;
//     uint160 requestedAmount;
// }
