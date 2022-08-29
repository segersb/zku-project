# ZKU project: Nutty - An NFT utility tool

## Description

This tool allows anyone to add utility to NFTs on Ethereum mainnet.  
Since NFTs can be traded, we always work with a snapshot time when creating a utility.  
Zero knowledge proofs are used to keep the identity of NFT holders private. While we know which addresses own which NFTs, we will not reveal which addresses are making use of this tool.

The system is designed in such a way that utilities are kept generic and can be expanded.
The two utilities that were developed for this MVP are events and polls.

### Events

Events can be created by making a snapshot of eligible tokens and their owners at a specific time.  
Eligible token holders will first need to register for the event and can then create an entrance QR code. The entrance QR code can then be scanned at the event.  
Both the registration and entrance can only be done a single time for each token.

### Polls

Polls are also created with a snapshot of token holders and with the vote options.  
Eligible token holders can vote for their favorite option.  
Voting can be done a single time for each token.

## Components

This project consists of 3 technical components: circuits, contracts and a webapp.  
Each of then have their own folder in this main GIT repository.  
All project dependencies are managed with NPM.

### Circuits

The circuits are implemented in circom and use Groth16.  
`yarn build` Builds the circuits by compiling them, going through the setup and generated the verification key, WASM and Solidity verifier contract.  
`yarn test` Tests the circuits directly with `circom_tester`, no need to build first.

#### UtilityClaim

This is the main circuit used by NFT owners to claim a utility.  
To use this circuit we need to specify which token we are using for the claim as well as it's path in the snapshot tree.
NFT owners will be required to sign a specific message that includes the ID of the utility they want to claim as well as the collection and token ID of the token they are using.  
This circuit takes the signature as input and verifies that the signature message matches the given utility and token.
The address of the NFT holder is extracted from the signature and this allows the holder to prove his ownership.

To make this circuit usable in various ways we also input an arbitrary utility step.  
The circuit is now able to output 2 key hashes, the claim commitment and claim nullifier.  
A claim commitment is a hash that remains the same per token in the utility.  
A claim nullifier is a hash that will be different for each utility step.

These hashes can be used differently depending on the utility.  
Events use utility step 1 for registration proofs and 2 for entrance proofs.
The commitment is used to verify that a holder can only enter the event if he has registered first.
The nullifiers are used to verify that a holder can only register and enter once per token.  
Polls use utility steps for each possible vote option.
The commitment is used to verify that a holder can only vote once.
The nullifiers are not needed here.

##### Signals

| Type   | Visibility | Name                  | Description                                                                            |
|--------|------------|-----------------------|----------------------------------------------------------------------------------------|
| input  | public     | utility               | The UUID of the utility                                                                |
| input  | public     | utilityStep           | A number that allows to claim the utility in multiple steps                            |
| input  | private    | collection            | The collection of the NFT that the prover wants to claim ownership of                  |
| input  | private    | token                 | The NFT token ID that the prover wants to claim ownership of                           |
| input  | private    | publicKey             | The public key of the prover                                                           |
| input  | private    | signatureR            | The "r" part of the signature needed to prove the ownership                            |
| input  | private    | signatureS            | The "s" part of the signature needed to prove the ownership                            |
| input  | private    | snapshotPathPositions | The 0/1 position indexes used to derive the Merkle root of the snapshot                |
| input  | private    | snapshotPathElements  | The other hashes of the snapshot Merkle tree used to derive the Merkle root            |
| output | public     | snapshotRoot          | The snapshot Merkle tree root computed by the proof (should match the actual root)     |
| output | public     | claimCommitment       | A hash that will remain the same for each unique utility claim, regardless of the step |
| output | public     | claimNullifier        | A hash that will be different for each step of the utility claim                       |

##### Parameters

| Name      | Description                                                                                                   |
|-----------|---------------------------------------------------------------------------------------------------------------|
| treeDepth | The depth of the NFT snapshot is set to 16 allowing for 65536, which should be large enough for all use cases |

##### Libraries

The circuit makes use of a library `circom-ecdsa` by **0xPARC** to verify ECDSA signatures.
This library comes with two other libraries included, more info on https://github.com/0xPARC/circom-ecdsa

###### Adaptations

Some adaptation were made to allow this circuit to run in the browser.  
The signature verification library has constraints for each multiplication of a point on the Secp256k1 curve.  
Adaptations were made so that the multiplication is first calculated without constraints and only the final point is checked.
The adaptation can be found by searching for the comment `[adapted]` in the library

### Contracts

The contracts are written in Solidity and the project compilation, testing and deployment is done with HardHat.  
Unlike the circuits, where we have one generic multi functional circuit, here we have one contract per utility.
This allows us to add utilities afterwards.

`compile` Compiles the contracts to the build folder  
`test` Tests the contracts  
`hardhat-node` Starts a local HardHat node  
`deploy:local:events` Deploys the events contract on the local HardHat node  
`deploy:local:polls` Deploys the polls contract on the local HardHat node  
`deploy:local` Deploys all contract on the local HardHat node  
`deploy:goerli:events` Deploys the events contract on the Goerli testnet  
`deploy:goerli:polls` Deploys the polls contract on the Goerli testnet

#### Development notes

Add a `.env` file containing the environment variables

- `GOERLI_PRIVATE_KEY` Needed to deploy contracts on Goerli testnet
- `ALCHEMY_API_KEY` Needed to deploy contracts on remote networks
- `ETHERSCAN_API_KEY` Needed to verify contracts on Etherscan

To modify `UtilityClaimVerifier.sol`, copy the contract from the circuit build and modify the Solidity version as well as the contract name

Verifying contract on Ethercan is done by executing the command `npx hardhat verify --network goerli <address>`.  
No script is provided for this since the address will always change.

#### Events

The `Events` contract is specific for the events utility. Its main functionality is the creation, registration and entrance.

##### createEvent

| Parameter    | Type    | Description                         |
|--------------|---------|-------------------------------------|
| eventId      | uint256 | UUID of the event                   |
| cid          | string  | CID of the event, published on IPFS |
| eventCount   | uint32  | number of elements in the snapshot  |
| snapshotRoot | uint256 | Merkle tree root of the snapshot    |

Creates a new event

##### eventRegistration / validateEventRegistration / eventEntrance / validateEventEntrance

| Parameter | Type       | Description                                                                 |
|-----------|------------|-----------------------------------------------------------------------------|
| a         | uint[2]    | registration proof `a`                                                      |
| b         | uint[2][2] | registration proof `b`                                                      |
| c         | uint[2]    | registration proof `c`                                                      |
| input     | uint[5]    | `claimCommitment`, `claimNullifier`, `snapshotRoot`, `eventId`, `eventStep` |

Processes/validates a single registration/entrance by taking a proof as input.  
In all cases the `snapshotRoot` needs to match the one of the event.

When registering we keep the `claimCommitment` as well as the `claimNullifier`.  
The `claimNullifier` is used to verify that a registration cannot be done twice.  
Registrations proofs need to have `eventStep` equal to 1.

When entering we check that we have previously registered the `claimCommitment`.  
The `claimNullifier` is stored and used to verify that an entrance cannot be done twice.
Entrance proofs need to have `eventStep` equal to 2.

##### getUserEventIds

| Parameter | Type    | Description                                 |
|-----------|---------|---------------------------------------------|
| user      | address | The address of the user that created events |

Returns the event ID's that a user created

##### getEventCreated / getEventCid / getEventRegistrationCount / getEventEntranceCount

| Parameter | Type    | Description           |
|-----------|---------|-----------------------|
| eventId   | uint256 | The UUID of the event |

Returns information about a specific event

#### Polls

The `Polls` contract is specific for the polls utility. Its main functionality is the creation and voting.

##### createPoll

| Parameter    | Type    | Description                        |
|--------------|---------|------------------------------------|
| pollId       | uint128 | UUID of the poll                   |
| cid          | string  | CID of the poll, published on IPFS |
| pollCount    | uint32  | number of elements in the snapshot |
| snapshotRoot | uint256 | Merkle tree root of the snapshot   |
| voteOptions  | uint8   | Number of vote options, minimum 2  |

Creates a new poll

##### vote / validateVote

| Parameter | Type       | Description                                                       |
|-----------|------------|-------------------------------------------------------------------|
| a         | uint[2]    | registration proof `a`                                            |
| b         | uint[2][2] | registration proof `b`                                            |
| c         | uint[2]    | registration proof `c`                                            |
| input     | uint[5]    | claimCommitment, claimNullifier, snapshotRoot, eventId, eventStep |

Processes/validates a single vote by taking a registration proof as input.  
`snapshotRoot` needs to match the one of the poll.  
`eventStep` should be a number between 1 and `voteOptions`.  
Only the `claimCommitment` is kept to ensure that a token can be used only once to vote.

##### getUserPollIds

| Parameter | Type    | Description                                 |
|-----------|---------|---------------------------------------------|
| user      | address | The address of the user that created events |

Returns the poll ID's that a user created

##### getPollCreated / getPollCid / getPollVoteCount / getPollVoteOptions / getPollResult

| Parameter | Type    | Description          |
|-----------|---------|----------------------|
| pollId    | uint128 | The UUID of the poll |

Returns information about a specific poll

### Webapp

The webapp is created with Next.js and contains both a frontend and backend part.  
The frontend uses the Material UI components library.  
Interactions with the blockchain is done with Ethers.

`dev` Runs a development server of the webapp, this assumes a local HardHat node is running with the contracts.  
`dev:goerli` Runs a development server of the webapp, this assumes the contracts are deployed on Goerli.  
`build` Builds the webapp with Next.js  
`start` Starts the webapp, previously built with the `build` script.  
`lint` Lints the code, implicitly done in `build`

#### Development notes

Add a `.env.development` and a `.env.production` file is expected to contain the following variables:

- `ETHERSCAN_API_KEY` Used in the backend to search for tokens and transact
- `EVENTS_CONTRACT` The `Events` contract address
- `POLLS_CONTRACT` The `Polls` contract address
- `CHAIN_ID` The chain ID where the contract is deployed (31337 for HardHat, 5 for Goerli)
- `CHAIN_NAME` The chain name, used in the frontend to display a warning
- `BACKEND_KEY` The private key that the backend uses to sign transactions
- `PINATA_JWT` Used in the backend to publish on IPFS

Copy `utilityClaim.wasm` and `utilityClaim_final.zkey` in the public folder.  
Those files were not committed to GIT because of the size of the key.

When updating contracts, copy the contract json file in the public folder.

A Dockerfile is used to package the frontend in a container.

#### Backend (API routes)

##### /tokens

| Parameter    | Description                                   |
|--------------|-----------------------------------------------|
| collection   | The collection address of the tokens to fetch |
| fromToken    | Optional, used to filter tokens in a range    |
| toToken      | Optional, used to filter tokens in a range    |
| snapshotTime | The time of the snapshot                      |

Returns a list of tokens, where each token has a collection, token and address.  
The address is the token holder at the snapshot time.

##### Event endpoints

| Path                                 | Description                                                                          |
|--------------------------------------|--------------------------------------------------------------------------------------|
| `/events/{id}`                       | Returns a specific event                                                             |
| `/events/{id}/register`              | Takes a registration proof and sends it to the blockchain after validating it        |
| `/events/{id}/validate-registration` | Validates an entrance proof                                                          |
| `/events/{id}/enter`                 | Takes an entrance proof and sends it to the blockchain after validating it           |
| `/events/{id}/validate-entrance`     | Validates an entrance proof                                                          |
| `/events/unit-price`                 | Returns the unit price to pay for an event (total price is `unitPrice * eventCount`) |
| `/events/publish`                    | Publishes an event to IPFS containing `id`, `name` and `tokens`                      |
| `/events`                            | Returns the events that the given `user` has created                                 |

##### Poll endpoints

| Path                        | Description                                                                       |
|-----------------------------|-----------------------------------------------------------------------------------|
| `/polls/{id}`               | Returns a specific poll                                                           |
| `/polls/{id}/vote`          | Takes a vote proof and sends it to the blockchain after validating it             |
| `/polls/{id}/validate-vote` | Validates a vote proof                                                            |
| `/polls/unit-price`         | Returns the unit price to pay for a poll (total price is `unitPrice * pollCount`) |
| `/polls/publish`            | Publishes a poll to IPFS containing `id`, `name`, `tokens` and `voteOptionNames`  |
| `/polls`                    | Returns the polls that the given `user` has created                               |

#### Frontend (Page routes)

| Path                 | Description                                                                                           |
|----------------------|-------------------------------------------------------------------------------------------------------|
| `/`                  | Index page containing the connect button, users are redirected here when there is no ethers provider  |
| `/user`              | Home page for users that are connected                                                                |
| `/events`            | Lists all events created by the user                                                                  |
| `/events/new`        | Page for creating new events                                                                          |
| `/events/{id}`       | Page for a specific event, this is where users register for an event and create their entrance ticket |
| `/events/{id}/enter` | Page where an entrance QR code links to, used to confirm entrances                                    |
| `/polls`             | Lists all polls created by the user                                                                   |
| `/polls/new`         | Page for creating new poll                                                                            |
| `/polls/{id}`        | Page for a specific poll, this is where users cast their vote                                         |