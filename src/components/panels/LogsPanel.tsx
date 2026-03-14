/**
 * Logs Panel Component
 *
 * Displays real-time logs:
 * - Log stream (recent entries)
 * - Pause/resume functionality
 * - Log level colors (ERROR red, WARN yellow, INFO blue, DEBUG gray)
 */

import React, { useState, useEffect, useRef } from 'react'

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'

export interface LogEntry {
  id: string
  timestamp: Date
  level: LogLevel
  message: string
  source?: string
}

export interface LogsPanelProps {
  logs: LogEntry[]
  collapsed: boolean
  paused?: boolean
  onPauseToggle?: (paused: boolean) => void
  maxVisible?: number
}

const levelColors: Record<LogLevel, string> = {
  ERROR: '#F38BA8',
  WARN: '#F9E2AF',
  INFO: '#89B4FA',
  DEBUG: '#6C7086',
}

const levelBgColors: Record<LogLevel, string> = {
  ERROR: 'rgba(243, 139, 168, 0.1)',
  WARN: 'rgba(249, 226, 175, 0.1)',
  INFO: 'rgba(137, 180, 250, 0.1)',
  DEBUG: 'rgba(108, 112, 134, 0.1)',
}

export function LogsPanel({
  logs,
  collapsed,
  paused = false,
  onPauseToggle,
  maxVisible = 50,
}: LogsPanelProps): React.ReactElement {
  const [isPaused, setIsPaused] = useState(paused)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [visibleLogs, setVisibleLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    if (!isPaused) {
      setVisibleLogs(logs.slice(-maxVisible))
    }
  }, [logs, isPaused, maxVisible])

  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleLogs, isPaused])

  const handlePauseToggle = () => {
    const newPaused = !isPaused
    setIsPaused(newPaused)
    onPauseToggle?.(newPaused)
  }

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      flex: 1,
      minHeight: 0,
      padding: collapsed ? '8px 6px' : '10px 12px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'space-between',
      marginBottom: collapsed ? 0 : 8,
    },
    title: {
      fontSize: 11,
      fontWeight: 'bold' as const,
      color: '#6C7086',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    controls: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    pauseBtn: {
      background: isPaused ? '#F9E2AF' : 'transparent',
      border: '1px solid #45475A',
      color: isPaused ? '#1E1E2E' : '#CDD6F4',
      padding: '2px 6px',
      fontSize: 10,
      cursor: 'pointer',
      borderRadius: 2,
    },
    logList: {
      flex: 1,
      overflow: 'auto',
      fontFamily: 'monospace',
      fontSize: 10,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 2,
    },
    logEntry: {
      padding: '3px 6px',
      borderRadius: 2,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6,
    },
    timestamp: {
      color: '#45475A',
      flexShrink: 0,
    },
    level: {
      fontWeight: 'bold' as const,
      flexShrink: 0,
      minWidth: 40,
    },
    message: {
      color: '#CDD6F4',
      wordBreak: 'break-all' as const,
      flex: 1,
    },
    source: {
      color: '#6C7086',
      fontSize: 9,
      flexShrink: 0,
    },
    pausedIndicator: {
      textAlign: 'center' as const,
      padding: '4px 0',
      color: '#F9E2AF',
      fontSize: 10,
      background: 'rgba(249, 226, 175, 0.1)',
      borderRadius: 2,
      marginBottom: 4,
    },
    emptyState: {
      textAlign: 'center' as const,
      color: '#45475A',
      padding: '20px 0',
      fontSize: 11,
    },
  }

  if (collapsed) {
    const errorCount = logs.filter(l => l.level === 'ERROR').length
    const warnCount = logs.filter(l => l.level === 'WARN').length

    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={{ fontSize: 12 }}>📋</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 6 }}>
          {errorCount > 0 && (
            <span style={{ fontSize: 10, color: '#F38BA8' }}>
              {errorCount} ERR
            </span>
          )}
          {warnCount > 0 && (
            <span style={{ fontSize: 10, color: '#F9E2AF' }}>
              {warnCount} WARN
            </span>
          )}
          <span style={{ fontSize: 9, color: '#6C7086' }}>
            {logs.length} logs
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Logs</span>
        <div style={styles.controls}>
          <span style={{ fontSize: 10, color: '#45475A' }}>
            {visibleLogs.length}
          </span>
          <button style={styles.pauseBtn} onClick={handlePauseToggle}>
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {isPaused && (
        <div style={styles.pausedIndicator}>
          ⏸ Paused - {logs.length - visibleLogs.length} new entries
        </div>
      )}

      <div ref={scrollRef} style={styles.logList}>
        {visibleLogs.length === 0 ? (
          <div style={styles.emptyState}>No logs yet</div>
        ) : (
          visibleLogs.map(log => (
            <div
              key={log.id}
              style={{
                ...styles.logEntry,
                background: levelBgColors[log.level],
              }}
            >
              <span style={styles.timestamp}>{formatTime(log.timestamp)}</span>
              <span style={{ ...styles.level, color: levelColors[log.level] }}>
                [{log.level}]
              </span>
              {log.source && <span style={styles.source}>&lt;{log.source}&gt;</span>}
              <span style={styles.message}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Mock data generator for testing
export function generateMockLogs(count: number = 20): LogEntry[] {
  const levels: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG']
  const sources = ['gateway', 'agent-1', 'channel-discord', 'cron', 'node-macbook']
  const messages = [
    'Connection established',
    'Processing message batch',
    'Heartbeat received',
    'Failed to reach node',
    'Rate limit approaching',
    'Task completed successfully',
    'Starting sync operation',
    'WebSocket message received',
    'Cache invalidated',
    'Permission check passed',
  ]

  const logs: LogEntry[] = []
  const now = Date.now()

  for (let i = 0; i < count; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)]
    // Weight towards INFO and DEBUG
    const weightedLevel = Math.random() < 0.6 ? 'INFO' : Math.random() < 0.8 ? 'DEBUG' : level

    logs.push({
      id: `log-${i}`,
      timestamp: new Date(now - (count - i) * 5000 + Math.random() * 3000),
      level: weightedLevel,
      message: messages[Math.floor(Math.random() * messages.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
    })
  }

  return logs
}

export const mockLogs: LogEntry[] = generateMockLogs(25)
