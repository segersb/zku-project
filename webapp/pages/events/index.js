import {useRouter} from "next/router";
import {useState} from "react";
import styles from "../../styles/events.module.css";
import {Backdrop, Breadcrumbs, Card, CardActionArea, CardContent, CircularProgress, IconButton, Link, Typography} from "@mui/material";
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import useLoadEffect from "../../composables/useLoadEffect";
import useWallet from "../../composables/useWallet";

export default function Events () {
  const [events, setEvents] = useState([])
  const router = useRouter()
  const {address} = useWallet()

  const {loading} = useLoadEffect(async () => {
    if (!address) {
      return
    }
    const eventsResponse = await fetch(`/api/events?user=${address}`)
    const events = await eventsResponse.json()
    setEvents(events)
  }, [address]);

  let content
  if (events.length === 0) {
    content = <Typography variant="body2" color="text.secondary">
      You haven&apos;t created any events yet
    </Typography>
  } else {
    content = events.map((event, i) =>
      <Card key={i} variant="outlined" sx={{minWidth: 275}}>
        <CardActionArea onClick={() => router.push(`/events/${event.id}`)}>
          <CardContent>
            <Typography gutterBottom variant="h5" component="div">
              {event.name}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    )
  }

  return (
    <div className={styles.main}>
      <Backdrop open={loading}>
        <CircularProgress />
      </Backdrop>

      <Breadcrumbs>
        <Link underline="hover" color="inherit" href="/">Home</Link>
        <Typography color="text.primary">Events</Typography>
      </Breadcrumbs>

      <Typography gutterBottom variant="h2" component="div">
        Events
        <IconButton onClick={() => router.push('/events/new')}>
          <AddCircleOutlineRoundedIcon/>
        </IconButton>
      </Typography>
      {content}
    </div>
  )
}