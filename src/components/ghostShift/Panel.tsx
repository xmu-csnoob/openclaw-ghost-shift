import type { ElementType, ReactNode } from 'react'

type PanelVariant = 'side' | 'overlay'

export interface PanelProps {
  as?: ElementType
  variant?: PanelVariant
  className?: string
  eyebrow?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  bodyClassName?: string
  children: ReactNode
}

export function Panel({
  as: Tag = 'section',
  variant = 'side',
  className,
  eyebrow,
  title,
  subtitle,
  actions,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <Tag className={['gs-panel', `gs-panel--${variant}`, className].filter(Boolean).join(' ')}>
      {(eyebrow || title || subtitle || actions) ? (
        <div className="gs-panel__header">
          <div className="gs-panel__heading">
            {eyebrow ? <div className="gs-panel__eyebrow">{eyebrow}</div> : null}
            {title ? <h3 className="gs-panel__title">{title}</h3> : null}
            {subtitle ? <p className="gs-panel__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="gs-panel__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={['gs-panel__body', bodyClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </Tag>
  )
}
