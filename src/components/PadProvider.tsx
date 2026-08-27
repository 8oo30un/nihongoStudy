import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { PadContext, type JapaneseField } from '../lib/pad-context'

function writeField(el: JapaneseField, next: string, cursor: number) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, next)
  el.setSelectionRange(cursor, cursor)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function PadProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<JapaneseField | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)
  const [katakana, setKatakana] = useState(false)
  const [open, setOpen] = useState(false)
  const flashTimer = useRef<number | null>(null)

  const flash = useCallback((key: string) => {
    setPressed(key)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setPressed(null), 150)
  }, [])

  const register = useCallback((el: JapaneseField | null) => {
    targetRef.current = el
  }, [])

  const insert = useCallback(
    (value: string) => {
      const el = targetRef.current
      if (!el) return
      flash(value)
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const next = el.value.slice(0, start) + value + el.value.slice(end)
      writeField(el, next, start + value.length)
    },
    [flash],
  )

  const mutate = useCallback(
    (fn: (text: string) => string, flashKey?: string) => {
      const el = targetRef.current
      if (!el) return
      if (flashKey) flash(flashKey)
      const start = el.selectionStart ?? el.value.length
      const before = el.value.slice(0, start)
      const after = el.value.slice(el.selectionEnd ?? start)
      const changed = fn(before)
      writeField(el, changed + after, changed.length)
    },
    [flash],
  )

  const value = useMemo(
    () => ({ pressed, katakana, setKatakana, open, setOpen, register, insert, mutate, flash }),
    [pressed, katakana, open, register, insert, mutate, flash],
  )

  return <PadContext.Provider value={value}>{children}</PadContext.Provider>
}
