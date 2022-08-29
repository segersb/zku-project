//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.16;

import "./UtilityClaimVerifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Polls is UtilityClaimVerifier, Ownable {
    uint256 unitPrice = 1_100_000_000_00_000; // 0.00011 ETH
    mapping(address => uint128[]) userPollIds;
    mapping(uint128 => Poll) polls;

    struct Poll {
        bool created;
        string cid;
        uint32 pollCount;
        uint256 snapshotRoot;
        uint8 voteOptions;
        uint32 voteCount;
        mapping(uint8 => uint32) results;
        mapping(uint256 => bool) voteNullifiers;
    }

    error DuplicatePoll();
    error InvalidPollPrice();
    error InvalidVoteOptions();
    error UnknownPoll();
    error InvalidSnapshot();
    error InvalidVote();
    error DuplicateVote();
    error PollFull();
    error InvalidProof();

    function createPoll(uint128 pollId, string memory cid, uint32 pollCount, uint256 snapshotRoot, uint8 voteOptions) public payable {
        assert(pollId > 0);
        assert(pollCount > 0);
        assert(snapshotRoot > 0);
        assert(voteOptions > 0);

        Poll storage poll = polls[pollId];

        if (poll.created) {
            revert DuplicatePoll();
        }
        if (msg.value != unitPrice * pollCount) {
            revert InvalidPollPrice();
        }
        if (voteOptions < 2) {
            revert InvalidVoteOptions();
        }

        poll.created = true;
        poll.cid = cid;
        poll.pollCount = pollCount;
        poll.snapshotRoot = snapshotRoot;
        poll.voteOptions = voteOptions;

        userPollIds[msg.sender].push(pollId);
    }

    function vote(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[5] memory input) public {
        validateVote(a, b, c, input);

        uint256 claimCommitment = input[1];
        uint128 pollId = uint128(input[3]);
        uint8 voteOption = uint8(input[4]);

        Poll storage poll = polls[pollId];
        poll.voteNullifiers[claimCommitment] = true;
        poll.results[voteOption] = poll.results[voteOption] + 1;
        poll.voteCount++;
    }

    function validateVote(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[5] memory input) public view returns (bool) {
        uint256 snapshotRoot = input[0];
        uint256 claimCommitment = input[1];
        uint128 pollId = uint128(input[3]);
        uint256 voteOption = input[4];

        Poll storage poll = polls[pollId];

        if (!poll.created) {
            revert UnknownPoll();
        }
        if (poll.snapshotRoot != snapshotRoot) {
            revert InvalidSnapshot();
        }
        if (voteOption < 1 || voteOption > poll.voteOptions) {
            revert InvalidVote();
        }
        if (poll.voteNullifiers[claimCommitment]) {
            revert DuplicateVote();
        }
        if (poll.voteCount == poll.pollCount) {
            revert PollFull();
        }
        if (!super.verifyProof(a, b, c, input)) {
            revert InvalidProof();
        }

        return true;
    }

    function getUserPollIds(address user) public view returns (uint128[] memory) {
        return userPollIds[user];
    }

    function getPollCreated(uint128 pollId) public view returns (bool) {
        return polls[pollId].created;
    }

    function getPollCid(uint128 pollId) public view returns (string memory) {
        return polls[pollId].cid;
    }

    function getPollVoteCount(uint128 pollId) public view returns (uint32) {
        return polls[pollId].voteCount;
    }

    function getPollVoteOptions(uint128 pollId) public view returns (uint8) {
        return polls[pollId].voteOptions;
    }

    function getPollResult(uint128 pollId, uint8 voteOption) public view returns (uint32) {
        return polls[pollId].results[voteOption];
    }

    function setUnitPrice(uint256 _unitPrice) public onlyOwner {
        unitPrice = _unitPrice;
    }

    function getUnitPrice() public view returns (uint256) {
        return unitPrice;
    }
}
