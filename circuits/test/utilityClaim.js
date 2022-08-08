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

    function calculateClaimLeaf(utility, collection, token, wallet) {
        const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token)).leftPad(32)
        const leafCollection = ethers.BigNumber.from(collection).toBigInt()
        const leafToken1 = ethers.BigNumber.from(tokenBytes.slice(0, 16)).toBigInt()
        const leafToken2 = ethers.BigNumber.from(tokenBytes.slice(16)).toBigInt()
        const leafAddress = ethers.BigNumber.from(wallet.address).toBigInt()
        return poseidon.F.toString(poseidon([leafCollection, leafToken1, leafToken2, leafAddress]))
    }

    function calculateClaimTree(claimLeaf1 = '0', claimLeaf2 = '0', claimLeaf3 = '0', claimLeaf4 = '0') {
        const node1 = poseidon.F.toString(poseidon([ethers.BigNumber.from(claimLeaf1).toBigInt(), ethers.BigNumber.from(claimLeaf2).toBigInt()]))
        const node2 = poseidon.F.toString(poseidon([ethers.BigNumber.from(claimLeaf3).toBigInt(), ethers.BigNumber.from(claimLeaf4).toBigInt()]))
        const root = poseidon.F.toString(poseidon([ethers.BigNumber.from(node1).toBigInt(), ethers.BigNumber.from(node2).toBigInt()]))
        return {
            root,
            nodes: [node1, node2],
            leaves: [claimLeaf1, claimLeaf2, claimLeaf3, claimLeaf4]
        }
    }

    function calculateClaimTreePath(claimTree, leafNumber) {
        switch (leafNumber) {
            case 1: return {
                positions: [0, 0],
                elements: [claimTree.leaves[1], claimTree.nodes[1]]
            }
            case 2: return {
                positions: [1, 0],
                elements: [claimTree.leaves[0], claimTree.nodes[1]]
            }
            case 3: return {
                positions: [0, 1],
                elements: [claimTree.leaves[3], claimTree.nodes[0]]
            }
            case 4: return {
                positions: [1, 1],
                elements: [claimTree.leaves[2], claimTree.nodes[0]]
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

    async function claimUtility(utility, utilityStep, collection, token, claimSignature, claimTreePath) {
        const witness = await circuit.calculateWitness({
            utility: ethers.BigNumber.from(utility).toBigInt().toString(2).padStart(256, '0').split(''),
            utilityStep,
            collection: ethers.BigNumber.from(collection).toBigInt().toString(2).padStart(160, '0').split(''),
            token: ethers.BigNumber.from(token).toBigInt().toString(2).padStart(256, '0').split(''),
            publicKey: ethers.BigNumber.from(claimSignature.publicKey).toBigInt().toString(2).padStart(512, '0').split(''),
            signatureR: ethers.BigNumber.from(claimSignature.signatureR).toBigInt().toString(2).padStart(256, '0').split(''),
            signatureS: ethers.BigNumber.from(claimSignature.signatureS).toBigInt().toString(2).padStart(256, '0').split(''),
            claimTreePositions: claimTreePath.positions,
            claimTreeElements: claimTreePath.elements
        }, true)

        return {
            claimRoot: witness[1],
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

        const claimLeaf1 = calculateClaimLeaf(utility, collection, token1, wallet1)
        const claimLeaf2 = calculateClaimLeaf(utility, collection, token2, wallet2)
        const claimLeaf3 = calculateClaimLeaf(utility, collection, token3, wallet3)
        const claimLeaf4 = calculateClaimLeaf(utility, collection, token4, wallet4)
        const claimTree = calculateClaimTree(claimLeaf1, claimLeaf2, claimLeaf3, claimLeaf4);

        const claimSignature = await signUtilityClaim(utility, collection, token1, wallet1);
        const claimTreePath = calculateClaimTreePath(claimTree, 1);

        const expectedEventCommitment = calculateClaimCommitment(utility, claimSignature);
        const expectedRegistrationNullifier = calculateClaimNullifier(1, claimSignature);
        const expectedEntranceNullifier = calculateClaimNullifier(2, claimSignature);

        const registrationProof = await claimUtility(utility, 1, collection, token1, claimSignature, claimTreePath);
        assert.equal(registrationProof.claimRoot, claimTree.root, 'The claim root from the registration proof must equal the root calculated from the leaves')
        assert.equal(registrationProof.claimCommitment, expectedEventCommitment, 'The registration proof commitment should match the expected value')
        assert.equal(registrationProof.claimNullifier, expectedRegistrationNullifier, 'The registration proof nullifier should match the expected value')

        const entranceProof = await claimUtility(utility, 2, collection, token1, claimSignature, claimTreePath);
        assert.equal(entranceProof.claimRoot, claimTree.root, 'The claim root from the entrance proof must equal the root calculated from the leaves')
        assert.equal(entranceProof.claimCommitment, expectedEventCommitment, 'The entrance proof commitment should match the expected value')
        assert.equal(entranceProof.claimNullifier, expectedEntranceNullifier, 'The entrance proof nullifier should match the expected value')
    });
});