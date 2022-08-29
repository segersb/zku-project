import {useRouter} from "next/router";
import styles from "../styles/user.module.css";
import {Card, CardActionArea, CardContent, Typography} from "@mui/material";

export default function Home () {
  const router = useRouter()

  return (
    <div className={styles.main}>
      <Card variant="outlined" sx={{minWidth: 275}}>
        <CardActionArea onClick={() => router.push('/events')}>
          <CardContent>
            <Typography gutterBottom variant="h5" component="div">
              Events
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create events for NFT holders
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>

      <Card variant="outlined" sx={{minWidth: 275, marginTop: 2}}>
        <CardActionArea onClick={() => router.push('/polls')}>
          <CardContent>
            <Typography gutterBottom variant="h5" component="div">
              Polls
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create polls for NFT holders
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </div>
  )
}