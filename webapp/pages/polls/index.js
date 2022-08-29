import {useRouter} from "next/router";
import {useState} from "react";
import styles from "../../styles/events.module.css";
import {Backdrop, Breadcrumbs, Card, CardActionArea, CardContent, CircularProgress, IconButton, Link, Typography} from "@mui/material";
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import useLoadEffect from "../../composables/useLoadEffect";
import useWallet from "../../composables/useWallet";

export default function Events () {
  const [polls, setPolls] = useState([])
  const router = useRouter()
  const {address} = useWallet()

  const {loading} = useLoadEffect(async () => {
    if (!address) {
      return
    }
    const pollsResponse = await fetch(`/api/polls?user=${address}`)
    const polls = await pollsResponse.json()
    setPolls(polls)
  }, [address]);

  let content
  if (polls.length === 0) {
    content = <Typography variant="body2" color="text.secondary">
      You haven&apos;t created any polls yet
    </Typography>
  } else {
    content = polls.map((poll, i) =>
      <Card key={i} variant="outlined" sx={{minWidth: 275, marginBottom: 2}}>
        <CardActionArea onClick={() => router.push(`/polls/${poll.id}`)}>
          <CardContent>
            <Typography gutterBottom variant="h5" component="div">
              {poll.name}
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
        <Typography color="text.primary">Polls</Typography>
      </Breadcrumbs>

      <Typography gutterBottom variant="h2" component="div">
        Polls
        <IconButton onClick={() => router.push('/polls/new')}>
          <AddCircleOutlineRoundedIcon/>
        </IconButton>
      </Typography>
      {content}
    </div>
  )
}