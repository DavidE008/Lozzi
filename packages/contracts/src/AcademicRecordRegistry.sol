// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IInstitutionRegistry } from "./IInstitutionRegistry.sol";

/// @notice Anchors salted academic record and consent commitments.
/// @dev Student-authorized requests are relayed by an authorized institution signer.
contract AcademicRecordRegistry {
    struct RecordVersion {
        bytes32 studentCommitment;
        bytes32 previousVersionCommitment;
        uint64 publishedAt;
        bool exists;
    }

    struct ShareGrant {
        bytes32 studentCommitment;
        bytes32 recordVersionCommitment;
        uint64 expiresAt;
        bool revoked;
        bool exists;
    }

    error DuplicateCommitment(bytes32 commitment);
    error DuplicateIdempotencyKey(bytes32 idempotencyKey);
    error GrantExpired(bytes32 grantCommitment);
    error GrantNotFound(bytes32 grantCommitment);
    error InstitutionInactive(bytes32 institutionId);
    error InvalidCommitment();
    error InvalidExpiration();
    error InvalidVersionLink(bytes32 expectedPrevious, bytes32 providedPrevious);
    error RecordVersionNotFound(bytes32 versionCommitment);
    error UnauthorizedSigner(bytes32 institutionId, address signer);

    IInstitutionRegistry public immutable institutionRegistry;

    mapping(bytes32 operationKey => bool processed) public processedIdempotencyKeys;
    mapping(bytes32 namespacedStudent => bytes32 versionCommitment) private currentVersions;
    mapping(bytes32 namespacedVersion => RecordVersion version) private recordVersions;
    mapping(bytes32 namespacedGrant => ShareGrant grant) private shareGrants;

    event RecordVersionPublished(
        bytes32 indexed institutionId,
        bytes32 indexed studentCommitment,
        bytes32 indexed versionCommitment,
        bytes32 previousVersionCommitment
    );
    event ShareGrantCreated(
        bytes32 indexed institutionId,
        bytes32 indexed grantCommitment,
        bytes32 indexed recordVersionCommitment,
        uint64 expiresAt
    );
    event ShareGrantRevoked(bytes32 indexed institutionId, bytes32 indexed grantCommitment);

    constructor(IInstitutionRegistry registry) {
        if (address(registry) == address(0)) revert InvalidCommitment();
        institutionRegistry = registry;
    }

    modifier onlyAuthorizedSigner(bytes32 institutionId) {
        if (!institutionRegistry.isInstitutionActive(institutionId)) {
            revert InstitutionInactive(institutionId);
        }
        if (!institutionRegistry.isAuthorizedSigner(institutionId, msg.sender)) {
            revert UnauthorizedSigner(institutionId, msg.sender);
        }
        _;
    }

    function publishRecordVersion(
        bytes32 institutionId,
        bytes32 studentCommitment,
        bytes32 versionCommitment,
        bytes32 previousVersionCommitment,
        bytes32 idempotencyKey
    ) external onlyAuthorizedSigner(institutionId) {
        _requireCommitments(studentCommitment, versionCommitment, idempotencyKey);
        _consumeIdempotency(institutionId, idempotencyKey);

        bytes32 studentKey = _namespace(institutionId, studentCommitment);
        bytes32 versionKey = _namespace(institutionId, versionCommitment);
        bytes32 expectedPrevious = currentVersions[studentKey];
        if (expectedPrevious != previousVersionCommitment) {
            revert InvalidVersionLink(expectedPrevious, previousVersionCommitment);
        }
        if (recordVersions[versionKey].exists) revert DuplicateCommitment(versionCommitment);

        recordVersions[versionKey] = RecordVersion({
            studentCommitment: studentCommitment,
            previousVersionCommitment: previousVersionCommitment,
            publishedAt: uint64(block.timestamp),
            exists: true
        });
        currentVersions[studentKey] = versionCommitment;

        emit RecordVersionPublished(
            institutionId, studentCommitment, versionCommitment, previousVersionCommitment
        );
    }

    function createShareGrant(
        bytes32 institutionId,
        bytes32 studentCommitment,
        bytes32 recordVersionCommitment,
        bytes32 grantCommitment,
        uint64 expiresAt,
        bytes32 idempotencyKey
    ) external onlyAuthorizedSigner(institutionId) {
        _requireCommitments(studentCommitment, recordVersionCommitment, grantCommitment);
        if (idempotencyKey == bytes32(0)) revert InvalidCommitment();
        if (expiresAt <= block.timestamp) revert InvalidExpiration();
        _consumeIdempotency(institutionId, idempotencyKey);

        bytes32 recordKey = _namespace(institutionId, recordVersionCommitment);
        RecordVersion memory version = recordVersions[recordKey];
        if (!version.exists || version.studentCommitment != studentCommitment) {
            revert RecordVersionNotFound(recordVersionCommitment);
        }

        bytes32 grantKey = _namespace(institutionId, grantCommitment);
        if (shareGrants[grantKey].exists) revert DuplicateCommitment(grantCommitment);
        shareGrants[grantKey] = ShareGrant({
            studentCommitment: studentCommitment,
            recordVersionCommitment: recordVersionCommitment,
            expiresAt: expiresAt,
            revoked: false,
            exists: true
        });

        emit ShareGrantCreated(institutionId, grantCommitment, recordVersionCommitment, expiresAt);
    }

    function revokeShareGrant(
        bytes32 institutionId,
        bytes32 grantCommitment,
        bytes32 idempotencyKey
    ) external onlyAuthorizedSigner(institutionId) {
        _requireCommitments(grantCommitment, idempotencyKey, bytes32(uint256(1)));
        _consumeIdempotency(institutionId, idempotencyKey);

        bytes32 grantKey = _namespace(institutionId, grantCommitment);
        ShareGrant storage grant = shareGrants[grantKey];
        if (!grant.exists) revert GrantNotFound(grantCommitment);
        grant.revoked = true;
        emit ShareGrantRevoked(institutionId, grantCommitment);
    }

    function currentRecordVersion(bytes32 institutionId, bytes32 studentCommitment)
        external
        view
        returns (bytes32)
    {
        return currentVersions[_namespace(institutionId, studentCommitment)];
    }

    function getRecordVersion(bytes32 institutionId, bytes32 versionCommitment)
        external
        view
        returns (bytes32 studentCommitment, bytes32 previousVersionCommitment, uint64 publishedAt)
    {
        RecordVersion memory version = recordVersions[_namespace(institutionId, versionCommitment)];
        if (!version.exists) revert RecordVersionNotFound(versionCommitment);
        return (version.studentCommitment, version.previousVersionCommitment, version.publishedAt);
    }

    function verifyShareGrant(bytes32 institutionId, bytes32 grantCommitment)
        external
        view
        returns (
            bool valid,
            bytes32 studentCommitment,
            bytes32 recordVersionCommitment,
            uint64 expiresAt,
            bool revoked
        )
    {
        ShareGrant memory grant = shareGrants[_namespace(institutionId, grantCommitment)];
        if (!grant.exists) return (false, bytes32(0), bytes32(0), 0, false);
        valid = !grant.revoked && grant.expiresAt > block.timestamp;
        return (
            valid,
            grant.studentCommitment,
            grant.recordVersionCommitment,
            grant.expiresAt,
            grant.revoked
        );
    }

    function _consumeIdempotency(bytes32 institutionId, bytes32 idempotencyKey) private {
        bytes32 operationKey = _namespace(institutionId, idempotencyKey);
        if (processedIdempotencyKeys[operationKey]) {
            revert DuplicateIdempotencyKey(idempotencyKey);
        }
        processedIdempotencyKeys[operationKey] = true;
    }

    function _namespace(bytes32 institutionId, bytes32 commitment) private pure returns (bytes32) {
        return keccak256(abi.encode(institutionId, commitment));
    }

    function _requireCommitments(bytes32 first, bytes32 second, bytes32 third) private pure {
        if (first == bytes32(0) || second == bytes32(0) || third == bytes32(0)) {
            revert InvalidCommitment();
        }
    }
}
