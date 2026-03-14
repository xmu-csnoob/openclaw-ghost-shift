import React from 'react'
import type { PublicOfficeStatus } from '../services/types.js'
import type { DisplaySession, PulseSample } from '../publicDisplay.js'
import {
  formatDurationShort,
  formatRatio,
  getActivityColor,
  getActivityLabel,
  getFootprintLabel,
  getPublicAgentLabel,
  getSignalWindowLabel,
  getZoneColor,
  getZoneLabel,
  summarizeModelMix,
  summarizeZones,
} from '../publicDisplay.js'

export interface StatusPanelProps {
  status: PublicOfficeStatus | null
  sessions: DisplaySession[]
  history: PulseSample[]
  selectedSessionKey: string | null
  onSelectSession: (sessionKey: string) => void
  visible: boolean
  onClose: () => void
}

function buildSparkline(samples: PulseSample[], width: number, height: number): string {
  if (samples.length === 0) return ''
  const values = samples.map((sample) => sample.running)
  const max = Math.max(...values, 1)

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
      const y = height - (value / max) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export function StatusPanel({
  status,
  sessions,
  history,
  selectedSessionKey,
  onSelectSession,
  visible,
  onClose,
}: StatusPanelProps): React.ReactElement | null {
  if (!visible) return null

  const averageSignal =
    sessions.length > 0 ? sessions.reduce((sum, session) => sum + session.signalScore, 0) / sessions.length : 0
  const warmCount = sessions.filter((session) => session.signalScore >= 0.6).length
  const sparkline = buildSparkline(history.slice(-30), 260, 56)
  const modelMix = summarizeModelMix(sessions)
  const zoneMix = summarizeZones(sessions)
  const topSessions = [...sessions]
    .sort((a, b) => {
      if (b.signalScore !== a.signalScore) return b.signalScore - a.signalScore
      return a.agentId.localeCompare(b.agentId)
    })
    .slice(0, 6)

  const styles = {
    panel: {
      position: 'absolute' as const,
      top: 60,
      right: 12,
      width: 'min(340px, calc(100vw - 24px))',
      maxHeight: 'calc(100% - 80px)',
      background: 'rgba(24, 24, 37, 0.96)',
      border: '1px solid rgba(137, 180, 250, 0.26)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.28)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      zIndex: 200,
      backdropFilter: 'blur(10px)',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      borderBottom: '1px solid rgba(69, 71, 90, 0.7)',
      background: 'linear-gradient(90deg, rgba(137, 180, 250, 0.12), rgba(249, 226, 175, 0.06))',
    },
    title: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#89B4FA',
      letterSpacing: 0.6,
    },
    closeBtn: {
      background: 'transparent',
      border: 'none',
      color: '#6C7086',
      fontSize: 16,
      cursor: 'pointer',
      padding: 0,
    },
    content: {
      flex: 1,
      overflow: 'auto',
      padding: 12,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 16,
    },
    sectionTitle: {
      fontSize: 10,
      color: '#6C7086',
      textTransform: 'uppercase' as const,
      letterSpacing: 1.1,
      marginBottom: 8,
    },
    statGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: 8,
    },
    statCard: {
      padding: 10,
      background: 'rgba(69, 71, 90, 0.22)',
      border: '1px solid rgba(69, 71, 90, 0.4)',
    },
    statLabel: {
      fontSize: 10,
      color: '#6C7086',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
    },
    statValue: {
      marginTop: 4,
      fontSize: 20,
      color: '#CDD6F4',
      fontWeight: 700,
    },
    statMeta: {
      marginTop: 4,
      fontSize: 11,
      color: '#9399B2',
    },
    mixRow: {
      display: 'grid',
      gridTemplateColumns: '68px 1fr 34px',
      gap: 10,
      alignItems: 'center',
      fontSize: 11,
      color: '#CDD6F4',
      marginBottom: 8,
    },
    meter: {
      height: 7,
      background: 'rgba(69, 71, 90, 0.35)',
      overflow: 'hidden',
    },
    sessionItem: {
      padding: '9px 10px',
      background: 'rgba(69, 71, 90, 0.18)',
      border: '1px solid rgba(69, 71, 90, 0.36)',
      marginBottom: 8,
      cursor: 'pointer',
    },
    sessionItemSelected: {
      border: '1px solid rgba(137, 180, 250, 0.85)',
      background: 'rgba(137, 180, 250, 0.08)',
    },
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>Office Telemetry</span>
        <button style={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      <div style={styles.content}>
        <div>
          <div style={styles.sectionTitle}>Live Pulse</div>
          <div style={styles.statGrid}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Running</div>
              <div style={styles.statValue}>{status?.running ?? 0}</div>
              <div style={styles.statMeta}>agents live right now</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Recent Signal</div>
              <div style={styles.statValue}>{formatRatio(averageSignal)}</div>
              <div style={styles.statMeta}>{warmCount} warm of {status?.displayed ?? sessions.length} visible agents</div>
            </div>
          </div>
          <div style={{ marginTop: 10, padding: 10, background: 'rgba(17, 24, 39, 0.55)' }}>
            <svg viewBox="0 0 260 56" width="100%" height="56" preserveAspectRatio="none">
              <path d={sparkline} fill="none" stroke="#89B4FA" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: 11, color: '#9399B2', marginTop: 4 }}>
              Running-agent history over the last {history.length * 3}s
            </div>
          </div>
        </div>

        <div>
          <div style={styles.sectionTitle}>Wings</div>
          {zoneMix.length === 0 ? (
            <div style={{ color: '#6C7086', fontSize: 11 }}>No public rooms occupied yet</div>
          ) : (
            zoneMix.map((entry) => (
              <div key={entry.zone} style={styles.mixRow}>
                <span style={{ color: getZoneColor(entry.zone) }}>{entry.label}</span>
                <div style={styles.meter}>
                  <div
                    style={{
                      width: `${Math.round((entry.count / Math.max(sessions.length, 1)) * 100)}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${getZoneColor(entry.zone)}, rgba(255,255,255,0.5))`,
                    }}
                  />
                </div>
                <span style={{ textAlign: 'right' }}>{entry.running}/{entry.count}</span>
              </div>
            ))
          )}
        </div>

        <div>
          <div style={styles.sectionTitle}>Model Mix</div>
          {modelMix.length === 0 ? (
            <div style={{ color: '#6C7086', fontSize: 11 }}>No public models visible yet</div>
          ) : (
            modelMix.map((entry) => (
              <div key={entry.label} style={styles.mixRow}>
                <span>{entry.label}</span>
                <div style={styles.meter}>
                  <div
                    style={{
                      width: `${Math.round(entry.share * 100)}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #89B4FA, #A6E3A1)',
                    }}
                  />
                </div>
                <span style={{ textAlign: 'right' }}>{entry.count}</span>
              </div>
            ))
          )}
        </div>

        <div>
          <div style={styles.sectionTitle}>Agent Cadence</div>
          {topSessions.length === 0 ? (
            <div style={{ color: '#6C7086', fontSize: 11 }}>No visible agents</div>
          ) : (
            topSessions.map((session) => (
              <div
                key={session.sessionKey}
                style={{
                  ...styles.sessionItem,
                  ...(selectedSessionKey === session.sessionKey ? styles.sessionItemSelected : {}),
                }}
                onClick={() => onSelectSession(session.sessionKey)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#CDD6F4', fontWeight: 700 }}>{getPublicAgentLabel(session.agentId)}</span>
                  <span style={{ color: getActivityColor(session.activityBand), fontSize: 11 }}>
                    {getActivityLabel(session.activityBand)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
                  <span style={{ color: getZoneColor(session.zone) }}>{getZoneLabel(session.zone)}</span>
                  <span style={{ color: '#CDD6F4' }}>{formatRatio(session.signalScore)} signal</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#6C7086' }}>
                  <span>{session.origin}</span>
                  <span>{getFootprintLabel(session.footprint)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#6C7086' }}>
                  <span>{getSignalWindowLabel(session.signalWindow)}</span>
                  <span>{session.modelFamily}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#6C7086' }}>
                  <span>Observed {formatDurationShort(Date.now() - session.observedSince)}</span>
                  <span>{session.status || 'idle'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
