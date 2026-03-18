interface HeaderNavigationLink {
  href: string
  label: string
  active?: boolean
}

interface HeaderNavigationAction {
  key: string
  label: string
  onClick: () => void
  active?: boolean
  ariaLabel?: string
  title?: string
}

interface HeaderNavigationProps {
  variant: 'site' | 'workspace'
  brandHref?: string
  brandName: string
  brandSubtitle?: string
  statusLabel?: string
  statusColor?: string
  statusDetail?: string
  links?: HeaderNavigationLink[]
  actions?: HeaderNavigationAction[]
}

export function HeaderNavigation({
  variant,
  brandHref = '/',
  brandName,
  brandSubtitle,
  statusLabel,
  statusColor,
  statusDetail,
  links = [],
  actions = [],
}: HeaderNavigationProps) {
  if (variant === 'workspace') {
    return (
      <header className="gs-header-nav gs-header-nav--workspace">
        <div className="gs-header-nav__status">
          {statusLabel ? (
            <>
              <span
                className="gs-header-nav__status-dot"
                style={statusColor ? { background: statusColor } : undefined}
              />
              <div className="gs-header-nav__status-copy">
                <strong data-testid="workspace-freshness-label">{statusLabel}</strong>
                {statusDetail ? <span data-testid="workspace-freshness-detail">{statusDetail}</span> : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="gs-header-nav__brand">
          <span className="gs-header-nav__logo" aria-hidden="true">GS</span>
          <div>
            <div className="gs-header-nav__title">{brandName}</div>
            {brandSubtitle ? <div className="gs-header-nav__subtitle">{brandSubtitle}</div> : null}
          </div>
        </div>

        {actions.length > 0 ? (
          <div className="gs-header-nav__actions">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={`gs-header-nav__action ${action.active ? 'is-active' : ''}`}
                onClick={action.onClick}
                aria-label={action.ariaLabel || action.label}
                title={action.title || action.ariaLabel || action.label}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>
    )
  }

  return (
    <header className="gs-header-nav gs-header-nav--site">
      <div className="gs-header-nav__brand">
        <a className="gs-header-nav__logo" href={brandHref} aria-label={brandName}>GS</a>
        <div>
          <div className="gs-header-nav__title">{brandName}</div>
          {brandSubtitle ? <div className="gs-header-nav__subtitle">{brandSubtitle}</div> : null}
        </div>
      </div>

      {links.length > 0 ? (
        <nav className="gs-header-nav__links" aria-label="Ghost Shift navigation">
          {links.map((link) => (
            <a
              key={link.href}
              className={`gs-header-nav__link ${link.active ? 'is-active' : ''}`}
              href={link.href}
              aria-current={link.active ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      ) : null}

      {actions.length > 0 ? (
        <div className="gs-header-nav__actions">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              className={`gs-header-nav__action ${action.active ? 'is-active' : ''}`}
              onClick={action.onClick}
              aria-label={action.ariaLabel || action.label}
              title={action.title || action.ariaLabel || action.label}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  )
}
