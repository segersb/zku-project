import '../styles/globals.css'
import {createTheme, CssBaseline, ThemeProvider} from "@mui/material";
import {useEffect} from "react";
import {useRouter} from "next/router";
import useWallet from "../composables/useWallet";

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
  const {connected, initialized} = useWallet()
  const router = useRouter()

  useEffect(() => {
    if (!initialized) {
      return
    }
    if (!connected && router.pathname !== '/') {
      router.push('/').catch(console.error)
    }
  })

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline/>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default App
