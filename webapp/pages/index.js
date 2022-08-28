import useWallet from "../composables/useWallet";
import {useEffect} from "react";
import {useRouter} from "next/router";
import {Button} from "@mui/material";
import styles from "../styles/index.module.css"

export default function Home() {
  const {connected, connect} = useWallet()

  const router = useRouter()
  useEffect(() => {
    if (connected) {
      const initRoute = window.localStorage.getItem('init-route');
      if (initRoute) {
        router.push(initRoute).catch(console.error)
      } else {
        router.push('user').catch(console.error)
      }
    }
  })

  return (
    <div className={styles.main}>
      <Button onClick={connect} variant="outlined">Connect</Button>
    </div>
  )
}
