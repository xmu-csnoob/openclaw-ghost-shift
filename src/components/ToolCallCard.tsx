/**
 * Tool Call Card Component
 *
 * Displays a single tool call with:
 * - Tool name + icon
 * - Parameter summary (truncated)
 * - Execution status (pending/running/success/error)
 * - Execution time
 * - Expandable to show full parameters
 */

import React, { useState } from 'react'
import { i18n } from '../content/i18n/index.js'
import { useT } from '../content/locale.js'

export type ToolType =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'WebSearch'
  | 'Grep'
  | 'Glob'
  | 'Agent'
  | 'TaskOutput'
  | 'Skill'
  | 'Other'

export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error'

export interface ToolCallData {
  id: string
  tool: ToolType
  toolName: string // Original tool name from API
  params: Record<string, unknown>
  status: ToolCallStatus
  startTime: number
  endTime?: number
  error?: string
}

export interface ToolCallCardProps {
  call: ToolCallData
  defaultExpanded?: boolean
}

// Tool type detection from tool name
export function detectToolType(toolName: string): ToolType {
  const name = toolName.toLowerCase()
  if (name.includes('read')) return 'Read'
  if (name.includes('write')) return 'Write'
  if (name.includes('edit')) return 'Edit'
  if (name.includes('bash') || name.includes('shell')) return 'Bash'
  if (name.includes('web') || name.includes('search')) return 'WebSearch'
  if (name.includes('grep')) return 'Grep'
  if (name.includes('glob')) return 'Glob'
  if (name.includes('agent')) return 'Agent'
  if (name.includes('task')) return 'TaskOutput'
  if (name.includes('skill')) return 'Skill'
  return 'Other'
}

// Catppuccin colors for different tool types
const TOOL_COLORS: Record<ToolType, { border: string; bg: string; icon: string }> = {
  Read: { border: '#89B4FA', bg: 'rgba(137, 180, 250, 0.1)', icon: '#89B4FA' },
  Write: { border: '#A6E3A1', bg: 'rgba(166, 227, 161, 0.1)', icon: '#A6E3A1' },
  Edit: { border: '#F9E2AF', bg: 'rgba(249, 226, 175, 0.1)', icon: '#F9E2AF' },
  Bash: { border: '#F38BA8', bg: 'rgba(243, 139, 168, 0.1)', icon: '#F38BA8' },
  WebSearch: { border: '#CBA6F7', bg: 'rgba(203, 166, 247, 0.1)', icon: '#CBA6F7' },
  Grep: { border: '#94E2D5', bg: 'rgba(148, 226, 213, 0.1)', icon: '#94E2D5' },
  Glob: { border: '#94E2D5', bg: 'rgba(148, 226, 213, 0.1)', icon: '#94E2D5' },
  Agent: { border: '#F5C2E7', bg: 'rgba(245, 194, 231, 0.1)', icon: '#F5C2E7' },
  TaskOutput: { border: '#89DCEB', bg: 'rgba(137, 220, 235, 0.1)', icon: '#89DCEB' },
  Skill: { border: '#FAB387', bg: 'rgba(250, 179, 135, 0.1)', icon: '#FAB387' },
  Other: { border: '#6C7086', bg: 'rgba(108, 112, 134, 0.1)', icon: '#6C7086' },
}

// Status colors
const STATUS_COLORS: Record<ToolCallStatus, { indicator: string; text: string }> = {
  pending: { indicator: '#6C7086', text: '#6C7086' },
  running: { indicator: '#89B4FA', text: '#89B4FA' },
  success: { indicator: '#A6E3A1', text: '#A6E3A1' },
  error: { indicator: '#F38BA8', text: '#F38BA8' },
}

// Tool icons (pixel-style unicode symbols)
const TOOL_ICONS: Record<ToolType, string> = {
  Read: '📖',
  Write: '✏️',
  Edit: '✂️',
  Bash: '⚡',
  WebSearch: '🌐',
  Grep: '🔍',
  Glob: '📂',
  Agent: '🤖',
  TaskOutput: '📋',
  Skill: '🎯',
  Other: '🔧',
}

// Truncate text for display
function truncateText(text: string, maxLength: number = 40): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

// Extract key parameter summary
function getParamSummary(tool: ToolType, params: Record<string, unknown>): string {
  switch (tool) {
    case 'Read':
      return truncateText(String(params.file_path || params.path || ''))
    case 'Write':
      return truncateText(String(params.file_path || params.path || ''))
    case 'Edit':
      return truncateText(String(params.file_path || params.path || ''))
    case 'Bash':
      return truncateText(String(params.command || ''))
    case 'WebSearch':
      return truncateText(String(params.query || ''))
    case 'Grep':
      return truncateText(String(params.pattern || ''))
    case 'Glob':
      return truncateText(String(params.pattern || ''))
    case 'Agent':
      return truncateText(String(params.description || params.prompt || ''))
    case 'TaskOutput':
      return truncateText(String(params.task_id || ''))
    case 'Skill':
      return truncateText(String(params.skill || ''))
    default:
      return ''
  }
}

// Format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export function ToolCallCard({
  call,
  defaultExpanded = false,
}: ToolCallCardProps): React.ReactElement {
  const tt = useT()
  const [expanded, setExpanded] = useState(defaultExpanded)

  const colors = TOOL_COLORS[call.tool]
  const statusColors = STATUS_COLORS[call.status]
  const icon = TOOL_ICONS[call.tool]
  const summary = getParamSummary(call.tool, call.params)

  const duration = call.endTime
    ? call.endTime - call.startTime
    : call.status === 'running'
      ? Date.now() - call.startTime
      : undefined

  const styles = {
    card: {
      background: colors.bg,
      border: `2px solid ${colors.border}`,
      borderRadius: 0, // Pixel style - no radius
      marginBottom: 6,
      overflow: 'hidden' as const,
      boxShadow: '2px 2px 0px #0A0A14',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      padding: '8px 10px',
      cursor: 'pointer',
      gap: 8,
    },
    iconWrapper: {
      fontSize: 16,
      lineHeight: 1,
    },
    toolName: {
      fontSize: 12,
      fontWeight: 'bold',
      color: colors.border,
      minWidth: 60,
    },
    summary: {
      flex: 1,
      fontSize: 11,
      color: '#9399B2',
      fontFamily: 'monospace',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    statusIndicator: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: statusColors.indicator,
      flexShrink: 0,
    },
    duration: {
      fontSize: 10,
      color: '#6C7086',
      fontFamily: 'monospace',
      marginLeft: 8,
      minWidth: 40,
      textAlign: 'right' as const,
    },
    expandIcon: {
      fontSize: 10,
      color: '#6C7086',
      marginLeft: 4,
      transition: 'transform 0.2s',
    },
    content: {
      padding: '8px 10px',
      borderTop: '1px solid rgba(69, 71, 90, 0.5)',
      background: 'rgba(30, 30, 46, 0.5)',
    },
    paramsTitle: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#6C7086',
      marginBottom: 6,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    paramsContent: {
      fontSize: 10,
      fontFamily: 'monospace',
      color: '#A6ADC8',
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-all' as const,
      maxHeight: 150,
      overflow: 'auto',
    },
    errorBox: {
      marginTop: 8,
      padding: 6,
      background: 'rgba(243, 139, 168, 0.1)',
      border: '1px solid #F38BA8',
    },
    errorText: {
      fontSize: 10,
      color: '#F38BA8',
      fontFamily: 'monospace',
      wordBreak: 'break-all' as const,
    },
    spinner: {
      display: 'inline-block',
      width: 8,
      height: 8,
      border: '2px solid transparent',
      borderTopColor: statusColors.indicator,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
  }

  // Spinner keyframes need to be in a style tag
  const spinnerStyle = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `

  return (
    <div style={styles.card}>
      <style>{spinnerStyle}</style>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.iconWrapper}>{icon}</span>
        <span style={styles.toolName}>{call.tool}</span>
        <span style={styles.summary}>{summary}</span>
        {call.status === 'running' ? (
          <span style={styles.spinner} />
        ) : (
          <span style={styles.statusIndicator} />
        )}
        {duration !== undefined && (
          <span style={styles.duration}>{formatDuration(duration)}</span>
        )}
        <span style={{ ...styles.expandIcon, transform: expanded ? 'rotate(180deg)' : '' }}>
          ▼
        </span>
      </div>
      {expanded && (
        <div style={styles.content}>
          <div style={styles.paramsTitle}>{tt(i18n.toolCall.parameters)}</div>
          <pre style={styles.paramsContent}>
            {JSON.stringify(call.params, null, 2)}
          </pre>
          {call.error && (
            <div style={styles.errorBox}>
              <div style={styles.errorText}>{call.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
