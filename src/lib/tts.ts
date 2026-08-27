function pickJapaneseVoice() {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang.startsWith('ja') && /kyoko|otoya|google/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('ja')) ??
    null
  )
}

export function speakJapanese(text: string) {
  const trimmed = text.trim()
  if (!trimmed || typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(trimmed)
  utter.lang = 'ja-JP'
  const voice = pickJapaneseVoice()
  if (voice) utter.voice = voice
  utter.rate = 0.92
  window.speechSynthesis.speak(utter)
}

export function stopSpeaking() {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

if (typeof window !== 'undefined') {
  window.speechSynthesis?.addEventListener('voiceschanged', () => {
    pickJapaneseVoice()
  })
}
