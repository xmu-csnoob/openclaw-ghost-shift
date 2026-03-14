import type { DisplaySession } from './publicDisplay.js'
import { formatRatio, getPublicAgentLabel, getZoneColor, getZoneLabel } from './publicDisplay.js'
import type { TimelinePoint } from './replay.js'
import type { PublicOfficeStatus } from './services/types.js'

export interface ShareCardOptions {
  stageCanvas: HTMLCanvasElement | null
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
  timeline: TimelinePoint[]
  timestamp: number
  freshnessLabel: string
  shareUrl: string
}

export function renderShareCard({
  stageCanvas,
  status,
  sessions,
  timeline,
  timestamp,
  freshnessLabel,
  shareUrl,
}: ShareCardOptions): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable')
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#08111d')
  gradient.addColorStop(0.55, '#0d1830')
  gradient.addColorStop(1, '#050913')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = 'rgba(246, 201, 120, 0.12)'
  ctx.beginPath()
  ctx.arc(160, 110, 140, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(125, 179, 255, 0.12)'
  ctx.beginPath()
  ctx.arc(1000, 120, 180, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#f6c978'
  ctx.font = '700 18px "Azeret Mono", monospace'
  ctx.fillText('GHOST SHIFT', 60, 70)

  ctx.fillStyle = '#f3f6fb'
  ctx.font = '600 44px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText('Shareable public office snapshot', 60, 128)

  ctx.fillStyle = 'rgba(226, 233, 245, 0.78)'
  ctx.font = '400 20px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(`Captured ${formatTimestamp(timestamp)} • ${freshnessLabel}`, 60, 165)

  const stageX = 60
  const stageY = 210
  const stageWidth = 700
  const stageHeight = 340

  ctx.fillStyle = 'rgba(7, 12, 21, 0.72)'
  roundRect(ctx, stageX, stageY, stageWidth, stageHeight, 24)
  ctx.fill()

  if (stageCanvas) {
    ctx.save()
    roundRect(ctx, stageX, stageY, stageWidth, stageHeight, 24)
    ctx.clip()
    ctx.drawImage(stageCanvas, stageX, stageY, stageWidth, stageHeight)
    ctx.restore()
  }

  ctx.strokeStyle = 'rgba(125, 179, 255, 0.22)'
  ctx.lineWidth = 2
  roundRect(ctx, stageX, stageY, stageWidth, stageHeight, 24)
  ctx.stroke()

  const metricX = 810
  const metricWidth = 330
  const metricHeight = 96
  const visibleCount = status?.displayed ?? sessions.length
  const runningCount = status?.running ?? sessions.filter((session) => session.status === 'running').length
  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0

  drawMetric(ctx, metricX, 220, metricWidth, metricHeight, 'Visible agents', String(visibleCount))
  drawMetric(ctx, metricX, 330, metricWidth, metricHeight, 'Live now', String(runningCount))
  drawMetric(ctx, metricX, 440, metricWidth, metricHeight, 'Average signal', formatRatio(averageSignal))

  const topAgents = sessions
    .slice()
    .sort((a, b) => b.signalScore - a.signalScore)
    .slice(0, 3)

  ctx.fillStyle = '#f6c978'
  ctx.font = '700 16px "Azeret Mono", monospace'
  ctx.fillText('Top public agents', 60, 572)

  ctx.fillStyle = 'rgba(226, 233, 245, 0.82)'
  ctx.font = '500 16px "IBM Plex Sans", "Segoe UI", sans-serif'
  topAgents.forEach((session, index) => {
    const x = 60 + (index * 225)
    ctx.fillStyle = getZoneColor(session.zone)
    ctx.beginPath()
    ctx.arc(x + 6, 588, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f3f6fb'
    ctx.fillText(getPublicAgentLabel(session.agentId), x + 18, 593)
    ctx.fillStyle = 'rgba(226, 233, 245, 0.68)'
    ctx.fillText(getZoneLabel(session.zone), x + 18, 612)
  })

  drawTrend(ctx, timeline.slice(-24).map((point) => point.running), 810, 565, 330, 42)

  ctx.fillStyle = 'rgba(226, 233, 245, 0.58)'
  ctx.font = '400 13px "Azeret Mono", monospace'
  ctx.fillText(shareUrl, 810, 610)

  return canvas.toDataURL('image/png')
}

function drawMetric(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
) {
  ctx.fillStyle = 'rgba(10, 18, 28, 0.82)'
  roundRect(ctx, x, y, width, height, 20)
  ctx.fill()

  ctx.strokeStyle = 'rgba(125, 179, 255, 0.16)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, width, height, 20)
  ctx.stroke()

  ctx.fillStyle = 'rgba(226, 233, 245, 0.58)'
  ctx.font = '700 13px "Azeret Mono", monospace'
  ctx.fillText(label.toUpperCase(), x + 22, y + 28)

  ctx.fillStyle = '#f3f6fb'
  ctx.font = '600 36px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(value, x + 22, y + 70)
}

function drawTrend(
  ctx: CanvasRenderingContext2D,
  values: number[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (values.length === 0) return

  const maxValue = Math.max(...values, 1)
  ctx.strokeStyle = '#7db3ff'
  ctx.lineWidth = 3
  ctx.beginPath()
  values.forEach((value, index) => {
    const px = x + (index / Math.max(values.length - 1, 1)) * width
    const py = y + height - ((value / maxValue) * height)
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.stroke()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}
