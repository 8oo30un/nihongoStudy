import { useEffect, useState, type FormEvent } from 'react'
import { toRomaji } from 'wanakana'
import { JapaneseTextarea } from '../components/JapaneseTextarea'
import { api } from '../lib/api'
import { useAutoKorean } from '../lib/use-auto-korean'
import type { Vocab } from '../types'

export function VocabPage() {
  const [items, setItems] = useState<Vocab[]>([])
  const [q, setQ] = useState('')
  const [surface, setSurface] = useState('')
  const { ko: koMeaning, onKoChange, status: koStatus, reset: resetKo } = useAutoKorean(surface)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editSurface, setEditSurface] = useState('')
  const [meaning, setMeaning] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function reload(query = q) {
    setItems(await api.vocab(query))
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      void reload(q).catch((err: Error) => setError(err.message))
    }, 160)
    return () => window.clearTimeout(t)
  }, [q])

  async function addWord(e: FormEvent) {
    e.preventDefault()
    const jp = surface.trim()
    if (!jp) return
    setError('')
    try {
      const saved = await api.addVocab({
        surface: jp,
        reading: jp,
        romaji: toRomaji(jp),
        koMeaning: koMeaning.trim(),
      })
      setSurface('')
      resetKo()
      setNotice(saved.already ? '이미 단어장에 있습니다.' : '단어장에 넣었습니다.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '단어장에 넣지 못했습니다.')
    }
  }

  function startEdit(item: Vocab) {
    setEditingId(item.id)
    setEditSurface(item.reading.trim() || item.surface)
    setMeaning(item.koMeaning)
    setError('')
  }

  async function saveEdit(item: Vocab) {
    const surface = editSurface.trim()
    if (!surface) return
    try {
      await api.patchVocab(item.id, {
        surface,
        reading: surface,
        romaji: toRomaji(surface),
        koMeaning: meaning,
      })
      setEditingId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '단어를 고치지 못했습니다.')
    }
  }

  return (
    <div>
      <p className="section-title kicker">vocab</p>
      <p className="meta mt-4">직접 넣거나, 문장에서 고른 단어입니다.</p>

      <form className="mt-8 space-y-5" onSubmit={(e) => void addWord(e)}>
        <p className="step-label">단어 넣기</p>
        <JapaneseTextarea
          compact
          required
          value={surface}
          onChange={(e) => setSurface(e.target.value)}
          placeholder="したく"
        />
        <label className="block">
          <span className="label">한글 뜻</span>
          <input
            className="ink-input"
            value={koMeaning}
            onChange={(e) => onKoChange(e.target.value)}
            placeholder="준비"
          />
          <span className="meta mt-2 block">
            {koStatus === 'loading'
              ? '뜻을 찾는 중입니다.'
              : koStatus === 'auto'
                ? '자동으로 넣었습니다. 이상하면 고치면 됩니다.'
                : koStatus === 'edited'
                  ? '직접 고친 뜻입니다.'
                  : '일본어를 적으면 뜻이 먼저 들어옵니다.'}
          </span>
        </label>
        <button type="submit" className="ink-btn">
          넣기
        </button>
        {notice && <p className="meta">{notice}</p>}
      </form>

      <label className="mt-10 flex items-baseline gap-3 border-b border-white/30 pb-2">
        <span className="font-ui text-[11px] tracking-[0.16em] text-ink/50">찾기</span>
        <input
          className="w-full bg-transparent font-kr text-[15px] text-ink outline-none"
          placeholder="단어, 로마자, 뜻…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {error && <p className="meta mt-6">{error}</p>}
      <div className="mt-2">
        {items.map((item) => (
          <article key={item.id} className="paper-card">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-jp text-[1.25rem] tracking-wide">{item.surface}</p>
              <button
                type="button"
                className="quiet-link opacity-50"
                onClick={() => {
                  void api.deleteVocab(item.id).then(() => reload())
                }}
              >
                delete
              </button>
            </div>
            <p className="mt-1 font-ui text-[12px] tracking-[0.04em] text-ink/70">{item.romaji}</p>
            {item.missCount > 0 && <p className="meta mt-1">틀림 {item.missCount}</p>}
            {editingId === item.id ? (
              <div className="mt-3 space-y-3">
                <JapaneseTextarea
                  compact
                  value={editSurface}
                  onChange={(e) => setEditSurface(e.target.value)}
                  placeholder="したくする"
                  className="!min-h-[2.2rem] !text-[1.05rem] !leading-7"
                />
                <input
                  className="ink-input"
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="한글 뜻"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className="quiet-link" onClick={() => void saveEdit(item)}>
                    저장
                  </button>
                  <button type="button" className="quiet-link opacity-50" onClick={() => setEditingId(null)}>
                    닫기
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="mt-3 block text-left text-[13px] leading-relaxed text-ink/85"
                onClick={() => startEdit(item)}
              >
                {item.koMeaning || <span className="meta">뜻을 적어 두기</span>}
                <span className="meta mt-1 block">가나·뜻을 고치기</span>
              </button>
            )}
            {item.contextJp && (
              <p className="meta mt-3">
                {item.contextJp}
                {item.contextKo ? ` · ${item.contextKo}` : ''}
              </p>
            )}
          </article>
        ))}
        {items.length === 0 && (
          <p className="meta py-8">아직 단어가 없습니다. 위에서 직접 넣거나, 문장 토글에서 고를 수 있습니다.</p>
        )}
      </div>
    </div>
  )
}
