import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { usePad } from '../lib/pad-context'
import { JapanesePad } from './JapanesePad'

const tabs = [
  { to: '/', label: 'today' },
  { to: '/search', label: 'search' },
  { to: '/categories', label: 'category' },
  { to: '/review', label: 'review' },
  { to: '/diary', label: 'diary' },
]

function sectionLabel(pathname: string) {
  if (pathname.startsWith('/search')) return 'search'
  if (pathname.startsWith('/categories')) return 'category'
  if (pathname.startsWith('/review')) return 'review'
  if (pathname.startsWith('/diary')) return 'diary'
  if (pathname.startsWith('/settings')) return 'setting'
  return 'today'
}

export function NotebookShell() {
  const { open } = usePad()
  const { pathname } = useLocation()
  const section = sectionLabel(pathname)

  return (
    <div className="notebook-bg min-h-dvh">
      <header className="site-header">
        <NavLink to="/" className="brand text-ink">
          にほんごノート
        </NavLink>
        <nav className="desktop-nav" aria-label="primary">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) => `desk-link ${isActive ? 'is-active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) => `desk-link ${isActive ? 'is-active' : ''}`}
          >
            setting
          </NavLink>
        </nav>
        <NavLink to="/settings" className="quiet-link mobile-setting">
          setting
        </NavLink>
      </header>

      <div
        className="page-frame"
        style={{
          paddingBottom: open
            ? 'var(--pad-open-bottom)'
            : 'var(--pad-closed-bottom)',
        }}
      >
        <aside className="side-label" aria-hidden>
          <span>{section}</span>
        </aside>
        <main className="page-main">
          <Outlet />
        </main>
      </div>

      <div className="pad-dock">
        <JapanesePad />
      </div>

      <nav className="mobile-tabbar" aria-label="mobile">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex items-center justify-center py-3 font-ui text-[10px] tracking-[0.16em] lowercase ${
                isActive ? 'text-ink' : 'text-ink/40'
              }`
            }
          >
            {({ isActive }) => (
              <span className={isActive ? 'border-b border-white pb-0.5' : 'pb-0.5'}>{tab.label}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
