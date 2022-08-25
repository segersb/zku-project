import {useEffect, useState} from 'react';
import {useRouter} from "next/router";

function arrayEquals(a, b) {
  return Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index]);
}

const loadingLock = new Map()
const loadingParams = new Map()

function useLoadEffect (loadFunction, watchParams = []) {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()

  const load = async () => {
    try {
      await loadFunction()
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) {
      return
    }

    if (loadingLock.get(router.pathname)) {
      return
    }

    if (loaded && arrayEquals(loadingParams.get(router.pathname), watchParams)) {
      return
    }

    loadingParams.set(router.pathname, watchParams)
    loadingLock.set(router.pathname, true)
    setLoading(true)

    load().catch(console.error).then(() => {
      setLoading(false)
      setLoaded(true)
      loadingLock.set(router.pathname, false)
    })
  });

  return {load, loading, loaded}
}

export default useLoadEffect