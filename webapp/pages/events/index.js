import useConnection from "../../composables/useConnection";
import {useRouter} from "next/router";
import {useState} from "react";
import styles from "../../styles/events.module.css";
import {Typography} from "@mui/material";

export default function Events () {
  const {connected, connectionChecked} = useConnection()
  const [events, setEvents] = useState([])
  const router = useRouter()

  let content
  if (events.length === 0) {
    content = <Typography variant="body2" color="text.secondary">
      You haven't created any events yet
    </Typography>
  } else {
    content = events.map(event =>
      <Typography variant="body2" color="text.secondary">
        {event.name}
      </Typography>
    )
  }

  return (
    <div className={styles.main}>
      <Typography gutterBottom variant="h2" component="div">
        Events
      </Typography>
      {content}
    </div>
  )
}