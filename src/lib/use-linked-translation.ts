import { useEffect, useRef, useState } from 'react'
import { api } from './api'

type Origin = 'user' | 'auto' | 'empty'

export function useLinkedTranslation() {
  const [jp, setJp] = useState('')
  const [ko, setKo] = useState('')
  const [status, setStatus] = useState<'idle' | 'to-ko' | 'to-jp'>('idle')
  const lastUser = useRef<'jp' | 'ko' | null>(null)
  const jpOrigin = useRef<Origin>('empty')
  const koOrigin = useRef<Origin>('empty')
  const requestRef = useRef(0)

  function onJpChange(value: string) {
    lastUser.current = 'jp'
    jpOrigin.current = value.trim() ? 'user' : 'empty'
    setJp(value)
  }

  function onKoChange(value: string) {
    lastUser.current = 'ko'
    koOrigin.current = value.trim() ? 'user' : 'empty'
    setKo(value)
  }

  function setPair(next: { jp: string; ko: string }) {
    lastUser.current = null
    requestRef.current += 1
    jpOrigin.current = next.jp.trim() ? 'user' : 'empty'
    koOrigin.current = next.ko.trim() ? 'user' : 'empty'
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
      if (koOrigin.current !== 'user') {
        koOrigin.current = 'empty'
        setKo('')
      }
      setStatus('idle')
      return
    }
    if (koOrigin.current === 'user') {
      setStatus('idle')
      return
    }
    setStatus('to-ko')
    const timer = window.setTimeout(() => {
      void api
        .suggest(q, 'sentence')
        .then((found) => {
          if (id !== requestRef.current || lastUser.current !== 'jp') return
          if (koOrigin.current === 'user') {
            setStatus('idle')
            return
          }
          if (found.primary) {
            koOrigin.current = 'auto'
            setKo(found.primary)
          }
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
      if (jpOrigin.current !== 'user') {
        jpOrigin.current = 'empty'
        setJp('')
      }
      setStatus('idle')
      return
    }
    if (!/[가-힣]/.test(q) || jpOrigin.current === 'user') {
      setStatus('idle')
      return
    }
    setStatus('to-jp')
    const timer = window.setTimeout(() => {
      void api
        .suggest(q, 'japanese')
        .then((found) => {
          if (id !== requestRef.current || lastUser.current !== 'ko') return
          if (jpOrigin.current === 'user') {
            setStatus('idle')
            return
          }
          if (found.primary) {
            jpOrigin.current = 'auto'
            setJp(found.primary)
          }
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
