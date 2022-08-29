import {getPollsContract} from "../../../../lib/contracts";

export default async function handler (req, res) {
  const {id} = req.query
  const {a, b, c, input} = JSON.parse(req.body)

  const polls = getPollsContract()

  const created = await polls.getPollCreated(id)
  if (!created) {
    return res.status(404).send({message: 'Not found'})
  }

  try {
    await polls.validateVote(a, b, c, input)
    res.status(200).json({valid: true})
  } catch (e) {
    res.status(200).json({valid: false, error: e.toString()})
  }
}
