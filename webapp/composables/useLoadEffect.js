import {useEffect, useState} from 'react';

const loadingLock = new Map()

function useLoadEffect (loadFunction, router) {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    try {
      await loadFunction()
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (router && !router.isReady) {
      return
    }

    if (loading || loaded || loadingLock.get(loadFunction)) {
      return
    }

    loadingLock.set(loadFunction, true)
    setLoading(true)
    load().catch(console.error)
  });

  return {loading, loaded}
}

export default useLoadEffect