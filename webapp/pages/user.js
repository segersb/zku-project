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
    </div>
  )
}