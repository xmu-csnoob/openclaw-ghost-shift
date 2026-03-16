import { type ReactNode } from 'react'

interface BilingualTitleProps {
  zh: ReactNode
  en: ReactNode
  variant?: 'stacked' | 'inline'
  className?: string
}

export function BilingualTitle({ zh, en, variant = 'stacked', className = '' }: BilingualTitleProps) {
  const variantClass = variant === 'inline' ? 'gs-bilingual-title--inline' : ''
  return (
    <span className={`gs-bilingual-title ${variantClass} ${className}`.trim()}>
      <span className="gs-bilingual-title__zh">{zh}</span>
      <span className="gs-bilingual-title__en">{en}</span>
    </span>
  )
}
