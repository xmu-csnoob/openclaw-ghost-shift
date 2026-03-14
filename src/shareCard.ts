import type { DisplaySession } from './publicDisplay.js'
import { formatRatio, getPublicAgentLabel, getZoneColor, getZoneLabel } from './publicDisplay.js'
import type { TimelinePoint } from './replay.js'
import type { PublicOfficeStatus } from './services/types.js'
import type { SurfaceTheme } from './surfaceThemes.js'

export interface ShareCardOptions {
  stageCanvas: HTMLCanvasElement | null
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
  timeline: TimelinePoint[]
  timestamp: number
  freshnessLabel: string
  shareUrl: string
  theme: SurfaceTheme
  headline: string
  summary: string
}

interface ShareThemePalette {
  background: [string, string, string]
  glowA: string
  glowB: string
  primary: string
  secondary: string
  tertiary: string
}

const shareThemePalettes: Record<SurfaceTheme, ShareThemePalette> = {
  aurora: {
    background: ['#08111d', '#0d1830', '#050913'],
    glowA: 'rgba(246, 201, 120, 0.12)',
    glowB: 'rgba(125, 179, 255, 0.14)',
    primary: '#7db3ff',
    secondary: '#f6c978',
    tertiary: '#9bffb4',
  },
  ember: {
    background: ['#1a0f0b', '#311810', '#0b0504'],
    glowA: 'rgba(255, 145, 109, 0.16)',
    glowB: 'rgba(255, 214, 102, 0.12)',
    primary: '#ff9a76',
    secondary: '#ffd35f',
    tertiary: '#ffb4a2',
  },
  circuit: {
    background: ['#071213', '#0a2122', '#04090a'],
    glowA: 'rgba(95, 255, 198, 0.16)',
    glowB: 'rgba(84, 194, 255, 0.12)',
    primary: '#67f7d4',
    secondary: '#8ff7a7',
    tertiary: '#7dc6ff',
  },
}

export function renderShareCard({
  stageCanvas,
  status,
  sessions,
  timeline,
  timestamp,
  freshnessLabel,
  shareUrl,
  theme,
  headline,
  summary,
}: ShareCardOptions): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return renderFallbackShareCard({
      status,
      sessions,
      timestamp,
      freshnessLabel,
      shareUrl,
      headline,
      summary,
      theme,
    })
  }

  const palette = shareThemePalettes[theme]
  const visibleCount = status?.displayed ?? sessions.length
  const runningCount = status?.running ?? sessions.filter((session) => session.status === 'running').length
  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0
  const topZone = sessions[0] ? getZoneLabel(sessions[0].zone) : 'Public office'
  const topAgents = sessions
    .slice()
    .sort((a, b) => b.signalScore - a.signalScore)
    .slice(0, 3)

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, palette.background[0])
  gradient.addColorStop(0.58, palette.background[1])
  gradient.addColorStop(1, palette.background[2])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = palette.glowA
  ctx.beginPath()
  ctx.arc(150, 120, 165, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = palette.glowB
  ctx.beginPath()
  ctx.arc(1030, 100, 200, 0, Math.PI * 2)
  ctx.fill()

  drawBackdropGrid(ctx, palette.primary)

  drawLabelPill(ctx, 60, 52, 168, 32, palette.secondary, 'GHOST SHIFT')

  ctx.fillStyle = '#f4f7fb'
  ctx.font = '600 44px "IBM Plex Sans", "Segoe UI", sans-serif'
  drawWrappedText(ctx, headline, 60, 110, 620, 52, 2)

  ctx.fillStyle = 'rgba(226, 233, 245, 0.82)'
  ctx.font = '400 20px "IBM Plex Sans", "Segoe UI", sans-serif'
  drawWrappedText(ctx, summary, 60, 204, 620, 30, 2)

  ctx.fillStyle = 'rgba(226, 233, 245, 0.74)'
  ctx.font = '400 18px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(`Captured ${formatTimestamp(timestamp)} • ${freshnessLabel}`, 60, 290)

  drawTagRow(ctx, 60, 316, [
    { label: 'Open Graph ready', color: palette.primary },
    { label: 'LinkedIn safe', color: palette.secondary },
    { label: 'WeChat preview', color: palette.tertiary },
  ])

  const stageX = 60
  const stageY = 360
  const stageWidth = 610
  const stageHeight = 210

  ctx.fillStyle = 'rgba(8, 12, 18, 0.78)'
  roundRect(ctx, stageX, stageY, stageWidth, stageHeight, 24)
  ctx.fill()

  if (stageCanvas) {
    ctx.save()
    roundRect(ctx, stageX, stageY, stageWidth, stageHeight, 24)
    ctx.clip()
    ctx.drawImage(stageCanvas, stageX, stageY, stageWidth, stageHeight)
    ctx.restore()
  }

  ctx.strokeStyle = withAlpha(palette.primary, 0.32)
  ctx.lineWidth = 2
  roundRect(ctx, stageX, stageY, stageWidth, stageHeight, 24)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.setLineDash([10, 10])
  roundRect(ctx, stageX + 20, stageY + 18, stageWidth - 40, stageHeight - 36, 18)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = 'rgba(226, 233, 245, 0.58)'
  ctx.font = '700 14px "Azeret Mono", monospace'
  ctx.fillText('SAFE CONTENT AREA', stageX + 24, stageY + 36)

  drawMetric(ctx, 710, 210, 190, 104, 'Visible agents', String(visibleCount), palette.primary)
  drawMetric(ctx, 920, 210, 220, 104, 'Running now', String(runningCount), palette.secondary)
  drawMetric(ctx, 710, 330, 430, 104, 'Average signal', formatRatio(averageSignal), palette.tertiary)

  ctx.fillStyle = 'rgba(226, 233, 245, 0.58)'
  ctx.font = '700 13px "Azeret Mono", monospace'
  ctx.fillText('FOCUS AREA', 710, 472)

  ctx.fillStyle = '#f4f7fb'
  ctx.font = '600 28px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(topZone, 710, 506)

  ctx.fillStyle = 'rgba(226, 233, 245, 0.74)'
  ctx.font = '400 18px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText('Top public agents for this frame', 710, 534)

  topAgents.forEach((session, index) => {
    const y = 566 + (index * 20)
    ctx.fillStyle = getZoneColor(session.zone)
    ctx.beginPath()
    ctx.arc(716, y - 5, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#f4f7fb'
    ctx.font = '500 15px "IBM Plex Sans", "Segoe UI", sans-serif'
    ctx.fillText(`${getPublicAgentLabel(session.agentId)} • ${getZoneLabel(session.zone)}`, 730, y)
  })

  drawTrend(ctx, timeline.slice(-16).map((point) => point.running), 60, 588, 370, 24, palette.primary)
  drawTrend(ctx, timeline.slice(-16).map((point) => point.displayed), 450, 588, 220, 24, palette.secondary)

  ctx.fillStyle = 'rgba(226, 233, 245, 0.58)'
  ctx.font = '400 12px "Azeret Mono", monospace'
  ctx.fillText(truncate(shareUrl, 48), 710, 606)

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
  accent: string,
) {
  ctx.fillStyle = 'rgba(10, 18, 28, 0.82)'
  roundRect(ctx, x, y, width, height, 22)
  ctx.fill()

  ctx.strokeStyle = withAlpha(accent, 0.32)
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, width, height, 22)
  ctx.stroke()

  ctx.fillStyle = 'rgba(226, 233, 245, 0.58)'
  ctx.font = '700 13px "Azeret Mono", monospace'
  ctx.fillText(label.toUpperCase(), x + 22, y + 28)

  ctx.fillStyle = '#f4f7fb'
  ctx.font = '600 38px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(value, x + 22, y + 74)
}

function drawTrend(
  ctx: CanvasRenderingContext2D,
  values: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  if (values.length === 0) return

  const maxValue = Math.max(...values, 1)
  ctx.strokeStyle = withAlpha(color, 0.92)
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

function drawLabelPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
  label: string,
) {
  ctx.fillStyle = withAlpha(accent, 0.14)
  roundRect(ctx, x, y, width, height, 18)
  ctx.fill()

  ctx.strokeStyle = withAlpha(accent, 0.3)
  roundRect(ctx, x, y, width, height, 18)
  ctx.stroke()

  ctx.fillStyle = accent
  ctx.font = '700 14px "Azeret Mono", monospace'
  ctx.fillText(label, x + 18, y + 21)
}

function drawTagRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tags: Array<{ label: string; color: string }>,
) {
  let currentX = x
  tags.forEach((tag) => {
    const width = Math.max(120, Math.ceil(ctx.measureText(tag.label).width) + 26)
    ctx.fillStyle = withAlpha(tag.color, 0.14)
    roundRect(ctx, currentX, y, width, 30, 16)
    ctx.fill()

    ctx.strokeStyle = withAlpha(tag.color, 0.3)
    roundRect(ctx, currentX, y, width, 30, 16)
    ctx.stroke()

    ctx.fillStyle = tag.color
    ctx.font = '600 13px "IBM Plex Sans", "Segoe UI", sans-serif'
    ctx.fillText(tag.label, currentX + 13, y + 19)
    currentX += width + 10
  })
}

function drawBackdropGrid(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save()
  ctx.strokeStyle = withAlpha(color, 0.08)
  ctx.lineWidth = 1
  for (let x = 0; x <= 1200; x += 48) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 630)
    ctx.stroke()
  }
  for (let y = 0; y <= 630; y += 48) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(1200, y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines = wrapText(ctx, text, maxWidth, maxLines)
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + (index * lineHeight))
  })
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let currentLine = words[0]

  for (let index = 1; index < words.length; index += 1) {
    const nextLine = `${currentLine} ${words[index]}`
    if (ctx.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine
      continue
    }

    lines.push(currentLine)
    currentLine = words[index]
    if (lines.length === maxLines - 1) break
  }

  const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length
  const remainingWords = words.slice(consumedWords)
  const lastLine = remainingWords.join(' ')
  if (lines.length < maxLines && lastLine) {
    lines.push(lastLine)
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines)
  }

  if (lines.length === maxLines) {
    const truncated = truncateToWidth(ctx, lines[maxLines - 1], maxWidth)
    lines[maxLines - 1] = truncated
  }

  return lines
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text

  let nextText = text
  while (nextText.length > 1 && ctx.measureText(`${nextText}…`).width > maxWidth) {
    nextText = nextText.slice(0, -1)
  }
  return `${nextText}…`
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}

function renderFallbackShareCard({
  status,
  sessions,
  timestamp,
  freshnessLabel,
  shareUrl,
  headline,
  summary,
  theme,
}: Omit<ShareCardOptions, 'stageCanvas' | 'timeline'>): string {
  const palette = shareThemePalettes[theme]
  const visibleCount = status?.displayed ?? sessions.length
  const runningCount = status?.running ?? sessions.filter((session) => session.status === 'running').length
  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.background[0]}" />
          <stop offset="60%" stop-color="${palette.background[1]}" />
          <stop offset="100%" stop-color="${palette.background[2]}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)" />
      <rect x="60" y="58" width="180" height="34" rx="17" fill="${withAlpha(palette.secondary, 0.16)}" stroke="${withAlpha(palette.secondary, 0.35)}" />
      <text x="80" y="80" fill="${palette.secondary}" font-size="14" font-family="Azeret Mono, monospace" font-weight="700">GHOST SHIFT</text>
      <text x="60" y="140" fill="#f4f7fb" font-size="46" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-weight="600">${escapeForSvg(headline)}</text>
      <text x="60" y="190" fill="rgba(226,233,245,0.82)" font-size="22" font-family="IBM Plex Sans, Segoe UI, sans-serif">${escapeForSvg(summary)}</text>
      <text x="60" y="228" fill="rgba(226,233,245,0.7)" font-size="18" font-family="IBM Plex Sans, Segoe UI, sans-serif">Captured ${escapeForSvg(formatTimestamp(timestamp))} • ${escapeForSvg(freshnessLabel)}</text>
      <rect x="60" y="280" width="610" height="290" rx="26" fill="rgba(10,18,28,0.75)" stroke="${withAlpha(palette.primary, 0.32)}" />
      <text x="96" y="338" fill="#f4f7fb" font-size="24" font-family="IBM Plex Sans, Segoe UI, sans-serif">Live office preview unavailable in this environment</text>
      <text x="96" y="374" fill="rgba(226,233,245,0.7)" font-size="18" font-family="IBM Plex Sans, Segoe UI, sans-serif">The exported card still includes timestamp, metrics, and share-safe copy.</text>
      <rect x="710" y="220" width="190" height="104" rx="20" fill="rgba(10,18,28,0.82)" stroke="${withAlpha(palette.primary, 0.3)}" />
      <rect x="920" y="220" width="220" height="104" rx="20" fill="rgba(10,18,28,0.82)" stroke="${withAlpha(palette.secondary, 0.3)}" />
      <rect x="710" y="340" width="430" height="104" rx="20" fill="rgba(10,18,28,0.82)" stroke="${withAlpha(palette.tertiary, 0.3)}" />
      <text x="734" y="248" fill="rgba(226,233,245,0.58)" font-size="13" font-family="Azeret Mono, monospace">VISIBLE AGENTS</text>
      <text x="734" y="296" fill="#f4f7fb" font-size="38" font-family="IBM Plex Sans, Segoe UI, sans-serif">${visibleCount}</text>
      <text x="944" y="248" fill="rgba(226,233,245,0.58)" font-size="13" font-family="Azeret Mono, monospace">RUNNING NOW</text>
      <text x="944" y="296" fill="#f4f7fb" font-size="38" font-family="IBM Plex Sans, Segoe UI, sans-serif">${runningCount}</text>
      <text x="734" y="368" fill="rgba(226,233,245,0.58)" font-size="13" font-family="Azeret Mono, monospace">AVERAGE SIGNAL</text>
      <text x="734" y="416" fill="#f4f7fb" font-size="38" font-family="IBM Plex Sans, Segoe UI, sans-serif">${escapeForSvg(formatRatio(averageSignal))}</text>
      <text x="710" y="520" fill="rgba(226,233,245,0.7)" font-size="18" font-family="IBM Plex Sans, Segoe UI, sans-serif">${escapeForSvg(truncate(shareUrl, 44))}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
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

function withAlpha(color: string, alpha: number): string {
  const normalized = color.replace('#', '')
  if (normalized.length !== 6) return color
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function escapeForSvg(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
