import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toSentenceRomaji } from '../lib/analyze'
import { speakJapanese } from '../lib/tts'
import type { Sentence, TodayStats } from '../types'

export function ReviewPage() {
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [queue, setQueue] = useState<Sentence[]>([])
  const [reveal, setReveal] = useState(false)
  const current = queue[0]

  async function reload() {
    const s = await api.stats()
    setStats(s)
    setQueue(await api.sentences({ due: s.today }))
    setReveal(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  async function mark(selfMark: Sentence['selfMark']) {
    if (!current) return
    await api.patchSentence(current.id, { selfMark })
    await reload()
  }

  if (!current) {
    return (
      <div>
        <p className="section-title kicker">review</p>
        <p className="meta mt-6">지금 복습할 문장이 없습니다. 틀린 문장은 다음 날 여기로 옵니다.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="section-title kicker">review</p>
      <p className="meta mt-4">
        left {queue.length}
        <span className="mx-2 opacity-50">/</span>
        {stats?.today}
      </p>
      <article className="mt-10">
        <p className="meta">
          {current.createdOn}
          <span className="mx-2 opacity-50">/</span>
          {current.categoryName}
        </p>
        <p className="mt-4 font-jp text-[1.6rem] leading-relaxed tracking-wide">{current.jpKana}</p>
        {current.jpKanji && current.jpKanji !== current.jpKana && (
          <p className="mt-2 font-jp text-[12px] text-ink/60">{current.jpKanji}</p>
        )}
        {reveal ? (
          <div className="mt-6">
            <p className="text-[15px] leading-relaxed text-ink/85">{current.koText}</p>
            <p className="mt-2 font-ui text-[12px] tracking-[0.04em] text-ink/70">
              {toSentenceRomaji(current.jpKana)}
            </p>
          </div>
        ) : (
          <button type="button" className="quiet-link mt-6" onClick={() => setReveal(true)}>
            한국어 뜻 · 로마자
          </button>
        )}
        <button
          type="button"
          className="quiet-link mt-4 block"
          onClick={() => speakJapanese(current.jpKanji || current.jpKana)}
        >
          listen
        </button>
      </article>
      <div className="mt-10 flex gap-3">
        <button type="button" className="ink-btn flex-1" onClick={() => void mark('ok')}>
          know
        </button>
        <button type="button" className="ink-btn-warn flex-1" onClick={() => void mark('wrong')}>
          again
        </button>
      </div>
    </div>
  )
}
