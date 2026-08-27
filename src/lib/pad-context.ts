import { createContext, useContext } from 'react'

export type JapaneseField = HTMLInputElement | HTMLTextAreaElement

export type PadContextValue = {
  pressed: string | null
  katakana: boolean
  setKatakana: (v: boolean) => void
  open: boolean
  setOpen: (v: boolean) => void
  register: (el: JapaneseField | null) => void
  insert: (value: string) => void
  mutate: (fn: (text: string) => string, flash?: string) => void
  flash: (key: string) => void
}

export const PadContext = createContext<PadContextValue | null>(null)

export function usePad() {
  const ctx = useContext(PadContext)
  if (!ctx) throw new Error('PadProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
