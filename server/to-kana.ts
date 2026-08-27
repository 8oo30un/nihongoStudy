import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { toHiragana } from 'wanakana'
import type { IpadicFeatures, Tokenizer } from 'kuromoji'

const require = createRequire(import.meta.url)
const kuromoji = require('kuromoji') as typeof import('kuromoji')
const dictPath = join(dirname(require.resolve('kuromoji/package.json')), 'dict')

const KANJI = /[\u4e00-\u9faf]/
const ATTACH = new Set(['助詞', '助動詞', '記号'])

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null

function hasKanji(text: string) {
  return KANJI.test(text)
}

function getTokenizer() {
  tokenizerPromise ??= new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: dictPath }).build((err, tokenizer) => {
      if (!tokenizer) {
        tokenizerPromise = null
        reject(err ?? new Error('kuromoji dictionary failed to load'))
        return
      }
      resolve(tokenizer)
    })
  })
  return tokenizerPromise
}

function tokenToKana(token: IpadicFeatures) {
  const surface = token.surface_form
  if (!hasKanji(surface)) return surface
  const raw = token.reading || token.pronunciation
  if (!raw || raw === '*') return surface
  return toHiragana(raw)
}

function tokensToKana(tokens: IpadicFeatures[]) {
  const chunks: string[] = []
  let current = ''
  for (const token of tokens) {
    const piece = tokenToKana(token)
    if (!piece.trim()) {
      if (current) {
        chunks.push(current)
        current = ''
      }
      continue
    }
    const attach =
      ATTACH.has(token.pos) || token.pos_detail_1 === '接尾' || token.pos_detail_1 === '非自立'
    if (!current || attach) current += piece
    else {
      chunks.push(current)
      current = piece
    }
  }
  if (current) chunks.push(current)
  return chunks.join(' ')
}

export async function toReadingKana(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (!hasKanji(trimmed)) return trimmed
  try {
    const tokenizer = await getTokenizer()
    return tokensToKana(tokenizer.tokenize(trimmed)).trim()
  } catch {
    return trimmed
  }
}
