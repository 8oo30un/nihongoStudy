import { useEffect, useRef, useState } from 'react'
import { api } from './api'

export function useAutoJapanese(ko: string) {
  const [jp, setJp] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'auto'>('idle')
  const requestRef = useRef(0)

  useEffect(() => {
    const q = ko.trim()
    if (!q || !/[가-힣]/.test(q)) {
      requestRef.current += 1
      setJp('')
      setStatus('idle')
      return
    }

    const id = ++requestRef.current
    setStatus('loading')
    const timer = window.setTimeout(() => {
      void api
        .suggest(q, 'japanese')
        .then((found) => {
          if (id !== requestRef.current) return
          if (found.primary) {
            setJp(found.primary)
            setStatus('auto')
            return
          }
          setJp('')
          setStatus('idle')
        })
        .catch(() => {
          if (id !== requestRef.current) return
          setJp('')
          setStatus('idle')
        })
    }, 520)

    return () => window.clearTimeout(timer)
  }, [ko])

  return { jp, status }
}
