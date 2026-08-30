import { useEffect, useState } from 'react'
import { SentenceCard } from '../components/SentenceCard'
import { api } from '../lib/api'
import type { Sentence } from '../types'

export function SearchPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const qTrim = q.trim()
    if (!qTrim) {
      setResults([])
      return
    }
    const t = window.setTimeout(() => {
      setLoading(true)
      void api
        .search(qTrim)
        .then(setResults)
        .finally(() => setLoading(false))
    }, 180)
    return () => window.clearTimeout(t)
  }, [q])

  return (
    <div>
      <p className="section-title kicker">search</p>
      <p className="meta mt-4">
        한글이나 가나를 넣으면, 저장해 둔 문장 안에서 같은 글자가 있는 것만 나옵니다.
      </p>
      <label className="mt-6 flex items-baseline gap-3 border-b border-white/30 pb-2">
        <span className="font-ui text-[11px] tracking-[0.16em] text-ink/50">찾기</span>
        <input
          autoFocus
          className="w-full bg-transparent font-kr text-[15px] text-ink outline-none"
          placeholder="사랑, すき, 숙소…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {loading && <p className="meta mt-6">찾는 중…</p>}
      {q.trim() && !loading && results.length === 0 && (
        <p className="meta mt-8">아직 이 글자가 들어간 문장이 없습니다. today에서 문장을 저장하면 여기서 찾을 수 있습니다.</p>
      )}
      <div className="mt-2">
        {results.map((sentence) => (
          <SentenceCard
            key={sentence.id}
            sentence={sentence}
            onUpdated={(next) => {
              setResults((prev) => prev.map((item) => (item.id === next.id ? next : item)))
            }}
          />
        ))}
      </div>
    </div>
  )
}
