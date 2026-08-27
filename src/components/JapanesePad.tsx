import { applyMap, DAKUTEN, GOJUON, HANDAKUTEN, SMALL, toKatakanaChar } from '../lib/kana'
import { usePad } from '../lib/pad-context'

function Key({
  id,
  label,
  wide,
  onPress,
}: {
  id: string
  label: string
  wide?: boolean
  onPress: () => void
}) {
  const { pressed } = usePad()
  const active = pressed === id || pressed === label
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress()
      }}
      className={`key-tile ${wide ? 'col-span-2' : ''} ${active ? 'key-tile-pressed' : ''}`}
    >
      {label}
    </button>
  )
}

export function JapanesePad() {
  const { insert, mutate, katakana, setKatakana, open, setOpen } = usePad()
  const show = (hira: string) => (katakana ? toKatakanaChar(hira) : hira)

  return (
    <section className="pad-sheet" aria-label="일본어 가상 키보드">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="font-ui text-[10px] tracking-[0.2em] text-ink/70 lowercase">
          {open ? 'type ka → か' : 'kana pad'}
        </p>
        <button
          type="button"
          className="quiet-link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen(!open)}
        >
          {open ? 'close' : 'open'}
        </button>
      </div>
      {open && (
        <>
          <div className="mb-1.5 grid grid-cols-5 gap-1">
            <Key id="toggle" label={katakana ? 'カナ' : 'かな'} onPress={() => setKatakana(!katakana)} />
            <Key id="small" label="小" onPress={() => mutate((t) => applyMap(t, SMALL), 'small')} />
            <Key id="dakuten" label="゛" onPress={() => mutate((t) => applyMap(t, DAKUTEN), 'dakuten')} />
            <Key id="handakuten" label="゜" onPress={() => mutate((t) => applyMap(t, HANDAKUTEN), 'handakuten')} />
            <Key id="backspace" label="⌫" onPress={() => mutate((t) => t.slice(0, -1), 'backspace')} />
          </div>
          <div className="grid grid-cols-10 gap-1">
            {GOJUON.flatMap((row, ri) =>
              row.map((kana, ci) => {
                if (!kana) return <span key={`${ri}-${ci}`} className="h-9" />
                const shown = show(kana)
                return (
                  <Key key={`${ri}-${ci}-${kana}`} id={shown} label={shown} onPress={() => insert(shown)} />
                )
              }),
            )}
          </div>
          <div className="mt-1.5 grid grid-cols-6 gap-1">
            <Key id="、" label="、" onPress={() => insert('、')} />
            <Key id="。" label="。" onPress={() => insert('。')} />
            <Key id="？" label="？" onPress={() => insert('？')} />
            <Key id="！" label="！" onPress={() => insert('！')} />
            <Key id="space" label="space" wide onPress={() => insert(' ')} />
          </div>
        </>
      )}
    </section>
  )
}
