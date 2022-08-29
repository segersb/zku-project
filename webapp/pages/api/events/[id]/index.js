import {getEventsContract} from "../../../../lib/contracts";
import cachedIpfs from "../../../../lib/cachedIpfs";

const ipfs = cachedIpfs()

export default async function handler (req, res) {
  const {id} = req.query

  const events = getEventsContract()

  const created = await events.getEventCreated(id)
  if (!created) {
    return res.status(404).send({message: 'Not found'})
  }

  const cid = await events.getEventCid(id)
  const registrationCount = await events.getEventRegistrationCount(id)
  const entranceCount = await events.getEventEntranceCount(id)

  const {name, tokens} = await ipfs.getJsonContent(cid)

  res.status(200).json({
    cid,
    registrationCount,
    entranceCount,
    name,
    tokens
  })
}
