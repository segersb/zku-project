import {getPollsContract} from "../../../../lib/contracts";
import cachedIpfs from "../../../../lib/cachedIpfs";

const ipfs = cachedIpfs()

export default async function handler (req, res) {
  const {id} = req.query

  const polls = getPollsContract()

  const created = await polls.getPollCreated(id)
  if (!created) {
    return res.status(404).send({message: 'Not found'})
  }

  const cid = await polls.getPollCid(id)
  const voteCount = await polls.getPollVoteCount(id)
  const voteOptions = await polls.getPollVoteOptions(id)

  let results = {}
  for (let voteOption of Array.from({length: voteOptions}, (_, i) => i + 1)) {
    results[voteOption] = await polls.getPollResult(id, voteOption)
  }

  const {name, tokens, voteOptionNames} = await ipfs.getJsonContent(cid)

  res.status(200).json({
    id,
    voteCount,
    voteOptions,
    results,
    name,
    tokens,
    voteOptionNames
  })
}
