import LRU from 'lru-cache'

const cache = new LRU({max: 20})

export default function cachedIpfs () {
  async function getJsonContent (cid) {
    const cachedContent = cache.get(cid)
    if (cachedContent != null) {
      return cachedContent
    }

    const contentResponse = await fetch(`https://cf-ipfs.com/ipfs/${cid}`)
    const content = await contentResponse.json();

    cache.set(cid, content)
    return content
  }

  return {getJsonContent};
}