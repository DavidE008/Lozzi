// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IEnsRegistry {
    function owner(bytes32 node) external view returns (address);
    function resolver(bytes32 node) external view returns (address);
}
