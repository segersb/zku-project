import useConnection from "../composables/useConnection";
import {useEffect} from "react";
import {useRouter} from "next/router";
import {Button} from "@mui/material";
import styles from "../styles/index.module.css"

export default function Home() {
  const {connected, connect} = useConnection()

  const router = useRouter()
  useEffect(() => {
    if (connected) {
      router.push('/user').catch(console.error)
    }
  })

  return (
    <div className={styles.main}>
      <Button onClick={connect} variant="contained">Connect</Button>
    </div>
  )
}
