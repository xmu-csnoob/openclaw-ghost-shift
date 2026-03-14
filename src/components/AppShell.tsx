import { Suspense, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface AppShellProps {
  children: ReactNode
}

const routeLabels: Record<string, string> = {
  '/': 'Home',
  '/live': 'Live',
  '/replay': 'Replay',
  '/embed': 'Embed',
  '/embed/card': 'Card',
  '/docs': 'Docs',
  '/about': 'About',
}

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/live', label: 'Live' },
  { to: '/replay', label: 'Replay' },
  { to: '/embed', label: 'Embed' },
  { to: '/docs', label: 'Docs' },
  { to: '/about', label: 'About' },
]

function Breadcrumbs() {
  const location = useLocation()
  const path = location.pathname

  const parts = path.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = [{ label: 'Home', path: '/' }]

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

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()

  return (
    <div className="gs-router-shell">
      <header className="gs-app-nav">
        <Link to="/" className="gs-app-nav__brand">
          <div className="gs-app-nav__logo">GS</div>
          <div>
            <div className="gs-app-nav__title">Ghost Shift</div>
            <div className="gs-app-nav__subtitle">Real-time AI Office</div>
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
      </header>
      <Breadcrumbs />
      <main className="gs-route-transition">
        <Suspense
          fallback={
            <div className="gs-route-loading">Loading...</div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  )
}
