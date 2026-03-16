import { useEffect, useMemo, useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import type { TimelinePoint } from '../replay.js'
import type { PublicOfficeStatus } from '../services/types.js'
import { renderShareCard } from '../shareCard.js'
import type { SurfaceTheme } from '../surfaceThemes.js'
import { surfaceThemeOptions } from '../surfaceThemes.js'
import { i18n } from '../content/i18n.js'

export interface SharePanelProps {
  livePath: string
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
  timeline: TimelinePoint[]
  timestamp: number
  freshnessLabel: string
  playbackMode: 'live' | 'replay'
  windowHours: number
  theme: SurfaceTheme
  autoGeneratePreview: boolean
}

function buildShareUrl(livePath: string, playbackMode: 'live' | 'replay', timestamp: number, windowHours: number): string {
  const url = new URL(livePath, window.location.origin)
  url.searchParams.set('mode', playbackMode)
  url.searchParams.set('ts', String(timestamp))
  url.searchParams.set('window', String(windowHours))
  return url.toString()
}

function captureStagePreview(): string | null {
  const stageCanvas = document.querySelector<HTMLCanvasElement>('.gs-live-stage canvas')
  if (!stageCanvas) return null

  try {
    return stageCanvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export function SharePanel({
  livePath,
  status,
  sessions,
  timeline,
  timestamp,
  freshnessLabel,
  playbackMode,
  windowHours,
  theme,
  autoGeneratePreview,
}: SharePanelProps) {
  const [cardTheme, setCardTheme] = useState<SurfaceTheme>(theme)
  const [headline, setHeadline] = useState(i18n.share.description.split('。')[0])
  const [summary, setSummary] = useState(i18n.share.description)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [stagePreviewUrl, setStagePreviewUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const shareUrl = useMemo(
    () => buildShareUrl(livePath, playbackMode, timestamp, windowHours),
    [livePath, playbackMode, timestamp, windowHours],
  )
  const visibleCount = status?.displayed ?? sessions.length
  const runningCount = status?.running ?? sessions.filter((session) => session.status === 'running').length
  const socialCopy = useMemo(
    () => `${headline} ${freshnessLabel.toLowerCase()} with ${visibleCount} visible agents and ${runningCount} running now.`,
    [freshnessLabel, headline, runningCount, visibleCount],
  )

  useEffect(() => {
    setCardTheme(theme)
  }, [theme])

  const createPreview = () => {
    const stageCanvas = document.querySelector<HTMLCanvasElement>('.gs-live-stage canvas')
    return renderShareCard({
      stageCanvas,
      status,
      sessions,
      timeline,
      timestamp,
      freshnessLabel,
      shareUrl,
      theme: cardTheme,
      headline,
      summary,
    })
  }

  useEffect(() => {
    setStagePreviewUrl(captureStagePreview())

    if (!autoGeneratePreview) return

    try {
      setPreviewUrl(createPreview())
    } catch {
      setMessage(i18n.share.messages.previewUnavailable)
    }
  }, [
    autoGeneratePreview,
    cardTheme,
    freshnessLabel,
    headline,
    sessions,
    shareUrl,
    status,
    summary,
    timeline,
    timestamp,
  ])

  const handleGeneratePreview = () => {
    const nextPreviewUrl = createPreview()
    setPreviewUrl(nextPreviewUrl)
    setStagePreviewUrl(captureStagePreview())
    setMessage(i18n.share.messages.previewRefreshed)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setMessage(i18n.share.messages.linkCopied)
    } catch {
      setMessage(i18n.share.messages.clipboardUnavailable)
    }
  }

  const handleCopySocialCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${socialCopy}\n${shareUrl}`)
      setMessage(i18n.share.messages.socialCopyCopied)
    } catch {
      setMessage(i18n.share.messages.clipboardUnavailable)
    }
  }

  const handleDownload = () => {
    const url = previewUrl || createPreview()
    if (!previewUrl) {
      setPreviewUrl(url)
    }

    const link = document.createElement('a')
    link.href = url
    link.download = `ghost-shift-${timestamp}.png`
    link.click()
    setMessage(i18n.share.messages.pngDownloaded)
  }

  const handleShare = async () => {
    if (!navigator.share) {
      await handleCopyLink()
      return
    }

    try {
      await navigator.share({
        title: headline,
        text: socialCopy,
        url: shareUrl,
      })
      setMessage(i18n.share.messages.sharedSuccessfully)
    } catch {
      setMessage(i18n.share.messages.shareCancelled)
    }
  }

  const platformChecks = [
    { label: i18n.share.platformChecks.titleLength, value: `${headline.length}/70`, status: headline.length <= 70 ? 'is-good' : 'is-warn' },
    { label: i18n.share.platformChecks.descriptionLength, value: `${summary.length}/140`, status: summary.length <= 140 ? 'is-good' : 'is-warn' },
    { label: i18n.share.platformChecks.deepLink, value: playbackMode === 'replay' ? i18n.share.platformChecks.timestamped : i18n.share.platformChecks.liveEdge, status: 'is-neutral' },
    { label: i18n.share.platformChecks.cardRatio, value: '1200 × 630', status: 'is-good' },
  ]

  return (
    <section className="gs-share-section" aria-label="Share tools">
      <div className="gs-share-section__head">
        <div>
          <span className="gs-section-kicker">{i18n.panels.share}</span>
          <h2>{i18n.share.title}</h2>
        </div>
        <p>
          {i18n.share.description}
        </p>
      </div>

      <div className="gs-share-layout">
        <article className="gs-share-card">
          <div className="gs-share-style-grid">
            <div className="gs-share-style-group">
              <span className="gs-share-preview__label">{i18n.share.cardStyle}</span>
              <div className="gs-share-theme-row" role="list" aria-label="Share card style">
                {surfaceThemeOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={cardTheme === option.id ? 'is-active' : ''}
                    onClick={() => setCardTheme(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="gs-share-field">
              <span className="gs-share-preview__label">{i18n.share.headline}</span>
              <input value={headline} onChange={(event) => setHeadline(event.target.value)} />
            </label>

            <label className="gs-share-field">
              <span className="gs-share-preview__label">{i18n.share.summary}</span>
              <textarea value={summary} rows={3} onChange={(event) => setSummary(event.target.value)} />
            </label>
          </div>

          <div className="gs-share-card__actions">
            <button type="button" onClick={handleGeneratePreview}>{i18n.share.buttons.generatePreview}</button>
            <button type="button" onClick={handleCopyLink}>{i18n.share.buttons.copyLink}</button>
            <button type="button" onClick={handleCopySocialCopy}>{i18n.share.buttons.copySocialCopy}</button>
            <button type="button" onClick={handleDownload}>{i18n.share.buttons.downloadPNG}</button>
            <button type="button" onClick={handleShare}>{i18n.share.buttons.share}</button>
          </div>

          <div className="gs-share-card__meta">
            <span>{shareUrl}</span>
            <span>{socialCopy}</span>
            {message ? <strong>{message}</strong> : null}
          </div>

          <div className="gs-share-platform-grid">
            {platformChecks.map((check) => (
              <div className={`gs-share-platform-card ${check.status}`} key={check.label}>
                <span>{check.label}</span>
                <strong>{check.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <div className="gs-share-preview-stack">
          <article className="gs-share-preview">
            <div className="gs-share-preview__label">{i18n.share.preview.socialMediaCard}</div>
            {previewUrl ? (
              <img src={previewUrl} alt={i18n.share.preview.generatedSharePreview} />
            ) : (
              <div className="gs-share-preview__placeholder">
                {i18n.share.preview.placeholderGenerate}
              </div>
            )}
          </article>

          <article className="gs-share-preview gs-share-preview--source">
            <div className="gs-share-preview__label">{i18n.share.preview.sourceImage}</div>
            {stagePreviewUrl ? (
              <img src={stagePreviewUrl} alt={i18n.share.preview.currentStageSnapshot} />
            ) : (
              <div className="gs-share-preview__placeholder">
                {i18n.share.preview.placeholderSource}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}
