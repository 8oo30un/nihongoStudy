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
      {showKo && <p className="mt-3 text-[13px] leading-relaxed text-ink/80">{sentence.koText}</p>}
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
