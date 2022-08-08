pragma circom 2.0.6;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/switcher.circom";
include "../lib/0xpark-ecdsa/ecdsa.circom";
include "../lib/zk-identity/eth.circom";

template UtilityClaim(treeDepth) {
    signal input utility[256];
    signal input utilityStep;
    signal input collection[160];
    signal input token[256];
    signal input publicKey[512];
    signal input signatureR[256];
    signal input signatureS[256];
    signal input claimTreePositions[treeDepth];
    signal input claimTreeElements[treeDepth];
    signal messageHash[256];
    signal address;
    signal claimLeaf;
    signal output claimRoot;
    signal output claimCommitment;
    signal output claimNullifier;

    component utilityClaimMessageHash = UtilityClaimMessageHash();
    for (var i = 0; i < 256; i++) utilityClaimMessageHash.utility[i] <== utility[i];
    for (var i = 0; i < 160; i++) utilityClaimMessageHash.collection[i] <== collection[i];
    for (var i = 0; i < 256; i++) utilityClaimMessageHash.token[i] <== token[i];
    for (var i = 0; i < 256; i++) messageHash[i] <== utilityClaimMessageHash.messageHash[i];

    component utilityClaimSignatureVerifier = UtilityClaimSignatureVerifier();
    for (var i = 0; i < 512; i++) utilityClaimSignatureVerifier.publicKey[i] <== publicKey[i];
    for (var i = 0; i < 256; i++) utilityClaimSignatureVerifier.signatureR[i] <== signatureR[i];
    for (var i = 0; i < 256; i++) utilityClaimSignatureVerifier.signatureS[i] <== signatureS[i];
    for (var i = 0; i < 256; i++) utilityClaimSignatureVerifier.messageHash[i] <== messageHash[i];

    component pubkeyToAddress = PubkeyToAddress();
    for (var i = 0; i < 512; i++) pubkeyToAddress.pubkeyBits[i] <== publicKey[511 - i];
    address <== pubkeyToAddress.address;

    component utilityClaimLeaf = UtilityClaimLeaf();
    for (var i = 0; i < 160; i++) utilityClaimLeaf.collection[i] <== collection[i];
    for (var i = 0; i < 256; i++) utilityClaimLeaf.token[i] <== token[i];
    utilityClaimLeaf.address <== address;
    claimLeaf <== utilityClaimLeaf.claimLeaf;

    component utilityClaimRoot = UtilityClaimRoot(treeDepth);
    utilityClaimRoot.claimLeaf <== utilityClaimLeaf.claimLeaf;
    for (var i = 0; i < treeDepth; i++) utilityClaimRoot.claimTreePositions[i] <== claimTreePositions[i];
    for (var i = 0; i < treeDepth; i++) utilityClaimRoot.claimTreeElements[i] <== claimTreeElements[i];
    claimRoot <== utilityClaimRoot.claimRoot;

    component utilityClaimCommitment = UtilityClaimCommitment();
    for (var i = 0; i < 256; i++) utilityClaimCommitment.utility[i] <== utility[i];
    for (var i = 0; i < 256; i++) utilityClaimCommitment.signatureR[i] <== signatureR[i];
    claimCommitment <== utilityClaimCommitment.claimCommitment;

    component utilityClaimNullifier = UtilityClaimNullifier();
    utilityClaimNullifier.utilityStep <== utilityStep;
    for (var i = 0; i < 256; i++) utilityClaimNullifier.signatureR[i] <== signatureR[i];
    claimNullifier <== utilityClaimNullifier.claimNullifier;
}

// Outputs the expected message hash according to the Ethereum singing standard
template UtilityClaimMessageHash() {
    signal input utility[256];
    signal input collection[160];
    signal input token[256];
    signal output messageHash[256];

    component messageKeccak = Keccak(896, 256);
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

    // 16 bits for fixed length "84"
    component lengthBits = Num2Bits(16);
    lengthBits.in <== 14388;
    for (var i = 0; i < 2; i++) {
        for (var j = 0; j < 8; j++) {
            messageKeccak.in[messageKeccakIndex] <== lengthBits.out[16 - i*8 - 8 + j];
            messageKeccakIndex++;
        }
    }

    // 256 bits for uint256 utility ID
    for (var i = 0; i < 32; i++) {
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
template UtilityClaimLeaf() {
    signal input collection[160];
    signal input token[256];
    signal input address;
    signal output claimLeaf;

    component collectionNum = Bits2Num(160);
    for (var i = 0; i < 160; i++) collectionNum.in[i] <== collection[159 - i];

    component tokenNum1 = Bits2Num(128);
    component tokenNum2 = Bits2Num(128);
    for (var i = 0; i < 128; i++) tokenNum1.in[i] <== token[127 - i];
    for (var i = 0; i < 128; i++) tokenNum2.in[i] <== token[255 - i];

    component claimLeafPoseidon = Poseidon(4);
    claimLeafPoseidon.inputs[0] <== collectionNum.out;
    claimLeafPoseidon.inputs[1] <== tokenNum1.out;
    claimLeafPoseidon.inputs[2] <== tokenNum2.out;
    claimLeafPoseidon.inputs[3] <== address;
    claimLeaf <== claimLeafPoseidon.out;
}

// Calculates the root of the NFT snapshot tree that is being claimed
// This root must later be matched to the actual root
template UtilityClaimRoot(treeDepth) {
    signal input claimLeaf;
    signal input claimTreePositions[treeDepth];
    signal input claimTreeElements[treeDepth];
    signal output claimRoot;

    component hashes[treeDepth];
    component hashInputs[treeDepth];

    for (var i = 0; i < treeDepth; i++) {
        if (i == 0) {
            hashInputs[0] = Switcher();
            hashInputs[0].sel <== claimTreePositions[0];
            hashInputs[0].L <== claimLeaf;
            hashInputs[0].R <== claimTreeElements[0];

            hashes[0] = Poseidon(2);
            hashes[0].inputs[0] <== hashInputs[0].outL;
            hashes[0].inputs[1] <== hashInputs[0].outR;
        } else {
            hashInputs[i] = Switcher();
            hashInputs[i].sel <== claimTreePositions[i];
            hashInputs[i].L <== hashes[i - 1].out;
            hashInputs[i].R <== claimTreeElements[i];

            hashes[i] = Poseidon(2);
            hashes[i].inputs[0] <== hashInputs[i].outL;
            hashes[i].inputs[1] <== hashInputs[i].outR;
        }
    }

    claimRoot <== hashes[treeDepth - 1].out;
}

// Calculates the commitment for the utility claim, remains the same for all steps
template UtilityClaimCommitment() {
    signal input utility[256];
    signal input signatureR[256];
    signal output claimCommitment;

    component utilityNum1 = Bits2Num(128);
    component utilityNum2 = Bits2Num(128);
    for (var i = 0; i < 128; i++) utilityNum1.in[i] <== utility[127 - i];
    for (var i = 0; i < 128; i++) utilityNum2.in[i] <== utility[255 - i];

    component signatureRNum1 = Bits2Num(128);
    component signatureRNum2 = Bits2Num(128);
    for (var i = 0; i < 128; i++) signatureRNum1.in[i] <== signatureR[127 - i];
    for (var i = 0; i < 128; i++) signatureRNum2.in[i] <== signatureR[255 - i];

    component claimCommitmentPoseidon = Poseidon(4);
    claimCommitmentPoseidon.inputs[0] <== utilityNum1.out;
    claimCommitmentPoseidon.inputs[1] <== utilityNum2.out;
    claimCommitmentPoseidon.inputs[2] <== signatureRNum1.out;
    claimCommitmentPoseidon.inputs[3] <== signatureRNum2.out;
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


// TODO fixed tree depth of 2 for now
component main = UtilityClaim(2);
