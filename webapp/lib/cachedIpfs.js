import LRU from 'lru-cache'

export default function cachedIpfs (cacheSize) {
  const cache = new LRU({max: cacheSize})

  async function getJsonContent (cid) {
    const cachedContent = cache.get(cid)
    if (cachedContent != null) {
      return cachedContent
    }

    const contentResponse = await fetch(`https://ipfs.io/ipfs/${cid}`)
    const content = await contentResponse.json();

    cache.set(cid, content)
    return content
  }

  return {getJsonContent};
}