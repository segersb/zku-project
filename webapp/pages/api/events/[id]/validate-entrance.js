import {ethers} from "ethers";
import Events from "../../../../public/Events.json";

export default async function handler (req, res) {
  const {id} = req.query
  const {a, b, c, input} = JSON.parse(req.body)

  const wsProvider = new ethers.providers.WebSocketProvider("ws://localhost:8545");
  const events = new ethers.Contract(process.env.EVENTS_CONTRACT, Events.abi, wsProvider)

  const created = await events.getEventCreated(id)
  if (!created) {
    return res.status(404).send({message: 'Not found'})
  }

  try {
    await events.validateEventEntrance(a, b, c, input)
    res.status(200).json({valid: true})
  } catch (e) {
    res.status(200).json({valid: false, error: e.toString()})
  }
}
