// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { AcademicRecordRegistry } from "../src/AcademicRecordRegistry.sol";
import { InstitutionRegistry } from "../src/InstitutionRegistry.sol";
import { TestBase } from "./TestBase.sol";

contract AcademicRecordRegistryTest is TestBase {
    InstitutionRegistry private institutions;
    AcademicRecordRegistry private records;

    bytes32 private constant INSTITUTION = keccak256("northstar-university");
    bytes32 private constant STUDENT = keccak256("salted-student-commitment");
    bytes32 private constant VERSION_ONE = keccak256("salted-record-version-one");
    bytes32 private constant VERSION_TWO = keccak256("salted-record-version-two");
    bytes32 private constant GRANT = keccak256("salted-grant");
    address private constant ADMINISTRATOR = address(0xA11CE);
    address private constant SIGNER = address(0x51A);
    address private constant ATTACKER = address(0xBAD);

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

    function setUp() public {
        institutions = new InstitutionRegistry(address(this));
        institutions.registerInstitution(
            INSTITUTION, ADMINISTRATOR, SIGNER, keccak256("institution-registration")
        );
        records = new AcademicRecordRegistry(institutions);
    }

    function testAuthorizedSignerPublishesVersionAndEvent() public {
        vm.expectEmit(true, true, true, true, address(records));
        emit RecordVersionPublished(INSTITUTION, STUDENT, VERSION_ONE, bytes32(0));
        vm.prank(SIGNER);
        records.publishRecordVersion(
            INSTITUTION, STUDENT, VERSION_ONE, bytes32(0), keccak256("publish-v1")
        );

        assertEq(records.currentRecordVersion(INSTITUTION, STUDENT), VERSION_ONE);
        (bytes32 student, bytes32 previous,) = records.getRecordVersion(INSTITUTION, VERSION_ONE);
        assertEq(student, STUDENT);
        assertEq(previous, bytes32(0));
    }

    function testUnauthorizedPublisherReverts() public {
        vm.prank(ATTACKER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcademicRecordRegistry.UnauthorizedSigner.selector, INSTITUTION, ATTACKER
            )
        );
        records.publishRecordVersion(
            INSTITUTION, STUDENT, VERSION_ONE, bytes32(0), keccak256("attacker")
        );
    }

    function testVersionLinkMustMatchCurrentVersion() public {
        _publishVersionOne();

        vm.prank(SIGNER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AcademicRecordRegistry.InvalidVersionLink.selector, VERSION_ONE, bytes32(0)
            )
        );
        records.publishRecordVersion(
            INSTITUTION, STUDENT, VERSION_TWO, bytes32(0), keccak256("publish-v2")
        );

        vm.prank(SIGNER);
        records.publishRecordVersion(
            INSTITUTION, STUDENT, VERSION_TWO, VERSION_ONE, keccak256("publish-v2")
        );
        assertEq(records.currentRecordVersion(INSTITUTION, STUDENT), VERSION_TWO);
    }

    function testDuplicateIdempotencyReverts() public {
        bytes32 key = keccak256("publish-v1");
        vm.prank(SIGNER);
        records.publishRecordVersion(INSTITUTION, STUDENT, VERSION_ONE, bytes32(0), key);

        vm.prank(SIGNER);
        vm.expectRevert(
            abi.encodeWithSelector(AcademicRecordRegistry.DuplicateIdempotencyKey.selector, key)
        );
        records.publishRecordVersion(INSTITUTION, STUDENT, VERSION_TWO, VERSION_ONE, key);
    }

    function testRelayedShareGrantVerifiesThenExpires() public {
        _publishVersionOne();
        uint64 expiration = uint64(block.timestamp + 7 days);

        vm.expectEmit(true, true, true, true, address(records));
        emit ShareGrantCreated(INSTITUTION, GRANT, VERSION_ONE, expiration);
        vm.prank(SIGNER);
        records.createShareGrant(
            INSTITUTION, STUDENT, VERSION_ONE, GRANT, expiration, keccak256("share-create")
        );

        (bool valid, bytes32 student, bytes32 version, uint64 expiresAt, bool revoked) =
            records.verifyShareGrant(INSTITUTION, GRANT);
        assertTrue(valid);
        assertEq(student, STUDENT);
        assertEq(version, VERSION_ONE);
        assertEq(expiresAt, expiration);
        assertFalse(revoked);

        vm.warp(expiration);
        (valid,,,,) = records.verifyShareGrant(INSTITUTION, GRANT);
        assertFalse(valid);
    }

    function testAuthorizedSignerRevokesShareGrant() public {
        _publishVersionOne();
        vm.prank(SIGNER);
        records.createShareGrant(
            INSTITUTION,
            STUDENT,
            VERSION_ONE,
            GRANT,
            uint64(block.timestamp + 7 days),
            keccak256("share-create")
        );

        vm.prank(SIGNER);
        records.revokeShareGrant(INSTITUTION, GRANT, keccak256("share-revoke"));

        (bool valid,,,, bool revoked) = records.verifyShareGrant(INSTITUTION, GRANT);
        assertFalse(valid);
        assertTrue(revoked);
    }

    function testInactiveInstitutionCannotPublish() public {
        vm.prank(ADMINISTRATOR);
        institutions.deactivateInstitution(INSTITUTION);

        vm.prank(SIGNER);
        vm.expectRevert(
            abi.encodeWithSelector(AcademicRecordRegistry.InstitutionInactive.selector, INSTITUTION)
        );
        records.publishRecordVersion(
            INSTITUTION, STUDENT, VERSION_ONE, bytes32(0), keccak256("publish-v1")
        );
    }

    function _publishVersionOne() private {
        vm.prank(SIGNER);
        records.publishRecordVersion(
            INSTITUTION, STUDENT, VERSION_ONE, bytes32(0), keccak256("publish-v1")
        );
    }
}
