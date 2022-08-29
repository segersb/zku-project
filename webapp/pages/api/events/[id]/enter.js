import {getEventsContract} from "../../../../lib/contracts";

export default async function handler (req, res) {
  const {id} = req.query
  const {a, b, c, input} = JSON.parse(req.body)

  const events = getEventsContract()
  const created = await events.getEventCreated(id)
  if (!created) {
    return res.status(404).send({message: 'Not found'})
  }

  await events.validateEventEntrance(a, b, c, input)
  await events.eventEntrance(a, b, c, input, {
    gasLimit: 400000
  })

  res.status(200).json({})
}
