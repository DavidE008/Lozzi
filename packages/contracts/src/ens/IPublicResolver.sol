// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IPublicResolver {
    function addr(bytes32 node) external view returns (address payable);
    function setAddr(bytes32 node, address address_) external;
}
