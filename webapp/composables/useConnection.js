import { useState, useEffect } from 'react';
import {ethers} from "ethers";
import detectEthereumProvider from "@metamask/detect-provider";

function useConnection() {
  const [connected, setConnected] = useState(null);
  const [connectionChecked, setConnectionChecked] = useState(null);

  async function checkConnection() {
    const provider = (await detectEthereumProvider())
    const ethersProvider = new ethers.providers.Web3Provider(provider)
    const signer = await ethersProvider.getSigner();
    try {
      await signer.getAddress()
      setConnected(true)
    } catch (e) {
    }
    setConnectionChecked(true)
  }

  async function connect() {
    const provider = (await detectEthereumProvider())
    await provider.request({method: "eth_requestAccounts"})
    setConnected(true)
  }

  useEffect(() => {
    checkConnection().catch(console.error)
  });

  return {connected, connect, connectionChecked};
}

export default useConnection