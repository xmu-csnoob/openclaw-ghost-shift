/**
 * Cron Panel Component
 *
 * Displays scheduled tasks:
 * - Task list
 * - Next execution time (relative)
 * - Enable/disable toggle
 */

import React from 'react'

export interface CronTask {
  id: string
  name: string
  schedule: string
  nextRun: Date
  enabled: boolean
  lastStatus?: 'success' | 'failed' | 'running'
}

export interface CronPanelProps {
  tasks: CronTask[]
  collapsed: boolean
  onToggle?: (taskId: string, enabled: boolean) => void
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMs < 0) return 'overdue'
  if (diffSec < 60) return `${diffSec}s`
  if (diffMin < 60) return `${diffMin}m`
  if (diffHour < 24) return `${diffHour}h ${diffMin % 60}m`
  return `${diffDay}d ${diffHour % 24}h`
}

const statusColors: Record<string, string> = {
  success: '#A6E3A1',
  failed: '#F38BA8',
  running: '#F9E2AF',
}

export function CronPanel({ tasks, collapsed, onToggle }: CronPanelProps): React.ReactElement {
  const styles = {
    container: {
      padding: collapsed ? '8px 6px' : '10px 12px',
      borderBottom: '1px solid #45475A',
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
    count: {
      fontSize: 10,
      color: '#45475A',
      background: 'rgba(69, 71, 90, 0.3)',
      padding: '2px 6px',
      borderRadius: 2,
    },
    list: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4,
    },
    taskItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: collapsed ? '4px 0' : '6px 8px',
      background: 'rgba(69, 71, 90, 0.2)',
      borderRadius: 4,
    },
    taskInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: 11,
      color: '#CDD6F4',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    nextRun: {
      fontSize: 10,
      color: '#6C7086',
      fontFamily: 'monospace',
    },
    toggle: {
      width: 28,
      height: 14,
      borderRadius: 7,
      background: '#45475A',
      position: 'relative' as const,
      cursor: 'pointer',
      transition: 'background 0.2s',
      flexShrink: 0,
    },
    toggleKnob: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#CDD6F4',
      position: 'absolute' as const,
      top: 1,
      transition: 'left 0.2s',
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      flexShrink: 0,
    },
  }

  const enabledCount = tasks.filter(t => t.enabled).length

  if (collapsed) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={{ fontSize: 12 }}>⏰</span>
        </div>
        <div style={{ ...styles.list, alignItems: 'center', marginTop: 6 }}>
          {tasks.slice(0, 3).map(task => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  ...styles.statusDot,
                  background: task.enabled ? '#A6E3A1' : '#6C7086',
                }}
              />
              <span style={{ fontSize: 9, color: '#6C7086' }}>
                {task.name.slice(0, 6)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Cron</span>
        <span style={styles.count}>{enabledCount}/{tasks.length}</span>
      </div>
      <div style={styles.list}>
        {tasks.map(task => (
          <div key={task.id} style={styles.taskItem}>
            <div style={styles.taskInfo}>
              {task.lastStatus && (
                <span
                  style={{
                    ...styles.statusDot,
                    background: statusColors[task.lastStatus],
                  }}
                />
              )}
              <span style={styles.name}>{task.name}</span>
              {task.enabled && (
                <span style={styles.nextRun}>in {formatRelativeTime(task.nextRun)}</span>
              )}
            </div>
            <div
              style={{
                ...styles.toggle,
                background: task.enabled ? '#A6E3A1' : '#45475A',
              }}
              onClick={() => onToggle?.(task.id, !task.enabled)}
            >
              <div
                style={{
                  ...styles.toggleKnob,
                  left: task.enabled ? 15 : 1,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Mock data for testing
export const mockCronTasks: CronTask[] = [
  {
    id: '1',
    name: 'backup-db',
    schedule: '0 2 * * *',
    nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000),
    enabled: true,
    lastStatus: 'success',
  },
  {
    id: '2',
    name: 'sync-state',
    schedule: '*/5 * * * *',
    nextRun: new Date(Date.now() + 3 * 60 * 1000),
    enabled: true,
    lastStatus: 'running',
  },
  {
    id: '3',
    name: 'cleanup-logs',
    schedule: '0 0 * * 0',
    nextRun: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    enabled: false,
    lastStatus: 'success',
  },
  {
    id: '4',
    name: 'health-check',
    schedule: '*/1 * * * *',
    nextRun: new Date(Date.now() + 30 * 1000),
    enabled: true,
    lastStatus: 'success',
  },
]
