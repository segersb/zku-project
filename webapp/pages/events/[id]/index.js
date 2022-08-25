import {useRouter} from "next/router"
import {useState} from "react"
import {Breadcrumbs, Button, Card, CardActions, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, Link, ListItemText, MenuItem, Select, Stack, TextField, Typography} from "@mui/material"
import styles from "../../../styles/events.module.css"
import {LoadingButton} from "@mui/lab"
import useUtilityCircuit from "../../../composables/useUtilityCircuit";
import useLoadEffect from "../../../composables/useLoadEffect";
import QRCodeCanvas from "qrcode.react";
import useWallet from "../../../composables/useWallet";

export default function Event () {
  const router = useRouter()
  const {id} = router.query

  const [registrationCount, setRegistrationCount] = useState(0)
  const [entranceCount, setEntranceCount] = useState(0)
  const [name, setName] = useState('')
  const [tokens, setTokens] = useState([])
  const [eligibleTokens, setEligibleTokens] = useState([])
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0)

  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [registrationDone, setRegistrationDone] = useState(false)

  const [createEntranceQRCodeLoading, setCreateEntranceQRCodeLoading] = useState(false)
  const [entranceQrCodeCreated, setEntranceQrCodeCreated] = useState(false)
  const [entranceQrCodeData, setEntranceQrCodeData] = useState('')

  const [qrDialogOpen, setQrDialogOpen] = useState(false)

  const {address} = useWallet()

  const {load} = useLoadEffect(async () => {
    if (!address) {
      return
    }

    const eventResponse = await fetch(`/api/events/${id}`)
    const event = await eventResponse.json()

    setRegistrationCount(event.registrationCount)
    setEntranceCount(event.entranceCount)
    setName(event.name)
    setTokens(event.tokens)

    const eligibleTokens = event.tokens.filter(token => token.address.toLowerCase() === address.toLowerCase());
    setEligibleTokens(eligibleTokens)

    if (eligibleTokens.length) {
      const selectedToken = eligibleTokens[0]
      loadTokenState(selectedToken)
    }
  }, [address])

  const onTokenSelectionChange = newSelectedTokenIndex => {
    setSelectedTokenIndex(newSelectedTokenIndex)
    const selectedToken = eligibleTokens[newSelectedTokenIndex]
    loadTokenState(selectedToken)
  }

  const loadTokenState = selectedToken => {
    const storedRegistration = window.localStorage.getItem(`${id}-${selectedToken.collection}-${selectedToken.token}-registration`)
    const storedEntrance = window.localStorage.getItem(`${id}-${selectedToken.collection}-${selectedToken.token}-entrance`)

    setRegistrationDone(!!storedRegistration)
    setEntranceQrCodeCreated(!!storedEntrance)
    setEntranceQrCodeData(!!storedEntrance ? encodeURI(`${window.location.origin}/events/${id}/enter?proof=${storedEntrance}`) : '')
    console.log('QR', !!storedEntrance ? encodeURI(`${window.location.origin}/events/${id}/enter?proof=${storedEntrance}`) : '')
  }

  const register = async () => {
    setRegistrationLoading(true)
    try {
      const token = eligibleTokens[selectedTokenIndex]

      const {createUtilityProof} = useUtilityCircuit()
      console.log('creating registration proof')
      const registrationProof = await createUtilityProof(id, tokens, token, 1)
      console.log('registration proof created')

      const registerResponse = await fetch(`/api/events/${id}/register`, {
        method: "POST",
        body: JSON.stringify(registrationProof)
      })

      if (registerResponse.ok) {
        window.localStorage.setItem(`${id}-${token.collection}-${token.token}-registration`, "true");
        setRegistrationDone(true)
        await load()
      }
    } finally {
      setRegistrationLoading(false)
    }
  }

  const createEntranceQRCode = async () => {
    setCreateEntranceQRCodeLoading(true)
    try {
      const selectedToken = eligibleTokens[selectedTokenIndex]

      const {createUtilityProof} = useUtilityCircuit()
      console.log('creating entrance proof')
      const entranceProof = await createUtilityProof(id, tokens, selectedToken, 2)
      console.log('entrance proof created')

      window.localStorage.setItem(`${id}-${selectedToken.collection}-${selectedToken.token}-entrance`, JSON.stringify(entranceProof));
      loadTokenState(selectedToken)
    } finally {
      setCreateEntranceQRCodeLoading(false)
    }
  }

  const downloadQRCode = () => {
    const canvas = document.getElementById("qr");
    const pngUrl = canvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `entrance-qr.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  let tokenButton
  if (!registrationDone) {
    tokenButton = <LoadingButton
      variant="outlined"
      onClick={register}
      loading={registrationLoading}
    >
      Register
    </LoadingButton>
  } else if (!entranceQrCodeCreated) {
    tokenButton = <LoadingButton
      variant="outlined"
      onClick={createEntranceQRCode}
      loading={createEntranceQRCodeLoading}
    >
      Create entrance QR code
    </LoadingButton>
  } else {
    tokenButton = <Button
      variant="outlined"
      onClick={() => setQrDialogOpen(true)}
    >
      View entrance QR code
    </Button>
  }

  const eligibleTokensCard = <Card variant="outlined">
    <CardHeader title="Tokens"/>
    <CardContent>
      <FormControl fullWidth={true}>
        <InputLabel id="token-select-label">Token</InputLabel>
        <Select
          labelId="token-select-label"
          id="token-select"
          label="Token"
          value={selectedTokenIndex}
          onChange={e => onTokenSelectionChange(e.target.value)}
          fullWidth={true}
        >
          {eligibleTokens.map((eligibleToken, index) =>
            <MenuItem key={index} value={index}>
              <ListItemText primary={eligibleToken.collection} secondary={eligibleToken.token}/>
            </MenuItem>
          )}
        </Select>
      </FormControl>
    </CardContent>
    <CardActions>
      {tokenButton}
    </CardActions>
  </Card>

  const ineligibleTokensCard = <Card variant="outlined">
    <CardHeader title="Tokens"/>
    <CardContent>
      <Typography sx={{mb: 1.5}} color="text.secondary">
        Your are not eligible for this event
      </Typography>
    </CardContent>
  </Card>

  return (
    <div className={styles.main}>
      <Breadcrumbs>
        <Link underline="hover" color="inherit" href="/">Home</Link>
        <Link underline="hover" color="inherit" href="/events">Events</Link>
        <Typography color="text.primary">{name}</Typography>
      </Breadcrumbs>

      <Typography gutterBottom variant="h2" component="div">
        Event
      </Typography>

      <Stack spacing={2} sx={{paddingX: 1, width: '100%', maxWidth: 500}}>
        <Card variant="outlined">
          <CardHeader title={name}/>
          <CardContent>
            <TextField
              label="Tokens"
              value={tokens.length}
              autoComplete="off"
              disabled={true}
              fullWidth={true}
            />
            <TextField
              label="Registrations"
              value={registrationCount}
              autoComplete="off"
              disabled={true}
              fullWidth={true}
              sx={{marginTop: 2}}
            />
            <TextField
              label="Entrances"
              value={entranceCount}
              autoComplete="off"
              disabled={true}
              fullWidth={true}
              sx={{marginTop: 2}}
            />
          </CardContent>
        </Card>

        {!!eligibleTokens.length ? eligibleTokensCard : ineligibleTokensCard}
      </Stack>

      <Dialog onClose={() => setQrDialogOpen(false)} open={qrDialogOpen}>
        <DialogTitle>Entrance QR code</DialogTitle>
        <DialogContent>
          <QRCodeCanvas id="qr" size={350} value={entranceQrCodeData}/>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={downloadQRCode}>Download</Button>
        </DialogActions>
      </Dialog>

    </div>
  )
}