import { useEffect, useMemo, useRef, useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import type { TimelinePoint } from '../replay.js'
import type { PublicOfficeStatus } from '../services/types.js'
import { renderShareCard } from '../shareCard.js'
import type { SurfaceTheme } from '../surfaceThemes.js'
import { surfaceThemeOptions } from '../surfaceThemes.js'
import { i18n } from '../content/i18n/index.js'
import { useLocale, useT } from '../content/locale.js'

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
  const locale = useLocale()
  const tt = useT()
  const defaultHeadline = tt(i18n.share.defaults.headline)
  const defaultSummary = tt(i18n.share.defaults.summary)
  const previousDefaultsRef = useRef({ headline: defaultHeadline, summary: defaultSummary })
  const [cardTheme, setCardTheme] = useState<SurfaceTheme>(theme)
  const [headline, setHeadline] = useState(() => defaultHeadline)
  const [summary, setSummary] = useState(() => defaultSummary)
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
    () => tt(i18n.share.defaults.socialCopy)
      .replace('{headline}', headline)
      .replace('{freshness}', freshnessLabel.toLowerCase())
      .replace('{visible}', String(visibleCount))
      .replace('{running}', String(runningCount)),
    [freshnessLabel, headline, runningCount, tt, visibleCount],
  )

  useEffect(() => {
    setCardTheme(theme)
  }, [theme])

  useEffect(() => {
    setHeadline((current) => (current === previousDefaultsRef.current.headline ? defaultHeadline : current))
    setSummary((current) => (current === previousDefaultsRef.current.summary ? defaultSummary : current))
    previousDefaultsRef.current = { headline: defaultHeadline, summary: defaultSummary }
  }, [defaultHeadline, defaultSummary, locale])

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
      setMessage(tt(i18n.share.messages.previewUnavailable))
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
    tt,
    timeline,
    timestamp,
  ])

  const handleGeneratePreview = () => {
    const nextPreviewUrl = createPreview()
    setPreviewUrl(nextPreviewUrl)
    setStagePreviewUrl(captureStagePreview())
    setMessage(tt(i18n.share.messages.previewRefreshed))
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setMessage(tt(i18n.share.messages.linkCopied))
    } catch {
      setMessage(tt(i18n.share.messages.clipboardUnavailable))
    }
  }

  const handleCopySocialCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${socialCopy}\n${shareUrl}`)
      setMessage(tt(i18n.share.messages.socialCopyCopied))
    } catch {
      setMessage(tt(i18n.share.messages.clipboardUnavailable))
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
    setMessage(tt(i18n.share.messages.pngDownloaded))
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
      setMessage(tt(i18n.share.messages.sharedSuccessfully))
    } catch {
      setMessage(tt(i18n.share.messages.shareCancelled))
    }
  }

  const platformChecks = [
    { label: tt(i18n.share.platformChecks.titleLength), value: `${headline.length}/70`, status: headline.length <= 70 ? 'is-good' : 'is-warn' },
    { label: tt(i18n.share.platformChecks.descriptionLength), value: `${summary.length}/140`, status: summary.length <= 140 ? 'is-good' : 'is-warn' },
    { label: tt(i18n.share.platformChecks.deepLink), value: playbackMode === 'replay' ? tt(i18n.share.platformChecks.timestamped) : tt(i18n.share.platformChecks.liveEdge), status: 'is-neutral' },
    { label: tt(i18n.share.platformChecks.cardRatio), value: '1200 × 630', status: 'is-good' },
  ]

  return (
    <section className="gs-share-section" aria-label={tt(i18n.common.shareTools)}>
      <div className="gs-share-section__head">
        <div>
          <span className="gs-section-kicker">{tt(i18n.panels.share)}</span>
          <h2>{tt(i18n.share.title)}</h2>
        </div>
        <p>
          {tt(i18n.share.description)}
        </p>
      </div>

      <div className="gs-share-layout">
        <article className="gs-share-card">
          <div className="gs-share-style-grid">
            <div className="gs-share-style-group">
              <span className="gs-share-preview__label">{tt(i18n.share.cardStyle)}</span>
              <div className="gs-share-theme-row" role="list" aria-label={tt(i18n.share.cardStyle)}>
                {surfaceThemeOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={cardTheme === option.id ? 'is-active' : ''}
                    onClick={() => setCardTheme(option.id)}
                  >
                    {tt(option.label)}
                  </button>
                ))}
              </div>
            </div>

            <label className="gs-share-field">
              <span className="gs-share-preview__label">{tt(i18n.share.headline)}</span>
              <input value={headline} onChange={(event) => setHeadline(event.target.value)} />
            </label>

            <label className="gs-share-field">
              <span className="gs-share-preview__label">{tt(i18n.share.summary)}</span>
              <textarea value={summary} rows={3} onChange={(event) => setSummary(event.target.value)} />
            </label>
          </div>

          <div className="gs-share-card__actions">
            <button type="button" onClick={handleGeneratePreview}>{tt(i18n.share.buttons.generatePreview)}</button>
            <button type="button" onClick={handleCopyLink}>{tt(i18n.share.buttons.copyLink)}</button>
            <button type="button" onClick={handleCopySocialCopy}>{tt(i18n.share.buttons.copySocialCopy)}</button>
            <button type="button" onClick={handleDownload}>{tt(i18n.share.buttons.downloadPNG)}</button>
            <button type="button" onClick={handleShare}>{tt(i18n.share.buttons.share)}</button>
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
            <div className="gs-share-preview__label">{tt(i18n.share.preview.socialMediaCard)}</div>
            {previewUrl ? (
              <img src={previewUrl} alt={tt(i18n.share.preview.generatedSharePreview)} />
            ) : (
              <div className="gs-share-preview__placeholder">
                {tt(i18n.share.preview.placeholderGenerate)}
              </div>
            )}
          </article>

          <article className="gs-share-preview gs-share-preview--source">
            <div className="gs-share-preview__label">{tt(i18n.share.preview.sourceImage)}</div>
            {stagePreviewUrl ? (
              <img src={stagePreviewUrl} alt={tt(i18n.share.preview.currentStageSnapshot)} />
            ) : (
              <div className="gs-share-preview__placeholder">
                {tt(i18n.share.preview.placeholderSource)}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}
