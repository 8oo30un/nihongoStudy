import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Vocab } from '../types'

export function VocabPage() {
  const [items, setItems] = useState<Vocab[]>([])
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [meaning, setMeaning] = useState('')
  const [error, setError] = useState('')

  async function reload(query = q) {
    setItems(await api.vocab(query))
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      void reload(q).catch((err: Error) => setError(err.message))
    }, 160)
    return () => window.clearTimeout(t)
  }, [q])

  async function saveMeaning(item: Vocab) {
    await api.patchVocab(item.id, { koMeaning: meaning })
    setEditingId(null)
    await reload()
  }

  return (
    <div>
      <p className="section-title kicker">vocab</p>
      <p className="meta mt-4">
        문장에서 고른 단어입니다. 한글 뜻은 여기서 채워 둘 수 있습니다.
      </p>
      <label className="mt-6 flex items-baseline gap-3 border-b border-white/30 pb-2">
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
            {editingId === item.id ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <input
                  className="ink-input max-w-[18rem] flex-1"
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="한글 뜻"
                />
                <button type="button" className="quiet-link" onClick={() => void saveMeaning(item)}>
                  저장
                </button>
                <button type="button" className="quiet-link opacity-50" onClick={() => setEditingId(null)}>
                  닫기
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-3 block text-left text-[13px] leading-relaxed text-ink/85"
                onClick={() => {
                  setEditingId(item.id)
                  setMeaning(item.koMeaning)
                }}
              >
                {item.koMeaning || <span className="meta">뜻을 적어 두기</span>}
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
        {items.length === 0 && <p className="meta py-8">아직 단어가 없습니다. 문장 토글에서 골라 넣을 수 있습니다.</p>}
      </div>
    </div>
  )
}
