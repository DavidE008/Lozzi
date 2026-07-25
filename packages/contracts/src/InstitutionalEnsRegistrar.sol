// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IEnsRegistry } from "./ens/IEnsRegistry.sol";
import { INameWrapper } from "./ens/INameWrapper.sol";
import { IPublicResolver } from "./ens/IPublicResolver.sol";

/// @notice Issues revocable, institution-owned ENS aliases under one wrapped parent.
/// @dev The issuer can create aliases only. The owner Safe retains parent and recovery control.
contract InstitutionalEnsRegistrar is Ownable2Step, Pausable, ReentrancyGuard, IERC1155Receiver {
    struct RequestRecord {
        bytes32 fingerprint;
        bytes32 node;
    }

    error AdapterApprovalMissing();
    error BatchReceiptRejected();
    error DependencyHasNoCode(address dependency);
    error InvalidAddress();
    error InvalidLabel();
    error InvalidParentNode();
    error InvalidRequestKey();
    error LabelUnavailable(bytes32 labelHash);
    error OwnershipRenunciationDisabled();
    error ParentExpired(uint64 expiry);
    error ParentNotWrapped();
    error ParentOwnerMismatch(address expected, address actual);
    error RecordVerificationFailed(bytes32 node);
    error RequestKeyConflict(bytes32 requestKey);
    error UnauthorizedIssuer(address caller);
    error UnexpectedTokenReceipt();

    IEnsRegistry public immutable ensRegistry;
    INameWrapper public immutable nameWrapper;
    IPublicResolver public immutable publicResolver;
    bytes32 public immutable parentNode;

    address public issuer;

    mapping(bytes32 requestKey => RequestRecord record) public requests;
    mapping(bytes32 labelHash => bool claimed) public claimedLabels;

    bytes32 private expectedReceiptNode;
    bool private expectedReceiptObserved;

    event IssuerChanged(address indexed previousIssuer, address indexed newIssuer);
    event SubnameIssued(
        bytes32 indexed requestKey,
        bytes32 indexed labelHash,
        address indexed resolvedAddress,
        bytes32 node
    );

    constructor(
        IEnsRegistry registry_,
        INameWrapper wrapper_,
        IPublicResolver resolver_,
        bytes32 parentNode_,
        address safeOwner_,
        address issuer_
    ) Ownable(safeOwner_) {
        if (
            address(registry_) == address(0) || address(wrapper_) == address(0)
                || address(resolver_) == address(0) || safeOwner_ == address(0)
                || issuer_ == address(0)
        ) {
            revert InvalidAddress();
        }
        if (parentNode_ == bytes32(0)) revert InvalidParentNode();
        _requireCode(address(registry_));
        _requireCode(address(wrapper_));
        _requireCode(address(resolver_));

        ensRegistry = registry_;
        nameWrapper = wrapper_;
        publicResolver = resolver_;
        parentNode = parentNode_;
        issuer = issuer_;

        if (registry_.owner(parentNode_) != address(wrapper_)) revert ParentNotWrapped();
        (address wrappedOwner,, uint64 expiry) = wrapper_.getData(uint256(parentNode_));
        if (wrappedOwner != safeOwner_) {
            revert ParentOwnerMismatch(safeOwner_, wrappedOwner);
        }
        if (expiry <= block.timestamp) revert ParentExpired(expiry);

        emit IssuerChanged(address(0), issuer_);
    }

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert UnauthorizedIssuer(msg.sender);
        _;
    }

    function issue(string calldata label, address resolvedAddress, bytes32 requestKey)
        external
        onlyIssuer
        whenNotPaused
        nonReentrant
        returns (bytes32 node)
    {
        if (resolvedAddress == address(0)) revert InvalidAddress();
        if (requestKey == bytes32(0)) revert InvalidRequestKey();
        _validateLabel(label);

        bytes32 labelHash = keccak256(bytes(label));
        bytes32 fingerprint = keccak256(abi.encode(labelHash, resolvedAddress));
        RequestRecord memory prior = requests[requestKey];
        if (prior.fingerprint != bytes32(0)) {
            if (prior.fingerprint != fingerprint) revert RequestKeyConflict(requestKey);
            return prior.node;
        }
        if (claimedLabels[labelHash]) revert LabelUnavailable(labelHash);

        address safeOwner = owner();
        (address wrappedOwner,, uint64 parentExpiry) = nameWrapper.getData(uint256(parentNode));
        if (wrappedOwner != safeOwner) {
            revert ParentOwnerMismatch(safeOwner, wrappedOwner);
        }
        if (parentExpiry <= block.timestamp) revert ParentExpired(parentExpiry);
        if (!nameWrapper.isApprovedForAll(safeOwner, address(this))) {
            revert AdapterApprovalMissing();
        }

        node = keccak256(abi.encodePacked(parentNode, labelHash));
        (address currentOwner,,) = nameWrapper.getData(uint256(node));
        if (currentOwner != address(0)) revert LabelUnavailable(labelHash);

        claimedLabels[labelHash] = true;
        requests[requestKey] = RequestRecord({ fingerprint: fingerprint, node: node });

        expectedReceiptNode = node;
        expectedReceiptObserved = false;
        bytes32 createdNode =
            nameWrapper.setSubnodeOwner(parentNode, label, address(this), 0, parentExpiry);
        if (createdNode != node || !expectedReceiptObserved) revert UnexpectedTokenReceipt();
        delete expectedReceiptNode;
        expectedReceiptObserved = false;

        publicResolver.setAddr(node, resolvedAddress);
        nameWrapper.setSubnodeRecord(
            parentNode, label, safeOwner, address(publicResolver), 0, 0, parentExpiry
        );

        (address finalOwner,,) = nameWrapper.getData(uint256(node));
        if (
            finalOwner != safeOwner || ensRegistry.owner(node) != address(nameWrapper)
                || ensRegistry.resolver(node) != address(publicResolver)
                || publicResolver.addr(node) != resolvedAddress
        ) {
            revert RecordVerificationFailed(node);
        }

        emit SubnameIssued(requestKey, labelHash, resolvedAddress, node);
    }

    function setIssuer(address newIssuer) external onlyOwner {
        if (newIssuer == address(0)) revert InvalidAddress();
        address previousIssuer = issuer;
        issuer = newIssuer;
        emit IssuerChanged(previousIssuer, newIssuer);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata
    ) external override returns (bytes4) {
        if (
            msg.sender != address(nameWrapper) || operator != address(this)
                || from != address(0) || bytes32(id) != expectedReceiptNode || value != 1
                || expectedReceiptNode == bytes32(0) || expectedReceiptObserved
        ) {
            revert UnexpectedTokenReceipt();
        }
        expectedReceiptObserved = true;
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        revert BatchReceiptRejected();
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(IERC1155Receiver).interfaceId;
    }

    function _requireCode(address dependency) private view {
        if (dependency.code.length == 0) revert DependencyHasNoCode(dependency);
    }

    function _validateLabel(string calldata label) private pure {
        bytes calldata value = bytes(label);
        uint256 length = value.length;
        if (length < 3 || length > 32 || value[0] == 0x2d || value[length - 1] == 0x2d) {
            revert InvalidLabel();
        }

        bool previousWasHyphen;
        for (uint256 index = 0; index < length; ++index) {
            bytes1 character = value[index];
            bool letter = character >= 0x61 && character <= 0x7a;
            bool number = character >= 0x30 && character <= 0x39;
            bool hyphen = character == 0x2d;
            if (!letter && !number && !hyphen) revert InvalidLabel();
            if (hyphen && previousWasHyphen) revert InvalidLabel();
            previousWasHyphen = hyphen;
        }
    }
}
