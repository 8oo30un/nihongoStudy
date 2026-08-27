import type { Category, DiaryEntry, MeaningSuggest, Sentence, Settings, TodayStats, Vocab } from '../types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  stats: () => request<TodayStats>('/api/stats'),
  settings: () => request<Settings>('/api/settings'),
  saveSettings: (body: Partial<Settings>) =>
    request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  categories: () => request<Category[]>('/api/categories'),
  addCategory: (name: string, emoji?: string) =>
    request<Category>('/api/categories', { method: 'POST', body: JSON.stringify({ name, emoji }) }),
  sentences: (query: { date?: string; categoryId?: number; due?: string } = {}) => {
    const params = new URLSearchParams()
    if (query.date) params.set('date', query.date)
    if (query.categoryId) params.set('categoryId', String(query.categoryId))
    if (query.due) params.set('due', query.due)
    const qs = params.toString()
    return request<Sentence[]>(`/api/sentences${qs ? `?${qs}` : ''}`)
  },
  addSentence: (body: {
    jpKana: string
    jpKanji?: string | null
    koText: string
    categoryId: number
  }) => request<Sentence>('/api/sentences', { method: 'POST', body: JSON.stringify(body) }),
  patchSentence: (
    id: number,
    body: Partial<{
      jpKana: string
      jpKanji: string | null
      koText: string
      keywords: string
      categoryId: number
      selfMark: Sentence['selfMark']
    }>,
  ) => request<Sentence>(`/api/sentences/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSentence: (id: number) => request<{ ok: boolean }>(`/api/sentences/${id}`, { method: 'DELETE' }),
  search: (q: string) => request<Sentence[]>(`/api/search?q=${encodeURIComponent(q)}`),
  diary: (date: string) => request<DiaryEntry>(`/api/diary/${date}`),
  saveDiary: (date: string, body: { jpKana: string; jpKanji?: string | null; koNote: string }) =>
    request<DiaryEntry>(`/api/diary/${date}`, { method: 'PUT', body: JSON.stringify(body) }),
  vocab: (q?: string) =>
    request<Vocab[]>(`/api/vocab${q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`),
  addVocab: (body: {
    surface: string
    reading?: string
    romaji: string
    koMeaning?: string
    contextKo?: string
    contextJp?: string
    sourceSentenceId?: number | null
  }) => request<Vocab>('/api/vocab', { method: 'POST', body: JSON.stringify(body) }),
  patchVocab: (id: number, body: { koMeaning: string }) =>
    request<Vocab>(`/api/vocab/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteVocab: (id: number) => request<{ ok: boolean }>(`/api/vocab/${id}`, { method: 'DELETE' }),
  suggest: (q: string, kind?: 'sentence') =>
    request<MeaningSuggest>(
      `/api/suggest?q=${encodeURIComponent(q)}${kind === 'sentence' ? '&kind=sentence' : ''}`,
    ),
}
