function useWait () {

  async function waitForCondition (sleepTime, maxRetries, conditionCheck) {
    let retryCount = 0
    let conditionMet = await conditionCheck()
    while (!conditionMet && retryCount < maxRetries) {
      await sleep(1000)
      retryCount++
      conditionMet = await conditionCheck()
    }

    if (!conditionMet) {
      throw new Error('condition was never met')
    }
  }

  function sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return {waitForCondition, sleep};
}

export default useWait