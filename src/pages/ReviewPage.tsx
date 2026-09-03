import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toSentenceRomaji } from '../lib/analyze'
import { speakJapanese } from '../lib/tts'
import type { Sentence, TodayStats, Vocab } from '../types'

type ReviewItem =
  | { kind: 'sentence'; id: number; sentence: Sentence }
  | { kind: 'vocab'; id: number; vocab: Vocab }

export function ReviewPage() {
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [queue, setQueue] = useState<ReviewItem[]>([])
  const [reveal, setReveal] = useState(false)
  const current = queue[0]

  async function reload() {
    const s = await api.stats()
    setStats(s)
    const [sentences, vocab] = await Promise.all([
      api.sentences({ due: s.today }),
      api.vocab({ due: s.today }),
    ])
    setQueue([
      ...sentences.map((sentence) => ({ kind: 'sentence' as const, id: sentence.id, sentence })),
      ...vocab.map((item) => ({ kind: 'vocab' as const, id: item.id, vocab: item })),
    ])
    setReveal(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  async function mark(selfMark: 'ok' | 'wrong') {
    if (!current) return
    if (current.kind === 'sentence') await api.patchSentence(current.sentence.id, { selfMark })
    else await api.patchVocab(current.vocab.id, { selfMark })
    await reload()
  }

  if (!current) {
    return (
      <div>
        <p className="section-title kicker">review</p>
        <p className="meta mt-6">지금 복습할 것이 없습니다. 테스트에서 틀린 문장과 단어가 여기로 옵니다.</p>
      </div>
    )
  }

  const jp = current.kind === 'sentence' ? current.sentence.jpKana : current.vocab.reading || current.vocab.surface
  const kanji = current.kind === 'sentence' ? current.sentence.jpKanji : current.vocab.surface
  const ko = current.kind === 'sentence' ? current.sentence.koText : current.vocab.koMeaning
  const missCount = current.kind === 'sentence' ? current.sentence.missCount : current.vocab.missCount
  const createdOn = current.kind === 'sentence' ? current.sentence.createdOn : current.vocab.createdOn
  const label = current.kind === 'sentence' ? current.sentence.categoryName : '단어'

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
          {createdOn}
          <span className="mx-2 opacity-50">/</span>
          {label}
          {missCount > 0 && (
            <>
              <span className="mx-2 opacity-50">/</span>
              틀림 {missCount}
            </>
          )}
        </p>
        <p className="mt-4 font-jp text-[1.6rem] leading-relaxed tracking-wide">{jp}</p>
        {kanji && kanji !== jp && <p className="mt-2 font-jp text-[12px] text-ink/60">{kanji}</p>}
        {reveal ? (
          <div className="mt-6">
            <p className="text-[15px] leading-relaxed text-ink/85">{ko}</p>
            {current.kind === 'sentence' && (
              <p className="mt-2 font-ui text-[12px] tracking-[0.04em] text-ink/70">
                {toSentenceRomaji(current.sentence.jpKana)}
              </p>
            )}
          </div>
        ) : (
          <button type="button" className="quiet-link mt-6" onClick={() => setReveal(true)}>
            한국어 뜻 · 로마자
          </button>
        )}
        <button type="button" className="quiet-link mt-4 block" onClick={() => speakJapanese(kanji || jp)}>
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
