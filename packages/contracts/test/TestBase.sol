// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface Vm {
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData)
        external;

    function expectEmit(
        bool checkTopic1,
        bool checkTopic2,
        bool checkTopic3,
        bool checkData,
        address emitter
    ) external;

    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error AssertionFailed();

    function assertTrue(bool condition) internal pure {
        if (!condition) revert AssertionFailed();
    }

    function assertFalse(bool condition) internal pure {
        if (condition) revert AssertionFailed();
    }

    function assertEq(bytes32 actual, bytes32 expected) internal pure {
        if (actual != expected) revert AssertionFailed();
    }

    function assertEq(address actual, address expected) internal pure {
        if (actual != expected) revert AssertionFailed();
    }

    function assertEq(uint256 actual, uint256 expected) internal pure {
        if (actual != expected) revert AssertionFailed();
    }
}

abstract contract InvariantTargetBase {
    struct FuzzSelector {
        address addr;
        bytes4[] selectors;
    }

    struct FuzzArtifactSelector {
        string artifact;
        bytes4[] selectors;
    }

    struct FuzzInterface {
        address addr;
        string[] artifacts;
    }

    address[] private targetedContracts;

    function targetContract(address target) internal {
        targetedContracts.push(target);
    }

    function excludeArtifacts() public pure returns (string[] memory values) { }

    function excludeContracts() public pure returns (address[] memory values) { }

    function excludeSelectors() public pure returns (FuzzSelector[] memory values) { }

    function excludeSenders() public pure returns (address[] memory values) { }

    function targetArtifactSelectors()
        public
        pure
        returns (FuzzArtifactSelector[] memory values)
    { }

    function targetArtifacts() public pure returns (string[] memory values) { }

    function targetContracts() public view returns (address[] memory) {
        return targetedContracts;
    }

    function targetInterfaces() public pure returns (FuzzInterface[] memory values) { }

    function targetSelectors() public pure returns (FuzzSelector[] memory values) { }

    function targetSenders() public pure returns (address[] memory values) { }
}
