import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Category } from '../types'

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')

  async function reload() {
    setCategories(await api.categories())
  }

  useEffect(() => {
    void reload()
  }, [])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await api.addCategory(name.trim())
    setName('')
    await reload()
  }

  return (
    <div>
      <p className="section-title kicker">category</p>
      <p className="meta mt-4">워홀에서 필요한 상황을 골라 문장을 꺼냅니다.</p>
      <ul className="mt-8">
        {categories.map((cat) => (
          <li key={cat.id} className="border-b border-white/20">
            <Link
              to={`/categories/${cat.id}`}
              className="flex items-baseline justify-between py-3.5 text-ink"
            >
              <span className="font-ui text-[13px] tracking-[0.08em]">{cat.name}</span>
              <span className="meta">{cat.emoji}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form className="mt-10 flex items-end gap-4" onSubmit={(e) => void onAdd(e)}>
        <label className="block flex-1">
          <span className="label">new</span>
          <input
            className="ink-input"
            placeholder="칸 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="submit" className="ink-btn shrink-0">
          add
        </button>
      </form>
    </div>
  )
}
