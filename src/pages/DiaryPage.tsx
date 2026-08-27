import { useEffect, useState } from 'react'
import { JapaneseTextarea } from '../components/JapaneseTextarea'
import { api } from '../lib/api'
import { speakJapanese } from '../lib/tts'
import type { DiaryEntry, TodayStats } from '../types'

export function DiaryPage() {
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [entry, setEntry] = useState<DiaryEntry | null>(null)
  const [jpKana, setJpKana] = useState('')
  const [koNote, setKoNote] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      const s = await api.stats()
      setStats(s)
      const d = await api.diary(s.today)
      setEntry(d)
      setJpKana(d.jpKana)
      setKoNote(d.koNote)
    })()
  }, [])

  async function save() {
    if (!stats) return
    const next = await api.saveDiary(stats.today, { jpKana, koNote })
    setEntry(next)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1200)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="section-title kicker">diary</p>
        <button type="button" className="quiet-link" onClick={() => speakJapanese(jpKana)}>
          listen
        </button>
      </div>
      <p className="meta mt-4">{stats?.today}</p>
      <section className="mt-8 space-y-6">
        <label className="block">
          <span className="label">kana</span>
          <JapaneseTextarea lined value={jpKana} onChange={(e) => setJpKana(e.target.value)} placeholder="きょうは …" />
        </label>
        <label className="block">
          <span className="label">note</span>
          <textarea
            className="ink-input min-h-[5rem]"
            value={koNote}
            onChange={(e) => setKoNote(e.target.value)}
          />
        </label>
        <button type="button" className="ink-btn" onClick={() => void save()}>
          {saved ? 'saved' : 'save'}
        </button>
        {entry?.correctionJson && <p className="meta">첨삭 결과가 있습니다.</p>}
      </section>
      <p className="meta mt-10">
        첨삭은 유료 API 없이 맥의 Ollama를 붙일 예정입니다. 지금은 원문 저장과 읽기부터 됩니다.
      </p>
    </div>
  )
}
