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

function calculateSnapshotLeaf (poseidon, collection, token, wallet) {
  const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token)).leftPad(32)
  const leafCollection = ethers.BigNumber.from(collection).toBigInt()
  const leafToken1 = ethers.BigNumber.from(tokenBytes.slice(0, 16)).toBigInt()
  const leafToken2 = ethers.BigNumber.from(tokenBytes.slice(16)).toBigInt()
  const leafAddress = ethers.BigNumber.from(wallet.address).toBigInt()
  return poseidon.F.toString(poseidon([leafCollection, leafToken1, leafToken2, leafAddress]))
}

async function signUtilityClaim (utility, collection, token, wallet) {
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

async function createClaimProof (utility, utilityStep, collection, token, claimSignature, snapshotProof) {
  const proofInput = {
    utility,
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
  const UNIT_PRICE = 2_200_000_000_00_000
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

    eventId = '0xd9aca7cc64c54031a2bdacf31f5b7673'
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

    snapshotLeaf1 = calculateSnapshotLeaf(poseidon, collection, token1, wallet1)
    snapshotLeaf2 = calculateSnapshotLeaf(poseidon, collection, token2, wallet2)
    snapshotLeaf3 = calculateSnapshotLeaf(poseidon, collection, token3, wallet3)
    snapshotLeaf4 = calculateSnapshotLeaf(poseidon, collection, token4, wallet4)

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
    // console.log('registrationProof1 =', registrationProof1)
    // console.log('entranceProof1 =', entranceProof1)
    // console.log('registrationProof2 =', registrationProof2)
    // console.log('entranceProof2 =', entranceProof2)

    registrationProof1 = {
      a: [
        '15900650993335498455385618454182531391567530489147429020357302243457777035106',
        '10372693572188074646300875566766301694659465233536076406034362991505222834794'
      ],
      b: [
        [
          '14900793770804253788574676217238836571343153822819135158245869408486077704454',
          '9208226770848671763191678319314827052688068015280010358269907145929616719503'
        ],
        [
          '10143064313412800908795589363688856662413280779622078387106421321315712526464',
          '20617621282900036324032237387833293094130727357650256244847553208843417202985'
        ]
      ],
      c: [
        '20062435057897017629341443788970148090054624134246879632027333543651311653494',
        '1461650930795877927005190960059265838142292996045174072768255858744802921420'
      ],
      input: [
        '1413262116555588320631701466486679704581693359549047048153660649670594556266',
        '9090576587701093885651238421801996511953298245267730570338208598958462072808',
        '6443820188641531791985872661860644801742280333957420551064781058273747752850',
        '289338953501130660026789716977293948531',
        '1'
      ]
    }
    entranceProof1 = {
      a: [
        '9339428126316847757225889628816653526855500001497389704320612202326604096204',
        '14477925293858452321584980824869196374178304320705438586176181645899723323150'
      ],
      b: [
        [
          '14389720783062751897266815623572373302243215427493212824808675362827310364777',
          '19120302968354780555542794393524907664503821659170644035001486250023774463383'
        ],
        [
          '9165224764584505771947067863508467416576366968993050292704886733090609960950',
          '5495548061235336601337803012503935052209144426323454315336301174829054835174'
        ]
      ],
      c: [
        '20592644441229941618726837150011093719071264770111548373349186659258779697512',
        '15307231418130513956219025747335264628485682638238111940823483209151351032257'
      ],
      input: [
        '1413262116555588320631701466486679704581693359549047048153660649670594556266',
        '9090576587701093885651238421801996511953298245267730570338208598958462072808',
        '10820541820005269172739260598484634399889497692726056219689385433717598564877',
        '289338953501130660026789716977293948531',
        '2'
      ]
    }
    registrationProof2 = {
      a: [
        '817220928316974871985224440528995668963649761948025491639623972783976692787',
        '20956805155473123525791941411991553193974940730829683016152385722684765620067'
      ],
      b: [
        [
          '21620711445174125231101404019841008883543270465252311130914236833541533855203',
          '2744505238443391577718536413604596362576743392847916060464842632313845441298'
        ],
        [
          '20679236784841324952353181395127156144868118153620329786360684419061871079555',
          '18895807838713972746724047007291890103640421858671637028395251855210923351077'
        ]
      ],
      c: [
        '18523385893275327758512183884490226019429068040026029787247764589543310441923',
        '14309322816499768810398651669161850142901827920929006628795446926944953185703'
      ],
      input: [
        '1413262116555588320631701466486679704581693359549047048153660649670594556266',
        '13324527469040260608525287672226166254303123238940799455023622387244904793670',
        '20094506127604943174780281785456949492983453711336277996054575376008550631869',
        '289338953501130660026789716977293948531',
        '1'
      ]
    }
    entranceProof2 = {
      a: [
        '10238023775502501819022465938912159615304164194434803360232939694032042976989',
        '18780337063437037741492059520883606305503445942239476885924854312484879000581'
      ],
      b: [
        [
          '12779033837914315884237624488804675158573330594246433836877629909731144607351',
          '8727797167325508535738942792937800512635763877255129020792194794738427250651'
        ],
        [
          '5800554180967180576144183238084936703483959310193386885489717358083101961534',
          '4337369096887873550316047626400542044961282829091786448267072584546307007685'
        ]
      ],
      c: [
        '8707367515984375489591176445882824560443861334377715695236132545041211161582',
        '20607591670168785486469314250363320169402055471168119683656639112710460699867'
      ],
      input: [
        '1413262116555588320631701466486679704581693359549047048153660649670594556266',
        '13324527469040260608525287672226166254303123238940799455023622387244904793670',
        '15291718975723302769825790850919125378468585630047587761922575808335723498135',
        '289338953501130660026789716977293948531',
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
