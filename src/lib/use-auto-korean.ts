import { useEffect, useRef, useState } from 'react'
import { api } from './api'

export function useAutoKorean(jp: string) {
  const [ko, setKo] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'auto' | 'edited'>('idle')
  const autoRef = useRef('')
  const editedRef = useRef(false)
  const requestRef = useRef(0)

  function onKoChange(value: string) {
    setKo(value)
    if (!value.trim()) {
      editedRef.current = false
      autoRef.current = ''
      setStatus('idle')
      return
    }
    const edited = value.trim() !== autoRef.current.trim()
    editedRef.current = edited
    setStatus(edited ? 'edited' : 'auto')
  }

  function reset() {
    setKo('')
    autoRef.current = ''
    editedRef.current = false
    requestRef.current += 1
    setStatus('idle')
  }

  useEffect(() => {
    const q = jp.trim()
    if (!q) {
      if (!editedRef.current) {
        autoRef.current = ''
        setKo('')
        setStatus('idle')
      }
      return
    }
    if (editedRef.current) return

    const id = ++requestRef.current
    setStatus('loading')
    const timer = window.setTimeout(() => {
      void api
        .suggest(q, 'sentence')
        .then((found) => {
          if (id !== requestRef.current || editedRef.current) return
          if (found.primary) {
            autoRef.current = found.primary
            setKo(found.primary)
            setStatus('auto')
            return
          }
          setStatus('idle')
        })
        .catch(() => {
          if (id !== requestRef.current || editedRef.current) return
          setStatus('idle')
        })
    }, 480)

    return () => window.clearTimeout(timer)
  }, [jp])

  return { ko, onKoChange, status, reset }
}
