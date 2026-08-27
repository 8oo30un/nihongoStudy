import { toRomaji } from 'wanakana'

const SKIP = new Set([
  'は',
  'が',
  'を',
  'に',
  'で',
  'と',
  'も',
  'の',
  'へ',
  'や',
  'か',
  'ね',
  'よ',
  'わ',
  'さ',
  'ぞ',
  'ぜ',
  'な',
  'ん',
  'て',
  'た',
  'だ',
  'です',
  'ます',
  'でした',
  'ました',
  'ません',
])

const TAILS = [
  'ませんでした',
  'でした',
  'ました',
  'ません',
  'です',
  'ます',
  'しない',
  'します',
  'している',
  'してる',
  'から',
  'まで',
  'より',
  'する',
  'して',
  'した',
]
const INNER_PARTICLES = ['から', 'まで', 'より', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'の', 'へ', 'や']

export type AnalyzedWord = {
  key: string
  surface: string
  reading: string
  romaji: string
}

function cleanToken(token: string) {
  return token.replace(/[。、！？!?.,「」『』（）()・…\s]/g, '').trim()
}

function peel(token: string): string[] {
  const tails: string[] = []
  let rest = token
  let changed = true
  while (changed && rest) {
    changed = false
    for (const suffix of TAILS) {
      if (rest.length > suffix.length && rest.endsWith(suffix)) {
        tails.unshift(suffix)
        rest = rest.slice(0, -suffix.length)
        changed = true
        break
      }
    }
  }
  return rest ? [rest, ...tails] : tails
}

/** 맨 앞이 아닌 조사에서만 잘라, はれ 같은 단어를 조사로 오인하지 않게 한다. */
function splitByInnerParticles(text: string): string[] {
  let earliest = -1
  let matched = ''
  for (const particle of INNER_PARTICLES) {
    const index = text.indexOf(particle, 1)
    if (index === -1) continue
    if (earliest === -1 || index < earliest || (index === earliest && particle.length > matched.length)) {
      earliest = index
      matched = particle
    }
  }
  if (earliest === -1) return [text]
  const left = text.slice(0, earliest)
  const right = text.slice(earliest + matched.length)
  return [...(left ? tokenize(left) : []), matched, ...(right ? tokenize(right) : [])]
}

function tokenize(text: string): string[] {
  const peeled = peel(text)
  if (peeled.length > 1) {
    return peeled.flatMap(tokenize)
  }
  const only = peeled[0]
  if (!only) return []
  return splitByInnerParticles(only)
}

export function toSentenceRomaji(kana: string) {
  return toRomaji(kana).replace(/\s+/g, ' ').trim()
}

export function analyzeJapanese(kana: string): AnalyzedWord[] {
  const source = kana.trim()
  if (!source) return []

  const chunks = /\s/.test(source) ? source.split(/\s+/).filter(Boolean) : [source]
  const tokens = chunks.flatMap((chunk) => tokenize(cleanToken(chunk) || chunk))

  const seen = new Set<string>()
  const words: AnalyzedWord[] = []
  for (const token of tokens) {
    const surface = cleanToken(token)
    if (!surface) continue
    if (SKIP.has(surface)) continue
    if (!/[\u3040-\u30ff\u4e00-\u9faf]/.test(surface)) continue
    const romaji = toRomaji(surface)
    const key = `${surface}|${surface}`
    if (seen.has(key)) continue
    seen.add(key)
    words.push({ key, surface, reading: surface, romaji })
  }
  return words
}
