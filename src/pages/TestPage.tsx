import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { speakJapanese } from '../lib/tts'
import type { QuizGrade, QuizQuestion } from '../types'

type Missed = {
  prompt: string
  answer: string
  choice: string
  missCount: number
}

type QuizScope = 'all' | 'today-sentences'

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 15
  return Math.min(30, Math.max(1, Math.round(value)))
}

export function TestPage() {
  const [searchParams] = useSearchParams()
  const preferToday = searchParams.get('scope') === 'today'
  const [questionCount, setQuestionCount] = useState(15)
  const [scope, setScope] = useState<QuizScope>(preferToday ? 'today-sentences' : 'all')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState('')
  const [grade, setGrade] = useState<QuizGrade | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [missed, setMissed] = useState<Missed[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const current = questions[index]
  const done = questions.length > 0 && index >= questions.length

  async function start(nextScope: QuizScope = scope) {
    const count = clampCount(questionCount)
    setQuestionCount(count)
    setScope(nextScope)
    setError('')
    setLoading(true)
    try {
      const { questions: next } = await api.quiz(count, nextScope)
      if (!next.length) {
        setQuestions([])
        setError(
          nextScope === 'today-sentences'
            ? '오늘 저장한 문장이 없거나, 보기를 만들 다른 문장이 없습니다.'
            : '문장이나 단어를 적어도 두 개 이상 적어 주세요. 보기를 만들 재료가 없습니다.',
        )
        return
      }
      setQuestions(next)
      setIndex(0)
      setPicked('')
      setGrade(null)
      setCorrectCount(0)
      setMissed([])
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제를 만들지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function choose(choice: string) {
    if (!current || grade) return
    setPicked(choice)
    const result = await api.gradeQuiz({
      kind: current.kind,
      itemId: current.itemId,
      direction: current.direction,
      choice,
    })
    setGrade(result)
    if (result.correct) setCorrectCount((n) => n + 1)
    else {
      setMissed((prev) => [
        ...prev,
        { prompt: current.prompt, answer: result.answer, choice, missCount: result.missCount },
      ])
    }
  }

  function next() {
    setIndex((n) => n + 1)
    setPicked('')
    setGrade(null)
  }

  if (done) {
    return (
      <div>
        <p className="section-title kicker">test</p>
        <p className="meta mt-4">
          {correctCount}/{questions.length}
        </p>
        <p className="mt-8 font-kr text-[15px] leading-relaxed text-ink/85">
          {missed.length
            ? '틀린 문항은 복습 칸에 넣었습니다. 틀린 횟수는 계속 쌓입니다.'
            : '전부 맞았습니다.'}
        </p>
        {missed.length > 0 && (
          <div className="mt-8">
            {missed.map((item) => (
              <article key={`${item.prompt}-${item.answer}-${item.choice}`} className="paper-card">
                <p className={/[\u3040-\u30ff\u4e00-\u9faf]/.test(item.prompt) ? 'font-jp text-[1.15rem]' : 'text-[15px]'}>
                  {item.prompt}
                </p>
                <p className="meta mt-2">정답 {item.answer}</p>
                <p className="meta">고른 답 {item.choice}</p>
                <p className="meta">틀린 횟수 {item.missCount}</p>
              </article>
            ))}
          </div>
        )}
        <div className="mt-10 flex flex-wrap gap-4">
          <button type="button" className="ink-btn" onClick={() => void start(scope)}>
            다시 보기
          </button>
          {missed.length > 0 && (
            <Link to="/review" className="quiet-link self-center">
              복습으로
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!current) {
    return (
      <div>
        <p className="section-title kicker">test</p>
        <p className="meta mt-4">
          적어 둔 문장과 단어로 객관식 {clampCount(questionCount)}문제를 냅니다. 시작하기는 오늘 문장을 섞고, 오늘
          학습 문장 공부하기는 오늘 저장한 문장만 냅니다.
        </p>
        <p className="mt-8 font-kr text-[15px] leading-relaxed text-ink/85">
          일본어를 보고 한글을 고르거나, 한글을 보고 일본어를 고릅니다. 틀리면 복습으로 들어가고 틀린 횟수가 남습니다.
        </p>
        <label className="mt-10 block">
          <span className="label">문제 수</span>
          <input
            type="number"
            min={1}
            max={30}
            className="ink-input"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          />
        </label>
        {error && <p className="meta mt-6">{error}</p>}
        <div className="mt-10 flex flex-col items-start gap-4">
          <button
            type="button"
            className="ink-btn"
            disabled={loading}
            onClick={() => void start('all')}
          >
            {loading && scope === 'all' ? '만드는 중' : '시작하기'}
          </button>
          <button
            type="button"
            className="ink-btn-warn"
            disabled={loading}
            onClick={() => void start('today-sentences')}
          >
            {loading && scope === 'today-sentences' ? '만드는 중' : '오늘 학습 문장 공부하기'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="section-title kicker">test</p>
      <p className="meta mt-4">
        {index + 1}/{questions.length}
        <span className="mx-2 opacity-50">/</span>
        {current.kind === 'vocab' ? '단어' : '문장'}
        {scope === 'today-sentences' && (
          <>
            <span className="mx-2 opacity-50">/</span>
            오늘 문장
          </>
        )}
      </p>
      <p
        className={`mt-10 leading-relaxed ${
          current.promptLang === 'jp' ? 'font-jp text-[1.6rem] tracking-wide' : 'text-[1.2rem]'
        }`}
      >
        {current.prompt}
      </p>
      {current.promptLang === 'jp' && (
        <button type="button" className="quiet-link mt-4" onClick={() => speakJapanese(current.prompt)}>
          listen
        </button>
      )}
      <div className="mt-8 space-y-3">
        {current.choices.map((choice) => {
          const isPicked = picked === choice
          const isAnswer = Boolean(grade && choice === grade.answer)
          const isWrongPick = Boolean(grade && isPicked && !grade.correct)
          return (
            <button
              key={choice}
              type="button"
              disabled={Boolean(grade)}
              className={`choice-btn${isAnswer ? ' is-correct' : ''}${isWrongPick ? ' is-wrong' : ''}`}
              onClick={() => void choose(choice)}
            >
              <span className={current.promptLang === 'ko' ? 'font-jp' : ''}>{choice}</span>
            </button>
          )
        })}
      </div>
      {grade && (
        <div className="mt-8">
          <p className="meta">
            {grade.correct
              ? '맞았습니다.'
              : `틀렸습니다. 복습에 넣었습니다. 틀린 횟수 ${grade.missCount}`}
          </p>
          <button type="button" className="ink-btn mt-6" onClick={next}>
            {index + 1 === questions.length ? '결과 보기' : '다음'}
          </button>
        </div>
      )}
    </div>
  )
}
