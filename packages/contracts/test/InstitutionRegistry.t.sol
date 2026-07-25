// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { InstitutionRegistry } from "../src/InstitutionRegistry.sol";
import { TestBase } from "./TestBase.sol";

contract InstitutionRegistryTest is TestBase {
    InstitutionRegistry private registry;

    bytes32 private constant INSTITUTION = keccak256("northstar-university");
    bytes32 private constant REGISTER_KEY = keccak256("register-northstar");
    address private constant ADMINISTRATOR = address(0xA11CE);
    address private constant SIGNER = address(0x51A);
    address private constant SECOND_SIGNER = address(0x52A);
    address private constant ATTACKER = address(0xBAD);

    event InstitutionRegistered(
        bytes32 indexed institutionId, address indexed administrator, address indexed signer
    );
    event InstitutionSignerAuthorizationChanged(
        bytes32 indexed institutionId, address indexed signer, bool authorized
    );

    function setUp() public {
        registry = new InstitutionRegistry(address(this));
    }

    function testProtocolAdministratorRegistersInstitutionAndEmitsCommitmentOnlyEvent() public {
        vm.expectEmit(true, true, true, true, address(registry));
        emit InstitutionRegistered(INSTITUTION, ADMINISTRATOR, SIGNER);

        registry.registerInstitution(INSTITUTION, ADMINISTRATOR, SIGNER, REGISTER_KEY);

        assertTrue(registry.isInstitutionActive(INSTITUTION));
        assertTrue(registry.isInstitutionAdministrator(INSTITUTION, ADMINISTRATOR));
        assertTrue(registry.isAuthorizedSigner(INSTITUTION, SIGNER));
    }

    function testUnauthorizedRegistrationReverts() public {
        vm.prank(ATTACKER);
        vm.expectRevert();
        registry.registerInstitution(INSTITUTION, ADMINISTRATOR, SIGNER, REGISTER_KEY);
    }

    function testDuplicateRegistrationIdempotencyReverts() public {
        registry.registerInstitution(INSTITUTION, ADMINISTRATOR, SIGNER, REGISTER_KEY);

        vm.expectRevert(
            abi.encodeWithSelector(
                InstitutionRegistry.DuplicateIdempotencyKey.selector, REGISTER_KEY
            )
        );
        registry.registerInstitution(
            keccak256("other-institution"), ADMINISTRATOR, SIGNER, REGISTER_KEY
        );
    }

    function testInstitutionAdministratorScopesAndRevokesSigner() public {
        registry.registerInstitution(INSTITUTION, ADMINISTRATOR, SIGNER, REGISTER_KEY);

        vm.expectEmit(true, true, false, true, address(registry));
        emit InstitutionSignerAuthorizationChanged(INSTITUTION, SECOND_SIGNER, true);
        vm.prank(ADMINISTRATOR);
        registry.setSignerAuthorization(INSTITUTION, SECOND_SIGNER, true);
        assertTrue(registry.isAuthorizedSigner(INSTITUTION, SECOND_SIGNER));

        vm.prank(ADMINISTRATOR);
        registry.setSignerAuthorization(INSTITUTION, SECOND_SIGNER, false);
        assertFalse(registry.isAuthorizedSigner(INSTITUTION, SECOND_SIGNER));
    }

    function testUnrelatedAccountCannotManageSigner() public {
        registry.registerInstitution(INSTITUTION, ADMINISTRATOR, SIGNER, REGISTER_KEY);
        vm.prank(ATTACKER);
        vm.expectRevert(
            abi.encodeWithSelector(
                InstitutionRegistry.UnauthorizedInstitutionAdministrator.selector,
                INSTITUTION,
                ATTACKER
            )
        );
        registry.setSignerAuthorization(INSTITUTION, SECOND_SIGNER, true);
    }

    function testDeactivationDisablesScopedAuthorization() public {
        registry.registerInstitution(INSTITUTION, ADMINISTRATOR, SIGNER, REGISTER_KEY);

        vm.prank(ADMINISTRATOR);
        registry.deactivateInstitution(INSTITUTION);

        assertFalse(registry.isInstitutionActive(INSTITUTION));
        assertFalse(registry.isAuthorizedSigner(INSTITUTION, SIGNER));
        assertFalse(registry.isInstitutionAdministrator(INSTITUTION, ADMINISTRATOR));
    }
}
