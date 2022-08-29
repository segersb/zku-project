import {getPollsContract} from "../../../lib/contracts";

export default async function handler (req, res) {
  const polls = getPollsContract()
  const unitPrice = await polls.getUnitPrice();
  res.status(200).json({
    unitPrice: unitPrice.toNumber()
  })
}
