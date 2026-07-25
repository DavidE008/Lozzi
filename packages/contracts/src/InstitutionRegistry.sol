// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { IInstitutionRegistry } from "./IInstitutionRegistry.sol";

/// @notice Authorizes institutions and their record-signing accounts.
/// @dev Identifiers are commitments. Human-readable institution or student data is never stored.
contract InstitutionRegistry is AccessControl, IInstitutionRegistry {
    struct Institution {
        uint64 registeredAt;
        bool active;
    }

    error DuplicateIdempotencyKey(bytes32 idempotencyKey);
    error InstitutionAlreadyRegistered(bytes32 institutionId);
    error InstitutionInactive(bytes32 institutionId);
    error InstitutionNotRegistered(bytes32 institutionId);
    error InvalidAddress();
    error InvalidCommitment();
    error UnauthorizedInstitutionAdministrator(bytes32 institutionId, address account);

    mapping(bytes32 institutionId => Institution institution) private institutions;
    mapping(bytes32 idempotencyKey => bool processed) public processedIdempotencyKeys;

    event InstitutionRegistered(
        bytes32 indexed institutionId, address indexed administrator, address indexed signer
    );
    event InstitutionStatusChanged(bytes32 indexed institutionId, bool active);
    event InstitutionAdministratorAuthorizationChanged(
        bytes32 indexed institutionId, address indexed administrator, bool authorized
    );
    event InstitutionSignerAuthorizationChanged(
        bytes32 indexed institutionId, address indexed signer, bool authorized
    );

    constructor(address protocolAdministrator) {
        if (protocolAdministrator == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, protocolAdministrator);
    }

    modifier onlyInstitutionAdministrator(bytes32 institutionId) {
        if (!isInstitutionAdministrator(institutionId, msg.sender)) {
            revert UnauthorizedInstitutionAdministrator(institutionId, msg.sender);
        }
        _;
    }

    function institutionAdministratorRole(bytes32 institutionId) public pure returns (bytes32) {
        return keccak256(abi.encode("LOZZI_INSTITUTION_ADMINISTRATOR", institutionId));
    }

    function institutionSignerRole(bytes32 institutionId) public pure returns (bytes32) {
        return keccak256(abi.encode("LOZZI_INSTITUTION_SIGNER", institutionId));
    }

    function registerInstitution(
        bytes32 institutionId,
        address administrator,
        address signer,
        bytes32 idempotencyKey
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (institutionId == bytes32(0) || idempotencyKey == bytes32(0)) {
            revert InvalidCommitment();
        }
        if (administrator == address(0) || signer == address(0)) revert InvalidAddress();
        if (processedIdempotencyKeys[idempotencyKey]) {
            revert DuplicateIdempotencyKey(idempotencyKey);
        }
        if (institutions[institutionId].registeredAt != 0) {
            revert InstitutionAlreadyRegistered(institutionId);
        }

        processedIdempotencyKeys[idempotencyKey] = true;
        institutions[institutionId] =
            Institution({ registeredAt: uint64(block.timestamp), active: true });
        _grantRole(institutionAdministratorRole(institutionId), administrator);
        _grantRole(institutionSignerRole(institutionId), signer);

        emit InstitutionRegistered(institutionId, administrator, signer);
    }

    function setAdministratorAuthorization(
        bytes32 institutionId,
        address administrator,
        bool authorized
    ) external onlyInstitutionAdministrator(institutionId) {
        _requireActiveInstitution(institutionId);
        if (administrator == address(0)) revert InvalidAddress();

        bytes32 role = institutionAdministratorRole(institutionId);
        if (authorized) {
            _grantRole(role, administrator);
        } else {
            _revokeRole(role, administrator);
        }
        emit InstitutionAdministratorAuthorizationChanged(institutionId, administrator, authorized);
    }

    function setSignerAuthorization(bytes32 institutionId, address signer, bool authorized)
        external
        onlyInstitutionAdministrator(institutionId)
    {
        _requireActiveInstitution(institutionId);
        if (signer == address(0)) revert InvalidAddress();

        bytes32 role = institutionSignerRole(institutionId);
        if (authorized) {
            _grantRole(role, signer);
        } else {
            _revokeRole(role, signer);
        }
        emit InstitutionSignerAuthorizationChanged(institutionId, signer, authorized);
    }

    function deactivateInstitution(bytes32 institutionId) external {
        bool protocolAdministrator = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        if (!protocolAdministrator && !isInstitutionAdministrator(institutionId, msg.sender)) {
            revert UnauthorizedInstitutionAdministrator(institutionId, msg.sender);
        }
        _requireActiveInstitution(institutionId);
        institutions[institutionId].active = false;
        emit InstitutionStatusChanged(institutionId, false);
    }

    function getInstitution(bytes32 institutionId)
        external
        view
        returns (uint64 registeredAt, bool active)
    {
        Institution memory institution = institutions[institutionId];
        if (institution.registeredAt == 0) revert InstitutionNotRegistered(institutionId);
        return (institution.registeredAt, institution.active);
    }

    function isInstitutionActive(bytes32 institutionId) public view returns (bool) {
        Institution memory institution = institutions[institutionId];
        return institution.registeredAt != 0 && institution.active;
    }

    function isInstitutionAdministrator(bytes32 institutionId, address account)
        public
        view
        returns (bool)
    {
        return isInstitutionActive(institutionId)
            && hasRole(institutionAdministratorRole(institutionId), account);
    }

    function isAuthorizedSigner(bytes32 institutionId, address account) public view returns (bool) {
        return isInstitutionActive(institutionId)
            && hasRole(institutionSignerRole(institutionId), account);
    }

    function _requireActiveInstitution(bytes32 institutionId) private view {
        if (institutions[institutionId].registeredAt == 0) {
            revert InstitutionNotRegistered(institutionId);
        }
        if (!institutions[institutionId].active) revert InstitutionInactive(institutionId);
    }
}
