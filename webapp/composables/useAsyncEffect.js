import {useEffect} from 'react';

function useAsyncEffect (asyncEffect) {
  useEffect(() => {
    asyncEffect().catch(console.error)
  });
}

export default useAsyncEffect