import { db, type SentenceRow, type VocabRow } from './db.ts'
import { todaySeoul } from './util.ts'

export type QuizKind = 'sentence' | 'vocab'
export type QuizDirection = 'jp-ko' | 'ko-jp'

export type QuizQuestion = {
  kind: QuizKind
  itemId: number
  direction: QuizDirection
  prompt: string
  promptLang: 'jp' | 'ko'
  choices: string[]
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

function distractors(pool: string[], answer: string, want: number) {
  const seen = new Set<string>()
  const unique: string[] = []
  const skip = answer.trim()
  for (const raw of pool) {
    const text = raw.trim()
    if (!text || text === skip || seen.has(text)) continue
    seen.add(text)
    unique.push(text)
  }
  return shuffle(unique).slice(0, want)
}

function buildQuestion(
  kind: QuizKind,
  itemId: number,
  direction: QuizDirection,
  prompt: string,
  answer: string,
  pool: string[],
): QuizQuestion | null {
  const promptText = prompt.trim()
  const answerText = answer.trim()
  if (!promptText || !answerText) return null
  const others = distractors(pool, answerText, 3)
  if (!others.length) return null
  return {
    kind,
    itemId,
    direction,
    prompt: promptText,
    promptLang: direction === 'jp-ko' ? 'jp' : 'ko',
    choices: shuffle([answerText, ...others]),
  }
}

export function buildQuiz(limit = 10): QuizQuestion[] {
  const sentences = db.prepare('SELECT * FROM sentence').all() as SentenceRow[]
  const vocab = (
    db.prepare('SELECT * FROM vocab').all() as VocabRow[]
  ).filter((row) => row.ko_meaning.trim() && (row.reading.trim() || row.surface.trim()))

  const koPool = [
    ...sentences.map((row) => row.ko_text),
    ...vocab.map((row) => row.ko_meaning),
  ]
  const jpPool = [
    ...sentences.map((row) => row.jp_kana),
    ...vocab.map((row) => row.reading || row.surface),
  ]

  const candidates: QuizQuestion[] = []
  for (const row of sentences) {
    const jpKo = buildQuestion('sentence', row.id, 'jp-ko', row.jp_kana, row.ko_text, koPool)
    const koJp = buildQuestion('sentence', row.id, 'ko-jp', row.ko_text, row.jp_kana, jpPool)
    if (jpKo) candidates.push(jpKo)
    if (koJp) candidates.push(koJp)
  }
  for (const row of vocab) {
    const jp = row.reading.trim() || row.surface.trim()
    const jpKo = buildQuestion('vocab', row.id, 'jp-ko', jp, row.ko_meaning, koPool)
    const koJp = buildQuestion('vocab', row.id, 'ko-jp', row.ko_meaning, jp, jpPool)
    if (jpKo) candidates.push(jpKo)
    if (koJp) candidates.push(koJp)
  }

  return shuffle(candidates).slice(0, Math.max(1, limit))
}

function expectedAnswer(kind: QuizKind, itemId: number, direction: QuizDirection) {
  if (kind === 'sentence') {
    const row = db.prepare('SELECT * FROM sentence WHERE id = ?').get(itemId) as SentenceRow | undefined
    if (!row) return null
    return {
      answer: direction === 'jp-ko' ? row.ko_text.trim() : row.jp_kana.trim(),
      row,
      vocab: null,
    }
  }
  const row = db.prepare('SELECT * FROM vocab WHERE id = ?').get(itemId) as VocabRow | undefined
  if (!row) return null
  const jp = (row.reading.trim() || row.surface.trim())
  return {
    answer: direction === 'jp-ko' ? row.ko_meaning.trim() : jp,
    row: null,
    vocab: row,
  }
}

export function gradeQuizAnswer(body: {
  kind: QuizKind
  itemId: number
  direction: QuizDirection
  choice: string
  timezone: string
}) {
  const found = expectedAnswer(body.kind, body.itemId, body.direction)
  if (!found) return null
  const correct = found.answer === body.choice.trim()
  const today = todaySeoul(body.timezone)
  let missCount = found.row?.miss_count ?? found.vocab?.miss_count ?? 0

  if (!correct) {
    missCount += 1
    if (found.row) {
      db.prepare(
        `UPDATE sentence
         SET miss_count = ?, due_on = ?, last_reviewed_on = ?, self_mark = 'wrong'
         WHERE id = ?`,
      ).run(missCount, today, today, body.itemId)
    } else {
      db.prepare(
        `UPDATE vocab
         SET miss_count = ?, due_on = ?, last_reviewed_on = ?
         WHERE id = ?`,
      ).run(missCount, today, today, body.itemId)
    }
  }

  return {
    correct,
    answer: found.answer,
    missCount,
  }
}
