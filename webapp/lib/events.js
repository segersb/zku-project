import {ethers} from "ethers";
import Events from "../public/Events.json";

export function getEventsContract() {
  let provider
  if (process.env.EVENTS_CHAIN_ID === '31337') {
    provider = new ethers.providers.WebSocketProvider("ws://localhost:8545");
  } else if (process.env.EVENTS_CHAIN_ID === '5') {
    provider = new ethers.providers.EtherscanProvider('goerli', process.env.ETHERSCAN_API_KEY)
  } else {
    throw Error('unknown chain id ' + process.env.EVENTS_CHAIN_ID)
  }

  const wallet = new ethers.Wallet(process.env.EVENTS_KEY, provider);
  return new ethers.Contract(process.env.EVENTS_CONTRACT, Events.abi, wallet)
}