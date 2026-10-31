import { useCallback, useEffect, useState } from 'react'
import { getLibrary } from './api/client'

export function useLibrary() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ status: 'loading', data: null, error: null })
    getLibrary(ctrl.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', data: null, error })
      })
    return () => ctrl.abort()
  }, [attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  // reload the data without the loading screen, so the UI keeps its state
  const refresh = useCallback(async () => {
    const data = await getLibrary()
    setState({ status: 'ready', data, error: null })
  }, [])
  return { ...state, retry, refresh }
}
