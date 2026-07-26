// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library TransferHelper {
    bytes4 private constant APPROVE_SELECTOR = 0x095ea7b3;
    bytes4 private constant TRANSFER_SELECTOR = 0xa9059cbb;
    bytes4 private constant TRANSFER_FROM_SELECTOR = 0x23b872dd;

    function safeApprove(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(APPROVE_SELECTOR, to, value));
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "Tower: APPROVE_FAILED"
        );
    }

    function safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(TRANSFER_SELECTOR, to, value));
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "Tower: TRANSFER_FAILED"
        );
    }

    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(TRANSFER_FROM_SELECTOR, from, to, value));
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "Tower: TRANSFER_FROM_FAILED"
        );
    }
}
