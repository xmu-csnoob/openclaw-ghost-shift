import type { TranslatableText } from '../../content/locale.js'
import { useT } from '../../content/locale.js'

export interface GhostShiftFeatureCard {
  icon: string
  title: TranslatableText
  body: TranslatableText
}

interface FeatureCardsProps {
  items: GhostShiftFeatureCard[]
}

export function FeatureCards({ items }: FeatureCardsProps) {
  const tt = useT()

  return (
    <div className="gs-feature-cards">
      {items.map((item) => (
        <article
          key={`${item.icon}-${typeof item.title === 'string' ? item.title : item.title.en}`}
          className="gs-feature-card"
        >
          <div className="gs-feature-card__icon" aria-hidden="true">{item.icon}</div>
          <h3>{tt(item.title)}</h3>
          <p>{tt(item.body)}</p>
        </article>
      ))}
    </div>
  )
}
