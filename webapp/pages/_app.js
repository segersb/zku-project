import '../styles/globals.css'
import {AppBar, Box, createTheme, CssBaseline, Divider, ThemeProvider, Toolbar, Typography} from "@mui/material";
import {useEffect} from "react";
import {useRouter} from "next/router";
import useWallet from "../composables/useWallet";
import Head from "next/head";
import Image from "next/image";
import Grid2 from "@mui/material/Unstable_Grid2";

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
      window.localStorage.setItem('init-route', router.asPath)
      router.replace('/').catch(console.error)
    }
  })

  return (
    <>
      <Head>
        <link rel="shortcut icon" href="/favicon.svg"/>
        <title>Nutty</title>
      </Head>

      <ThemeProvider theme={darkTheme}>
        <AppBar position="sticky">
          <Toolbar>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1}}>
              <Image src="/favicon.svg" width={15} height={75} />
              <Divider variant="middle" orientation="vertical"  sx={{marginX: 1}}/>
              <Typography variant="caption" fontSize={30} color="#ffc107">Nutty</Typography>
            </Box>
          </Toolbar>
        </AppBar>

        <Divider sx={{marginBottom: 2}}/>

        <CssBaseline/>
        <Component {...pageProps} />
      </ThemeProvider>
    </>
  );
}

export default App
