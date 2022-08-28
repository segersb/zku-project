pragma circom 2.0.6;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/switcher.circom";
include "../lib/0xpark-ecdsa/ecdsa.circom";
include "../lib/zk-identity/eth.circom";

template UtilityClaim(treeDepth) {
    // public input
    signal input utility;
    signal input utilityStep;
    
    // private input
    signal input collection;
    signal input token[2];
    signal input publicKey[4];
    signal input signatureR[2];
    signal input signatureS[2];
    signal input snapshotPathPositions[treeDepth];
    signal input snapshotPathElements[treeDepth];
    
    // output
    signal output snapshotRoot;
    signal output claimCommitment;
    signal output claimNullifier;

    // convert inputs to bits
    component utilityBits = Nums2Bits(1, 128);
    component collectionBits = Nums2Bits(1, 160);
    component tokenBits = Nums2Bits(2, 128);
    component publicKeyBits = Nums2Bits(4, 128);
    component signatureRBits = Nums2Bits(2, 128);
    component signatureSBits = Nums2Bits(2, 128);
    utilityBits.numbers[0] <== utility;
    collectionBits.numbers[0] <== collection;
    for (var i = 0; i < 2; i++) tokenBits.numbers[i] <== token[i];
    for (var i = 0; i < 4; i++) publicKeyBits.numbers[i] <== publicKey[i];
    for (var i = 0; i < 2; i++) signatureRBits.numbers[i] <== signatureR[i];
    for (var i = 0; i < 2; i++) signatureSBits.numbers[i] <== signatureS[i];    
    
    // calculate expected message hash
    component utilityClaimMessageHash = UtilityClaimMessageHash();
    for (var i = 0; i < 128; i++) utilityClaimMessageHash.utility[i] <== utilityBits.bits[i];
    for (var i = 0; i < 160; i++) utilityClaimMessageHash.collection[i] <== collectionBits.bits[i];
    for (var i = 0; i < 256; i++) utilityClaimMessageHash.token[i] <== tokenBits.bits[i];

    // verify signature is from public key and expected message hash
    component utilityClaimSignatureVerifier = UtilityClaimSignatureVerifier();
    for (var i = 0; i < 512; i++) utilityClaimSignatureVerifier.publicKey[i] <== publicKeyBits.bits[i];
    for (var i = 0; i < 256; i++) utilityClaimSignatureVerifier.signatureR[i] <== signatureRBits.bits[i];
    for (var i = 0; i < 256; i++) utilityClaimSignatureVerifier.signatureS[i] <== signatureSBits.bits[i];
    for (var i = 0; i < 256; i++) utilityClaimSignatureVerifier.messageHash[i] <== utilityClaimMessageHash.messageHash[i];

    // calculate address from public key
    component pubkeyToAddress = PubkeyToAddress();
    for (var i = 0; i < 512; i++) pubkeyToAddress.pubkeyBits[i] <== publicKeyBits.bits[511 - i];

    // calculate snapshot leaf
    component utilitySnapshotLeaf = UtilitySnapshotLeaf();
    for (var i = 0; i < 160; i++) utilitySnapshotLeaf.collection[i] <== collectionBits.bits[i];
    for (var i = 0; i < 256; i++) utilitySnapshotLeaf.token[i] <== tokenBits.bits[i];
    utilitySnapshotLeaf.address <== pubkeyToAddress.address;

    component utilitySnapshotRoot = UtilitySnapshotRoot(treeDepth);
    utilitySnapshotRoot.snapshotLeaf <== utilitySnapshotLeaf.snapshotLeaf;
    for (var i = 0; i < treeDepth; i++) utilitySnapshotRoot.snapshotPathPositions[i] <== snapshotPathPositions[i];
    for (var i = 0; i < treeDepth; i++) utilitySnapshotRoot.snapshotPathElements[i] <== snapshotPathElements[i];
    snapshotRoot <== utilitySnapshotRoot.snapshotRoot;

    component utilityClaimCommitment = UtilityClaimCommitment();
    utilityClaimCommitment.utility <== utility;
    for (var i = 0; i < 256; i++) utilityClaimCommitment.signatureR[i] <== signatureRBits.bits[i];
    claimCommitment <== utilityClaimCommitment.claimCommitment;

    component utilityClaimNullifier = UtilityClaimNullifier();
    utilityClaimNullifier.utilityStep <== utilityStep;
    for (var i = 0; i < 256; i++) utilityClaimNullifier.signatureR[i] <== signatureRBits.bits[i];
    claimNullifier <== utilityClaimNullifier.claimNullifier;
}

// Outputs the expected message hash according to the Ethereum singing standard
template UtilityClaimMessageHash() {
    signal input utility[128];
    signal input collection[160];
    signal input token[256];
    signal output messageHash[256];

    component messageKeccak = Keccak(768, 256);
    var messageKeccakIndex = 0;

    // 208 bits for prefix "\x19Ethereum Signed Message:\n"
    component prefixBits = Num2Bits(208);
    prefixBits.in <== 40609425437117077327497243497209003585044186318288565794322954;
    for (var i = 0; i < 26; i++) {
        for (var j = 0; j < 8; j++) {
            messageKeccak.in[messageKeccakIndex] <== prefixBits.out[208 - i*8 - 8 + j];
            messageKeccakIndex++;
        }
    }

    // 16 bits for fixed length as string "68"
    component lengthBits = Num2Bits(16);
    lengthBits.in <== 13880;
    for (var i = 0; i < 2; i++) {
        for (var j = 0; j < 8; j++) {
            messageKeccak.in[messageKeccakIndex] <== lengthBits.out[16 - i*8 - 8 + j];
            messageKeccakIndex++;
        }
    }

    // 128 bits for uint256 utility ID
    for (var i = 0; i < 16; i++) {
        for (var j = 0; j < 8; j++) {
            messageKeccak.in[messageKeccakIndex] <== utility[i*8 + 7 - j];
            messageKeccakIndex++;
        }
    }

    // 160 bit for collection eth address
    for (var i = 0; i < 20; i++) {
        for (var j = 0; j < 8; j++) {
            messageKeccak.in[messageKeccakIndex] <== collection[i*8 + 7 - j];
            messageKeccakIndex++;
        }
    }


    // 256 bits for uint256 token ID
    for (var i = 0; i < 32; i++) {
        for (var j = 0; j < 8; j++) {
            messageKeccak.in[messageKeccakIndex] <== token[i*8 + 7 - j];
            messageKeccakIndex++;
        }
    }

    for (var i = 0; i < 32; i++) {
        for (var j = 0; j < 8; j++) {
            messageHash[i*8 + j] <== messageKeccak.out[i*8 + 7 - j];
        }
    }
}

// Verifies that the provided ECDSA signature is valid and signs the expected message
template UtilityClaimSignatureVerifier() {
    signal input publicKey[512];
    signal input signatureR[256];
    signal input signatureS[256];
    signal input messageHash[256];

    component publicKeyXRegisters[4];
    component publicKeyYRegisters[4];
    component signatureRRegisters[4];
    component signatureSRegisters[4];
    component messageHashRegisters[4];

    component signatureVerifier = ECDSAVerifyNoPubkeyCheck(64, 4);
    for (var i = 0; i < 4; i++) {
        publicKeyXRegisters[i] = Bits2Num(64);
        publicKeyYRegisters[i] = Bits2Num(64);
        signatureRRegisters[i] = Bits2Num(64);
        signatureSRegisters[i] = Bits2Num(64);
        messageHashRegisters[i] = Bits2Num(64);

        for (var j = 0; j < 64; j++) {
            publicKeyXRegisters[i].in[j] <== publicKey[255 - i*64 - j];
            publicKeyYRegisters[i].in[j] <== publicKey[511 - i*64 - j];
            signatureRRegisters[i].in[j] <== signatureR[255 - i*64 - j];
            signatureSRegisters[i].in[j] <== signatureS[255 - i*64 - j];
            messageHashRegisters[i].in[j] <== messageHash[255 - i*64 - j];
        }

        signatureVerifier.pubkey[0][i] <== publicKeyXRegisters[i].out;
        signatureVerifier.pubkey[1][i] <== publicKeyYRegisters[i].out;
        signatureVerifier.r[i] <== signatureRRegisters[i].out;
        signatureVerifier.s[i] <== signatureSRegisters[i].out;
        signatureVerifier.msghash[i] <== messageHashRegisters[i].out;
    }
    signatureVerifier.result === 1;
}

// Calculates the leaf of the NFT snapshot tree that is being claimed
template UtilitySnapshotLeaf() {
    signal input collection[160];
    signal input token[256];
    signal input address;
    signal output snapshotLeaf;

    component collectionNum = Bits2Num(160);
    for (var i = 0; i < 160; i++) collectionNum.in[i] <== collection[159 - i];

    component tokenNum1 = Bits2Num(128);
    component tokenNum2 = Bits2Num(128);
    for (var i = 0; i < 128; i++) tokenNum1.in[i] <== token[127 - i];
    for (var i = 0; i < 128; i++) tokenNum2.in[i] <== token[255 - i];

    component snapshotLeafPoseidon = Poseidon(4);
    snapshotLeafPoseidon.inputs[0] <== collectionNum.out;
    snapshotLeafPoseidon.inputs[1] <== tokenNum1.out;
    snapshotLeafPoseidon.inputs[2] <== tokenNum2.out;
    snapshotLeafPoseidon.inputs[3] <== address;
    snapshotLeaf <== snapshotLeafPoseidon.out;
}

// Calculates the root of the NFT snapshot tree that is being claimed
// This root must later be matched to the actual root
template UtilitySnapshotRoot(treeDepth) {
    signal input snapshotLeaf;
    signal input snapshotPathPositions[treeDepth];
    signal input snapshotPathElements[treeDepth];
    signal output snapshotRoot;

    component hashes[treeDepth];
    component hashInputs[treeDepth];

    for (var i = 0; i < treeDepth; i++) {
        if (i == 0) {
            hashInputs[0] = Switcher();
            hashInputs[0].sel <== snapshotPathPositions[0];
            hashInputs[0].L <== snapshotLeaf;
            hashInputs[0].R <== snapshotPathElements[0];

            hashes[0] = Poseidon(2);
            hashes[0].inputs[0] <== hashInputs[0].outL;
            hashes[0].inputs[1] <== hashInputs[0].outR;
        } else {
            hashInputs[i] = Switcher();
            hashInputs[i].sel <== snapshotPathPositions[i];
            hashInputs[i].L <== hashes[i - 1].out;
            hashInputs[i].R <== snapshotPathElements[i];

            hashes[i] = Poseidon(2);
            hashes[i].inputs[0] <== hashInputs[i].outL;
            hashes[i].inputs[1] <== hashInputs[i].outR;
        }
    }

    snapshotRoot <== hashes[treeDepth - 1].out;
}

// Calculates the commitment for the utility claim, remains the same for all steps
template UtilityClaimCommitment() {
    signal input utility;
    signal input signatureR[256];
    signal output claimCommitment;

    component signatureRNum1 = Bits2Num(128);
    component signatureRNum2 = Bits2Num(128);
    for (var i = 0; i < 128; i++) signatureRNum1.in[i] <== signatureR[127 - i];
    for (var i = 0; i < 128; i++) signatureRNum2.in[i] <== signatureR[255 - i];

    component claimCommitmentPoseidon = Poseidon(3);
    claimCommitmentPoseidon.inputs[0] <== utility;
    claimCommitmentPoseidon.inputs[1] <== signatureRNum1.out;
    claimCommitmentPoseidon.inputs[2] <== signatureRNum2.out;
    claimCommitment <== claimCommitmentPoseidon.out;
}

// Calculates the nullifier for the current step in the utility claim
template UtilityClaimNullifier() {
    signal input utilityStep;
    signal input signatureR[256];
    signal output claimNullifier;

    component signatureRNum1 = Bits2Num(128);
    component signatureRNum2 = Bits2Num(128);
    for (var i = 0; i < 128; i++) signatureRNum1.in[i] <== signatureR[127 - i];
    for (var i = 0; i < 128; i++) signatureRNum2.in[i] <== signatureR[255 - i];

    component claimNullifierPoseidon = Poseidon(3);
    claimNullifierPoseidon.inputs[0] <== utilityStep;
    claimNullifierPoseidon.inputs[1] <== signatureRNum1.out;
    claimNullifierPoseidon.inputs[2] <== signatureRNum2.out;
    claimNullifier <== claimNullifierPoseidon.out;
}

template Nums2Bits(numberCount, bitCount) {
    signal input numbers[numberCount];
    signal output bits[numberCount * bitCount];

    component numberBits[numberCount];
    for (var i = 0; i < numberCount; i++) {
        numberBits[i] = Num2Bits(bitCount);
        numberBits[i].in <== numbers[i];
        for (var j = 0; j < bitCount; j++) {
            bits[i*bitCount + j] <== numberBits[i].out[bitCount - 1 - j];
        }
    }
}

// Used large enough tree
component main {public [utility, utilityStep]} = UtilityClaim(16);
