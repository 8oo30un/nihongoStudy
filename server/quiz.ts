import { db, type SentenceRow, type VocabRow } from './db.js'
import { todaySeoul } from './util.js'

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

export type QuizScope = 'all' | 'today-sentences'

export async function buildQuiz(
  limit = 15,
  options: { scope?: QuizScope; timezone?: string } = {},
): Promise<QuizQuestion[]> {
  const want = Math.max(1, Math.min(30, limit))
  const today = todaySeoul(options.timezone)
  const sentences = (await db.prepare('SELECT * FROM sentence').all()) as unknown as SentenceRow[]
  const vocab = ((await db.prepare('SELECT * FROM vocab').all()) as unknown as VocabRow[]).filter(
    (row) => row.ko_meaning.trim() && (row.reading.trim() || row.surface.trim()),
  )

  const koPool = [
    ...sentences.map((row) => row.ko_text),
    ...vocab.map((row) => row.ko_meaning),
  ]
  const jpPool = [
    ...sentences.map((row) => row.jp_kana),
    ...vocab.map((row) => row.reading || row.surface),
  ]

  function questionsForSentence(row: SentenceRow): QuizQuestion[] {
    const out: QuizQuestion[] = []
    const jpKo = buildQuestion('sentence', row.id, 'jp-ko', row.jp_kana, row.ko_text, koPool)
    const koJp = buildQuestion('sentence', row.id, 'ko-jp', row.ko_text, row.jp_kana, jpPool)
    if (jpKo) out.push(jpKo)
    if (koJp) out.push(koJp)
    return out
  }

  function questionsForVocab(row: VocabRow): QuizQuestion[] {
    const out: QuizQuestion[] = []
    const jp = row.reading.trim() || row.surface.trim()
    const jpKo = buildQuestion('vocab', row.id, 'jp-ko', jp, row.ko_meaning, koPool)
    const koJp = buildQuestion('vocab', row.id, 'ko-jp', row.ko_meaning, jp, jpPool)
    if (jpKo) out.push(jpKo)
    if (koJp) out.push(koJp)
    return out
  }

  const todaySentences = shuffle(sentences.filter((row) => row.created_on === today))
  const todayVocab = shuffle(vocab.filter((row) => row.created_on === today))

  if (options.scope === 'today-sentences') {
    const picked: QuizQuestion[] = []
    const usedKeys = new Set<string>()
    for (const row of todaySentences) {
      if (picked.length >= want) break
      const pick = shuffle(questionsForSentence(row))[0]
      if (!pick) continue
      picked.push(pick)
      usedKeys.add(`${pick.kind}:${pick.itemId}:${pick.direction}`)
    }
    if (picked.length < want) {
      for (const row of todaySentences) {
        if (picked.length >= want) break
        for (const q of questionsForSentence(row)) {
          const key = `${q.kind}:${q.itemId}:${q.direction}`
          if (usedKeys.has(key)) continue
          usedKeys.add(key)
          picked.push(q)
          break
        }
      }
    }
    return shuffle(picked).slice(0, want)
  }

  // 오늘 저장한 문장은 최대 5개를 반드시 포함 (문장당 문제 1개)
  const mustHave: QuizQuestion[] = []
  const usedKeys = new Set<string>()
  for (const row of todaySentences.slice(0, 5)) {
    const pick = shuffle(questionsForSentence(row))[0]
    if (!pick) continue
    mustHave.push(pick)
    usedKeys.add(`${pick.kind}:${pick.itemId}`)
  }

  // 오늘 문장·단어가 전혀 없으면 기존 전체에서 15개
  if (mustHave.length === 0 && todayVocab.length === 0) {
    const all: QuizQuestion[] = []
    for (const row of sentences) all.push(...questionsForSentence(row))
    for (const row of vocab) all.push(...questionsForVocab(row))
    return shuffle(all).slice(0, want)
  }

  const picked: QuizQuestion[] = [...mustHave]

  // 남은 칸: 오늘 단어 우선 → 그다음 기존 문장/단어
  const todayVocabPicks: QuizQuestion[] = []
  for (const row of todayVocab) {
    if (usedKeys.has(`vocab:${row.id}`)) continue
    const pick = shuffle(questionsForVocab(row))[0]
    if (!pick) continue
    todayVocabPicks.push(pick)
    usedKeys.add(`vocab:${row.id}`)
  }

  for (const q of todayVocabPicks) {
    if (picked.length >= want) break
    picked.push(q)
  }

  if (picked.length < want) {
    const filler: QuizQuestion[] = []
    for (const row of sentences) {
      if (usedKeys.has(`sentence:${row.id}`)) continue
      filler.push(...questionsForSentence(row))
    }
    for (const row of vocab) {
      if (usedKeys.has(`vocab:${row.id}`)) continue
      filler.push(...questionsForVocab(row))
    }
    for (const q of shuffle(filler)) {
      if (picked.length >= want) break
      const key = `${q.kind}:${q.itemId}`
      if (usedKeys.has(key)) continue
      usedKeys.add(key)
      picked.push(q)
    }
  }

  return shuffle(picked).slice(0, want)
}

async function expectedAnswer(kind: QuizKind, itemId: number, direction: QuizDirection) {
  if (kind === 'sentence') {
    const row = (await db.prepare('SELECT * FROM sentence WHERE id = ?').get(itemId)) as unknown as
      | SentenceRow
      | undefined
    if (!row) return null
    return {
      answer: direction === 'jp-ko' ? row.ko_text.trim() : row.jp_kana.trim(),
      row,
      vocab: null,
    }
  }
  const row = (await db.prepare('SELECT * FROM vocab WHERE id = ?').get(itemId)) as unknown as VocabRow | undefined
  if (!row) return null
  const jp = row.reading.trim() || row.surface.trim()
  return {
    answer: direction === 'jp-ko' ? row.ko_meaning.trim() : jp,
    row: null,
    vocab: row,
  }
}

export async function gradeQuizAnswer(body: {
  kind: QuizKind
  itemId: number
  direction: QuizDirection
  choice: string
  timezone: string
}) {
  const found = await expectedAnswer(body.kind, body.itemId, body.direction)
  if (!found) return null
  const correct = found.answer === body.choice.trim()
  const today = todaySeoul(body.timezone)
  let missCount = found.row?.miss_count ?? found.vocab?.miss_count ?? 0

  if (!correct) {
    missCount += 1
    if (found.row) {
      await db
        .prepare(
          `UPDATE sentence
         SET miss_count = ?, due_on = ?, last_reviewed_on = ?, self_mark = 'wrong'
         WHERE id = ?`,
        )
        .run(missCount, today, today, body.itemId)
    } else {
      await db
        .prepare(
          `UPDATE vocab
         SET miss_count = ?, due_on = ?, last_reviewed_on = ?
         WHERE id = ?`,
        )
        .run(missCount, today, today, body.itemId)
    }
  }

  return {
    correct,
    answer: found.answer,
    missCount,
  }
}
