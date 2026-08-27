import { useEffect, useRef, type TextareaHTMLAttributes } from 'react'
import { toKana } from 'wanakana'
import { usePad } from '../lib/pad-context'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  lined?: boolean
}

export function JapaneseTextarea({ lined, className = '', onChange, onFocus, ...props }: Props) {
  const { register, flash, setOpen } = usePad()
  const ref = useRef<HTMLTextAreaElement>(null)
  const last = useRef('')

  useEffect(() => {
    return () => {
      if (ref.current) register(null)
    }
  }, [register])

  return (
    <textarea
      {...props}
      ref={ref}
      lang="ja"
      inputMode="text"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      className={`w-full resize-y bg-transparent font-jp text-[1.15rem] leading-8 text-ink outline-none placeholder:text-ink/35 ${
        lined ? 'lined-area min-h-[9rem]' : 'min-h-[4.5rem]'
      } ${className}`}
      onFocus={(e) => {
        register(e.currentTarget)
        setOpen(true)
        onFocus?.(e)
      }}
      onChange={(e) => {
        const el = e.currentTarget
        const converted = toKana(el.value, { IMEMode: true })
        if (converted !== el.value) {
          const extra = converted.length - el.value.length
          const pos = (el.selectionStart ?? converted.length) + extra
          el.value = converted
          el.setSelectionRange(pos, pos)
        }
        const next = el.value
        if (next.length >= last.current.length) {
          const added = next.slice(last.current.length)
          const ch = [...added].at(-1)
          if (ch) flash(ch)
        }
        last.current = next
        onChange?.(e)
      }}
    />
  )
}
