import {getEventsContract} from "../../../../lib/events";

export default async function handler (req, res) {
  const {id} = req.query
  const {a, b, c, input} = JSON.parse(req.body)

  const events = getEventsContract()

  const created = await events.getEventCreated(id)
  if (!created) {
    return res.status(404).send({message: 'Not found'})
  }

  await events.eventRegistration(a, b, c, input)

  res.status(200).json({})
}
