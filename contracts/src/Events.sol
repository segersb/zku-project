//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.16;

import "./UtilityClaimVerifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Events is UtilityClaimVerifier, Ownable {
    uint256 unitPrice = 1_000_000;
    mapping(address => uint256[]) userEventIds;
    mapping(uint256 => Event) events;

    struct Event {
        bool created;
        string cid;
        uint32 eventCount;
        uint256 snapshotRoot;
        uint32 registrationCount;
        uint32 entranceCount;
        mapping(uint256 => bool) registrationCommitments;
        mapping(uint256 => bool) registrationNullifiers;
        mapping(uint256 => bool) entranceNullifiers;
    }

    error DuplicateEvent();
    error InvalidEventPrice();
    error UnknownEvent();
    error InvalidSnapshot();
    error InvalidStep();
    error DuplicateRegistration();
    error RegistrationFull();
    error InvalidProof();
    error UnknownRegistration();

    function createEvent(uint256 eventId, string memory cid, uint32 eventCount, uint256 snapshotRoot) public payable {
        assert(eventId > 0);
        assert(eventCount > 0);
        assert(snapshotRoot > 0);

        Event storage _event = events[eventId];

        if (_event.created) {
            revert DuplicateEvent();
        }
        if (msg.value != unitPrice * eventCount) {
            revert InvalidEventPrice();
        }

        _event.created = true;
        _event.cid = cid;
        _event.eventCount = eventCount;
        _event.snapshotRoot = snapshotRoot;

        userEventIds[msg.sender].push(eventId);
    }

    function eventRegistration(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[6] memory input) public {
        uint256 snapshotRoot = input[0];
        uint256 claimCommitment = input[1];
        uint256 claimNullifier = input[2];
        uint256 eventId = input[3] * 340282366920938463463374607431768211456 + input[4];
        uint256 eventStep = input[5];

        Event storage _event = events[eventId];

        if (!_event.created) {
            revert UnknownEvent();
        }
        if (_event.snapshotRoot != snapshotRoot) {
            revert InvalidSnapshot();
        }
        if (eventStep != 1) {
            revert InvalidStep();
        }
        if (_event.registrationNullifiers[claimNullifier]) {
            revert DuplicateRegistration();
        }
        if (_event.registrationCount == _event.eventCount) {
            revert RegistrationFull();
        }
        if (!super.verifyProof(a, b, c, input)) {
            revert InvalidProof();
        }

        _event.registrationCommitments[claimCommitment] = true;
        _event.registrationNullifiers[claimNullifier] = true;
        _event.registrationCount++;
    }

    function eventEntrance(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[6] memory input) public {
        uint256 snapshotRoot = input[0];
        uint256 claimCommitment = input[1];
        uint256 claimNullifier = input[2];
        uint256 eventId = input[3] * 340282366920938463463374607431768211456 + input[4];
        uint256 eventStep = input[5];

        Event storage _event = events[eventId];

        if (!_event.created) {
            revert UnknownEvent();
        }
        if (_event.snapshotRoot != snapshotRoot) {
            revert InvalidSnapshot();
        }
        if (eventStep != 2) {
            revert InvalidStep();
        }
        if (!_event.registrationCommitments[claimCommitment]) {
            revert UnknownRegistration();
        }
        if (!super.verifyProof(a, b, c, input)) {
            revert InvalidProof();
        }

        _event.entranceNullifiers[claimNullifier] = true;
        _event.entranceCount++;
    }

    function getUserEventIds(address user) public view returns (uint256[] memory) {
        return userEventIds[user];
    }

    function getEventCreated(uint256 eventId) public view returns (bool) {
        return events[eventId].created;
    }

    function getEventCid(uint256 eventId) public view returns (string memory) {
        return events[eventId].cid;
    }

    function getEventRegistrationCount(uint256 eventId) public view returns (uint32) {
        return events[eventId].registrationCount;
    }

    function getEventEntranceCount(uint256 eventId) public view returns (uint32) {
        return events[eventId].entranceCount;
    }

    function setUnitPrice(uint256 _unitPrice) public onlyOwner {
        unitPrice = _unitPrice;
    }

    function getUnitPrice() public view returns (uint256) {
        return unitPrice;
    }
}
