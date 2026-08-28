import { toKana } from 'wanakana'

export const DAKUTEN: Record<string, string> = {
  か: 'が',
  き: 'ぎ',
  く: 'ぐ',
  け: 'げ',
  こ: 'ご',
  さ: 'ざ',
  し: 'じ',
  す: 'ず',
  せ: 'ぜ',
  そ: 'ぞ',
  た: 'だ',
  ち: 'ぢ',
  つ: 'づ',
  て: 'で',
  と: 'ど',
  は: 'ば',
  ひ: 'び',
  ふ: 'ぶ',
  へ: 'べ',
  ほ: 'ぼ',
  う: 'ゔ',
  カ: 'ガ',
  キ: 'ギ',
  ク: 'グ',
  ケ: 'ゲ',
  コ: 'ゴ',
  サ: 'ザ',
  シ: 'ジ',
  ス: 'ズ',
  セ: 'ゼ',
  ソ: 'ゾ',
  タ: 'ダ',
  チ: 'ヂ',
  ツ: 'ヅ',
  テ: 'デ',
  ト: 'ド',
  ハ: 'バ',
  ヒ: 'ビ',
  フ: 'ブ',
  ヘ: 'ベ',
  ホ: 'ボ',
  ウ: 'ヴ',
}

export const HANDAKUTEN: Record<string, string> = {
  は: 'ぱ',
  ひ: 'ぴ',
  ふ: 'ぷ',
  へ: 'ぺ',
  ほ: 'ぽ',
  ば: 'ぱ',
  び: 'ぴ',
  ぶ: 'ぷ',
  べ: 'ぺ',
  ぼ: 'ぽ',
  ハ: 'パ',
  ヒ: 'ピ',
  フ: 'プ',
  ヘ: 'ペ',
  ホ: 'ポ',
  バ: 'パ',
  ビ: 'ピ',
  ブ: 'プ',
  ベ: 'ペ',
  ボ: 'ポ',
}

export const SMALL: Record<string, string> = {
  あ: 'ぁ',
  い: 'ぃ',
  う: 'ぅ',
  え: 'ぇ',
  お: 'ぉ',
  や: 'ゃ',
  ゆ: 'ゅ',
  よ: 'ょ',
  つ: 'っ',
  わ: 'ゎ',
  ア: 'ァ',
  イ: 'ィ',
  ウ: 'ゥ',
  エ: 'ェ',
  オ: 'ォ',
  ヤ: 'ャ',
  ユ: 'ュ',
  ヨ: 'ョ',
  ツ: 'ッ',
  ワ: 'ヮ',
  か: 'ヵ',
  け: 'ヶ',
}

/** 가로 10키 (あ행이 세로). 화면을 덜 가린다. */
export const GOJUON = [
  ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ'],
  ['い', 'き', 'し', 'ち', 'に', 'ひ', 'み', '', 'り', 'を'],
  ['う', 'く', 'す', 'つ', 'ぬ', 'ふ', 'む', 'ゆ', 'る', 'ん'],
  ['え', 'け', 'せ', 'て', 'ね', 'へ', 'め', '', 'れ', ''],
  ['お', 'こ', 'そ', 'と', 'の', 'ほ', 'も', 'よ', 'ろ', 'ー'],
] as const

export function toKatakanaChar(kana: string) {
  return kana.replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
}

const ROMAJI_TAIL = /[a-zA-Z'\-]+$/

/** 지금 치는 로마자만 가나로 바꾼다. 이미 적은 히라가나·가타카나는 그대로 둔다. */
export function applyImeKana(beforeCursor: string, inserted = '', katakana = false) {
  const match = beforeCursor.match(ROMAJI_TAIL)
  const committed = match ? beforeCursor.slice(0, -match[0].length) : beforeCursor
  const pending = (match ? match[0] : '') + inserted
  if (!pending) return committed
  return committed + toKana(pending, { IMEMode: katakana ? 'toKatakana' : true })
}

export function applyMap(text: string, table: Record<string, string>) {
  if (!text) return text
  const last = text.at(-1)!
  const next = table[last]
  if (!next) return text
  return text.slice(0, -1) + next
}
