// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IInstitutionRegistry {
    function isInstitutionActive(bytes32 institutionId) external view returns (bool);

    function isAuthorizedSigner(bytes32 institutionId, address account) external view returns (bool);
}
