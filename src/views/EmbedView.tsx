import type { ComponentProps } from 'react'
import { GhostShiftSummaryCard } from '../components/GhostShiftSummaryCard.js'
import { DocsStudioSection } from '../components/ghostShift/DocsStudioSection.js'
import './embed.css'

interface EmbedViewProps {
  page: 'embed' | 'embed-card'
  summaryCardProps: Omit<ComponentProps<typeof GhostShiftSummaryCard>, 'variant'>
  docsStudioProps: Omit<ComponentProps<typeof DocsStudioSection>, 'page'>
  shareLabel: string
  onShare: () => void
}

export function EmbedView({
  page,
  summaryCardProps,
  docsStudioProps,
  shareLabel,
  onShare,
}: EmbedViewProps) {
  if (page === 'embed-card') {
    return (
      <main className="gs-embed-shell">
        <GhostShiftSummaryCard {...summaryCardProps} variant="embed" />
      </main>
    )
  }

  return (
    <>
      <DocsStudioSection {...docsStudioProps} page="embed" />
      <button
        type="button"
        className="gs-share-fab"
        onClick={onShare}
        aria-label={shareLabel}
      >
        {shareLabel}
      </button>
    </>
  )
}
