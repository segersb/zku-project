const {buildPoseidon} = require("circomlibjs");
const {ethers} = require("ethers");
const detectEthereumProvider = require("@metamask/detect-provider");
const {IncrementalMerkleTree} = require("@zk-kit/incremental-merkle-tree");

function useUtilityCircuit () {

  async function createUtilityProof (id, tokens, token, utilityStep) {
    const poseidon = await buildPoseidon()

    const utilityBytes = ethers.utils.arrayify(ethers.BigNumber.from(id)).leftPad(32)
    const collectionBytes = ethers.utils.arrayify(ethers.BigNumber.from(token.collection)).leftPad(20)
    const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token.token)).leftPad(32)
    const messageBytes = ethers.utils.concat([utilityBytes, collectionBytes, tokenBytes])
    const messageHash = ethers.BigNumber.from(ethers.utils.hashMessage(messageBytes)).toHexString()

    const provider = (await detectEthereumProvider())
    const ethersProvider = new ethers.providers.Web3Provider(provider)
    const signer = await ethersProvider.getSigner();
    const signature = await signer.signMessage(messageBytes)
    const signatureSplit = ethers.utils.splitSignature(signature)
    const signatureR = signatureSplit.r
    const signatureS = signatureSplit.s
    const publicKey = '0x' + ethers.utils.recoverPublicKey(ethers.utils.arrayify(messageHash), signature).substring(4)

    const snapshotTree = new IncrementalMerkleTree(i => poseidon.F.toString(poseidon(i)), 16, BigInt(0), 2)
    tokens.forEach(token => {
      const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token.token)).leftPad(32)
      const leafCollection = ethers.BigNumber.from(token.collection).toBigInt()
      const leafToken1 = ethers.BigNumber.from(tokenBytes.slice(0, 16)).toBigInt()
      const leafToken2 = ethers.BigNumber.from(tokenBytes.slice(16)).toBigInt()
      const leafAddress = ethers.BigNumber.from(token.address).toBigInt()
      snapshotTree.insert(poseidon.F.toString(poseidon([leafCollection, leafToken1, leafToken2, leafAddress])))
    })

    const snapshotTreeIndex = tokens.findIndex(t => t === token)
    const snapshotProof = snapshotTree.createProof(snapshotTreeIndex)

    const proofInput = {
      utility: splitNumber(ethers.BigNumber.from(id).toBigInt(), 2, 128),
      utilityStep,
      collection: ethers.BigNumber.from(token.collection).toBigInt(),
      token: splitNumber(ethers.BigNumber.from(token.token).toBigInt(), 2, 128),
      publicKey: splitNumber(ethers.BigNumber.from(publicKey).toBigInt(), 4, 128),
      signatureR: splitNumber(ethers.BigNumber.from(signatureR).toBigInt(), 2, 128),
      signatureS: splitNumber(ethers.BigNumber.from(signatureS).toBigInt(), 2, 128),
      snapshotPathPositions: snapshotProof.pathIndices,
      snapshotPathElements: snapshotProof.siblings.map(s => ethers.BigNumber.from(s[0]).toBigInt())
    }

    const groth16 = require("snarkjs").groth16;
    const {proof, publicSignals} = await groth16.fullProve(proofInput, "/utilityClaim.wasm", "/utilityClaim_final.zkey");
    const editedPublicSignals = unstringifyBigInts(publicSignals);
    const editedProof = unstringifyBigInts(proof);
    const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals);

    const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());

    const a = [argv[0], argv[1]];
    const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
    const c = [argv[6], argv[7]];
    const input = argv.slice(8);

    return {a, b, c, input}
  }

  return {createUtilityProof};
}

function splitNumber (number, parts, bits) {
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

function unstringifyBigInts (o) {
  if ((typeof (o) == "string") && (/^[0-9]+$/.test(o))) {
    return BigInt(o);
  } else if ((typeof (o) == "string") && (/^0x[0-9a-fA-F]+$/.test(o))) {
    return BigInt(o);
  } else if (Array.isArray(o)) {
    return o.map(unstringifyBigInts);
  } else if (typeof o == "object") {
    if (o === null) return null;
    const res = {};
    const keys = Object.keys(o);
    keys.forEach((k) => {
      res[k] = unstringifyBigInts(o[k]);
    });
    return res;
  } else {
    return o;
  }
}

export default useUtilityCircuit