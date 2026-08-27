import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SentenceCard } from '../components/SentenceCard'
import { api } from '../lib/api'
import type { Category, Sentence } from '../types'

export function CategoryDetailPage() {
  const { id } = useParams()
  const categoryId = Number(id)
  const [category, setCategory] = useState<Category | null>(null)
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    void (async () => {
      const cats = await api.categories()
      setCategory(cats.find((c) => c.id === categoryId) ?? null)
      setSentences(await api.sentences({ categoryId }))
    })()
  }, [categoryId])

  const filtered = q.trim()
    ? sentences.filter((s) => `${s.jpKana}${s.koText}${s.keywords}`.includes(q.trim()))
    : sentences

  return (
    <div>
      <Link to="/categories" className="quiet-link">
        ← category
      </Link>
      <p className="section-title mt-6">{category?.name ?? 'category'}</p>
      <input
        className="ink-input mt-6"
        placeholder="이 칸에서 찾기"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-2">
        {filtered.map((sentence) => (
          <SentenceCard key={sentence.id} sentence={sentence} />
        ))}
        {filtered.length === 0 && <p className="meta py-8">이 칸에 문장이 없습니다.</p>}
      </div>
    </div>
  )
}
