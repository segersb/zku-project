import {useRouter} from "next/router"
import {useState} from "react"
import {Backdrop, Card, CardActions, CardHeader, CircularProgress, Stack, Typography} from "@mui/material"
import styles from "../../../styles/events.module.css"
import {LoadingButton} from "@mui/lab"
import useLoadEffect from "../../../composables/useLoadEffect";
import useWait from "../../../composables/useWait";

export default function Event () {
  const router = useRouter()
  const {id, proof} = router.query

  const [name, setName] = useState('')

  const [entranceLoading, setEntranceLoading] = useState(false)
  const [entranceDone, setEntranceDone] = useState(false)
  const [entranceValid, setEntranceValid] = useState(false)

  const [message, setMessage] = useState('')

  const {waitForCondition} = useWait()

  const {loading} = useLoadEffect(async () => {
    setMessage('Validating entrance code...')

    const eventResponse = await fetch(`/api/events/${id}`)
    const event = await eventResponse.json()

    setName(event.name)

    const entranceValidationResponse = await fetch(`/api/events/${id}/validate-entrance`, {
      method: "POST",
      body: proof
    })
    const entranceValidation = await entranceValidationResponse.json()

    setEntranceValid(entranceValidation.valid)

    if (entranceValidation.valid) {
      setMessage('Entrance code is valid')
    } else if (entranceValidation.error.includes('DuplicateEntrance')) {
      setMessage('Entrance code is already used')
    } else {
      setMessage('Invalid entrance code')
    }
  })

  const enter = async () => {
    setEntranceLoading(true)
    try {
      const entranceResponse = await fetch(`/api/events/${id}/enter`, {
        method: "POST",
        body: proof
      })

      if (entranceResponse.ok) {
        await waitForCondition(1000, 60, async () => {
          const entranceValidationResponse = await fetch(`/api/events/${id}/validate-entrance`, {
            method: "POST",
            body: proof
          })
          const entranceValidation = await entranceValidationResponse.json()
          return entranceValidation.error && entranceValidation.error.includes('DuplicateEntrance')
        })

        setEntranceDone(true)
        setMessage('Entrance confirmed!')
      }
    } finally {
      setEntranceLoading(false)
    }
  }

  return (
    <div className={styles.main}>
      <Backdrop open={loading}>
        <CircularProgress />
      </Backdrop>

      <Typography gutterBottom variant="h2" component="div">
        Event entrance
      </Typography>

      <Stack spacing={2} sx={{paddingX: 1, width: '100%', maxWidth: 500}}>
        <Card variant="outlined">
          <CardHeader title={name} subheader={message}/>
          <CardActions>
            {(entranceValid && !entranceDone) &&
              <LoadingButton variant="outlined" loading={entranceLoading} onClick={enter}>Confirm entrance</LoadingButton>}
          </CardActions>
        </Card>
      </Stack>

    </div>
  )
}