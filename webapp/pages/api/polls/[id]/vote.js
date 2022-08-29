import {getEventsContract, getPollsContract} from "../../../../lib/contracts";

export default async function handler (req, res) {
  const {id} = req.query
  const {a, b, c, input} = JSON.parse(req.body)

  const polls = getPollsContract()
  const created = await polls.getPollCreated(id)
  if (!created) {
    return res.status(404).send({message: 'Not found'})
  }

  await polls.validateVote(a, b, c, input)
  await polls.vote(a, b, c, input, {
    gasLimit: 400000
  })

  res.status(200).json({})
}
