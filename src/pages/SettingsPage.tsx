import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Settings } from '../types'

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [goal, setGoal] = useState(5)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void api.settings().then((s) => {
      setSettings(s)
      setGoal(s.dailySentenceGoal)
    })
  }, [])

  async function save() {
    const next = await api.saveSettings({ dailySentenceGoal: goal })
    setSettings(next)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1200)
  }

  return (
    <div>
      <p className="section-title kicker">setting</p>
      <section className="mt-8 space-y-6">
        <label className="block">
          <span className="label">daily sentences</span>
          <input
            type="number"
            min={1}
            max={20}
            className="ink-input"
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
          />
        </label>
        <p className="meta">
          음성은 맥/폰의 일본어 보이스(Web Speech)로 읽습니다. piper-plus는 다음에 같은 버튼에 연결합니다.
        </p>
        <p className="meta">
          데이터는 <span className="font-ui tracking-wide">data/nihongo.db</span> 에 저장됩니다.
        </p>
        <button type="button" className="ink-btn" onClick={() => void save()}>
          {saved ? 'saved' : 'save'}
        </button>
      </section>
      {settings && <p className="meta mt-8">{settings.timezone}</p>}
      <section className="mt-12 border-t border-white/20 pt-8">
        <p className="font-ui text-[13px] tracking-[0.16em] lowercase">app view</p>
        <p className="meta mt-3">
          아이폰 사파리에서 공유 → 홈 화면에 추가. 주소창 없이 열립니다.
        </p>
      </section>
    </div>
  )
}
