import { useEffect, useRef, useState } from 'react'
import { api } from './api'

export function useLinkedTranslation() {
  const [jp, setJp] = useState('')
  const [ko, setKo] = useState('')
  const [status, setStatus] = useState<'idle' | 'to-ko' | 'to-jp'>('idle')
  const lastUser = useRef<'jp' | 'ko' | null>(null)
  const requestRef = useRef(0)

  function onJpChange(value: string) {
    lastUser.current = 'jp'
    setJp(value)
  }

  function onKoChange(value: string) {
    lastUser.current = 'ko'
    setKo(value)
  }

  function setPair(next: { jp: string; ko: string }) {
    lastUser.current = null
    requestRef.current += 1
    setJp(next.jp)
    setKo(next.ko)
    setStatus('idle')
  }

  function reset() {
    setPair({ jp: '', ko: '' })
  }

  useEffect(() => {
    if (lastUser.current !== 'jp') return
    const q = jp.trim()
    const id = ++requestRef.current
    if (!q) {
      setKo('')
      setStatus('idle')
      return
    }
    setStatus('to-ko')
    const timer = window.setTimeout(() => {
      void api
        .suggest(q, 'sentence')
        .then((found) => {
          if (id !== requestRef.current || lastUser.current !== 'jp') return
          if (found.primary) setKo(found.primary)
          setStatus('idle')
        })
        .catch(() => {
          if (id !== requestRef.current) return
          setStatus('idle')
        })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [jp])

  useEffect(() => {
    if (lastUser.current !== 'ko') return
    const q = ko.trim()
    const id = ++requestRef.current
    if (!q) {
      setJp('')
      setStatus('idle')
      return
    }
    if (!/[가-힣]/.test(q)) {
      setStatus('idle')
      return
    }
    setStatus('to-jp')
    const timer = window.setTimeout(() => {
      void api
        .suggest(q, 'japanese')
        .then((found) => {
          if (id !== requestRef.current || lastUser.current !== 'ko') return
          if (found.primary) setJp(found.primary)
          setStatus('idle')
        })
        .catch(() => {
          if (id !== requestRef.current) return
          setStatus('idle')
        })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [ko])

  return { jp, ko, onJpChange, onKoChange, setPair, reset, status }
}
