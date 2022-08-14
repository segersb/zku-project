const {buildPoseidon} = require("circomlibjs")
const {ethers} = require("hardhat")
const {groth16} = require("snarkjs")
const {assert} = require('chai')
const {IncrementalMerkleTree} = require('@zk-kit/incremental-merkle-tree')

Uint8Array.prototype.leftPad = function (length) {
  if (this.length < length) {
    let paddedArray = new Uint8Array(length)
    paddedArray.set([...Array(length - this.length).map(() => 0)])
    paddedArray.set(this, length - this.length)
    return paddedArray
  }
  return this
}

function calculateSnapshotLeaf(poseidon, utility, collection, token, wallet) {
  const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token)).leftPad(32)
  const leafCollection = ethers.BigNumber.from(collection).toBigInt()
  const leafToken1 = ethers.BigNumber.from(tokenBytes.slice(0, 16)).toBigInt()
  const leafToken2 = ethers.BigNumber.from(tokenBytes.slice(16)).toBigInt()
  const leafAddress = ethers.BigNumber.from(wallet.address).toBigInt()
  return poseidon.F.toString(poseidon([leafCollection, leafToken1, leafToken2, leafAddress]))
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

async function createClaimProof (utility, utilityStep, collection, token, claimSignature, snapshotProof) {
  const proofInput = {
    utility: splitNumber(ethers.BigNumber.from(utility).toBigInt(), 2, 128),
    utilityStep,
    collection: ethers.BigNumber.from(collection).toBigInt(),
    token: splitNumber(ethers.BigNumber.from(token).toBigInt(), 2, 128),
    publicKey: splitNumber(ethers.BigNumber.from(claimSignature.publicKey).toBigInt(), 4, 128),
    signatureR: splitNumber(ethers.BigNumber.from(claimSignature.signatureR).toBigInt(), 2, 128),
    signatureS: splitNumber(ethers.BigNumber.from(claimSignature.signatureS).toBigInt(), 2, 128),
    snapshotPathPositions: snapshotProof.pathIndices,
    snapshotPathElements: snapshotProof.siblings.map(s => ethers.BigNumber.from(s[0]).toBigInt())
  }

  const {proof, publicSignals} = await groth16.fullProve(proofInput, "../circuits/build/utilityClaim_js/utilityClaim.wasm", "../circuits/build/utilityClaim_final.zkey");
  const editedPublicSignals = unstringifyBigInts(publicSignals);
  const editedProof = unstringifyBigInts(proof);
  const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals);

  const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());

  const a = [argv[0], argv[1]];
  const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
  const c = [argv[6], argv[7]];
  const input = argv.slice(8);

  return {
    a,
    b,
    c,
    input
  }
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

function unstringifyBigInts(o) {
  if ((typeof(o) == "string") && (/^[0-9]+$/.test(o) ))  {
    return BigInt(o);
  } else if ((typeof(o) == "string") && (/^0x[0-9a-fA-F]+$/.test(o) ))  {
    return BigInt(o);
  } else if (Array.isArray(o)) {
    return o.map(unstringifyBigInts);
  } else if (typeof o == "object") {
    if (o===null) return null;
    const res = {};
    const keys = Object.keys(o);
    keys.forEach( (k) => {
      res[k] = unstringifyBigInts(o[k]);
    });
    return res;
  } else {
    return o;
  }
}

describe("Events", function () {
  let poseidon
  let events
  let eventId
  let collection
  let token1
  let token2
  let token3
  let token4
  let wallet1
  let wallet2
  let wallet3
  let wallet4
  let snapshotLeaf1
  let snapshotLeaf2
  let snapshotLeaf3
  let snapshotLeaf4
  let snapshotTree

  beforeEach(async function () {
    this.timeout(60000000)

    poseidon = await buildPoseidon()

    const Events = await ethers.getContractFactory("Events");
    events = await Events.deploy();
    await events.deployed();

    eventId = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
    collection = '0x9378368ba6b85c1fba5b131b530f5f5bedf21a18'

    token1 = '100000000000000000001'
    token2 = '100000000000000000002'
    token3 = '100000000000000000003'
    token4 = '100000000000000000004'

    wallet1 = ethers.Wallet.fromMnemonic('test test test test test test test test test test test junk')
    wallet2 = ethers.Wallet.createRandom()
    wallet3 = ethers.Wallet.createRandom()
    wallet4 = ethers.Wallet.createRandom()

    snapshotLeaf1 = calculateSnapshotLeaf(poseidon, eventId, collection, token1, wallet1)
    snapshotLeaf2 = calculateSnapshotLeaf(poseidon, eventId, collection, token2, wallet2)
    snapshotLeaf3 = calculateSnapshotLeaf(poseidon, eventId, collection, token3, wallet3)
    snapshotLeaf4 = calculateSnapshotLeaf(poseidon, eventId, collection, token4, wallet4)

    snapshotTree = new IncrementalMerkleTree(i => poseidon.F.toString(poseidon(i)), 16, BigInt(0), 2)
    snapshotTree.insert(snapshotLeaf1)
    snapshotTree.insert(snapshotLeaf2)
    snapshotTree.insert(snapshotLeaf3)
    snapshotTree.insert(snapshotLeaf4)
  });

  it("Register for an event", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, snapshotTree.root)

    const eventSignature = await signUtilityClaim(eventId, collection, token1, wallet1);
    const snapshotProof = snapshotTree.createProof(0)

    const {a, b, c, input} = await createClaimProof(eventId, 1, collection, token1, eventSignature, snapshotProof);
    await events.eventRegistration(a, b, c, input)
  })

  it("Enter an event", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, snapshotTree.root)

    const eventSignature = await signUtilityClaim(eventId, collection, token1, wallet1);
    const snapshotProof = snapshotTree.createProof(0)

    const {a: a1, b: b1, c: c1, input: input1} = await createClaimProof(eventId, 1, collection, token1, eventSignature, snapshotProof)
    await events.eventRegistration(a1, b1, c1, input1)

    const {a: a2, b: b2, c: c2, input: input2} = await createClaimProof(eventId, 2, collection, token1, eventSignature, snapshotProof)
    await events.eventEntrance(a2, b2, c2, input2)
  })

  it("Creating an event with an existing ID fails", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, snapshotTree.root)

    let error = "";
    try {
      await events.createEvent(eventId, snapshotTree.leaves[0])
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Creating an event with an existing ID should fail')
    assert.include(error, 'DuplicateEvent', 'A DuplicateEvent should be thrown')
  })

  it("Registering twice for an event fails", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, snapshotTree.root)

    const eventSignature = await signUtilityClaim(eventId, collection, token1, wallet1);
    const snapshotProof = snapshotTree.createProof(0)

    const {a, b, c, input} = await createClaimProof(eventId, 1, collection, token1, eventSignature, snapshotProof);
    await events.eventRegistration(a, b, c, input)

    let error = "";
    try {
      await events.eventRegistration(a, b, c, input)
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Registering twice for an event should fail')
    assert.include(error, 'DuplicateRegistration', 'A DuplicateRegistration should be thrown')
  })

  it("Entering an event without registration fails", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, snapshotTree.root)

    const eventSignature = await signUtilityClaim(eventId, collection, token1, wallet1);
    const snapshotProof = snapshotTree.createProof(0)

    const {a, b, c, input} = await createClaimProof(eventId, 2, collection, token1, eventSignature, snapshotProof);

    let error = "";
    try {
      await events.eventEntrance(a, b, c, input)
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Entering an event without registration should fail')
    assert.include(error, 'UnknownRegistration', 'A UnknownRegistration should be thrown')
  })
});
