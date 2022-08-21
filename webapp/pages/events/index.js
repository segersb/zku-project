import useConnection from "../../composables/useConnection";
import {useRouter} from "next/router";
import {useEffect, useState} from "react";
import styles from "../../styles/events.module.css";
import {Breadcrumbs, Button, Card, CardActionArea, CardContent, IconButton, Link, Typography} from "@mui/material";
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import detectEthereumProvider from "@metamask/detect-provider";
import {ethers} from "ethers";
import useLoadEffect from "../../composables/useLoadEffect";

export default function Events () {
  const [events, setEvents] = useState([])
  const router = useRouter()

  useLoadEffect(async () => {
    const provider = (await detectEthereumProvider())
    const ethersProvider = new ethers.providers.Web3Provider(provider)
    const signer = await ethersProvider.getSigner();
    const address = await signer.getAddress()

    const eventsResponse = await fetch(`/api/events?user=${address}`)
    const events = await eventsResponse.json()

    setEvents(events)
  })

  let content
  if (events.length === 0) {
    content = <Typography variant="body2" color="text.secondary">
      You haven't created any events yet
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
      <Breadcrumbs>
        <Link underline="hover" color="inherit" href="/">Home</Link>
        <Typography color="text.primary">Events</Typography>
      </Breadcrumbs>

      <Typography gutterBottom variant="h2" component="div">
        Events
        <IconButton onClick={() => router.push('/events/new')}>
          <AddCircleOutlineRoundedIcon />
        </IconButton>
      </Typography>
      {content}
    </div>
  )
}