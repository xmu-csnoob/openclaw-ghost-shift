import { useEffect, useMemo, useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import type { TimelinePoint } from '../replay.js'
import type { PublicOfficeStatus } from '../services/types.js'
import { renderShareCard } from '../shareCard.js'
import type { SurfaceTheme } from '../surfaceThemes.js'
import { surfaceThemeOptions } from '../surfaceThemes.js'

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
  const [headline, setHeadline] = useState('Replayable public telemetry for the current Ghost Shift frame')
  const [summary, setSummary] = useState('Share the exact office state with proof metrics, preview-safe framing, and a timestamped deep link.')
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
      setMessage('Preview unavailable in this environment')
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
    setMessage('Preview refreshed')
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setMessage('Timestamped link copied')
    } catch {
      setMessage('Clipboard unavailable')
    }
  }

  const handleCopySocialCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${socialCopy}\n${shareUrl}`)
      setMessage('Social copy copied')
    } catch {
      setMessage('Clipboard unavailable')
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
    setMessage('PNG downloaded')
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
      setMessage('Shared successfully')
    } catch {
      setMessage('Share cancelled')
    }
  }

  const platformChecks = [
    { label: 'Title length', value: `${headline.length}/70`, status: headline.length <= 70 ? 'is-good' : 'is-warn' },
    { label: 'Description length', value: `${summary.length}/140`, status: summary.length <= 140 ? 'is-good' : 'is-warn' },
    { label: 'Deep link', value: playbackMode === 'replay' ? 'Timestamped' : 'Live edge', status: 'is-neutral' },
    { label: 'Card ratio', value: '1200 × 630', status: 'is-good' },
  ]

  return (
    <section className="gs-share-section" aria-label="Share tools">
      <div className="gs-share-section__head">
        <div>
          <span className="gs-section-kicker">Share Surface</span>
          <h2>Generate a polished social card, inspect the source image, and package the right copy.</h2>
        </div>
        <p>
          Theme presets, custom headline and summary fields, live image preview, and platform-length checks keep the
          share flow production-ready instead of feeling like a debug export.
        </p>
      </div>

      <div className="gs-share-layout">
        <article className="gs-share-card">
          <div className="gs-share-style-grid">
            <div className="gs-share-style-group">
              <span className="gs-share-preview__label">Card style</span>
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
              <span className="gs-share-preview__label">Headline</span>
              <input value={headline} onChange={(event) => setHeadline(event.target.value)} />
            </label>

            <label className="gs-share-field">
              <span className="gs-share-preview__label">Summary</span>
              <textarea value={summary} rows={3} onChange={(event) => setSummary(event.target.value)} />
            </label>
          </div>

          <div className="gs-share-card__actions">
            <button type="button" onClick={handleGeneratePreview}>Generate preview</button>
            <button type="button" onClick={handleCopyLink}>Copy link</button>
            <button type="button" onClick={handleCopySocialCopy}>Copy social copy</button>
            <button type="button" onClick={handleDownload}>Download PNG</button>
            <button type="button" onClick={handleShare}>Share</button>
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
            <div className="gs-share-preview__label">Social media card preview</div>
            {previewUrl ? (
              <img src={previewUrl} alt="Generated Ghost Shift share preview" />
            ) : (
              <div className="gs-share-preview__placeholder">
                Generate a preview to combine the office frame, product proof points, and a timestamp-safe share link.
              </div>
            )}
          </article>

          <article className="gs-share-preview gs-share-preview--source">
            <div className="gs-share-preview__label">Source image preview</div>
            {stagePreviewUrl ? (
              <img src={stagePreviewUrl} alt="Current office stage snapshot" />
            ) : (
              <div className="gs-share-preview__placeholder">
                The live stage snapshot appears here when the canvas is available. It is used as the base image for the
                social card.
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}
