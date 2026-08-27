import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { analyzeJapanese, toSentenceRomaji } from '../lib/analyze'
import { speakJapanese } from '../lib/tts'
import type { Sentence } from '../types'

export function SentenceCard({
  sentence,
  showKo = true,
  onMark,
  onDelete,
}: {
  sentence: Sentence
  showKo?: boolean
  onMark?: (mark: Sentence['selfMark']) => void
  onDelete?: () => void
}) {
  const kanji = sentence.jpKanji?.trim()
  const [open, setOpen] = useState(false)
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Record<string, string>>({})
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState('')

  const romaji = useMemo(() => toSentenceRomaji(sentence.jpKana), [sentence.jpKana])
  const words = useMemo(() => analyzeJapanese(sentence.jpKana), [sentence.jpKana])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const list = await api.vocab()
      if (cancelled) return
      const saved = new Set(list.map((item) => `${item.surface}|${item.reading}`))
      setSavedKeys(saved)
      const targets = words
      setLoadingKeys(new Set(targets.map((word) => word.key)))
      const next: Record<string, string> = {}
      await Promise.all(
        targets.map(async (word) => {
          const found = await api.suggest(word.surface)
          if (found.primary) next[word.key] = found.primary
        }),
      )
      if (cancelled) return
      setSuggestions(next)
      setLoadingKeys(new Set())
    })()
    return () => {
      cancelled = true
    }
  }, [open, words])

  async function addWord(word: { key: string; surface: string; reading: string; romaji: string }) {
    setNotice('')
    try {
      const saved = await api.addVocab({
        surface: word.surface,
        reading: word.reading,
        romaji: word.romaji,
        koMeaning: suggestions[word.key] ?? '',
        contextKo: sentence.koText,
        contextJp: sentence.jpKana,
        sourceSentenceId: sentence.id,
      })
      setSavedKeys((prev) => new Set(prev).add(word.key))
      setNotice(saved.already ? '이미 단어장에 있습니다.' : '단어장에 넣었습니다.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '단어장에 넣지 못했습니다.')
    }
  }

  return (
    <article className="paper-card">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="meta">
          {sentence.createdOn}
          <span className="mx-2 opacity-50">/</span>
          {sentence.categoryName}
        </p>
        <button
          type="button"
          className="quiet-link"
          onClick={() => speakJapanese(sentence.jpKanji || sentence.jpKana)}
        >
          listen
        </button>
      </div>
      <p className="font-jp text-[1.35rem] leading-relaxed tracking-wide">{sentence.jpKana}</p>
      {kanji && kanji !== sentence.jpKana && (
        <p className="mt-1 font-jp text-[12px] tracking-wide text-ink/60">{kanji}</p>
      )}
      {showKo && (
        <div className="mt-3">
          <button type="button" className="quiet-link" onClick={() => setOpen((v) => !v)}>
            {open ? '▾ 한국어 뜻 · 로마자' : '▸ 한국어 뜻 · 로마자'}
          </button>
          {open && (
            <div className="meaning-panel mt-3">
              <p className="text-[13px] leading-relaxed text-ink/90">{sentence.koText}</p>
              <p className="mt-2 font-ui text-[12px] tracking-[0.04em] text-ink/70">{romaji}</p>
              <p className="step-label mt-5">단어장에 넣기</p>
              <p className="meta mt-1">한글 뜻은 자동으로 찾아 줍니다. 틀리면 단어장에서 고치면 됩니다.</p>
              <ul className="mt-3 space-y-3">
                {words.map((word) => {
                  const saved = savedKeys.has(word.key)
                  const suggested = suggestions[word.key]
                  const loading = loadingKeys.has(word.key)
                  return (
                    <li key={word.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-jp text-[15px]">{word.surface}</span>
                      <span className="font-ui text-[11px] tracking-[0.04em] text-ink/60">{word.romaji}</span>
                      {loading ? (
                        <span className="meta">뜻 찾는 중</span>
                      ) : suggested ? (
                        <span className="text-[13px] text-ink/85">{suggested}</span>
                      ) : saved ? null : (
                        <span className="meta">뜻을 못 찾음</span>
                      )}
                      {saved ? (
                        <span className="meta">넣음</span>
                      ) : (
                        <button
                          type="button"
                          className="quiet-link"
                          disabled={loading}
                          onClick={() => void addWord(word)}
                        >
                          add
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              {words.length === 0 && (
                <p className="meta mt-3">나눌 단어가 없습니다. 가나에서 어절을 띄어 쓰면 더 잘 갈립니다.</p>
              )}
              {notice && <p className="meta mt-3">{notice}</p>}
            </div>
          )}
        </div>
      )}
      {(onMark || onDelete) && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {onMark && (
            <>
              <button type="button" className="quiet-link" onClick={() => onMark('ok')}>
                ok
              </button>
              <button type="button" className="quiet-link" onClick={() => onMark('wrong')}>
                again
              </button>
            </>
          )}
          {onDelete && (
            <button type="button" className="quiet-link ml-auto opacity-50" onClick={onDelete}>
              delete
            </button>
          )}
        </div>
      )}
    </article>
  )
}
