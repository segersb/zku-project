import {useRouter} from "next/router";
import {useEffect, useState} from "react";
import styles from "../../styles/polls.module.css";
import {Alert, Breadcrumbs, Button, Card, CardActions, CardContent, Link, NoSsr, Slider, Stack, Tab, Tabs, TextField, Typography} from "@mui/material";
import {ethers} from "ethers";
import {DateTimePicker, LocalizationProvider} from "@mui/x-date-pickers";
import {AdapterMoment} from '@mui/x-date-pickers/AdapterMoment';
import moment from "moment-timezone";
import {LoadingButton} from "@mui/lab";
import getConfig from "next/config";
import Polls from "../../public/Polls.json";
import {buildPoseidon} from "circomlibjs"
import {IncrementalMerkleTree} from '@zk-kit/incremental-merkle-tree'
import {v4 as uuid} from 'uuid';
import useWait from "../../composables/useWait";
import useWallet from "../../composables/useWallet";

export default function NewPoll () {
  const router = useRouter()

  const [addTab, setAddTab] = useState(0)

  const [name, setName] = useState('')
  const [snapshotTime, setSnapshotTime] = useState(moment.utc())
  const [voteOptions, setVoteOptions] = useState(2)
  const [snapshotTimeDisabled, setSnapshotTimeDisabled] = useState(false)
  const [tokens, setTokens] = useState([])
  const [collection, setCollection] = useState('')
  const [fromToken, setFromToken] = useState('')
  const [toToken, setToToken] = useState('')
  const [price, setPrice] = useState(0)
  const [weiPrice, setWeiPrice] = useState(0)
  const [voteOptionNames, setVoteOptionNames] = useState(['', '', '', '', '', '', '', '', '', ''])

  const [addTokenLoading, setAddTokenLoading] = useState(false)
  const [addTokenDisabled, setAddTokenDisabled] = useState(true)

  const [createPollLoading, setCreatePollLoading] = useState(false)
  const [createPollDisabled, setCreatePollDisabled] = useState(true)

  const [showChainMessage, setShowChainMessage] = useState(false)
  const {publicRuntimeConfig} = getConfig()
  const {chainId} = useWallet()

  const {waitForCondition} = useWait()

  useEffect(() => {
    if (Number(publicRuntimeConfig.chainId) !== chainId) {
      setShowChainMessage(true)
    } else {
      setShowChainMessage(false)
    }
  }, [publicRuntimeConfig.chainId, chainId])

  useEffect(() => {
    if (Number(publicRuntimeConfig.chainId) !== chainId) {
      return setCreatePollDisabled(true)
    }
    if (name.trim().length === 0) {
      return setCreatePollDisabled(true)
    }
    if (tokens.length === 0) {
      return setCreatePollDisabled(true)
    }
    if (voteOptions < 2) {
      return setCreatePollDisabled(true)
    }
    setCreatePollDisabled(false)
  }, [publicRuntimeConfig.chainId, chainId, name, tokens.length])

  useEffect(() => {
    if (addTab === 1 || addTab === 2) {
      if (!fromToken || !Number.isInteger(Number(fromToken))) {
        return setAddTokenDisabled(true)
      }
    }

    if (addTab === 1) {
      if (!toToken || !Number.isInteger(Number(toToken))) {
        return setAddTokenDisabled(true)
      }
    }

    setAddTokenDisabled(false)
  }, [addTab, fromToken, toToken])

  const createPoll = async () => {
    setCreatePollLoading(true)

    try {
      const id = `0x${uuid().toString().replaceAll('-', '')}`
      const poseidon = await buildPoseidon()

      const snapshotTree = new IncrementalMerkleTree(i => poseidon.F.toString(poseidon(i)), 16, BigInt(0), 2)
      tokens.forEach(token => {
        const tokenBytes = ethers.utils.arrayify(ethers.BigNumber.from(token.token)).leftPad(32)
        const leafCollection = ethers.BigNumber.from(token.collection).toBigInt()
        const leafToken1 = ethers.BigNumber.from(tokenBytes.slice(0, 16)).toBigInt()
        const leafToken2 = ethers.BigNumber.from(tokenBytes.slice(16)).toBigInt()
        const leafAddress = ethers.BigNumber.from(token.address).toBigInt()
        snapshotTree.insert(poseidon.F.toString(poseidon([leafCollection, leafToken1, leafToken2, leafAddress])))
      })

      const publishResponse = await fetch("/api/polls/publish", {
        method: "POST",
        body: JSON.stringify({
          id,
          name,
          tokens,
          voteOptionNames,
        })
      })

      if (!publishResponse.ok) {
        console.error('publishResponse', publishResponse)
        return
      }

      const {uri} = await publishResponse.json()
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      const polls = new ethers.Contract(publicRuntimeConfig.pollsContract, Polls.abi, signer)

      await polls.createPoll(id, uri, tokens.length, snapshotTree.root, voteOptions, {
        value: `${weiPrice}`,
        gasLimit: 250000
      })

      await waitForCondition(5000, 120, async () => {
        const pollResponse = await fetch(`/api/polls/${id}`)
        return pollResponse.ok
      })

      await router.push(`/polls/${id}`)
    } finally {
      setCreatePollLoading(false)
    }
  }

  const addTokens = async () => {
    setSnapshotTimeDisabled(true)
    setAddTokenLoading(true)

    try {
      const body = {
        collection,
        snapshotTime: snapshotTime.unix()
      }

      if (addTab === 1) {
        body.fromToken = Number(fromToken)
        body.toToken = Number(toToken)
      }

      if (addTab === 2) {
        body.fromToken = Number(fromToken)
        body.toToken = Number(fromToken)
      }

      const response = await fetch("/api/tokens", {
        method: "POST",
        body: JSON.stringify(body)
      })

      const responseTokens = await response.json()
      const updateTokens = [...tokens, ...responseTokens]
      const distinctTokens = [...new Map(updateTokens.map(updateToken => [`${updateToken.collection}${updateToken.token}`, updateToken])).values()];
      setTokens(distinctTokens)

      const unitPriceResponse = await fetch("/api/polls/unit-price")
      const {unitPrice} = await unitPriceResponse.json()
      setPrice(Number((distinctTokens.length * unitPrice / 1000000000000000000).toFixed(6)))
      setWeiPrice(distinctTokens.length * unitPrice)

      setCollection('')
      setFromToken('')
      setToToken('')
    } finally {
      setAddTokenLoading(false)
    }
  }

  const clearTokens = () => {
    setTokens([])
    setSnapshotTimeDisabled(false)
    setPrice(0)
    setWeiPrice(0)
  }

  return (
    <div className={styles.main}>
      {showChainMessage && <Alert severity="warning">Please connect to network {publicRuntimeConfig.chainName}</Alert>}

      <Breadcrumbs>
        <Link underline="hover" color="inherit" href="/">Home</Link>
        <Link underline="hover" color="inherit" href="/polls">Polls</Link>
        <Typography color="text.primary">New</Typography>
      </Breadcrumbs>

      <Typography gutterBottom variant="h2" component="div">
        New poll
      </Typography>
      <Stack spacing={2} sx={{paddingX: 1, width: '100%', maxWidth: 500}}>
        <TextField
          label="Name"
          value={name}
          onInput={e => setName(e.target.value)}
          autoComplete="off"
        />

        <NoSsr>
          <LocalizationProvider dateAdapter={AdapterMoment} adapterLocale={'en'}>
            <DateTimePicker
              label="Snapshot time (UTC)"
              value={snapshotTime}
              onChange={v => setSnapshotTime(v)}
              renderInput={(params) => <TextField {...params} />}
              disabled={snapshotTimeDisabled}
            />
          </LocalizationProvider>
        </NoSsr>

        <Card variant="outlined">
          <CardContent>
            <div>
              <Typography gutterBottom variant="h5" component="span">
                Tokens
              </Typography>
              <Typography gutterBottom variant="subtitle1" component="span" sx={{marginLeft: 1}}>
                {tokens.length ? tokens.length : '0'}
              </Typography>
            </div>
            <Tabs value={addTab} onChange={(e, v) => setAddTab(v)} sx={{marginBottom: 2}}>
              <Tab label="Collection" disabled={addTokenLoading || createPollLoading}/>
              <Tab label="Token range" disabled={addTokenLoading || createPollLoading}/>
              <Tab label="Token" disabled={addTokenLoading || createPollLoading}/>
            </Tabs>
            <TextField
              label="Collection"
              value={collection}
              onInput={e => setCollection(e.target.value)}
              fullWidth={true}
              autoComplete="off"
              disabled={addTokenLoading || createPollLoading}
            />
            <div hidden={addTab !== 1}>
              <TextField
                label="From token ID"
                value={fromToken}
                onInput={e => setFromToken(e.target.value)}
                fullWidth={true}
                autoComplete="off"
                sx={{marginTop: 2}}
                disabled={addTokenLoading || createPollLoading}
              />
              <TextField
                label="To token ID"
                value={toToken}
                onInput={e => setToToken(e.target.value)}
                fullWidth={true}
                autoComplete="off"
                sx={{marginTop: 2}}
                disabled={addTokenLoading || createPollLoading}
              />
            </div>
            <div hidden={addTab !== 2}>
              <TextField
                label="Token ID"
                value={fromToken}
                onInput={e => setFromToken(e.target.value)}
                fullWidth={true}
                autoComplete="off"
                sx={{marginTop: 2}}
                disabled={addTokenLoading || createPollLoading}
              />
            </div>
          </CardContent>
          <CardActions>
            <LoadingButton
              variant="outlined"
              onClick={addTokens}
              loading={addTokenLoading}
              disabled={addTokenDisabled || createPollLoading}
            >
              Add
            </LoadingButton>
            <Button
              variant="outlined"
              color="error"
              onClick={clearTokens}
              disabled={addTokenLoading || createPollLoading}
            >
              Clear
            </Button>
          </CardActions>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <div>
              <Typography gutterBottom variant="h5" component="span">
                Options
              </Typography>
            </div>

            <Slider
              defaultValue={2}
              valueLabelDisplay="auto"
              step={1}
              marks
              min={2}
              max={10}
              onChange={(e, v) => setVoteOptions(v)}
              disabled={createPollLoading}
            />

            {Array.from({length: voteOptions}, (_, i) => i + 1).map(voteOption =>
              <TextField
                key={voteOption}
                label={`Option ${voteOption}`}
                value={voteOptionNames[voteOption - 1]}
                onInput={e => setVoteOptionNames(voteOptionNames.map((o, i) => i === voteOption - 1 ? e.target.value : o))}
                fullWidth={true}
                autoComplete="off"
                sx={{marginTop: 2}}
                disabled={createPollLoading}
              />
            )}
          </CardContent>
        </Card>


        <TextField
          label="Price"
          value={price ? price : ''}
          autoComplete="off"
          disabled={true}
        />
        <LoadingButton
          variant="outlined"
          onClick={createPoll}
          loading={createPollLoading}
          disabled={createPollDisabled}
        >
          Create poll
        </LoadingButton>
      </Stack>
    </div>
  )
}