import type { GhostShiftSummaryCardProps } from '../GhostShiftSummaryCard.js'
import { GhostShiftSummaryCard } from '../GhostShiftSummaryCard.js'
import type { LiveOfficeStageProps } from '../LiveOfficeStage.js'
import { LiveOfficeStage } from '../LiveOfficeStage.js'
import { i18n } from '../../content/i18n/index.js'
import { useT } from '../../content/locale.js'
import { FeatureCards, type GhostShiftFeatureCard } from './FeatureCards.js'

interface LandingShowcaseSectionProps {
  liveHref: string
  replayHref: string
  embedCardHref: string
  featureCards: GhostShiftFeatureCard[]
  stageProps: LiveOfficeStageProps
  summaryCardProps: GhostShiftSummaryCardProps
}

export function LandingShowcaseSection({
  liveHref,
  replayHref,
  embedCardHref,
  featureCards,
  stageProps,
  summaryCardProps,
}: LandingShowcaseSectionProps) {
  const tt = useT()

  return (
    <div className="gs-page__content">
      <section className="gs-landing-showcase">
        <div className="gs-landing-showcase__stage">
          <LiveOfficeStage {...stageProps} />

          <div className="gs-landing-showcase__overlay">
            <div className="gs-landing-showcase__kicker">{tt(i18n.brand.tagline)}</div>
            <h1>{tt(i18n.hero.title)}</h1>
            <p>{tt(i18n.hero.subtitle)}</p>
            <div className="gs-hero-actions">
              <a className="gs-button gs-button--primary" href={liveHref}>
                {tt(i18n.hero.cta.primary)}
              </a>
              <a className="gs-button gs-button--secondary" href={replayHref}>
                {tt(i18n.pages.replay.title)}
              </a>
            </div>
          </div>
        </div>

        <FeatureCards items={featureCards} />

        <section className="gs-embed-preview">
          <div className="gs-embed-preview__header">
            <span>{tt(i18n.landing.embedPreview)}</span>
            <a className="gs-button gs-button--secondary" href={embedCardHref}>
              {tt(i18n.landing.viewCard)}
            </a>
          </div>
          <GhostShiftSummaryCard {...summaryCardProps} />
        </section>
      </section>
    </div>
  )
}
