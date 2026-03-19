import { documentationPoints } from '../../content/ghostShiftContent.js'
import { i18n } from '../../content/i18n/index.js'
import { useT } from '../../content/locale.js'
import type { GhostShiftSummaryCardProps } from '../GhostShiftSummaryCard.js'
import { GhostShiftSummaryCard } from '../GhostShiftSummaryCard.js'
import { Panel } from './Panel.js'

interface DocsStudioSectionProps {
  page: 'embed' | 'docs'
  embedSnippet: string
  embedCardHref: string
  liveHref: string
  summaryCardProps: GhostShiftSummaryCardProps
}

export function DocsStudioSection({
  page,
  embedSnippet,
  embedCardHref,
  liveHref,
  summaryCardProps,
}: DocsStudioSectionProps) {
  const tt = useT()

  return (
    <div className="gs-page__content">
      <section className="gs-docs-section">
        <div className="gs-docs-copy">
          <span className="gs-section-kicker">
            {page === 'embed' ? tt(i18n.docsSection.embedKicker) : tt(i18n.docsSection.docsKicker)}
          </span>
          <h2>{page === 'embed' ? tt(i18n.docsSection.embedTitle) : tt(i18n.docsSection.docsTitle)}</h2>
          <p>{page === 'embed' ? tt(i18n.docsSection.embedBody) : tt(i18n.docsSection.docsBody)}</p>
        </div>

        <div className="gs-docs-layout">
          {page === 'embed' ? (
            <GhostShiftSummaryCard {...summaryCardProps} />
          ) : (
            <Panel
              className="gs-docs-studio__panel"
              eyebrow={tt(i18n.docsSection.deploymentNotes)}
              title={tt(i18n.docsSection.keepContractNarrow)}
            >
              <ul className="gs-doc-list">
                {documentationPoints.map((point) => (
                  <li key={point.zh}>{tt(point)}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            className="gs-docs-studio__code"
            eyebrow={tt(i18n.docsSection.shareableUrls)}
            title={tt(i18n.docsSection.openCardPreview)}
          >
            <pre>
              <code>{embedSnippet}</code>
            </pre>
            <div className="gs-route-grid gs-route-grid--compact">
              <a className="gs-route-card" href={embedCardHref}>
                <span className="gs-route-card__eyebrow">{tt(i18n.docsSection.card)}</span>
                <strong>{tt(i18n.docsSection.openCardPreview)}</strong>
              </a>
              <a className="gs-route-card" href={liveHref}>
                <span className="gs-route-card__eyebrow">{tt(i18n.nav.live)}</span>
                <strong>{tt(i18n.docsSection.openLiveOffice)}</strong>
              </a>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  )
}
