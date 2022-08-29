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
Unlike the circuits where a single 