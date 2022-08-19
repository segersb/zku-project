// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import {ethers} from "ethers";

export default async function handler(req, res) {
  const {collection, fromToken, toToken, snapshotTime} = JSON.parse(req.body)
  console.log('collection', collection)
  console.log('fromToken', fromToken)
  console.log('toToken', toToken)
  console.log('snapshotTime', snapshotTime)

  const tokens = new Map()
  const abi = ["event Transfer(address indexed src, address indexed dst, uint val)"]
  const provider = new ethers.providers.EtherscanProvider('homestead', process.env.ETHERSCAN_API_KEY)
  const contract = new ethers.Contract(collection, abi, provider);

  const timestampBlock = await provider.fetch('block', {
    action: 'getblocknobytime',
    timestamp: snapshotTime,
    closest: 'before'
  });

  console.log('timestampBlock', timestampBlock)
  // return []
  //`https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${process.env.ETHERSCAN_API_KEY}`

  let allEventsFetched = false
  let fromBlock = null
  while (!allEventsFetched) {
    const transferEvents = await contract.queryFilter(contract.filters.Transfer(), fromBlock, Number(timestampBlock))
    console.log('fetched events', transferEvents.length)
    if (transferEvents.length < 1000) {
      allEventsFetched = true
    } else {
      fromBlock = transferEvents[transferEvents.length - 1].blockNumber
    }

    for (const transferEvent of transferEvents) {
      const address = ethers.BigNumber.from(transferEvent.topics[2]).toHexString()
      const token = ethers.BigNumber.from(transferEvent.topics[3]).toNumber()
      if (!fromToken || !toToken || (fromToken <= token && token <= toToken)) {
        tokens.set(token, {
          collection,
          token,
          address
        })
      }
    }
  }
  res.status(200).json(Array.from(tokens.values()))
}
