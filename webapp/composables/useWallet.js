import {ethers} from "ethers";
import detectEthereumProvider from "@metamask/detect-provider";
import {createGlobalState} from "react-hooks-global-state";
import {useEffect} from "react";

const {useGlobalState} = createGlobalState({
  initialized: false,
  initializing: false,
  connected: false,
  chainId: 0,
  address: ''
});

function useWallet () {
  const [initialized, setInitialized] = useGlobalState('initialized')
  const [initializing, setInitializing] = useGlobalState('initializing')
  const [connected, setConnected] = useGlobalState('connected')
  const [chainId, setChainId] = useGlobalState('chainId')
  const [address, setAddress] = useGlobalState('address')

  async function init () {
    const ethereum = (await detectEthereumProvider())
    const provider = new ethers.providers.Web3Provider(ethereum, 'any');
    const signer = await provider.getSigner();

    provider.on("network", network => {
      setChainId(network.chainId)
    })

    ethereum.on('accountsChanged', function (accounts) {
      checkConnection()
    })

    try {
      const address = await signer.getAddress();
      setAddress(address)
      setConnected(true)
    } catch (e) {
      setAddress('')
      setConnected(false)
    }
  }

  async function checkConnection () {
    const ethereum = (await detectEthereumProvider())
    const provider = new ethers.providers.Web3Provider(ethereum, 'any');
    const signer = await provider.getSigner();

    try {
      const address = await signer.getAddress();
      setAddress(address)
      setConnected(true)
    } catch (e) {
      setAddress('')
      setConnected(false)
    }
  }

  async function connect () {
    const ethereum = (await detectEthereumProvider())
    const provider = new ethers.providers.Web3Provider(ethereum, 'any');
    await provider.send("eth_requestAccounts", []);
    setConnected(true)
  }

  useEffect(() => {
    if (initialized || initializing) {
      return
    }
    setInitializing(true)
    init().then(() => {
      setInitializing(false)
      setInitialized(true)
    })
  })

  return {initialized, connect, connected, address, chainId};
}

export default useWallet