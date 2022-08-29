import {getPollsContract} from "../../../lib/contracts";
import cachedIpfs from "../../../lib/cachedIpfs";

const ipfs = cachedIpfs()

export default async function handler (req, res) {
  const {user} = req.query

  const polls = getPollsContract()
  const pollIds = await polls.getUserPollIds(user)

  const responseEvents = []
  for (let id of pollIds) {
    const cid = await polls.getPollCid(id)
    const {name} = await ipfs.getJsonContent(cid)

    responseEvents.push({
      id: id.toHexString(),
      name
    })
  }

  res.status(200).json(responseEvents)
}
