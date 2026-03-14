import React from 'react'
import type { DisplaySession } from '../publicDisplay.js'
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
} from '../publicDisplay.js'

export interface SessionPanelProps {
  session: DisplaySession | null
  onClose: () => void
  visible: boolean
  position?: 'left' | 'right'
}

const styles = {
  panel: {
    position: 'absolute' as const,
    top: 60,
    width: 'min(320px, calc(100vw - 24px))',
    maxHeight: 'calc(100% - 80px)',
    background: 'rgba(24, 24, 37, 0.96)',
    border: '1px solid rgba(137, 180, 250, 0.28)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 150,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.28)',
    backdropFilter: 'blur(10px)',
  },
  panelLeft: {
    left: 12,
  },
  panelRight: {
    right: 12,
  },
  header: {
    display: 'flex' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(69, 71, 90, 0.7)',
    background: 'linear-gradient(90deg, rgba(137, 180, 250, 0.12), rgba(249, 226, 175, 0.06))',
  },
  titleWrap: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold' as const,
    color: '#CDD6F4',
  },
  subtitle: {
    fontSize: 10,
    color: '#6C7086',
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6C7086',
    fontSize: 16,
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
  },
  content: {
    padding: 14,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 12,
  },
  hero: {
    padding: 12,
    background: 'linear-gradient(180deg, rgba(137, 180, 250, 0.14), rgba(17, 24, 39, 0.2))',
    border: '1px solid rgba(137, 180, 250, 0.28)',
  },
  heroStatus: {
    display: 'flex' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    fontSize: 12,
  },
  heroText: {
    fontSize: 12,
    lineHeight: 1.55,
    color: '#BAC2DE',
  },
  statsGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  statCard: {
    padding: 10,
    background: 'rgba(69, 71, 90, 0.18)',
    border: '1px solid rgba(69, 71, 90, 0.38)',
  },
  statLabel: {
    fontSize: 10,
    color: '#6C7086',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  statValue: {
    marginTop: 4,
    fontSize: 16,
    color: '#CDD6F4',
    fontWeight: 700,
  },
  metaRow: {
    display: 'flex' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(69, 71, 90, 0.3)',
    fontSize: 11,
  },
  metaLabel: {
    color: '#9399B2',
  },
  metaValue: {
    color: '#CDD6F4',
    fontFamily: 'monospace',
  },
  footer: {
    fontSize: 10,
    color: '#6C7086',
    lineHeight: 1.55,
  },
}

export function SessionPanel({
  session,
  onClose,
  visible,
  position = 'right',
}: SessionPanelProps): React.ReactElement | null {
  if (!visible) return null

  const label = getPublicAgentLabel(session?.agentId)
  const activity = session ? getActivityLabel(session.activityBand) : 'Quiet'
  const activityColor = session ? getActivityColor(session.activityBand) : '#6C7086'
  const zoneColor = session ? getZoneColor(session.zone) : '#6C7086'
  const signalWindowLabel = session ? getSignalWindowLabel(session.signalWindow) : 'Observed'
  const footprintLabel = session ? getFootprintLabel(session.footprint) : 'Public Thread'

  return (
    <div
      style={{
        ...styles.panel,
        ...(position === 'left' ? styles.panelLeft : styles.panelRight),
      }}
    >
      <div style={styles.header}>
        <div style={styles.titleWrap}>
          <div style={styles.title}>{label}</div>
          <div style={styles.subtitle}>Public agent card</div>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.hero}>
          <div style={styles.heroStatus}>
            <span style={{ color: activityColor, fontWeight: 700 }}>{activity}</span>
            <span style={{ color: '#CDD6F4' }}>{session?.status || 'idle'}</span>
          </div>
          <div style={styles.heroText}>
            {session?.status === 'running'
              ? 'This agent is actively contributing right now and its public activity trace is updating live.'
              : `This agent is quiet at the moment, but its latest public burst landed ${signalWindowLabel.toLowerCase()}.`}
          </div>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Recent Signal</div>
            <div style={styles.statValue}>{session ? formatRatio(session.signalScore) : '0%'}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Observed</div>
            <div style={styles.statValue}>
              {session ? formatDurationShort(Date.now() - session.observedSince) : '0m'}
            </div>
          </div>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Wing</span>
          <span style={{ ...styles.metaValue, color: zoneColor }}>
            {session ? getZoneLabel(session.zone) : 'hidden'}
          </span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Role</span>
          <span style={styles.metaValue}>{session?.role || 'hidden'}</span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Origin</span>
          <span style={styles.metaValue}>{session?.origin || 'hidden'}</span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Last Burst</span>
          <span style={styles.metaValue}>{signalWindowLabel}</span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Footprint</span>
          <span style={styles.metaValue}>{footprintLabel}</span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Public Alias</span>
          <span style={styles.metaValue}>{label}</span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Model Family</span>
          <span style={styles.metaValue}>{session?.modelFamily || 'hidden'}</span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Current Beat</span>
          <span style={{ ...styles.metaValue, color: activityColor }}>{activity}</span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Current State</span>
          <span style={styles.metaValue}>{session?.status || 'idle'}</span>
        </div>

        <div style={styles.footer}>
          These metrics are derived from the public office snapshot plus coarse recency and volume bands. Internal
          session identifiers, channels, prompts, transcript contents, devices, approvals, and exact token counts stay hidden.
        </div>
      </div>
    </div>
  )
}
