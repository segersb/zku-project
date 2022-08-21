import {ethers} from "ethers";
import Events from "../../../../public/Events.json";

export default async function handler (req, res) {
  const {id} = req.query
  const {a, b, c, input} = JSON.parse(req.body)

  const wsProvider = new ethers.providers.WebSocketProvider("ws://localhost:8545");
  const wallet = new ethers.Wallet(process.env.EVENTS_KEY, wsProvider);
  const events = new ethers.Contract(process.env.EVENTS_CONTRACT, Events.abi, wallet)

  const created = await events.getEventCreated(id)
  if (!created) {
    return res.status(404).send({message: 'Not found'})
  }

  await events.eventRegistration(a, b, c, input)

  res.status(200).json({})
}
