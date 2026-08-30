import { useEffect, useMemo, useState } from 'react'
import { toRomaji } from 'wanakana'
import { api } from '../lib/api'
import { analyzeJapanese, toSentenceRomaji } from '../lib/analyze'
import { speakJapanese } from '../lib/tts'
import type { Sentence } from '../types'
import { JapaneseTextarea } from './JapaneseTextarea'

type WordDraft = {
  id: string
  surface: string
  meaning: string
  meaningTouched: boolean
}

export function SentenceCard({
  sentence,
  showKo = true,
  onMark,
  onDelete,
  onUpdated,
}: {
  sentence: Sentence
  showKo?: boolean
  onMark?: (mark: Sentence['selfMark']) => void
  onDelete?: () => void
  onUpdated?: (next: Sentence) => void
}) {
  const kanji = sentence.jpKanji?.trim()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editJp, setEditJp] = useState(sentence.jpKana)
  const [editKo, setEditKo] = useState(sentence.koText)
  const [editKanji, setEditKanji] = useState(sentence.jpKanji ?? '')
  const [showKanji, setShowKanji] = useState(Boolean(sentence.jpKanji?.trim()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Record<string, string>>({})
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<WordDraft[]>([])
  const [notice, setNotice] = useState('')

  function startEdit() {
    setEditJp(sentence.jpKana)
    setEditKo(sentence.koText)
    setEditKanji(sentence.jpKanji ?? '')
    setShowKanji(Boolean(sentence.jpKanji?.trim()))
    setError('')
    setEditing(true)
    setOpen(false)
  }

  async function saveEdit() {
    const jpKana = editJp.trim()
    const koText = editKo.trim()
    if (!jpKana || !koText) {
      setError('가나와 한글 뜻이 필요합니다.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const next = await api.patchSentence(sentence.id, {
        jpKana,
        koText,
        jpKanji: showKanji ? editKanji.trim() || null : sentence.jpKanji,
      })
      setEditing(false)
      onUpdated?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '문장을 고치지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const romaji = useMemo(() => toSentenceRomaji(sentence.jpKana), [sentence.jpKana])
  const words = useMemo(() => analyzeJapanese(sentence.jpKana), [sentence.jpKana])

  useEffect(() => {
    setDrafts(
      words.map((word) => ({
        id: word.key,
        surface: word.surface,
        meaning: '',
        meaningTouched: false,
      })),
    )
  }, [words])

  useEffect(() => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.meaningTouched || draft.meaning
          ? draft
          : { ...draft, meaning: suggestions[draft.id] ?? '' },
      ),
    )
  }, [suggestions])

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

  function updateDraft(index: number, patch: Partial<WordDraft>) {
    setDrafts((prev) => prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)))
  }

  function attachNext(index: number) {
    setDrafts((prev) => {
      const current = prev[index]
      const next = prev[index + 1]
      if (!current || !next) return prev
      const merged: WordDraft = {
        ...current,
        surface: `${current.surface}${next.surface}`,
        meaning: current.meaningTouched || current.meaning ? current.meaning : next.meaning,
        meaningTouched: current.meaningTouched,
      }
      return [...prev.slice(0, index), merged, ...prev.slice(index + 2)]
    })
  }

  async function addWord(draft: WordDraft) {
    const surface = draft.surface.trim()
    if (!surface) return
    setNotice('')
    try {
      const saved = await api.addVocab({
        surface,
        reading: surface,
        romaji: toRomaji(surface),
        koMeaning: draft.meaning.trim(),
        contextKo: sentence.koText,
        contextJp: sentence.jpKana,
        sourceSentenceId: sentence.id,
      })
      setSavedKeys((prev) => new Set(prev).add(`${surface}|${surface}`))
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
          {(sentence.missCount ?? 0) > 0 && (
            <>
              <span className="mx-2 opacity-50">/</span>
              틀림 {sentence.missCount}
            </>
          )}
        </p>
        <button
          type="button"
          className="quiet-link"
          onClick={() => speakJapanese(sentence.jpKanji || sentence.jpKana)}
        >
          listen
        </button>
      </div>
      {editing ? (
        <div className="space-y-4">
          <JapaneseTextarea
            value={editJp}
            onChange={(e) => setEditJp(e.target.value)}
            placeholder="きょうは はれです。"
          />
          <input
            className="ink-input"
            value={editKo}
            onChange={(e) => setEditKo(e.target.value)}
            placeholder="오늘은 맑아요."
          />
          <button type="button" className="quiet-link" onClick={() => setShowKanji((v) => !v)}>
            {showKanji ? '한자 칸 닫기' : '한자도 적어 두기'}
          </button>
          {showKanji && (
            <input
              className="ink-input font-jp"
              value={editKanji}
              onChange={(e) => setEditKanji(e.target.value)}
              placeholder="今日は晴れです。"
            />
          )}
          {error && <p className="meta">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="quiet-link" disabled={saving} onClick={() => void saveEdit()}>
              {saving ? '저장 중' : '저장'}
            </button>
            <button type="button" className="quiet-link opacity-50" onClick={() => setEditing(false)}>
              닫기
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-jp text-[1.35rem] leading-relaxed tracking-wide">{sentence.jpKana}</p>
          {kanji && kanji !== sentence.jpKana && (
            <p className="mt-1 font-jp text-[12px] tracking-wide text-ink/60">{kanji}</p>
          )}
        </>
      )}
      {showKo && !editing && (
        <div className="mt-3">
          <button type="button" className="quiet-link" onClick={() => setOpen((v) => !v)}>
            {open ? '▾ 한국어 뜻 · 로마자' : '▸ 한국어 뜻 · 로마자'}
          </button>
          {open && (
            <div className="meaning-panel mt-3">
              <p className="text-[13px] leading-relaxed text-ink/90">{sentence.koText}</p>
              <p className="mt-2 font-ui text-[12px] tracking-[0.04em] text-ink/70">{romaji}</p>
              <p className="step-label mt-5">단어장에 넣기</p>
              <p className="meta mt-1">뜻을 고치거나, 가나를 더 적은 뒤 넣으면 됩니다. 다음 어절은 붙이기로 이어 붙입니다.</p>
              <ul className="mt-3 space-y-4">
                {drafts.map((draft, index) => {
                  const key = `${draft.surface.trim()}|${draft.surface.trim()}`
                  const saved = savedKeys.has(key)
                  const loading = loadingKeys.has(draft.id)
                  return (
                    <li key={`${draft.id}-${index}`}>
                      <JapaneseTextarea
                        compact
                        value={draft.surface}
                        onChange={(e) => updateDraft(index, { surface: e.target.value })}
                        placeholder="したくする"
                        className="!min-h-[2.2rem] !text-[1.05rem] !leading-7"
                      />
                      <div className="mt-2 flex flex-wrap items-end gap-3">
                        <input
                          className="ink-input min-w-[10rem] flex-1"
                          value={draft.meaning}
                          onChange={(e) =>
                            updateDraft(index, { meaning: e.target.value, meaningTouched: true })
                          }
                          placeholder={loading ? '뜻 찾는 중' : '한글 뜻'}
                        />
                        {index < drafts.length - 1 && (
                          <button type="button" className="quiet-link" onClick={() => attachNext(index)}>
                            붙이기
                          </button>
                        )}
                        {saved ? (
                          <span className="meta">넣음</span>
                        ) : (
                          <button
                            type="button"
                            className="quiet-link"
                            disabled={loading && !draft.meaningTouched}
                            onClick={() => void addWord(draft)}
                          >
                            add
                          </button>
                        )}
                      </div>
                      <p className="meta mt-1">{toRomaji(draft.surface.trim())}</p>
                    </li>
                  )
                })}
              </ul>
              {drafts.length === 0 && (
                <p className="meta mt-3">나눌 단어가 없습니다. 가나에서 어절을 띄어 쓰면 더 잘 갈립니다.</p>
              )}
              {notice && <p className="meta mt-3">{notice}</p>}
            </div>
          )}
        </div>
      )}
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
        {!editing && (
          <button type="button" className="quiet-link" onClick={startEdit}>
            고치기
          </button>
        )}
        {onDelete && (
          <button type="button" className="quiet-link ml-auto opacity-50" onClick={onDelete}>
            delete
          </button>
        )}
      </div>
    </article>
  )
}
