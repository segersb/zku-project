import {getEventsContract} from "../../../lib/events";

export default async function handler (req, res) {
  const {user} = req.query

  const events = getEventsContract()
  const eventIds = await events.getUserEventIds(user)

  const responseEvents = []
  for (let id of eventIds) {
    const cid = await events.getEventCid(id)
    const registrationCount = await events.getEventRegistrationCount(id)
    const entranceCount = await events.getEventEntranceCount(id)

    const eventDataResponse = await fetch(`https://ipfs.io/ipfs/${cid}`)
    const {name, tokens} = await eventDataResponse.json()

    responseEvents.push({
      id: id.toHexString(),
      cid,
      registrationCount,
      entranceCount,
      name,
      tokens
    })
  }

  res.status(200).json(responseEvents)
}
