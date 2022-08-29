import {useRouter} from "next/router"
import {useState} from "react"
import {Backdrop, Breadcrumbs, Card, CardActions, CardContent, CardHeader, CircularProgress, FormControl, InputLabel, Link, ListItemText, MenuItem, Select, Stack, TextField, Typography} from "@mui/material"
import styles from "../../styles/polls.module.css"
import {LoadingButton} from "@mui/lab"
import useUtilityCircuit from "../../composables/useUtilityCircuit";
import useLoadEffect from "../../composables/useLoadEffect";
import useWallet from "../../composables/useWallet";
import useWait from "../../composables/useWait";

export default function Poll () {
  const router = useRouter()
  const {id} = router.query

  const [name, setName] = useState('')
  const [tokens, setTokens] = useState([])
  const [eligibleTokens, setEligibleTokens] = useState([])
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0)
  const [voteCount, setVoteCount] = useState(0)
  const [voteOptions, setVoteOptions] = useState(0)
  const [voteOptionNames, setVoteOptionNames] = useState([])
  const [results, setResults] = useState([])

  const [voteLoading, setVoteLoading] = useState(false)
  const [voteDone, setVoteDone] = useState(false)

  const {address} = useWallet()
  const {waitForCondition} = useWait()
  const {createUtilityProof} = useUtilityCircuit()

  const {loading, load} = useLoadEffect(async () => {
    if (!address) {
      return
    }

    const pollResponse = await fetch(`/api/polls/${id}`)
    const poll = await pollResponse.json()

    setName(poll.name)
    setTokens(poll.tokens)
    setVoteCount(poll.voteCount)
    setVoteOptions(poll.voteOptions)
    setVoteOptionNames(poll.voteOptionNames)
    setResults(poll.results)

    const eligibleTokens = poll.tokens.filter(token => token.address.toLowerCase() === address.toLowerCase());
    setEligibleTokens(eligibleTokens)

    if (eligibleTokens.length) {
      const selectedToken = eligibleTokens[0]
      loadTokenState(selectedToken)
    }
  }, [address])

  const onTokenSelectionChange = newSelectedTokenIndex => {
    setSelectedTokenIndex(newSelectedTokenIndex)
    const selectedToken = eligibleTokens[newSelectedTokenIndex]
    loadTokenState(selectedToken)
  }

  const loadTokenState = selectedToken => {
    const storedVote = window.localStorage.getItem(`${id}-${selectedToken.collection}-${selectedToken.token}-vote`)
    setVoteDone(!!storedVote)
  }

  const vote = async (voteOption) => {
    setVoteLoading(true)
    try {
      const token = eligibleTokens[selectedTokenIndex]

      console.log('creating vote proof')
      const voteProof = await createUtilityProof(id, tokens, token, voteOption)
      console.log('vote proof created')

      const voteValidationResponse = await fetch(`/api/polls/${id}/validate-vote`, {
        method: "POST",
        body: JSON.stringify(voteProof)
      })

      const voteValidation = await voteValidationResponse.json();
      if (!voteValidation.valid && voteValidation.error.includes('DuplicateVote')) {
        window.localStorage.setItem(`${id}-${token.collection}-${token.token}-vote`, "true");
        setVoteDone(true)
        return
      }

      const voteResponse = await fetch(`/api/polls/${id}/vote`, {
        method: "POST",
        body: JSON.stringify(voteProof)
      })

      if (voteResponse.ok) {
        window.localStorage.setItem(`${id}-${token.collection}-${token.token}-vote`, "true");

        const currentVoteCount = voteCount
        await waitForCondition(1000, 60, async () => {
          const pollResponse = await fetch(`/api/polls/${id}`)
          const poll = await pollResponse.json()
          return poll.voteCount > currentVoteCount
        })

        setVoteDone(true)
        await load()
      }
    } finally {
      setVoteLoading(false)
    }
  }

  const eligibleTokensCard = <Card variant="outlined">
    <CardHeader title="Tokens"/>
    <CardContent>
      <FormControl fullWidth={true}>
        <InputLabel id="token-select-label">Token</InputLabel>
        <Select
          labelId="token-select-label"
          id="token-select"
          label="Token"
          value={selectedTokenIndex}
          onChange={e => onTokenSelectionChange(e.target.value)}
          fullWidth={true}
          disabled={voteLoading}
        >
          {eligibleTokens.map((eligibleToken, index) =>
            <MenuItem key={index} value={index}>
              <ListItemText primary={eligibleToken.collection} secondary={eligibleToken.token}/>
            </MenuItem>
          )}
        </Select>
      </FormControl>
    </CardContent>
    <CardActions>
      {Array.from({length: voteOptions}, (_, i) => i + 1).map(voteOption =>
        <LoadingButton
          variant="outlined"
          onClick={() => vote(voteOption)}
          loading={voteLoading}
          key={voteOption}
          disabled={voteDone}
        >
          Vote {voteOption}
        </LoadingButton>)}
    </CardActions>
  </Card>

  const ineligibleTokensCard = <Card variant="outlined">
    <CardHeader title="Tokens"/>
    <CardContent>
      <Typography sx={{mb: 1.5}} color="text.secondary">
        Your are not eligible for this poll
      </Typography>
    </CardContent>
  </Card>

  return (
    <div className={styles.main}>
      <Backdrop open={loading}>
        <CircularProgress/>
      </Backdrop>

      <Breadcrumbs>
        <Link underline="hover" color="inherit" href="/">Home</Link>
        <Link underline="hover" color="inherit" href="/polls">Polls</Link>
        <Typography color="text.primary">{name}</Typography>
      </Breadcrumbs>

      <Typography gutterBottom variant="h2" component="div">
        Poll
      </Typography>

      <Stack spacing={2} sx={{paddingX: 1, width: '100%', maxWidth: 500}}>
        <Card variant="outlined">
          <CardHeader title={name}/>
          <CardContent>
            <TextField
              label="Tokens"
              value={tokens.length}
              autoComplete="off"
              disabled={true}
              fullWidth={true}
            />
            <TextField
              label="Votes"
              value={voteCount}
              autoComplete="off"
              disabled={true}
              fullWidth={true}
              sx={{marginTop: 2}}
            />
            {Array.from({length: voteOptions}, (_, i) => i + 1).map(voteOption =>
              <TextField
                key={voteOption}
                label={`${voteOption} ${voteOptionNames[voteOption - 1]}`}
                value={results[voteOption]}
                autoComplete="off"
                disabled={true}
                fullWidth={true}
                sx={{marginTop: 2}}
              />
            )}

          </CardContent>
        </Card>

        {!!eligibleTokens.length ? eligibleTokensCard : ineligibleTokensCard}
      </Stack>
    </div>
  )
}