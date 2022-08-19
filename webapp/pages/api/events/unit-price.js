import {ethers} from "ethers";
import Events from "../../../public/Events.json";

export default async function handler(req, res) {
  const wsProvider = new ethers.providers.WebSocketProvider("ws://localhost:8545");
  const contract = new ethers.Contract(process.env.EVENTS_CONTRACT, Events.abi, wsProvider)

  const unitPrice = await contract.getUnitPrice();
  res.status(200).json({
    unitPrice: unitPrice.toNumber()
  })
}
