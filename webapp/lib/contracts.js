import {ethers} from "ethers";
import Events from "../public/Events.json";
import Polls from "../public/Polls.json";

function getProvider () {
  if (process.env.CHAIN_ID === '31337') {
    return new ethers.providers.WebSocketProvider("ws://localhost:8545");
  } else if (process.env.CHAIN_ID === '5') {
    return new ethers.providers.EtherscanProvider('goerli', process.env.ETHERSCAN_API_KEY)
  } else {
    throw Error('unknown chain id ' + process.env.CHAIN_ID)
  }
}

export function getEventsContract() {
  let provider = getProvider()
  const wallet = new ethers.Wallet(process.env.BACKEND_KEY, provider);
  return new ethers.Contract(process.env.EVENTS_CONTRACT, Events.abi, wallet)
}

export function getPollsContract() {
  let provider = getProvider()
  const wallet = new ethers.Wallet(process.env.BACKEND_KEY, provider);
  return new ethers.Contract(process.env.POLLS_CONTRACT, Polls.abi, wallet)
}