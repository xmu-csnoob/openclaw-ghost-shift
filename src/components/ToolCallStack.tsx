/**
 * Tool Call Stack Component
 *
 * Displays a sequence of tool calls for an agent session:
 * - Shows tool calls in chronological order
 * - Real-time updates via props
 * - Auto-scrolls to latest call
 * - Supports collapsing/expanding all
 */

import React, { useRef, useEffect, useState } from 'react'
import {
  ToolCallCard,
  ToolCallData,
  ToolType,
} from './ToolCallCard.js'

export interface ToolCallStackProps {
  calls: ToolCallData[]
  maxVisible?: number
  autoScroll?: boolean
  showStats?: boolean
}

// Aggregate statistics from calls
function getCallStats(calls: ToolCallData[]): {
  total: number
  success: number
  error: number
  running: number
  pending: number
  byType: Record<ToolType, number>
  totalDuration: number
} {
  const stats = {
    total: calls.length,
    success: 0,
    error: 0,
    running: 0,
    pending: 0,
    byType: {} as Record<ToolType, number>,
    totalDuration: 0,
  }

  for (const call of calls) {
    stats[call.status]++
    stats.byType[call.tool] = (stats.byType[call.tool] || 0) + 1
    if (call.endTime) {
      stats.totalDuration += call.endTime - call.startTime
    }
  }

  return stats
}

// Format total duration
function formatTotalDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

export function ToolCallStack({
  calls,
  maxVisible = 50,
  autoScroll = true,
  showStats = true,
}: ToolCallStackProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [expandedAll, setExpandedAll] = useState(false)
  const [showOlder, setShowOlder] = useState(false)

  // Auto-scroll to bottom on new calls
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [calls.length, autoScroll])

  const stats = getCallStats(calls)

  // Determine which calls to show
  const hiddenCount = Math.max(0, calls.length - maxVisible)
  const visibleCalls = showOlder
    ? calls
    : calls.slice(-maxVisible)

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      background: 'rgba(30, 30, 46, 0.8)',
      border: '2px solid #45475A',
      borderRadius: 0,
      overflow: 'hidden',
      boxShadow: '2px 2px 0px #0A0A14',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderBottom: '1px solid #45475A',
      background: 'rgba(69, 71, 90, 0.3)',
    },
    title: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#89B4FA',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    count: {
      fontSize: 10,
      background: 'rgba(137, 180, 250, 0.2)',
      color: '#89B4FA',
      padding: '2px 6px',
      borderRadius: 0,
    },
    actions: {
      display: 'flex',
      gap: 8,
    },
    actionBtn: {
      background: 'transparent',
      border: '1px solid #45475A',
      color: '#9399B2',
      fontSize: 10,
      padding: '2px 8px',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    statsBar: {
      display: 'flex',
      gap: 12,
      padding: '6px 12px',
      borderBottom: '1px solid rgba(69, 71, 90, 0.5)',
      background: 'rgba(30, 30, 46, 0.5)',
      flexWrap: 'wrap' as const,
    },
    statItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
    },
    statValue: {
      fontWeight: 'bold',
      fontFamily: 'monospace',
    },
    statSuccess: { color: '#A6E3A1' },
    statError: { color: '#F38BA8' },
    statRunning: { color: '#89B4FA' },
    statPending: { color: '#6C7086' },
    statDuration: { color: '#F9E2AF' },
    list: {
      flex: 1,
      overflow: 'auto',
      padding: 8,
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#6C7086',
      fontSize: 12,
      gap: 8,
    },
    emptyIcon: {
      fontSize: 32,
      opacity: 0.5,
    },
    hiddenNotice: {
      padding: '6px 12px',
      background: 'rgba(249, 226, 175, 0.1)',
      borderBottom: '1px solid rgba(69, 71, 90, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 10,
      color: '#F9E2AF',
    },
    showMoreBtn: {
      background: 'transparent',
      border: '1px solid #F9E2AF',
      color: '#F9E2AF',
      padding: '2px 8px',
      cursor: 'pointer',
      fontSize: 10,
    },
    toolTypePills: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap' as const,
    },
    toolPill: {
      fontSize: 9,
      padding: '1px 4px',
      borderRadius: 0,
    },
  }

  // Generate colors for tool type pills
  const TOOL_COLORS: Record<ToolType, string> = {
    Read: '#89B4FA',
    Write: '#A6E3A1',
    Edit: '#F9E2AF',
    Bash: '#F38BA8',
    WebSearch: '#CBA6F7',
    Grep: '#94E2D5',
    Glob: '#94E2D5',
    Agent: '#F5C2E7',
    TaskOutput: '#89DCEB',
    Skill: '#FAB387',
    Other: '#6C7086',
  }

  const isEmpty = calls.length === 0

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>
          Tool Calls
          <span style={styles.count}>{stats.total}</span>
        </span>
        <div style={styles.actions}>
          <button
            style={styles.actionBtn}
            onClick={() => setExpandedAll(!expandedAll)}
            title={expandedAll ? 'Collapse all' : 'Expand all'}
          >
            {expandedAll ? '⊟' : '⊞'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {showStats && !isEmpty && (
        <div style={styles.statsBar}>
          {stats.success > 0 && (
            <span style={styles.statItem}>
              <span style={{ ...styles.statValue, ...styles.statSuccess }}>
                ✓{stats.success}
              </span>
            </span>
          )}
          {stats.error > 0 && (
            <span style={styles.statItem}>
              <span style={{ ...styles.statValue, ...styles.statError }}>
                ✗{stats.error}
              </span>
            </span>
          )}
          {stats.running > 0 && (
            <span style={styles.statItem}>
              <span style={{ ...styles.statValue, ...styles.statRunning }}>
                ◷{stats.running}
              </span>
            </span>
          )}
          {stats.pending > 0 && (
            <span style={styles.statItem}>
              <span style={{ ...styles.statValue, ...styles.statPending }}>
                ○{stats.pending}
              </span>
            </span>
          )}
          {stats.totalDuration > 0 && (
            <span style={styles.statItem}>
              <span style={{ ...styles.statValue, ...styles.statDuration }}>
                ⏱{formatTotalDuration(stats.totalDuration)}
              </span>
            </span>
          )}
          {/* Tool type breakdown */}
          <div style={styles.toolTypePills}>
            {Object.entries(stats.byType).map(([tool, count]) => (
              <span
                key={tool}
                style={{
                  ...styles.toolPill,
                  background: `rgba(${hexToRgb(TOOL_COLORS[tool as ToolType])}, 0.2)`,
                  color: TOOL_COLORS[tool as ToolType],
                }}
              >
                {tool}:{count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hidden calls notice */}
      {hiddenCount > 0 && !showOlder && (
        <div style={styles.hiddenNotice}>
          <span>{hiddenCount} older calls hidden</span>
          <button
            style={styles.showMoreBtn}
            onClick={() => setShowOlder(true)}
          >
            Show All
          </button>
        </div>
      )}

      {/* Tool Call List */}
      {isEmpty ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>🔧</span>
          <span>No tool calls yet</span>
        </div>
      ) : (
        <div ref={containerRef} style={styles.list}>
          {visibleCalls.map((call) => (
            <ToolCallCard
              key={call.id}
              call={call}
              defaultExpanded={expandedAll}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Helper: hex to rgb for rgba colors
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0, 0, 0'
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

// Re-export types for convenience
export type { ToolCallData, ToolCallStatus, ToolType } from './ToolCallCard.js'
export { detectToolType } from './ToolCallCard.js'
