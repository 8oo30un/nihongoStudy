import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { JapaneseTextarea } from '../components/JapaneseTextarea'
import { SentenceCard } from '../components/SentenceCard'
import { api } from '../lib/api'
import { speakJapanese } from '../lib/tts'
import { useLinkedTranslation } from '../lib/use-linked-translation'
import type { Category, Sentence, TodayStats } from '../types'

export function TodayPage() {
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [jpKanji, setJpKanji] = useState('')
  const { jp: jpKana, ko: koText, onJpChange, onKoChange, reset, status } = useLinkedTranslation()
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [error, setError] = useState('')
  const [showKanji, setShowKanji] = useState(false)

  async function reload() {
    const [s, cats] = await Promise.all([api.stats(), api.categories()])
    setStats(s)
    setCategories(cats)
    if (categoryId === '' && cats[0]) setCategoryId(cats[0].id)
    const list = await api.sentences({ date: s.today })
    setSentences(list)
  }

  useEffect(() => {
    void reload().catch((err: Error) => setError(err.message))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!categoryId) return
    setError('')
    try {
      await api.addSentence({
        jpKana,
        jpKanji: jpKanji.trim() || null,
        koText,
        categoryId,
      })
      setJpKanji('')
      reset()
      setShowKanji(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    }
  }

  return (
    <div>
      <p className="section-title kicker">today</p>
      <p className="meta mt-4">
        {stats?.today}
        <span className="mx-2 opacity-50">/</span>
        {stats?.saved ?? 0}/{stats?.goal ?? 5}
        {(stats?.reviewCount ?? 0) > 0 && (
          <>
            <span className="mx-2 opacity-50">/</span>
            <Link to="/review">복습 {stats?.reviewCount}</Link>
          </>
        )}
      </p>

      <form className="mt-10 space-y-8" onSubmit={(e) => void onSubmit(e)}>
        <p className="font-kr text-[15px] leading-relaxed text-ink/85">
          오늘 외울 문장을 가나로 적고, 한글 뜻을 같이 저장합니다.
        </p>

        <section>
          <p className="step-label">1 · 일본어</p>
          <p className="meta mt-1">
            {status === 'to-jp'
              ? '한글 뜻을 일본어로 맞추는 중입니다.'
              : '칸을 누르거나 패드를 연 뒤, 노트북 키보드로 ka 처럼 치면 か 가 입력됩니다. 한글을 먼저 적어도 됩니다.'}
          </p>
          <div className="mt-3">
            <JapaneseTextarea
              required
              value={jpKana}
              onChange={(e) => onJpChange(e.target.value)}
              placeholder="きょうは はれです。"
            />
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-4">
            <button type="button" className="quiet-link" onClick={() => setShowKanji((v) => !v)}>
              {showKanji ? '한자 칸 닫기' : '한자도 적어 두기'}
            </button>
            <button type="button" className="quiet-link" onClick={() => speakJapanese(jpKana)}>
              읽어 보기
            </button>
          </div>
          {showKanji && (
            <label className="mt-4 block">
              <span className="label">한자 표기 · 선택</span>
              <input
                className="ink-input font-jp"
                value={jpKanji}
                onChange={(e) => setJpKanji(e.target.value)}
                placeholder="今日は晴れです。"
              />
              <span className="meta mt-2 block">나중에 한자를 확인할 때만 씁니다. 검색용 태그가 아닙니다.</span>
            </label>
          )}
        </section>

        <section>
          <p className="step-label">2 · 한글 뜻</p>
          <p className="meta mt-1">
            {status === 'to-ko'
              ? '일본어를 한글로 맞추는 중입니다.'
              : '직접 고친 뜻은 그대로 둡니다. 비어 있으면 일본어에 맞춰 넣습니다.'}
          </p>
          <input
            required
            className="ink-input mt-3"
            value={koText}
            onChange={(e) => onKoChange(e.target.value)}
            placeholder="오늘은 맑아요."
          />
        </section>

        <section>
          <p className="step-label">3 · 언제 쓰는 문장인가요</p>
          <p className="meta mt-1">분류에서 나중에 꺼내 봅니다.</p>
          <select
            className="ink-input mt-3"
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            required
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </section>

        {error && <p className="text-sm text-ink/80">{error}</p>}
        <button type="submit" className="ink-btn">
          저장하기
        </button>
      </form>

      <div className="mt-4 border-t border-white/20 pt-8">
        <p className="step-label">오늘 적은 문장</p>
        {sentences.map((sentence) => (
          <SentenceCard
            key={sentence.id}
            sentence={sentence}
            onDelete={() => {
              void api.deleteSentence(sentence.id).then(() => reload())
            }}
          />
        ))}
        {sentences.length === 0 && (
          <p className="meta py-6">아직 없습니다. 위 세 칸만 채우면 됩니다.</p>
        )}
      </div>
    </div>
  )
}
