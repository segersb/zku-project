//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.16;

import "./UtilityClaimVerifier.sol";
import "hardhat/console.sol";

contract Events is UtilityClaimVerifier {
    mapping(uint256 => uint256) snapshotRoots;
    mapping(uint256 => mapping(uint256 => bool)) registrationCommitments;
    mapping(uint256 => mapping(uint256 => bool)) registrationNullifiers;
    mapping(uint256 => mapping(uint256 => bool)) entranceNullifiers;

    error DuplicateEvent();
    error UnknownEvent();
    error InvalidSnapshot();
    error InvalidStep();
    error DuplicateRegistration();
    error InvalidProof();
    error UnknownRegistration();

    function createEvent(uint256 eventId, uint256 snapshotRoot) public {
        assert(eventId > 0);
        assert(snapshotRoot > 0);

        if (snapshotRoots[eventId] > 0) {
            revert DuplicateEvent();
        }
        snapshotRoots[eventId] = snapshotRoot;
    }

    function eventRegistration(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[6] memory input) public {
        uint256 snapshotRoot = input[0];
        uint256 claimCommitment = input[1];
        uint256 claimNullifier = input[2];
        uint256 eventId = input[3] * 340282366920938463463374607431768211456 + input[4];
        uint256 eventStep = input[5];

        if (snapshotRoots[eventId] == 0) {
            revert UnknownEvent();
        }
        if (snapshotRoots[eventId] != snapshotRoot) {
            revert InvalidSnapshot();
        }
        if (eventStep != 1) {
            revert InvalidStep();
        }
        if (registrationNullifiers[eventId][claimNullifier]) {
            revert DuplicateRegistration();
        }
        if (!super.verifyProof(a, b, c, input)) {
            revert InvalidProof();
        }

        registrationCommitments[eventId][claimCommitment] = true;
        registrationNullifiers[eventId][claimNullifier] = true;
    }

    function eventEntrance(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[6] memory input) public {
        uint256 snapshotRoot = input[0];
        uint256 claimCommitment = input[1];
        uint256 claimNullifier = input[2];
        uint256 eventId = input[3] * 340282366920938463463374607431768211456 + input[4];
        uint256 eventStep = input[5];

        if (snapshotRoots[eventId] == 0) {
            revert UnknownEvent();
        }
        if (snapshotRoots[eventId] != snapshotRoot) {
            revert InvalidSnapshot();
        }
        if (eventStep != 2) {
            revert InvalidStep();
        }
        if (!registrationCommitments[eventId][claimCommitment]) {
            revert UnknownRegistration();
        }
        if (!super.verifyProof(a, b, c, input)) {
            revert InvalidProof();
        }

        entranceNullifiers[eventId][claimNullifier] = true;
    }

}
