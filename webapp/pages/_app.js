import '../styles/globals.css'
import {createTheme, CssBaseline, ThemeProvider} from "@mui/material";
import {useEffect, useState} from "react";
import {useRouter} from "next/router";
import useConnection from "../composables/useConnection";

Uint8Array.prototype.leftPad = function (length) {
  if (this.length < length) {
    let paddedArray = new Uint8Array(length)
    paddedArray.set([...Array(length - this.length).map(() => 0)])
    paddedArray.set(this, length - this.length)
    return paddedArray
  }
  return this
}

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});


function App ({Component, pageProps}) {
  const {connected, connectionChecked} = useConnection()
  const router = useRouter()

  useEffect(() => {
    if (!connectionChecked) {
      return
    }
    if (!connected && router.pathname !== '/') {
      router.push('/').catch(console.error)
    }
  })

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default App
