import { useEffect, useMemo, useState } from 'react'
import { JapaneseTextarea } from '../components/JapaneseTextarea'
import { api } from '../lib/api'
import { useLinkedTranslation } from '../lib/use-linked-translation'
import { speakJapanese } from '../lib/tts'
import type { DiaryEntry, Sentence, TodayStats, Vocab } from '../types'

const WEEKDAYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toYmd(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function parseYmd(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month: month - 1, day }
}

function monthCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const prevDays = new Date(prevYear, prevMonth + 1, 0).getDate()
  const cells: { date: string; day: number; muted: boolean }[] = []

  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const day = prevDays - i
    cells.push({ date: toYmd(prevYear, prevMonth, day), day, muted: true })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: toYmd(year, month, day), day, muted: false })
  }
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    cells.push({ date: toYmd(nextYear, nextMonth, nextDay), day: nextDay, muted: true })
    nextDay += 1
  }
  return cells
}

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const left = next[i]
    const right = next[j]
    if (left === undefined || right === undefined) continue
    next[i] = right
    next[j] = left
  }
  return next
}

function joinLine(current: string, next: string) {
  const left = current.trim()
  const right = next.trim()
  if (!right) return current
  if (!left) return right
  if (left.includes(right)) return current
  return `${left}\n${right}`
}

export function DiaryPage() {
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [entry, setEntry] = useState<DiaryEntry | null>(null)
  const [selected, setSelected] = useState('')
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [written, setWritten] = useState<Set<string>>(new Set())
  const { jp: jpKana, ko: koNote, onJpChange, onKoChange, setPair, status } = useLinkedTranslation()
  const [saved, setSaved] = useState(false)
  const [daySentences, setDaySentences] = useState<Sentence[]>([])
  const [dayVocab, setDayVocab] = useState<Vocab[]>([])
  const [extraSentences, setExtraSentences] = useState<Sentence[]>([])
  const [extraVocab, setExtraVocab] = useState<Vocab[]>([])

  const monthKey = `${cursor.year}-${pad(cursor.month + 1)}`
  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor.year, cursor.month])
  const today = stats?.today ?? ''

  async function loadDates(month: string) {
    setWritten(new Set(await api.diaryDates(month)))
  }

  async function loadDay(date: string) {
    const d = await api.diary(date)
    setEntry(d)
    setPair({ jp: d.jpKana, ko: d.koNote })
    setSaved(false)
  }

  async function loadHints(date: string) {
    const [sameDaySentences, allSentences, sameDayVocab, allVocab] = await Promise.all([
      api.sentences({ date }),
      api.sentences(),
      api.vocab({ date }),
      api.vocab(),
    ])
    setDaySentences(sameDaySentences)
    setDayVocab(sameDayVocab)
    setExtraSentences(
      shuffle(allSentences.filter((item) => item.createdOn !== date)).slice(0, 3),
    )
    setExtraVocab(shuffle(allVocab.filter((item) => item.createdOn !== date)).slice(0, 4))
  }

  function insertSentence(sentence: Sentence) {
    setPair({
      jp: joinLine(jpKana, sentence.jpKana),
      ko: joinLine(koNote, sentence.koText),
    })
  }

  function insertVocab(item: Vocab) {
    const jp = item.reading.trim() || item.surface
    setPair({
      jp: joinLine(jpKana, jp),
      ko: joinLine(koNote, item.koMeaning),
    })
  }

  useEffect(() => {
    void (async () => {
      const s = await api.stats()
      setStats(s)
      const { year, month } = parseYmd(s.today)
      setCursor({ year, month })
      setSelected(s.today)
      await Promise.all([loadDay(s.today), loadHints(s.today)])
    })()
  }, [])

  useEffect(() => {
    void loadDates(monthKey).catch(() => setWritten(new Set()))
  }, [monthKey])

  async function openDate(date: string) {
    const { year, month } = parseYmd(date)
    setCursor({ year, month })
    setSelected(date)
    await Promise.all([loadDay(date), loadHints(date)])
  }

  async function save() {
    if (!selected) return
    const next = await api.saveDiary(selected, { jpKana, koNote })
    setEntry(next)
    setSaved(true)
    const hasText = Boolean(jpKana.trim() || koNote.trim())
    setWritten((prev) => {
      const nextSet = new Set(prev)
      if (hasText) nextSet.add(selected)
      else nextSet.delete(selected)
      return nextSet
    })
    window.setTimeout(() => setSaved(false), 1200)
  }

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="section-title kicker">diary</p>
        <button type="button" className="quiet-link" onClick={() => speakJapanese(jpKana)}>
          listen
        </button>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-baseline justify-between">
          <button type="button" className="quiet-link" onClick={() => shiftMonth(-1)}>
            prev
          </button>
          <p className="font-ui text-[13px] tracking-[0.16em] lowercase">
            {MONTHS[cursor.month]} {cursor.year}
          </p>
          <button type="button" className="quiet-link" onClick={() => shiftMonth(1)}>
            next
          </button>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((day) => (
            <p key={day} className="cal-weekday">
              {day}
            </p>
          ))}
          {cells.map((cell) => {
            const isToday = cell.date === today
            const isWritten = written.has(cell.date)
            const isSelected = cell.date === selected
            return (
              <button
                key={cell.date}
                type="button"
                className={`cal-day${isToday ? ' is-today' : ''}${isWritten && !isToday ? ' is-written' : ''}${
                  isSelected ? ' is-selected' : ''
                }${cell.muted ? ' is-muted' : ''}`}
                onClick={() => void openDate(cell.date)}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
        <p className="meta mt-4">
          오늘 날짜는 하얀 동그라미, 일기를 쓴 날은 하얀 테두리입니다. 날짜를 누르면 그날 일기가 열립니다.
        </p>
      </div>

      <p className="meta mt-8">{selected}</p>
      <section className="mt-6">
        <p className="step-label">추천</p>
        <p className="meta mt-1">
          저장해 둔 문장과 단어입니다. 누르면 아래 일기 칸에 넣습니다.
        </p>
        {daySentences.length === 0 &&
          dayVocab.length === 0 &&
          extraSentences.length === 0 &&
          extraVocab.length === 0 && (
            <p className="meta mt-4">아직 저장한 문장이나 단어가 없습니다.</p>
          )}
        {daySentences.length > 0 && (
          <div className="mt-4">
            <p className="label">그날 문장</p>
            {daySentences.map((sentence) => (
              <button
                key={`day-s-${sentence.id}`}
                type="button"
                className="paper-card block w-full text-left"
                onClick={() => insertSentence(sentence)}
              >
                <p className="font-jp text-[1.05rem] leading-relaxed tracking-wide">{sentence.jpKana}</p>
                <p className="meta mt-1">{sentence.koText}</p>
              </button>
            ))}
          </div>
        )}
        {dayVocab.length > 0 && (
          <div className="mt-4">
            <p className="label">그날 단어</p>
            {dayVocab.map((item) => (
              <button
                key={`day-v-${item.id}`}
                type="button"
                className="paper-card block w-full text-left"
                onClick={() => insertVocab(item)}
              >
                <p className="font-jp text-[1.05rem] tracking-wide">{item.reading.trim() || item.surface}</p>
                <p className="meta mt-1">{item.koMeaning || item.romaji}</p>
              </button>
            ))}
          </div>
        )}
        {(extraSentences.length > 0 || extraVocab.length > 0) && (
          <div className="mt-4">
            <p className="label">{daySentences.length || dayVocab.length ? '다른 날에서' : '저장해 둔 것에서'}</p>
            {extraSentences.map((sentence) => (
              <button
                key={`extra-s-${sentence.id}`}
                type="button"
                className="paper-card block w-full text-left"
                onClick={() => insertSentence(sentence)}
              >
                <p className="font-jp text-[1.05rem] leading-relaxed tracking-wide">{sentence.jpKana}</p>
                <p className="meta mt-1">{sentence.koText}</p>
              </button>
            ))}
            {extraVocab.map((item) => (
              <button
                key={`extra-v-${item.id}`}
                type="button"
                className="paper-card block w-full text-left"
                onClick={() => insertVocab(item)}
              >
                <p className="font-jp text-[1.05rem] tracking-wide">{item.reading.trim() || item.surface}</p>
                <p className="meta mt-1">{item.koMeaning || item.romaji}</p>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="mt-10 space-y-6">
        <label className="block">
          <span className="label">일본어</span>
          <JapaneseTextarea
            lined
            value={jpKana}
            onChange={(e) => onJpChange(e.target.value)}
            placeholder="きょうは …"
          />
          <span className="meta mt-2 block">
            {status === 'to-jp'
              ? '한글을 일본어로 맞추는 중입니다.'
              : status === 'to-ko'
                ? '일본어를 한글로 맞추는 중입니다.'
                : '직접 적은 칸은 그대로 두고, 비어 있거나 자동으로 넣은 칸만 맞춥니다.'}
          </span>
        </label>
        <label className="block">
          <span className="label">한글</span>
          <textarea
            className="ink-input min-h-[5rem]"
            value={koNote}
            onChange={(e) => onKoChange(e.target.value)}
            placeholder="오늘 지갑을 놓고 나왔다."
          />
        </label>
        <button type="button" className="ink-btn" onClick={() => void save()}>
          {saved ? 'saved' : 'save'}
        </button>
        {entry?.correctionJson && <p className="meta">첨삭 결과가 있습니다.</p>}
      </section>
    </div>
  )
}
