# zku-project

## Circuits

### UtilityClaim
This is the main circuit used to verify the ownership of an NFT.

#### Signals
| Type   | Name               | Description                                                                            |
|--------|--------------------|----------------------------------------------------------------------------------------|
| input  | utility            | An ID uniquely defining a utility                                                      |
| input  | utilityStep        | A number that allows to claim the utility in multiple steps                            |
| input  | collection         | The collection of the NFT that the prover wants to claim ownership of                  |
| input  | token              | The NFT token ID that the prover wants to claim ownership of                           |
| input  | publicKey          | The public key of the prover                                                           |
| input  | signatureR         | The "r" part of the signature needed to prove the ownership                            |
| input  | signatureS         | The "s" part of the signature needed to prove the ownership                            |
| input  | claimTreePositions | The 0/1 position indexes used to derive the Merkle root of the snapshot                |
| input  | claimTreeElements  | The other hashes of the snapshot Merkle tree used to derive the Merkle root            |
| output | claimRoot          | The snapshot Merkle tree root computed by the proof (should match the actual root)     |
| output | claimCommitment    | A hash that will remain the same for each unique utility claim, regardless of the step |
| output | claimNullifier     | A hash that will be different for each step of the utility claim                       |

#### Parameters

| Name      | Description                                                                                                                                                                                  |
|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| treeDepth | The depth of the NFT snapshot tree<br/>For the moment it is hardcoded to 2<br/>TBD either have a large enough value for all use cases or multiple contracts and use the most appropriate one |

#### Libraries
The circuit makes use of a library `circom-ecdsa` by **0xPARC** to verify ECDSA signatures.
This library comes with two other libraries included, more info on https://github.com/0xPARC/circom-ecdsa