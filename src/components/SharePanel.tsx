import { useMemo, useState } from 'react'
import type { DisplaySession } from '../publicDisplay.js'
import type { TimelinePoint } from '../replay.js'
import type { PublicOfficeStatus } from '../services/types.js'
import { renderShareCard } from '../shareCard.js'

export interface SharePanelProps {
  livePath: string
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
  timeline: TimelinePoint[]
  timestamp: number
  freshnessLabel: string
  playbackMode: 'live' | 'replay'
  windowHours: number
}

function buildShareUrl(livePath: string, playbackMode: 'live' | 'replay', timestamp: number, windowHours: number): string {
  const url = new URL(livePath, window.location.origin)
  url.searchParams.set('mode', playbackMode)
  url.searchParams.set('ts', String(timestamp))
  url.searchParams.set('window', String(windowHours))
  return url.toString()
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
}: SharePanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const shareUrl = useMemo(
    () => buildShareUrl(livePath, playbackMode, timestamp, windowHours),
    [livePath, playbackMode, timestamp, windowHours],
  )

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
    })
  }

  const handleGeneratePreview = () => {
    const nextPreviewUrl = createPreview()
    setPreviewUrl(nextPreviewUrl)
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
        title: 'Ghost Shift public office snapshot',
        text: `Ghost Shift ${freshnessLabel.toLowerCase()} snapshot`,
        url: shareUrl,
      })
      setMessage('Shared successfully')
    } catch {
      setMessage('Share cancelled')
    }
  }

  return (
    <section className="gs-share-section" aria-label="Share tools">
      <div className="gs-share-section__head">
        <div>
          <span className="gs-section-kicker">Share Surface</span>
          <h2>Capture the current state and send people to the same frame.</h2>
        </div>
        <p>
          Generate a social-card preview from the current office state, copy a timestamped link, or share the replay
          frame directly.
        </p>
      </div>

      <div className="gs-share-layout">
        <article className="gs-share-card">
          <div className="gs-share-card__actions">
            <button type="button" onClick={handleGeneratePreview}>Generate preview</button>
            <button type="button" onClick={handleCopyLink}>Copy link</button>
            <button type="button" onClick={handleDownload}>Download PNG</button>
            <button type="button" onClick={handleShare}>Share</button>
          </div>

          <div className="gs-share-card__meta">
            <span>{shareUrl}</span>
            {message ? <strong>{message}</strong> : null}
          </div>
        </article>

        <article className="gs-share-preview">
          <div className="gs-share-preview__label">Social media card preview</div>
          {previewUrl ? (
            <img src={previewUrl} alt="Generated Ghost Shift share preview" />
          ) : (
            <div className="gs-share-preview__placeholder">
              Generate a preview to capture the current office canvas, live stats, and timestamp.
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
