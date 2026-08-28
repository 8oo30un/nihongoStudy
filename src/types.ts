export type Category = {
  id: number
  name: string
  slug: string
  emoji: string
  sortOrder: number
}

export type SelfMark = 'unset' | 'ok' | 'wrong'

export type Sentence = {
  id: number
  jpKana: string
  jpKanji: string | null
  koText: string
  keywords: string
  categoryId: number
  categoryName?: string
  categoryEmoji?: string
  createdOn: string
  selfMark: SelfMark
  dueOn: string | null
  lastReviewedOn: string | null
  reviewCount: number
  missCount: number
}

export type DiaryEntry = {
  id: number
  date: string
  jpKana: string
  jpKanji: string | null
  koNote: string
  correctionJson: string | null
}

export type Settings = {
  dailySentenceGoal: number
  ttsEngine: 'piper' | 'web-speech'
  timezone: string
}

export type TodayStats = {
  today: string
  saved: number
  goal: number
  reviewCount: number
  diarySaved: boolean
}

export type Vocab = {
  id: number
  surface: string
  reading: string
  romaji: string
  koMeaning: string
  contextKo: string
  contextJp: string
  sourceSentenceId: number | null
  createdOn: string
  missCount: number
  dueOn: string | null
  lastReviewedOn: string | null
  already?: boolean
}

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

export type QuizGrade = {
  correct: boolean
  answer: string
  missCount: number
}

export type MeaningSuggest = {
  query: string
  primary: string
  alternatives: string[]
  source: 'cache' | 'common' | 'jisho' | 'mt' | ''
}
