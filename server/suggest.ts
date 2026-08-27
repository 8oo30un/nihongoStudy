import { toHiragana } from 'wanakana'
import { analyzeJapanese } from '../src/lib/analyze.ts'
import { db } from './db.ts'

const COMMON: Record<string, string> = {
  する: '하다',
  ある: '있다',
  いる: '있다',
  なる: '되다',
  いく: '가다',
  行く: '가다',
  くる: '오다',
  来る: '오다',
  みる: '보다',
  見る: '보다',
  きく: '듣다',
  いう: '말하다',
  言う: '말하다',
  たべる: '먹다',
  のむ: '마시다',
  よむ: '읽다',
  かく: '쓰다',
  かう: '사다',
  つくる: '만들다',
  わかる: '알다',
  できる: '할 수 있다',
  ねる: '자다',
  おきる: '일어나다',
  あさ: '아침',
  朝: '아침',
  はれ: '맑다',
  晴れ: '맑다',
  ひる: '낮',
  ばん: '저녁',
  よる: '밤',
  きょう: '오늘',
  あした: '내일',
  きのう: '어제',
  いま: '지금',
  ひと: '사람',
  わたし: '나',
  これ: '이것',
  それ: '그것',
  あれ: '저것',
  ここ: '여기',
  なに: '무엇',
  どこ: '어디',
  だれ: '누구',
  わすれる: '잊다',
  忘れる: '잊다',
  さいふ: '지갑',
  財布: '지갑',
  コーディネート: '코디하다',
  コーデイネート: '코디하다',
}

type JishoWord = {
  word?: string
  reading?: string
}

type JishoEntry = {
  slug?: string
  is_common?: boolean
  japanese: JishoWord[]
  senses: { english_definitions: string[] }[]
}

export type MeaningSuggest = {
  query: string
  primary: string
  alternatives: string[]
  source: 'cache' | 'common' | 'jisho' | 'mt' | ''
}

db.exec(`
CREATE TABLE IF NOT EXISTS meaning_cache (
  query TEXT PRIMARY KEY,
  ko_meaning TEXT NOT NULL,
  source TEXT NOT NULL
);
`)

function lookupCache(query: string) {
  return db.prepare('SELECT ko_meaning, source FROM meaning_cache WHERE query = ?').get(query) as
    | { ko_meaning: string; source: string }
    | undefined
}

function saveCache(query: string, koMeaning: string, source: string) {
  db.prepare(
    `INSERT INTO meaning_cache (query, ko_meaning, source) VALUES (?, ?, ?)
     ON CONFLICT(query) DO UPDATE SET ko_meaning = excluded.ko_meaning, source = excluded.source`,
  ).run(query, koMeaning, source)
}

function queryKeys(surface: string) {
  const trimmed = surface.trim()
  const keys = [trimmed]
  const swapped = trimmed.replaceAll('デイ', 'ディ').replaceAll('テイ', 'ティ')
  if (swapped !== trimmed) keys.push(swapped)
  const hira = toHiragana(trimmed)
  if (hira && !keys.includes(hira)) keys.push(hira)
  return keys
}

function commonMeaning(surface: string) {
  for (const key of queryKeys(surface)) {
    if (COMMON[key]) return COMMON[key]
    const hira = toHiragana(key)
    if (COMMON[hira]) return COMMON[hira]
  }
  return ''
}

function uniqueMeanings(values: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const parts = raw
      .split(/[,;/·|]+/)
      .map((part) => part.trim())
      .filter(Boolean)
    for (const part of parts) {
      if (seen.has(part)) continue
      seen.add(part)
      out.push(part)
    }
  }
  return out
}

function looksKorean(text: string) {
  return /[가-힣]/.test(text)
}

function cleanupKo(text: string, english: string) {
  let next = text.trim()
  if (!next) return ''
  if (!looksKorean(next)) return ''
  if (next.endsWith('일') && !/day/i.test(english) && next.length > 1) {
    next = next.slice(0, -1)
  }
  return uniqueMeanings([next]).join(', ')
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'nihongo-study/0.1' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function translateEnKo(english: string) {
  const q = english.trim()
  if (!q) return ''
  const data = await fetchJson<{ responseData?: { translatedText?: string } }>(
    `https://api.mymemory.translated.net/get?${new URLSearchParams({ q, langpair: 'en|ko' })}`,
  )
  return cleanupKo(data?.responseData?.translatedText ?? '', q)
}

async function translateJaKo(japanese: string) {
  const data = await fetchJson<{ responseData?: { translatedText?: string } }>(
    `https://api.mymemory.translated.net/get?${new URLSearchParams({ q: japanese, langpair: 'ja|ko' })}`,
  )
  return cleanupKo(data?.responseData?.translatedText ?? '', '')
}

function pickJishoEntry(entries: JishoEntry[], surface: string) {
  const wanted = new Set(queryKeys(surface).map((key) => toHiragana(key)))
  const scored = entries.flatMap((entry) =>
    entry.japanese.map((jp) => {
      const reading = toHiragana(jp.reading || jp.word || '')
      const exact = wanted.has(reading) || wanted.has(toHiragana(jp.word || ''))
      return { entry, jp, exact, common: Boolean(entry.is_common), len: reading.length }
    }),
  )
  scored.sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.common) - Number(a.common) || a.len - b.len)
  return scored[0]
}

function pickGlosses(senses: { english_definitions: string[] }[]) {
  const preferred = senses.find((sense) =>
    sense.english_definitions.some((def) => /clothes|clothing|outfit|accessories|garment/i.test(def)),
  )
  return (preferred ?? senses[0])?.english_definitions ?? []
}

async function lookupViaJisho(surface: string) {
  for (const keyword of queryKeys(surface)) {
    const data = await fetchJson<{ data?: JishoEntry[] }>(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`,
    )
    const entries = data?.data ?? []
    if (!entries.length) continue
    const picked = pickJishoEntry(entries, surface) ?? {
      entry: entries[0],
      jp: entries[0].japanese[0],
      exact: false,
      common: Boolean(entries[0].is_common),
      len: 0,
    }
    const glosses = pickGlosses(picked.entry.senses)
    if (!glosses.length) continue
    const english = glosses[0].replace(/\(.*?\)/g, '').trim()
    const fromEn = await translateEnKo(english)
    if (fromEn) return fromEn
    const headword = picked.jp.word || picked.jp.reading || keyword
    const fromJa = await translateJaKo(headword)
    if (fromJa) return fromJa
  }
  return ''
}

export async function suggestMeaning(surface: string): Promise<MeaningSuggest> {
  const query = surface.trim()
  if (!query) return { query, primary: '', alternatives: [], source: '' }

  const cached = lookupCache(query)
  if (cached?.ko_meaning) {
    return {
      query,
      primary: cached.ko_meaning,
      alternatives: uniqueMeanings([cached.ko_meaning]),
      source: (cached.source as MeaningSuggest['source']) || 'cache',
    }
  }

  const fromCommon = commonMeaning(query)
  if (fromCommon) {
    saveCache(query, fromCommon, 'common')
    return { query, primary: fromCommon, alternatives: [fromCommon], source: 'common' }
  }

  const fromJisho = await lookupViaJisho(query)
  if (fromJisho) {
    saveCache(query, fromJisho, 'jisho')
    return { query, primary: fromJisho, alternatives: uniqueMeanings([fromJisho]), source: 'jisho' }
  }

  return { query, primary: '', alternatives: [], source: '' }
}

function sentenceKey(query: string) {
  return `s:${query}`
}

export async function suggestSentence(text: string): Promise<MeaningSuggest> {
  const query = text.trim()
  if (!query || !/[\u3040-\u30ff\u4e00-\u9faf]/.test(query)) {
    return { query, primary: '', alternatives: [], source: '' }
  }

  const cacheId = sentenceKey(query)
  const cached = lookupCache(cacheId)
  if (cached?.ko_meaning) {
    return {
      query,
      primary: cached.ko_meaning,
      alternatives: uniqueMeanings([cached.ko_meaning]),
      source: (cached.source as MeaningSuggest['source']) || 'cache',
    }
  }

  const words = analyzeJapanese(query)
  const parts = (
    await Promise.all(words.map((word) => suggestMeaning(word.surface)))
  )
    .map((item) => item.primary.trim())
    .filter(Boolean)
  const joined: string[] = []
  for (const part of parts) {
    if (part === '하다' && joined.at(-1)?.endsWith('하다')) continue
    joined.push(part)
  }
  const fromWords = joined.join(' ').trim()
  if (fromWords) {
    saveCache(cacheId, fromWords, 'jisho')
    return { query, primary: fromWords, alternatives: uniqueMeanings([fromWords]), source: 'jisho' }
  }

  const stripped = query.replace(/[。、！？!?.,]+/g, ' ').replace(/\s+/g, ' ').trim()
  const ko = (await translateJaKo(stripped)) || (await translateJaKo(query))
  if (ko) {
    saveCache(cacheId, ko, 'mt')
    return { query, primary: ko, alternatives: uniqueMeanings([ko]), source: 'mt' }
  }

  return { query, primary: '', alternatives: [], source: '' }
}
