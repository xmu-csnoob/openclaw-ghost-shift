import React from 'react'
import type { PublicOfficeStatus } from '../services/types.js'
import type { DisplaySession, PulseSample } from '../publicDisplay.js'
import { formatRatio, getZoneColor, summarizeZones } from '../publicDisplay.js'

export interface SignalStripProps {
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
  history: PulseSample[]
}

function buildLine(points: number[], width: number, height: number): string {
  if (points.length === 0) return ''

  const maxValue = Math.max(...points, 1)
  return points
    .map((value, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
      const y = height - (value / maxValue) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export function SignalStrip({ status, sessions, history }: SignalStripProps): React.ReactElement | null {
  const samples = history.slice(-24)
  const runningSeries = samples.map((sample) => sample.running)
  const displayedSeries = samples.map((sample) => sample.displayed)
  const runningPath = buildLine(runningSeries, 180, 44)
  const displayedPath = buildLine(displayedSeries, 180, 44)
  const zoneMix = summarizeZones(sessions)
  const utilization = status?.displayed ? status.running / status.displayed : 0
  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0
  const warmCount = sessions.filter((session) => session.signalScore >= 0.6).length

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        width: 'min(420px, calc(100vw - 24px))',
        padding: 14,
        zIndex: 110,
        display: 'grid',
        gridTemplateColumns: '1.2fr 0.8fr',
        gap: 14,
        background:
          'linear-gradient(135deg, rgba(24, 24, 37, 0.94), rgba(30, 30, 46, 0.92) 55%, rgba(17, 24, 39, 0.9))',
        border: '1px solid rgba(137, 180, 250, 0.22)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.24)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: '#89B4FA' }}>
          Office Pulse
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 24, color: '#CDD6F4', fontWeight: 700 }}>{warmCount}</span>
          <span style={{ fontSize: 12, color: '#6C7086' }}>agents carrying recent signal</span>
        </div>
        <div style={{ marginTop: 10, position: 'relative', height: 52 }}>
          <svg viewBox="0 0 180 44" width="100%" height="52" preserveAspectRatio="none">
            <path d={displayedPath} fill="none" stroke="rgba(137, 180, 250, 0.35)" strokeWidth="2" />
            <path d={runningPath} fill="none" stroke="#A6E3A1" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11 }}>
          <div style={{ color: '#CDD6F4' }}>
            <span style={{ color: '#6C7086' }}>Visible</span> {status?.displayed ?? sessions.length}
          </div>
          <div style={{ color: '#CDD6F4' }}>
            <span style={{ color: '#6C7086' }}>Utilization</span> {formatRatio(utilization)}
          </div>
          <div style={{ color: '#CDD6F4' }}>
            <span style={{ color: '#6C7086' }}>Avg signal</span> {formatRatio(averageSignal)}
          </div>
          <div style={{ color: '#CDD6F4' }}>
            <span style={{ color: '#6C7086' }}>State</span> {status?.status || 'unknown'}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: '#F9E2AF' }}>
          Wings
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {zoneMix.length === 0 ? (
            <div style={{ color: '#6C7086', fontSize: 11 }}>Waiting for public session data</div>
          ) : (
            zoneMix.map((entry) => (
              <div key={entry.zone}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#CDD6F4' }}>
                  <span>{entry.label}</span>
                  <span>
                    {entry.running}/{entry.count}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 6,
                    background: 'rgba(69, 71, 90, 0.4)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(8, Math.round((entry.count / Math.max(sessions.length, 1)) * 100))}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${getZoneColor(entry.zone)}, rgba(255,255,255,0.65))`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
