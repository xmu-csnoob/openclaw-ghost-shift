/**
 * Dashboard Sidebar Component
 *
 * A collapsible sidebar for dashboard panels:
 * - Fixed position on left side
 * - Collapsible (shows icons only when collapsed)
 * - Contains multiple panels: Channels, Nodes, Cron, Logs
 */

import React, { useState } from 'react'
import {
  ChannelsPanel,
  Channel,
  mockChannels,
} from './panels/ChannelsPanel'
import {
  NodesPanel,
  Node,
  mockNodes,
} from './panels/NodesPanel'
import {
  CronPanel,
  CronTask,
  mockCronTasks,
} from './panels/CronPanel'
import {
  LogsPanel,
  LogEntry,
  mockLogs,
} from './panels/LogsPanel'
import { i18n } from '../content/i18n.js'
import { useT } from '../content/locale.js'

export interface DashboardSidebarProps {
  /** Initial collapsed state */
  initialCollapsed?: boolean
  /** Custom channels data */
  channels?: Channel[]
  /** Custom nodes data */
  nodes?: Node[]
  /** Custom cron tasks data */
  cronTasks?: CronTask[]
  /** Custom logs data */
  logs?: LogEntry[]
  /** Callback when cron task is toggled */
  onCronToggle?: (taskId: string, enabled: boolean) => void
  /** Callback when log pause state changes */
  onLogsPauseToggle?: (paused: boolean) => void
  /** Additional container style */
  style?: React.CSSProperties
}

export function DashboardSidebar({
  initialCollapsed = false,
  channels = mockChannels,
  nodes = mockNodes,
  cronTasks = mockCronTasks,
  logs = mockLogs,
  onCronToggle,
  onLogsPauseToggle,
  style,
}: DashboardSidebarProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const tt = useT()

  const styles = {
    container: {
      position: 'absolute' as const,
      top: 60,
      left: 12,
      width: collapsed ? 48 : 260,
      maxHeight: 'calc(100% - 80px)',
      background: 'rgba(30, 30, 46, 0.95)',
      border: '2px solid #45475A',
      borderRadius: 4,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      zIndex: 150,
      transition: 'width 0.2s ease',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'space-between',
      padding: collapsed ? '10px 6px' : '10px 12px',
      borderBottom: '1px solid #45475A',
      background: 'rgba(69, 71, 90, 0.3)',
    },
    title: {
      fontSize: 13,
      fontWeight: 'bold' as const,
      color: '#89B4FA',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    collapseBtn: {
      background: 'transparent',
      border: 'none',
      color: '#6C7086',
      fontSize: 14,
      cursor: 'pointer',
      padding: '4px 8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.2s',
    },
    panelsContainer: {
      flex: 1,
      overflow: collapsed ? 'hidden' : 'auto',
      display: 'flex',
      flexDirection: 'column' as const,
    },
    collapseIcon: {
      transform: collapsed ? 'rotate(180deg)' : 'none',
    },
  }

  return (
    <div style={{ ...styles.container, ...style }}>
      <div style={styles.header}>
        {!collapsed && (
          <span style={styles.title}>
            <span>📊</span>
            <span>{tt(i18n.dashboard.title)}</span>
          </span>
        )}
        <button
          style={styles.collapseBtn}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? tt(i18n.expandSidebar) : tt(i18n.collapseSidebar)}
        >
          <span style={styles.collapseIcon}>◀</span>
        </button>
      </div>

      <div style={styles.panelsContainer}>
        <ChannelsPanel channels={channels} collapsed={collapsed} />
        <NodesPanel nodes={nodes} collapsed={collapsed} />
        <CronPanel tasks={cronTasks} collapsed={collapsed} onToggle={onCronToggle} />
        <LogsPanel logs={logs} collapsed={collapsed} onPauseToggle={onLogsPauseToggle} />
      </div>
    </div>
  )
}

// Re-export types and mock data for convenience
export {
  type Channel,
  type ChannelStatus,
  type ChannelType,
} from './panels/ChannelsPanel'
export {
  type Node,
  type NodeCapability,
} from './panels/NodesPanel'
export {
  type CronTask,
} from './panels/CronPanel'
export {
  type LogEntry,
  type LogLevel,
  generateMockLogs,
} from './panels/LogsPanel'
export {
  mockChannels,
  mockNodes,
  mockCronTasks,
  mockLogs,
}
