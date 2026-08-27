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
