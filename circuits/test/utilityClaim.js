import ethers from "ethers";
import {wasm} from 'circom_tester'
import {buildPoseidon} from "circomlibjs"
import {assert} from 'chai'
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree"

Uint8Array.prototype.leftPad = function (length) {
    if (this.length < length) {
        let paddedArray = new Uint8Array(length)
        paddedArray.set([...Array(length - this.length).map(() => 0)])
        paddedArray.set(this, length - this.length)
        return paddedArray
    }
    return this
}

describe("UtilityClaim", function () {
    let circuit
    let poseidon

    before(async function () {
        this.timeout(60000000)
        circuit = await wasm("src/utilityClaim.circom")
        poseidon = await buildPoseidon()
    })

    function calculateSnapshotLeaf(collection, token, wallet) {
        const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token)).leftPad(32)
        const leafCollection = ethers.BigNumber.from(collection).toBigInt()
        const leafToken1 = ethers.BigNumber.from(tokenBytes.slice(0, 16)).toBigInt()
        const leafToken2 = ethers.BigNumber.from(tokenBytes.slice(16)).toBigInt()
        const leafAddress = ethers.BigNumber.from(wallet.address).toBigInt()
        return poseidon.F.toString(poseidon([leafCollection, leafToken1, leafToken2, leafAddress]))
    }

    async function signUtilityClaim(utility, collection, token, wallet) {
        const utilityBytes = ethers.utils.arrayify(ethers.BigNumber.from(utility)).leftPad(16)
        const collectionBytes = ethers.utils.arrayify(ethers.BigNumber.from(collection)).leftPad(20)
        const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token)).leftPad(32)
        const messageBytes = ethers.utils.concat([utilityBytes, collectionBytes, tokenBytes])
        const messageHash = ethers.BigNumber.from(ethers.utils.hashMessage(messageBytes)).toHexString()

        const signature = await wallet.signMessage(messageBytes)
        const signatureSplit = ethers.utils.splitSignature(signature)
        const signatureR = signatureSplit.r
        const signatureS = signatureSplit.s
        const publicKey = '0x' + ethers.utils.recoverPublicKey(ethers.utils.arrayify(messageHash), signature).substring(4)

        return {
            signatureR,
            signatureS,
            publicKey
        }
    }

    async function claimUtility(utility, utilityStep, collection, token, claimSignature, snapshotProof) {
        const witness = await circuit.calculateWitness({
            utility,
            utilityStep,
            collection: ethers.BigNumber.from(collection).toBigInt(),
            token: splitNumber(ethers.BigNumber.from(token).toBigInt(), 2, 128),
            publicKey: splitNumber(ethers.BigNumber.from(claimSignature.publicKey).toBigInt(), 4, 128),
            signatureR: splitNumber(ethers.BigNumber.from(claimSignature.signatureR).toBigInt(), 2, 128),
            signatureS: splitNumber(ethers.BigNumber.from(claimSignature.signatureS).toBigInt(), 2, 128),
            snapshotPathPositions: snapshotProof.pathIndices,
            snapshotPathElements: snapshotProof.siblings.map(s => ethers.BigNumber.from(s[0]).toBigInt())
        }, true)

        return {
            snapshotRoot: witness[1],
            claimCommitment: witness[2],
            claimNullifier: witness[3]
        }
    }

    function calculateClaimCommitment(utility, claimSignature) {
        const signatureRBytes = ethers.utils.arrayify(ethers.BigNumber.from(claimSignature.signatureR)).leftPad(32)

        const nullifierUtility = ethers.BigNumber.from(utility).toBigInt()
        const nullifierSignatureR1 = ethers.BigNumber.from(signatureRBytes.slice(0, 16)).toBigInt()
        const nullifierSignatureR2 = ethers.BigNumber.from(signatureRBytes.slice(16)).toBigInt()

        return poseidon.F.toString(poseidon([nullifierUtility, nullifierSignatureR1, nullifierSignatureR2]))
    }

    function calculateClaimNullifier(utilityStep, claimSignature) {
        const signatureRBytes = ethers.utils.arrayify(ethers.BigNumber.from(claimSignature.signatureR)).leftPad(32)

        const nullifierUtilityStep = ethers.BigNumber.from(utilityStep).toBigInt()
        const nullifierSignatureR1 = ethers.BigNumber.from(signatureRBytes.slice(0, 16)).toBigInt()
        const nullifierSignatureR2 = ethers.BigNumber.from(signatureRBytes.slice(16)).toBigInt()

        return poseidon.F.toString(poseidon([nullifierUtilityStep, nullifierSignatureR1, nullifierSignatureR2]))
    }

    function splitNumber(number, parts, bits) {
        let mod = 1n;
        for (let i = 0; i < bits; i++) {
            mod = mod * 2n;
        }

        let splitNumber = [];
        let remainder = number;
        for (let i = 0; i < parts; i++) {
            splitNumber.push(remainder % mod);
            remainder = remainder / mod;
        }
        return splitNumber.reverse();
    }

    it("UtilityClaim for events", async function () {
        this.timeout(60000000)

        const utility = '0xd9aca7cc64c54031a2bdacf31f5b7673'
        const collection = '0x9378368ba6b85c1fba5b131b530f5f5bedf21a18'

        const token1 = '100000000000000000001'
        const token2 = '100000000000000000002'
        const token3 = '100000000000000000003'
        const token4 = '100000000000000000004'

        const wallet1 = ethers.Wallet.fromMnemonic('test test test test test test test test test test test junk')
        const wallet2 = ethers.Wallet.createRandom()
        const wallet3 = ethers.Wallet.createRandom()
        const wallet4 = ethers.Wallet.createRandom()

        const snapshotLeaf1 = calculateSnapshotLeaf(collection, token1, wallet1)
        const snapshotLeaf2 = calculateSnapshotLeaf(collection, token2, wallet2)
        const snapshotLeaf3 = calculateSnapshotLeaf(collection, token3, wallet3)
        const snapshotLeaf4 = calculateSnapshotLeaf(collection, token4, wallet4)

        const snapshotTree = new IncrementalMerkleTree(i => poseidon.F.toString(poseidon(i)), 16, BigInt(0), 2)
        snapshotTree.insert(snapshotLeaf1)
        snapshotTree.insert(snapshotLeaf2)
        snapshotTree.insert(snapshotLeaf3)
        snapshotTree.insert(snapshotLeaf4)

        const claimSignature = await signUtilityClaim(utility, collection, token1, wallet1)
        const snapshotProof = snapshotTree.createProof(0)

        const expectedEventCommitment = calculateClaimCommitment(utility, claimSignature)
        const expectedRegistrationNullifier = calculateClaimNullifier(1, claimSignature)
        const expectedEntranceNullifier = calculateClaimNullifier(2, claimSignature)

        const registrationProof = await claimUtility(utility, 1, collection, token1, claimSignature, snapshotProof)
        assert.equal(registrationProof.snapshotRoot, snapshotTree.root, 'The snapshot root from the registration proof must equal the root calculated from the leaves')
        assert.equal(registrationProof.claimCommitment, expectedEventCommitment, 'The registration proof commitment should match the expected value')
        assert.equal(registrationProof.claimNullifier, expectedRegistrationNullifier, 'The registration proof nullifier should match the expected value')

        const entranceProof = await claimUtility(utility, 2, collection, token1, claimSignature, snapshotProof)
        assert.equal(entranceProof.snapshotRoot, snapshotTree.root, 'The snapshot root from the entrance proof must equal the root calculated from the leaves')
        assert.equal(entranceProof.claimCommitment, expectedEventCommitment, 'The entrance proof commitment should match the expected value')
        assert.equal(entranceProof.claimNullifier, expectedEntranceNullifier, 'The entrance proof nullifier should match the expected value')
    });
});