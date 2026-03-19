import { Suspense, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { i18n } from '../content/i18n/index.js'
import { setLocale, useLocale, useT } from '../content/locale.js'
import { Modal } from './Modal.js'

interface AppShellProps {
  children: ReactNode
  showSettings?: boolean
  onToggleSettings?: () => void
}

const navLinks = [
  { to: '/', labelKey: 'home' },
  { to: '/live', labelKey: 'live' },
  { to: '/replay', labelKey: 'replay' },
  { to: '/embed', labelKey: 'embed' },
  { to: '/docs', labelKey: 'docs' },
  { to: '/about', labelKey: 'about' },
]

function Breadcrumbs() {
  const location = useLocation()
  const tt = useT()
  const path = location.pathname

  const parts = path.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = [{ label: tt(i18n.nav.home), path: '/' }]

  let currentPath = ''
  for (const part of parts) {
    currentPath += '/' + part
    let label: string
    if (currentPath === '/live') label = tt(i18n.nav.live)
    else if (currentPath === '/replay') label = tt(i18n.nav.replay)
    else if (currentPath === '/embed') label = tt(i18n.nav.embed)
    else if (currentPath === '/embed/card') label = tt(i18n.nav.card)
    else if (currentPath === '/docs') label = tt(i18n.nav.docs)
    else if (currentPath === '/about') label = tt(i18n.nav.about)
    else label = part
    crumbs.push({ label, path: currentPath })
  }

  if (crumbs.length <= 1) return null

  return (
    <nav className="gs-breadcrumbs" aria-label={tt(i18n.common.breadcrumbs)}>
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
  const locale = useLocale()
  const tt = useT()

  // 使用外部状态（如果提供）或本地状态
  const isSettingsOpen = onToggleSettings ? showSettings : localShowSettings
  const handleToggleSettings = onToggleSettings || (() => setLocalShowSettings(!localShowSettings))

  return (
    <div className="gs-router-shell">
      <header className="gs-app-nav">
        <Link to="/" className="gs-app-nav__brand">
          <div className="gs-app-nav__logo">GS</div>
          <div>
            <div className="gs-app-nav__title">{tt(i18n.brand.name)}</div>
            <div className="gs-app-nav__subtitle">{tt(i18n.brand.tagline)}</div>
          </div>
        </Link>
        <nav className="gs-app-nav__links">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`gs-app-nav__link ${location.pathname === link.to ? 'is-active' : ''}`}
            >
              {tt(i18n.nav[link.labelKey as keyof typeof i18n.nav])}
            </Link>
          ))}
        </nav>
        <div className="gs-app-nav__actions">
          <button
            type="button"
            className="gs-settings-icon"
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            aria-label={locale === 'zh' ? tt(i18n.localeSwitcher.toggleToEn) : tt(i18n.localeSwitcher.toggleToZh)}
            title={locale === 'zh' ? tt(i18n.localeSwitcher.toggleToEn) : tt(i18n.localeSwitcher.toggleToZh)}
          >
            🌐 {tt(i18n.localeSwitcher.compact)}
          </button>
          <button
            type="button"
            className={`gs-settings-icon ${isSettingsOpen ? 'is-active' : ''}`}
            onClick={handleToggleSettings}
            aria-label={tt(i18n.panels.settings)}
            title={tt(i18n.panels.settings)}
          >
            ⚙️
          </button>
        </div>
      </header>
      <Breadcrumbs />
      <main className="gs-route-transition">
        <Suspense
          fallback={
            <div className="gs-route-loading">{tt(i18n.common.loading)}</div>
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
          title={tt(i18n.panels.settings)}
        >
          <div style={{ padding: '20px 0', color: 'var(--gs-text-dim)' }}>
            {tt(i18n.common.loadingSettingsContent)}
          </div>
        </Modal>
      )}
    </div>
  )
}
