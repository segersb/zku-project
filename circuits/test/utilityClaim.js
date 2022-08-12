import ethers from "ethers";
import {wasm} from 'circom_tester'
import {buildPoseidon} from "circomlibjs"
import {assert} from 'chai'

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

    function calculateSnapshotLeaf(utility, collection, token, wallet) {
        const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token)).leftPad(32)
        const leafCollection = ethers.BigNumber.from(collection).toBigInt()
        const leafToken1 = ethers.BigNumber.from(tokenBytes.slice(0, 16)).toBigInt()
        const leafToken2 = ethers.BigNumber.from(tokenBytes.slice(16)).toBigInt()
        const leafAddress = ethers.BigNumber.from(wallet.address).toBigInt()
        return poseidon.F.toString(poseidon([leafCollection, leafToken1, leafToken2, leafAddress]))
    }

    function calculateSnapshotTree(snapshotLeaf1 = '0', snapshotLeaf2 = '0', snaphotLeaf3 = '0', snapshotLeaf4 = '0') {
        const node1 = poseidon.F.toString(poseidon([ethers.BigNumber.from(snapshotLeaf1).toBigInt(), ethers.BigNumber.from(snapshotLeaf2).toBigInt()]))
        const node2 = poseidon.F.toString(poseidon([ethers.BigNumber.from(snaphotLeaf3).toBigInt(), ethers.BigNumber.from(snapshotLeaf4).toBigInt()]))
        const root = poseidon.F.toString(poseidon([ethers.BigNumber.from(node1).toBigInt(), ethers.BigNumber.from(node2).toBigInt()]))
        return {
            root,
            nodes: [node1, node2],
            leaves: [snapshotLeaf1, snapshotLeaf2, snaphotLeaf3, snapshotLeaf4]
        }
    }

    function calculateSnapshotPath(snapshotTree, leafNumber) {
        switch (leafNumber) {
            case 1: return {
                positions: [0, 0],
                elements: [snapshotTree.leaves[1], snapshotTree.nodes[1]]
            }
            case 2: return {
                positions: [1, 0],
                elements: [snapshotTree.leaves[0], snapshotTree.nodes[1]]
            }
            case 3: return {
                positions: [0, 1],
                elements: [snapshotTree.leaves[3], snapshotTree.nodes[0]]
            }
            case 4: return {
                positions: [1, 1],
                elements: [snapshotTree.leaves[2], snapshotTree.nodes[0]]
            }
        }
    }

    async function signUtilityClaim(utility, collection, token, wallet) {
        const utilityBytes = ethers.utils.arrayify(ethers.BigNumber.from(utility)).leftPad(32)
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

    async function claimUtility(utility, utilityStep, collection, token, claimSignature, snapshotPath) {
        const witness = await circuit.calculateWitness({
            utility: splitNumber(ethers.BigNumber.from(utility).toBigInt(), 2, 128),
            utilityStep,
            collection: ethers.BigNumber.from(collection).toBigInt(),
            token: splitNumber(ethers.BigNumber.from(token).toBigInt(), 2, 128),
            publicKey: splitNumber(ethers.BigNumber.from(claimSignature.publicKey).toBigInt(), 4, 128),
            signatureR: splitNumber(ethers.BigNumber.from(claimSignature.signatureR).toBigInt(), 2, 128),
            signatureS: splitNumber(ethers.BigNumber.from(claimSignature.signatureS).toBigInt(), 2, 128),
            snapshotPathPositions: snapshotPath.positions,
            snapshotPathElements: snapshotPath.elements
        }, true)

        return {
            snapshotRoot: witness[1],
            claimCommitment: witness[2],
            claimNullifier: witness[3]
        }
    }

    function calculateClaimCommitment(utility, claimSignature) {
        const utilityBytes = ethers.utils.arrayify(ethers.BigNumber.from(utility)).leftPad(32)
        const signatureRBytes = ethers.utils.arrayify(ethers.BigNumber.from(claimSignature.signatureR)).leftPad(32)

        const nullifierUtility1 = ethers.BigNumber.from(utilityBytes.slice(0, 16)).toBigInt()
        const nullifierUtility2 = ethers.BigNumber.from(utilityBytes.slice(16)).toBigInt()
        const nullifierSignatureR1 = ethers.BigNumber.from(signatureRBytes.slice(0, 16)).toBigInt()
        const nullifierSignatureR2 = ethers.BigNumber.from(signatureRBytes.slice(16)).toBigInt()

        return poseidon.F.toString(poseidon([nullifierUtility1, nullifierUtility2, nullifierSignatureR1, nullifierSignatureR2]))
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

        const utility = '1234'
        const collection = '0x9378368ba6b85c1fba5b131b530f5f5bedf21a18'

        const token1 = '100000000000000000001'
        const token2 = '100000000000000000002'
        const token3 = '100000000000000000003'
        const token4 = '100000000000000000004'

        const wallet1 = ethers.Wallet.fromMnemonic('test test test test test test test test test test test junk')
        const wallet2 = ethers.Wallet.createRandom()
        const wallet3 = ethers.Wallet.createRandom()
        const wallet4 = ethers.Wallet.createRandom()

        const snapshotLeaf1 = calculateSnapshotLeaf(utility, collection, token1, wallet1)
        const snapshotLeaf2 = calculateSnapshotLeaf(utility, collection, token2, wallet2)
        const snapshotLeaf3 = calculateSnapshotLeaf(utility, collection, token3, wallet3)
        const snapshotLeaf4 = calculateSnapshotLeaf(utility, collection, token4, wallet4)
        const snapshotTree = calculateSnapshotTree(snapshotLeaf1, snapshotLeaf2, snapshotLeaf3, snapshotLeaf4);

        const claimSignature = await signUtilityClaim(utility, collection, token1, wallet1);
        const snapshotPath = calculateSnapshotPath(snapshotTree, 1);

        const expectedEventCommitment = calculateClaimCommitment(utility, claimSignature);
        const expectedRegistrationNullifier = calculateClaimNullifier(1, claimSignature);
        const expectedEntranceNullifier = calculateClaimNullifier(2, claimSignature);

        const registrationProof = await claimUtility(utility, 1, collection, token1, claimSignature, snapshotPath);
        assert.equal(registrationProof.snapshotRoot, snapshotTree.root, 'The snapshot root from the registration proof must equal the root calculated from the leaves')
        assert.equal(registrationProof.claimCommitment, expectedEventCommitment, 'The registration proof commitment should match the expected value')
        assert.equal(registrationProof.claimNullifier, expectedRegistrationNullifier, 'The registration proof nullifier should match the expected value')

        const entranceProof = await claimUtility(utility, 2, collection, token1, claimSignature, snapshotPath);
        assert.equal(entranceProof.snapshotRoot, snapshotTree.root, 'The snapshot root from the entrance proof must equal the root calculated from the leaves')
        assert.equal(entranceProof.claimCommitment, expectedEventCommitment, 'The entrance proof commitment should match the expected value')
        assert.equal(entranceProof.claimNullifier, expectedEntranceNullifier, 'The entrance proof nullifier should match the expected value')
    });
});