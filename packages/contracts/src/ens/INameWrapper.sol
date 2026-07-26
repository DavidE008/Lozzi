// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface INameWrapper {
    function getData(uint256 id) external view returns (address owner, uint32 fuses, uint64 expiry);

    function isApprovedForAll(address account, address operator) external view returns (bool);

    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address owner,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node);

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external;
}
