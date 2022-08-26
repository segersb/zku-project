import {getEventsContract} from "../../../lib/events";

export default async function handler (req, res) {
  const events = getEventsContract()
  const unitPrice = await events.getUnitPrice();
  res.status(200).json({
    unitPrice: unitPrice.toNumber()
  })
}
