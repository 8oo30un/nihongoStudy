import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toKana } from 'wanakana'
import { PadContext, type JapaneseField } from '../lib/pad-context'

function writeField(el: JapaneseField, next: string, cursor: number) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, next)
  el.setSelectionRange(cursor, cursor)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function isOtherTextField(target: EventTarget | null, japanese: JapaneseField | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target === japanese) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

export function PadProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<JapaneseField | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)
  const [katakana, setKatakana] = useState(false)
  const [open, setOpenState] = useState(false)
  const flashTimer = useRef<number | null>(null)
  const katakanaRef = useRef(katakana)
  katakanaRef.current = katakana

  const flash = useCallback((key: string) => {
    setPressed(key)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setPressed(null), 150)
  }, [])

  const register = useCallback((el: JapaneseField | null) => {
    targetRef.current = el
  }, [])

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v)
    if (v) {
      window.requestAnimationFrame(() => targetRef.current?.focus())
    }
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

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      const el = targetRef.current
      if (!el) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isOtherTextField(e.target, el)) return

      const letter = e.key.length === 1 && /[a-zA-Z'\-]/.test(e.key)
      const space = e.key === ' '
      const backspace = e.key === 'Backspace'
      if (!letter && !space && !backspace) return

      e.preventDefault()
      if (document.activeElement !== el) el.focus()

      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const after = el.value.slice(end)

      if (backspace) {
        const cut = start === end ? Math.max(0, start - 1) : start
        writeField(el, el.value.slice(0, cut) + after, cut)
        flash('backspace')
        return
      }

      const raw = space ? ' ' : katakanaRef.current ? e.key.toUpperCase() : e.key.toLowerCase()
      const nextRaw = el.value.slice(0, start) + raw + after
      const converted = toKana(nextRaw, { IMEMode: katakanaRef.current ? 'toKatakana' : true })
      const cursor = Math.max(0, converted.length - after.length)
      writeField(el, converted, cursor)
      const added = converted.slice(0, cursor)
      const ch = [...added].at(-1)
      if (ch && ch !== ' ') flash(ch)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, flash])

  const value = useMemo(
    () => ({ pressed, katakana, setKatakana, open, setOpen, register, insert, mutate, flash }),
    [pressed, katakana, open, setOpen, register, insert, mutate, flash],
  )

  return <PadContext.Provider value={value}>{children}</PadContext.Provider>
}
