import { demoSidebarNotes } from '../../content/ghostShiftContent.js'
import { i18n } from '../../content/i18n.js'
import { useT } from '../../content/locale.js'
import type { GhostShiftSummaryCardProps } from '../GhostShiftSummaryCard.js'
import { GhostShiftSummaryCard } from '../GhostShiftSummaryCard.js'
import { Panel } from './Panel.js'

interface AboutOverviewSectionProps {
  landingHref: string
  liveHref: string
  replayHref: string
  embedHref: string
  docsHref: string
  aboutHref: string
  summaryCardProps: GhostShiftSummaryCardProps
}

export function AboutOverviewSection({
  landingHref,
  liveHref,
  replayHref,
  embedHref,
  docsHref,
  aboutHref,
  summaryCardProps,
}: AboutOverviewSectionProps) {
  const tt = useT()
  const heroRouteCards = [
    {
      href: liveHref,
      eyebrow: tt(i18n.pages.live.eyebrow),
      title: tt(i18n.pages.live.title),
      body: tt(i18n.pages.live.body),
    },
    {
      href: replayHref,
      eyebrow: tt(i18n.pages.replay.eyebrow),
      title: tt(i18n.pages.replay.title),
      body: tt(i18n.pages.replay.body),
    },
    {
      href: embedHref,
      eyebrow: tt(i18n.pages.embed.eyebrow),
      title: tt(i18n.pages.embed.title),
      body: tt(i18n.pages.embed.body),
    },
    {
      href: docsHref,
      eyebrow: tt(i18n.pages.docs.eyebrow),
      title: tt(i18n.pages.docs.title),
      body: tt(i18n.pages.docs.body),
    },
  ]
  const routeCards = [
    {
      href: landingHref,
      eyebrow: tt(i18n.about.home),
      title: tt(i18n.about.homeLanding),
    },
    {
      href: embedHref,
      eyebrow: tt(i18n.about.embed),
      title: tt(i18n.about.embedPreviewConfigure),
    },
    {
      href: aboutHref,
      eyebrow: tt(i18n.about.about),
      title: tt(i18n.about.aboutProductIntent),
    },
  ]

  return (
    <div className="gs-page__content">
      <section className="gs-hero gs-about-overview">
        <div className="gs-hero-copy">
          <span className="gs-kicker">{tt(i18n.about.subtitle)}</span>
          <h1>{tt(i18n.about.title)}</h1>
          <p>{tt(i18n.about.description)}</p>

          <div className="gs-hero-actions">
            <a className="gs-button gs-button--primary" href={liveHref}>
              {tt(i18n.about.exploreLive)}
            </a>
            <a className="gs-button gs-button--secondary" href={docsHref}>
              {tt(i18n.about.readDocs)}
            </a>
          </div>

          <div className="gs-route-grid">
            {heroRouteCards.map((card) => (
              <a key={card.href} className="gs-route-card" href={card.href}>
                <span className="gs-route-card__eyebrow">{card.eyebrow}</span>
                <strong>{card.title}</strong>
                <p>{card.body}</p>
              </a>
            ))}
          </div>
        </div>

        <GhostShiftSummaryCard {...summaryCardProps} />
      </section>

      <section className="gs-dashboard-section gs-about-principles">
        <div className="gs-dashboard-head">
          <div>
            <span className="gs-section-kicker">{tt(i18n.about.principlesKicker)}</span>
            <h2>{tt(i18n.about.principles.title)}</h2>
          </div>
          <p>{tt(i18n.about.description)}</p>
        </div>
        <div className="gs-demo-layout">
          <Panel
            className="gs-about-overview__panel"
            eyebrow={tt(i18n.about.whyItExists)}
            title={tt(i18n.about.safeVisibility)}
          >
            <ul className="gs-side-list">
              {demoSidebarNotes.map((note) => (
                <li key={note.zh}>{tt(note)}</li>
              ))}
            </ul>
          </Panel>

          <Panel
            className="gs-about-overview__panel"
            eyebrow={tt(i18n.about.routeMapEyebrow)}
            title={tt(i18n.about.routeMapTitle)}
          >
            <div className="gs-route-grid gs-route-grid--compact">
              {routeCards.map((card) => (
                <a key={card.href} className="gs-route-card" href={card.href}>
                  <span className="gs-route-card__eyebrow">{card.eyebrow}</span>
                  <strong>{card.title}</strong>
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  )
}
