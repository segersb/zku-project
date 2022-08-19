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

function calculateSnapshotLeaf (poseidon, utility, collection, token, wallet) {
  const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token)).leftPad(32)
  const leafCollection = ethers.BigNumber.from(collection).toBigInt()
  const leafToken1 = ethers.BigNumber.from(tokenBytes.slice(0, 16)).toBigInt()
  const leafToken2 = ethers.BigNumber.from(tokenBytes.slice(16)).toBigInt()
  const leafAddress = ethers.BigNumber.from(wallet.address).toBigInt()
  return poseidon.F.toString(poseidon([leafCollection, leafToken1, leafToken2, leafAddress]))
}

async function signUtilityClaim (utility, collection, token, wallet) {
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

describe("Events", function () {
  const UNIT_PRICE = 1_000_000
  let poseidon
  let events
  let eventId
  let cid
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
  let registrationProof1
  let registrationProof2
  let entranceProof1
  let entranceProof2

  before(async function () {
    this.timeout(60000000)
    poseidon = await buildPoseidon()

    eventId = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
    cid = 'bafkreian266thfymaekepwnaetwritbqlifuslhiadd4ygvfytv6krr2na'
    collection = '0x9378368ba6b85c1fba5b131b530f5f5bedf21a18'

    token1 = '100000000000000000001'
    token2 = '100000000000000000002'
    token3 = '100000000000000000003'
    token4 = '100000000000000000004'

    wallet1 = ethers.Wallet.fromMnemonic('test test test test test test test test test test test junk')
    wallet2 = ethers.Wallet.fromMnemonic('staff that doll morning label lucky wonder today sheriff east subject cradle')
    wallet3 = ethers.Wallet.fromMnemonic('lizard alley one original sniff cricket middle useful excuse kangaroo dinner twin')
    wallet4 = ethers.Wallet.fromMnemonic('mammal require vacuum pear cliff escape stand silly elegant celery act post')

    snapshotLeaf1 = calculateSnapshotLeaf(poseidon, eventId, collection, token1, wallet1)
    snapshotLeaf2 = calculateSnapshotLeaf(poseidon, eventId, collection, token2, wallet2)
    snapshotLeaf3 = calculateSnapshotLeaf(poseidon, eventId, collection, token3, wallet3)
    snapshotLeaf4 = calculateSnapshotLeaf(poseidon, eventId, collection, token4, wallet4)

    snapshotTree = new IncrementalMerkleTree(i => poseidon.F.toString(poseidon(i)), 16, BigInt(0), 2)
    snapshotTree.insert(snapshotLeaf1)
    snapshotTree.insert(snapshotLeaf2)
    snapshotTree.insert(snapshotLeaf3)
    snapshotTree.insert(snapshotLeaf4)

    // const eventSignature1 = await signUtilityClaim(eventId, collection, token1, wallet1);
    // const snapshotProof1 = snapshotTree.createProof(0)
    // registrationProof1 = await createClaimProof(eventId, 1, collection, token1, eventSignature1, snapshotProof1)
    // entranceProof1 = await createClaimProof(eventId, 2, collection, token1, eventSignature1, snapshotProof1)
    //
    // const eventSignature2 = await signUtilityClaim(eventId, collection, token2, wallet2);
    // const snapshotProof2 = snapshotTree.createProof(1)
    // registrationProof2 = await createClaimProof(eventId, 1, collection, token2, eventSignature2, snapshotProof2)
    // entranceProof2 = await createClaimProof(eventId, 2, collection, token2, eventSignature2, snapshotProof2)
    //
    // console.log('registrationProof1 = ', registrationProof1)
    // console.log('entranceProof1 = ', entranceProof1)
    // console.log('registrationProof2 = ', registrationProof2)
    // console.log('entranceProof2 = ', entranceProof2)

    registrationProof1 = {
      a: [
        '10836644726307194818007028963581931391580288997042421150847736208803177917691',
        '15040134174851259841852001705983785670176196327676125394002347196159669780612'
      ],
      b: [
        [
          '16949803031993292694886754842170563331260700740212412452648063227565879820170',
          '3993285524869236061441993652633705784983681599687106883444197094864302252747'
        ],
        [
          '18434509876175130178681322861973084548853569488076127668010251293160819875676',
          '11054295229936959235873452685590306548780168725256413293347497091195357555648'
        ]
      ],
      c: [
        '7536241663999984280378435084335423889969031856668450984165243927320142808058',
        '3814728662762542059541527284902452541317883853169317681302963255306798069648'
      ],
      input: [
        '1413262116555588320631701466486679704581693359549047048153660649670594556266',
        '3601115037486793128817348661456951499784326820857524963646681821394028591765',
        '18177851841767167136302560285035585914828808316014354355165611329101178062472',
        '340282366920938463463374607431768211455',
        '340282366920938463463374607431768211455',
        '1'
      ]
    }
    entranceProof1 = {
      a: [
        '11357516825924970879827294459721313080874058164637763439840611248085271081887',
        '1242156356949509985392187708455303875681655445140713047245383778956325980972'
      ],
      b: [
        [
          '17000578790951675631209913556374978352853683645421189182934649240153185475312',
          '15195730488980249976651894550690157293958672542957476256807183034534198986740'
        ],
        [
          '11231855283046610333730020572919389453363999705607393602059409404761024153878',
          '5724132539350240657203995591896880644210959446630625073901705169805115816121'
        ]
      ],
      c: [
        '837609743546572584498008516768246622619068991751024226064938085562168011213',
        '13106142831837391297675237689683126205735817823290707699309195542708310680114'
      ],
      input: [
        '1413262116555588320631701466486679704581693359549047048153660649670594556266',
        '3601115037486793128817348661456951499784326820857524963646681821394028591765',
        '13455056645605101673323569162185452849042808102033667369743862788716288420951',
        '340282366920938463463374607431768211455',
        '340282366920938463463374607431768211455',
        '2'
      ]
    }
    registrationProof2 = {
      a: [
        '9608272050297634590385844363197205107347253057598508738518530653831591597579',
        '3942193647478543515520908947703694931189776569398807022970939440980181229669'
      ],
      b: [
        [
          '9864669237022168124520162875056769706166759610150062221101160196161971227259',
          '18275910912126559126858569546773946236437528604504543157326419103910478702393'
        ],
        [
          '21196435522694985690939561372383078348395280607852961500652323277406992645245',
          '16147410638875362107000251967247039146618054614033796976591251618760402226161'
        ]
      ],
      c: [
        '18456255656883972073727685758800858328582074727829833202839767951318662456576',
        '20560505276094139722619995329124418425259778878630181579687947781096981035683'
      ],
      input: [
        '1413262116555588320631701466486679704581693359549047048153660649670594556266',
        '19828337993819474325742544028657528142975728882587057486096273537043762480783',
        '12219665449155229369753533570879726013037480371781733920939370801222753754625',
        '340282366920938463463374607431768211455',
        '340282366920938463463374607431768211455',
        '1'
      ]
    }
    entranceProof2 = {
      a: [
        '4511032517102075910455924842126390090980374552189459872609999670717846556984',
        '11541136551474916713980984757899332637978242432182434030557044333624669508118'
      ],
      b: [
        [
          '9695040641245489695494890404747295633922711782991980205234858730269039154257',
          '1298570101491255722242335148766918786833746237140432515426654849922364512292'
        ],
        [
          '11982296881215389018546226475699676630044939669152545735929297490771369750548',
          '14730208128007957318266614146053405078407938390216060043497245612015867445182'
        ]
      ],
      c: [
        '3056562157660475099175131056466576708052816040820348808459061856463024832248',
        '12120144109625927863471445431721469102589927226875867293907958717981233058456'
      ],
      input: [
        '1413262116555588320631701466486679704581693359549047048153660649670594556266',
        '19828337993819474325742544028657528142975728882587057486096273537043762480783',
        '14816191617862413777521484609589585096296936005980211758640362317274674976764',
        '340282366920938463463374607431768211455',
        '340282366920938463463374607431768211455',
        '2'
      ]
    }

  })

  beforeEach(async function () {
    this.timeout(60000000)

    const Events = await ethers.getContractFactory("Events");
    events = await Events.deploy();
    await events.deployed();
  });

  it("Create an event", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, cid, 4, snapshotTree.root, {
      value: UNIT_PRICE * 4
    })
    assert.equal(await events.getEventCid(eventId), cid)
  })

  it("Creating an event with an existing ID fails", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, cid, 4, snapshotTree.root, {
      value: UNIT_PRICE * 4
    })

    let error = "";
    try {
      await events.createEvent(eventId, cid, 4, snapshotTree.root, {
        value: UNIT_PRICE * 4
      })
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Creating an event with an existing ID should fail')
    assert.include(error, 'DuplicateEvent', 'A DuplicateEvent error should be thrown')
  })

  it("Register for an event", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, cid, 4, snapshotTree.root, {
      value: UNIT_PRICE * 4
    })
    await events.eventRegistration(registrationProof1.a, registrationProof1.b, registrationProof1.c, registrationProof1.input)
  })

  it("Registering twice for an event fails", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, cid, 4, snapshotTree.root, {
      value: UNIT_PRICE * 4
    })
    await events.eventRegistration(registrationProof1.a, registrationProof1.b, registrationProof1.c, registrationProof1.input)

    let error = "";
    try {
      await events.eventRegistration(registrationProof1.a, registrationProof1.b, registrationProof1.c, registrationProof1.input)
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Registering twice for an event should fail')
    assert.include(error, 'DuplicateRegistration', 'A DuplicateRegistration error should be thrown')
  })

  it("Registering for an unknown event fails", async function () {
    this.timeout(60000000)

    let error = "";
    try {
      await events.eventRegistration(registrationProof1.a, registrationProof1.b, registrationProof1.c, registrationProof1.input)
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Registering for an unknown event should fail')
    assert.include(error, 'UnknownEvent', 'A UnknownEvent error should be thrown')
  })

  it("Registering with an proof for a wrong snapshot fails", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, cid, 4, '1', {
      value: UNIT_PRICE * 4
    })

    let error = "";
    try {
      await events.eventRegistration(registrationProof1.a, registrationProof1.b, registrationProof1.c, registrationProof1.input)
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Registering with an proof for a wrong snapshot should fail')
    assert.include(error, 'InvalidSnapshot', 'A InvalidSnapshot error should be thrown')
  })

  it("Registering with an invalid proof fails", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, cid, 4, snapshotTree.root, {
      value: UNIT_PRICE * 4
    })

    let error = "";
    try {
      await events.eventRegistration(registrationProof1.c, registrationProof1.b, registrationProof1.a, registrationProof1.input)
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Registering with an invalid proof should fail')
    assert.include(error, 'InvalidProof', 'A InvalidProof error should be thrown')
  })

  it("Registering when the event is full fails", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, cid, 1, snapshotTree.root, {
      value: UNIT_PRICE
    })

    await events.eventRegistration(registrationProof1.a, registrationProof1.b, registrationProof1.c, registrationProof1.input)

    let error = "";
    try {
      await events.eventRegistration(registrationProof2.a, registrationProof2.b, registrationProof2.c, registrationProof2.input)
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Registering when the event is full should fail')
    assert.include(error, 'RegistrationFull', 'A RegistrationFull error should be thrown')
  })

  it("Enter an event", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, cid, 4, snapshotTree.root, {
      value: UNIT_PRICE * 4
    })
    await events.eventRegistration(registrationProof1.a, registrationProof1.b, registrationProof1.c, registrationProof1.input)
    await events.eventEntrance(entranceProof1.a, entranceProof1.b, entranceProof1.c, entranceProof1.input)
  })


  it("Entering an event without registration fails", async function () {
    this.timeout(60000000)

    await events.createEvent(eventId, cid, 4, snapshotTree.root, {
      value: UNIT_PRICE * 4
    })

    let error = "";
    try {
      await events.eventEntrance(entranceProof1.a, entranceProof1.b, entranceProof1.c, entranceProof1.input)
    } catch (e) {
      error = e.toString()
    }

    assert.isNotEmpty(error, 'Entering an event without registration should fail')
    assert.include(error, 'UnknownRegistration', 'A UnknownRegistration error should be thrown')
  })
});
