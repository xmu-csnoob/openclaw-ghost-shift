import { Suspense, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { i18n } from '../content/i18n.js'
import { Modal } from './Modal.js'

interface AppShellProps {
  children: ReactNode
  showSettings?: boolean
  onToggleSettings?: () => void
}

const routeLabels: Record<string, string> = {
  '/': '首页',
  '/live': i18n.nav.live,
  '/replay': i18n.nav.replay,
  '/embed': i18n.nav.embed,
  '/embed/card': '卡片',
  '/docs': i18n.nav.docs,
  '/about': i18n.nav.about,
}

const navLinks = [
  { to: '/', label: '首页' },
  { to: '/live', label: i18n.nav.live },
  { to: '/replay', label: i18n.nav.replay },
  { to: '/embed', label: i18n.nav.embed },
  { to: '/docs', label: i18n.nav.docs },
  { to: '/about', label: i18n.nav.about },
]

function Breadcrumbs() {
  const location = useLocation()
  const path = location.pathname

  const parts = path.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = [{ label: '首页', path: '/' }]

  let currentPath = ''
  for (const part of parts) {
    currentPath += '/' + part
    const label = routeLabels[currentPath] || part
    crumbs.push({ label, path: currentPath })
  }

  if (crumbs.length <= 1) return null

  return (
    <nav className="gs-breadcrumbs" aria-label="Breadcrumbs">
      {crumbs.map((crumb, index) => (
        <span key={crumb.path}>
          {index > 0 && <span className="gs-breadcrumbs__separator">/</span>}
          {index < crumbs.length - 1 ? (
            <Link to={crumb.path} className="gs-breadcrumbs__link">
              {crumb.label}
            </Link>
          ) : (
            <span className="gs-breadcrumbs__current">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

export function AppShell({ children, showSettings = false, onToggleSettings }: AppShellProps) {
  const location = useLocation()
  const [localShowSettings, setLocalShowSettings] = useState(false)
  
  // 使用外部状态（如果提供）或本地状态
  const isSettingsOpen = onToggleSettings ? showSettings : localShowSettings
  const handleToggleSettings = onToggleSettings || (() => setLocalShowSettings(!localShowSettings))

  return (
    <div className="gs-router-shell">
      <header className="gs-app-nav">
        <Link to="/" className="gs-app-nav__brand">
          <div className="gs-app-nav__logo">GS</div>
          <div>
            <div className="gs-app-nav__title">{i18n.brand.en}</div>
            <div className="gs-app-nav__subtitle">{i18n.brand.tagline}</div>
          </div>
        </Link>
        <nav className="gs-app-nav__links">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`gs-app-nav__link ${location.pathname === link.to ? 'is-active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className={`gs-settings-icon ${isSettingsOpen ? 'is-active' : ''}`}
          onClick={handleToggleSettings}
          aria-label="设置"
          title="打开设置"
        >
          ⚙️
        </button>
      </header>
      <Breadcrumbs />
      <main className="gs-route-transition">
        <Suspense
          fallback={
            <div className="gs-route-loading">{i18n.common.loading}</div>
          }
        >
          {children}
        </Suspense>
      </main>
      
      {/* 设置 Modal 占位符 - 内容由 GhostShiftSurface 提供 */}
      {isSettingsOpen && (
        <Modal
          isOpen={isSettingsOpen}
          onClose={handleToggleSettings}
          title="设置"
        >
          <div style={{ padding: '20px 0', color: 'var(--gs-text-dim)' }}>
            设置内容正在加载...
          </div>
        </Modal>
      )}
    </div>
  )
}
