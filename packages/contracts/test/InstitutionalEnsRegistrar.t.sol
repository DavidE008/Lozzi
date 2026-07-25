// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import { InstitutionalEnsRegistrar } from "../src/InstitutionalEnsRegistrar.sol";
import { IEnsRegistry } from "../src/ens/IEnsRegistry.sol";
import { INameWrapper } from "../src/ens/INameWrapper.sol";
import { IPublicResolver } from "../src/ens/IPublicResolver.sol";
import { TestBase } from "./TestBase.sol";

contract MockEnsRegistry is IEnsRegistry {
    mapping(bytes32 node => address account) private owners;
    mapping(bytes32 node => address account) private resolvers;

    function owner(bytes32 node) external view returns (address) {
        return owners[node];
    }

    function resolver(bytes32 node) external view returns (address) {
        return resolvers[node];
    }

    function setOwner(bytes32 node, address account) external {
        owners[node] = account;
    }

    function setResolver(bytes32 node, address account) external {
        resolvers[node] = account;
    }
}

contract MockNameWrapper is INameWrapper {
    struct NameData {
        address owner;
        uint32 fuses;
        uint64 expiry;
    }

    MockEnsRegistry private immutable registry;
    mapping(uint256 id => NameData data) private names;
    mapping(address account => mapping(address operator => bool approved)) private approvals;

    uint256 public createCalls;

    constructor(MockEnsRegistry registry_) {
        registry = registry_;
    }

    function configureParent(bytes32 node, address parentOwner, uint64 expiry) external {
        names[uint256(node)] = NameData({ owner: parentOwner, fuses: 0, expiry: expiry });
        registry.setOwner(node, address(this));
    }

    function configureExisting(bytes32 node, address childOwner, uint64 expiry) external {
        names[uint256(node)] = NameData({ owner: childOwner, fuses: 0, expiry: expiry });
        registry.setOwner(node, address(this));
    }

    function setApprovalForAll(address account, address operator, bool approved) external {
        approvals[account][operator] = approved;
    }

    function getData(uint256 id)
        external
        view
        returns (address owner, uint32 fuses, uint64 expiry)
    {
        NameData memory data = names[id];
        return (data.owner, data.fuses, data.expiry);
    }

    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return approvals[account][operator];
    }

    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address newOwner,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node) {
        _requireParentAuthority(parentNode);
        node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        if (names[uint256(node)].owner != address(0)) revert();
        names[uint256(node)] = NameData({ owner: newOwner, fuses: fuses, expiry: expiry });
        registry.setOwner(node, address(this));
        ++createCalls;

        if (newOwner.code.length != 0) {
            bytes4 response = IERC1155Receiver(newOwner).onERC1155Received(
                msg.sender, address(0), uint256(node), 1, ""
            );
            if (response != IERC1155Receiver.onERC1155Received.selector) revert();
        }
    }

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address newOwner,
        address resolver_,
        uint64,
        uint32 fuses,
        uint64 expiry
    ) external {
        _requireParentAuthority(parentNode);
        bytes32 node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        if (names[uint256(node)].owner == address(0)) revert();
        names[uint256(node)] = NameData({ owner: newOwner, fuses: fuses, expiry: expiry });
        registry.setOwner(node, address(this));
        registry.setResolver(node, resolver_);
    }

    function _requireParentAuthority(bytes32 parentNode) private view {
        address parentOwner = names[uint256(parentNode)].owner;
        if (msg.sender != parentOwner && !approvals[parentOwner][msg.sender]) revert();
    }
}

contract MockPublicResolver is IPublicResolver {
    MockNameWrapper private immutable wrapper;
    mapping(bytes32 node => address resolved) private addresses;
    bool public failWrites;

    constructor(MockNameWrapper wrapper_) {
        wrapper = wrapper_;
    }

    function addr(bytes32 node) external view returns (address payable) {
        return payable(addresses[node]);
    }

    function setAddr(bytes32 node, address address_) external {
        if (failWrites) revert();
        (address nodeOwner,,) = wrapper.getData(uint256(node));
        if (nodeOwner != msg.sender) revert();
        addresses[node] = address_;
    }

    function setFailWrites(bool enabled) external {
        failWrites = enabled;
    }
}

contract InstitutionalEnsRegistrarTest is TestBase {
    bytes32 private constant PARENT_NODE = keccak256("institution-sepolia.eth");
    bytes32 private constant REQUEST_KEY = keccak256("request-1");
    address private constant SAFE = address(0x5AFE);
    address private constant ISSUER = address(0x155);
    address private constant NEXT_ISSUER = address(0x156);
    address private constant RESOLVED = address(0xA11CE);
    address private constant ATTACKER = address(0xBAD);

    MockEnsRegistry private registry;
    MockNameWrapper private wrapper;
    MockPublicResolver private resolver;
    InstitutionalEnsRegistrar private registrar;

    event IssuerChanged(address indexed previousIssuer, address indexed newIssuer);
    event SubnameIssued(
        bytes32 indexed requestKey,
        bytes32 indexed labelHash,
        address indexed resolvedAddress,
        bytes32 node
    );

    function setUp() public {
        registry = new MockEnsRegistry();
        wrapper = new MockNameWrapper(registry);
        resolver = new MockPublicResolver(wrapper);
        wrapper.configureParent(PARENT_NODE, SAFE, uint64(block.timestamp + 365 days));
        registrar = new InstitutionalEnsRegistrar(
            registry, wrapper, resolver, PARENT_NODE, SAFE, ISSUER
        );
        wrapper.setApprovalForAll(SAFE, address(registrar), true);
    }

    function testIssuerCreatesResolvedSafeOwnedSubname() public {
        bytes32 labelHash = keccak256("calm-river-42");
        bytes32 expectedNode = keccak256(abi.encodePacked(PARENT_NODE, labelHash));
        vm.expectEmit(true, true, true, true, address(registrar));
        emit SubnameIssued(REQUEST_KEY, labelHash, RESOLVED, expectedNode);

        vm.prank(ISSUER);
        bytes32 node = registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);

        assertEq(node, expectedNode);
        (address wrappedOwner,,) = wrapper.getData(uint256(node));
        assertEq(wrappedOwner, SAFE);
        assertEq(registry.owner(node), address(wrapper));
        assertEq(registry.resolver(node), address(resolver));
        assertEq(resolver.addr(node), RESOLVED);
        assertEq(wrapper.createCalls(), 1);
    }

    function testExactReplayReturnsNodeWithoutAnotherWrite() public {
        vm.prank(ISSUER);
        bytes32 first = registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);
        vm.prank(ISSUER);
        bytes32 second = registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);

        assertEq(second, first);
        assertEq(wrapper.createCalls(), 1);
    }

    function testRequestKeyCannotBeReusedWithDifferentInput() public {
        vm.prank(ISSUER);
        registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);

        vm.prank(ISSUER);
        vm.expectRevert(
            abi.encodeWithSelector(
                InstitutionalEnsRegistrar.RequestKeyConflict.selector, REQUEST_KEY
            )
        );
        registrar.issue("bright-field-7", RESOLVED, REQUEST_KEY);
    }

    function testExistingWrappedLabelCannotBeReplaced() public {
        bytes32 labelHash = keccak256("calm-river-42");
        bytes32 node = keccak256(abi.encodePacked(PARENT_NODE, labelHash));
        wrapper.configureExisting(node, ATTACKER, uint64(block.timestamp + 30 days));

        vm.prank(ISSUER);
        vm.expectRevert(
            abi.encodeWithSelector(
                InstitutionalEnsRegistrar.LabelUnavailable.selector, labelHash
            )
        );
        registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);
    }

    function testUnauthorizedAccountCannotIssue() public {
        vm.prank(ATTACKER);
        vm.expectRevert(
            abi.encodeWithSelector(
                InstitutionalEnsRegistrar.UnauthorizedIssuer.selector, ATTACKER
            )
        );
        registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);
    }

    function testOwnerRotatesIssuerAndCanPause() public {
        vm.expectEmit(true, true, false, true, address(registrar));
        emit IssuerChanged(ISSUER, NEXT_ISSUER);
        vm.prank(SAFE);
        registrar.setIssuer(NEXT_ISSUER);

        vm.prank(SAFE);
        registrar.pause();
        vm.prank(NEXT_ISSUER);
        vm.expectRevert();
        registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);

        vm.prank(SAFE);
        registrar.unpause();
        vm.prank(NEXT_ISSUER);
        registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);
    }

    function testParentOwnershipDriftFailsClosed() public {
        wrapper.configureParent(PARENT_NODE, ATTACKER, uint64(block.timestamp + 365 days));

        vm.prank(ISSUER);
        vm.expectRevert(
            abi.encodeWithSelector(
                InstitutionalEnsRegistrar.ParentOwnerMismatch.selector, SAFE, ATTACKER
            )
        );
        registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);
    }

    function testMissingAdapterApprovalFailsClosed() public {
        wrapper.setApprovalForAll(SAFE, address(registrar), false);

        vm.prank(ISSUER);
        vm.expectRevert(InstitutionalEnsRegistrar.AdapterApprovalMissing.selector);
        registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);
    }

    function testResolverFailureRollsBackRequestAndLabelReservation() public {
        resolver.setFailWrites(true);
        vm.prank(ISSUER);
        vm.expectRevert();
        registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);

        (bytes32 fingerprint,) = registrar.requests(REQUEST_KEY);
        assertEq(fingerprint, bytes32(0));
        assertFalse(registrar.claimedLabels(keccak256("calm-river-42")));

        resolver.setFailWrites(false);
        vm.prank(ISSUER);
        registrar.issue("calm-river-42", RESOLVED, REQUEST_KEY);
    }

    function testRejectsUnexpectedAndBatchTokenReceipts() public {
        vm.prank(address(wrapper));
        vm.expectRevert(InstitutionalEnsRegistrar.UnexpectedTokenReceipt.selector);
        registrar.onERC1155Received(address(registrar), address(0), 1, 1, "");

        vm.expectRevert(InstitutionalEnsRegistrar.BatchReceiptRejected.selector);
        registrar.onERC1155BatchReceived(
            address(registrar), address(0), new uint256[](0), new uint256[](0), ""
        );
    }

    function testOwnerCannotRenounceRecoveryControl() public {
        vm.prank(SAFE);
        vm.expectRevert(InstitutionalEnsRegistrar.OwnershipRenunciationDisabled.selector);
        registrar.renounceOwnership();
    }

    function testInvalidLabelsAndArgumentsRevert() public {
        _expectInvalidLabel("ab");
        _expectInvalidLabel("-calm");
        _expectInvalidLabel("calm-");
        _expectInvalidLabel("calm--river");
        _expectInvalidLabel("Calm-river");
        _expectInvalidLabel("calm_river");
        _expectInvalidLabel("abcdefghijklmnopqrstuvwxyz1234567");

        vm.prank(ISSUER);
        vm.expectRevert(InstitutionalEnsRegistrar.InvalidAddress.selector);
        registrar.issue("calm-river", address(0), REQUEST_KEY);

        vm.prank(ISSUER);
        vm.expectRevert(InstitutionalEnsRegistrar.InvalidRequestKey.selector);
        registrar.issue("calm-river", RESOLVED, bytes32(0));
    }

    function testFuzzIssueBindsAnyNonzeroAddressAndRequestKey(address resolved, bytes32 requestKey)
        public
    {
        if (resolved == address(0)) resolved = address(1);
        if (requestKey == bytes32(0)) requestKey = bytes32(uint256(1));

        vm.prank(ISSUER);
        bytes32 node = registrar.issue("quiet-harbor-9", resolved, requestKey);

        assertEq(resolver.addr(node), resolved);
        (bytes32 fingerprint, bytes32 storedNode) = registrar.requests(requestKey);
        assertTrue(fingerprint != bytes32(0));
        assertEq(storedNode, node);
    }

    function _expectInvalidLabel(string memory label) private {
        vm.prank(ISSUER);
        vm.expectRevert(InstitutionalEnsRegistrar.InvalidLabel.selector);
        registrar.issue(label, RESOLVED, REQUEST_KEY);
    }
}
