export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}

export default async function handler(req, res) {
  const {id, name, tokens, voteOptionNames} = JSON.parse(req.body)

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PINATA_JWT}`
    },
    body: JSON.stringify({
      "pinataOptions": {
        "cidVersion": 1
      },
      "pinataContent": {
        id,
        name,
        tokens,
        voteOptionNames,
      }
    })
  });

  if (!response.ok) {
    console.error(await response.text())
    res.status(500).send({ message: 'Internal server error' })
    return
  }

  const {IpfsHash} = await response.json()

  res.status(200).json({
    uri: IpfsHash
  })
}