/**
 * Chat History Component
 *
 * Displays message history for a session:
 * - User vs assistant message styling
 * - Tool call cards
 * - Collapsible/expandable
 */

import React, { useState } from 'react'
import { i18n } from '../content/i18n.js'

// ==================== Types ====================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  toolCalls?: ToolCallInfo[]
}

export interface ToolCallInfo {
  id: string
  name: string
  params?: Record<string, unknown>
  result?: string
  isError?: boolean
  status: 'pending' | 'running' | 'completed' | 'error'
}

export interface ChatHistoryProps {
  messages: ChatMessage[]
  maxHeight?: number
  compact?: boolean
}

// ==================== Mock Data ====================

export const mockChatMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'Please implement a function to validate email addresses',
    timestamp: '10:23:45',
  },
  {
    id: '2',
    role: 'assistant',
    content: "I'll implement an email validation function for you. Let me create this in the utils file.",
    timestamp: '10:23:48',
    toolCalls: [
      {
        id: 'tc1',
        name: 'Read',
        params: { file_path: '/src/utils/validation.ts' },
        status: 'completed',
        result: 'File not found',
      },
    ],
  },
  {
    id: '3',
    role: 'assistant',
    content: 'The file does not exist yet. Let me create it with the email validation function.',
    timestamp: '10:23:52',
    toolCalls: [
      {
        id: 'tc2',
        name: 'Write',
        params: { file_path: '/src/utils/validation.ts' },
        status: 'completed',
        result: 'File written successfully (456 bytes)',
      },
    ],
  },
  {
    id: '4',
    role: 'assistant',
    content: "I've created the email validation function. It includes:\n\n- RFC 5322 compliant regex\n- Support for international domains\n- Test coverage for edge cases",
    timestamp: '10:24:01',
  },
  {
    id: '5',
    role: 'user',
    content: 'Can you also add phone number validation?',
    timestamp: '10:25:12',
  },
  {
    id: '6',
    role: 'assistant',
    content: 'Adding phone number validation now...',
    timestamp: '10:25:15',
    toolCalls: [
      {
        id: 'tc3',
        name: 'Edit',
        params: { file_path: '/src/utils/validation.ts', old_string: 'export function validateEmail', new_string: 'export function validateEmail' },
        status: 'completed',
        result: 'Edited successfully',
      },
      {
        id: 'tc4',
        name: 'Bash',
        params: { command: 'npm test validation.test.ts' },
        status: 'running',
      },
    ],
  },
]

// ==================== Styles ====================

const styles = {
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 8,
  },
  message: {
    padding: '8px 10px',
    borderRadius: 4,
    fontSize: 12,
    lineHeight: 1.5,
  },
  userMessage: {
    background: 'rgba(137, 180, 250, 0.1)',
    borderLeft: '2px solid #89B4FA',
  },
  assistantMessage: {
    background: 'rgba(166, 227, 161, 0.1)',
    borderLeft: '2px solid #A6E3A1',
  },
  systemMessage: {
    background: 'rgba(249, 226, 175, 0.1)',
    borderLeft: '2px solid #F9E2AF',
    fontSize: 11,
    color: '#9399B2',
  },
  messageHeader: {
    display: 'flex' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  userRole: {
    color: '#89B4FA',
  },
  assistantRole: {
    color: '#A6E3A1',
  },
  timestamp: {
    fontSize: 9,
    color: '#45475A',
  },
  content: {
    color: '#CDD6F4',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  toolCallsContainer: {
    marginTop: 8,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 4,
  },
  toolCard: {
    background: 'rgba(69, 71, 90, 0.3)',
    border: '1px solid #45475A',
    borderRadius: 4,
    padding: '6px 8px',
  },
  toolHeader: {
    display: 'flex' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
  },
  toolName: {
    display: 'flex' as const,
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 'bold' as const,
    color: '#F9E2AF',
  },
  toolStatus: {
    fontSize: 9,
    padding: '1px 4px',
    borderRadius: 2,
    textTransform: 'uppercase' as const,
  },
  statusPending: {
    background: 'rgba(108, 112, 134, 0.3)',
    color: '#6C7086',
  },
  statusRunning: {
    background: 'rgba(137, 180, 250, 0.2)',
    color: '#89B4FA',
  },
  statusCompleted: {
    background: 'rgba(166, 227, 161, 0.2)',
    color: '#A6E3A1',
  },
  statusError: {
    background: 'rgba(243, 139, 168, 0.2)',
    color: '#F38BA8',
  },
  toolDetails: {
    marginTop: 6,
    fontSize: 10,
    color: '#9399B2',
    borderTop: '1px solid rgba(69, 71, 90, 0.5)',
    paddingTop: 6,
  },
  toolParams: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#6C7086',
    marginBottom: 4,
  },
  toolResult: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#A6E3A1',
    padding: '4px 6px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 2,
  },
  toolResultError: {
    color: '#F38BA8',
    background: 'rgba(243, 139, 168, 0.1)',
  },
  expandIcon: {
    fontSize: 10,
    color: '#6C7086',
    transition: 'transform 0.2s',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: 24,
    color: '#6C7086',
    fontSize: 11,
  },
}

// ==================== Helpers ====================

const getStatusStyle = (status: ToolCallInfo['status']) => {
  switch (status) {
    case 'pending': return styles.statusPending
    case 'running': return styles.statusRunning
    case 'completed': return styles.statusCompleted
    case 'error': return styles.statusError
    default: return styles.statusPending
  }
}

const getStatusIcon = (status: ToolCallInfo['status']) => {
  switch (status) {
    case 'pending': return '○'
    case 'running': return '◐'
    case 'completed': return '●'
    case 'error': return '✕'
    default: return '○'
  }
}

const getToolIcon = (name: string) => {
  switch (name) {
    case 'Read': return '📖'
    case 'Write': return '✏️'
    case 'Edit': return '🔧'
    case 'Bash': return '⚡'
    case 'Grep': return '🔍'
    case 'Glob': return '📁'
    default: return '⚙️'
  }
}

const getToolName = (name: string): string => {
  switch (name) {
    case 'Read': return i18n.chatHistory.tool.read
    case 'Write': return i18n.chatHistory.tool.write
    case 'Edit': return i18n.chatHistory.tool.edit
    case 'Bash': return i18n.chatHistory.tool.bash
    case 'Grep': return i18n.chatHistory.tool.grep
    case 'Glob': return i18n.chatHistory.tool.glob
    default: return i18n.chatHistory.tool.default
  }
}

const getStatusLabel = (status: ToolCallInfo['status']): string => {
  switch (status) {
    case 'pending': return i18n.chatHistory.status.pending
    case 'running': return i18n.chatHistory.status.running
    case 'completed': return i18n.chatHistory.status.completed
    case 'error': return i18n.chatHistory.status.error
    default: return i18n.chatHistory.status.pending
  }
}

const getRoleLabel = (role: ChatMessage['role']): string => {
  switch (role) {
    case 'user': return i18n.chatHistory.role.user
    case 'assistant': return i18n.chatHistory.role.assistant
    case 'system': return i18n.chatHistory.role.system
    default: return role
  }
}

const formatParams = (params?: Record<string, unknown>): string => {
  if (!params) return ''
  const keys = Object.keys(params)
  if (keys.length === 0) return ''
  return keys.map(k => `${k}=${JSON.stringify(params[k])}`).join(', ')
}

// ==================== Components ====================

interface ToolCallCardProps {
  tool: ToolCallInfo
  defaultExpanded?: boolean
}

function ToolCallCard({ tool, defaultExpanded = false }: ToolCallCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div style={styles.toolCard}>
      <div
        style={styles.toolHeader}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={styles.toolName}>
          <span>{getToolIcon(tool.name)}</span>
          <span>{getToolName(tool.name)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...styles.toolStatus, ...getStatusStyle(tool.status) }}>
            {getStatusIcon(tool.status)} {getStatusLabel(tool.status)}
          </span>
          <span style={{ ...styles.expandIcon, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>
        </div>
      </div>

      {expanded && (
        <div style={styles.toolDetails}>
          {tool.params && (
            <div style={styles.toolParams}>
              {formatParams(tool.params)}
            </div>
          )}
          {tool.result && (
            <div style={{
              ...styles.toolResult,
              ...(tool.isError ? styles.toolResultError : {}),
            }}>
              {tool.result}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== Main Component ====================

export function ChatHistory({
  messages,
  maxHeight = 300,
  compact = false,
}: ChatHistoryProps): React.ReactElement {
  if (messages.length === 0) {
    return (
      <div style={styles.emptyState}>
        {i18n.chatHistory.empty}
      </div>
    )
  }

  return (
    <div style={{
      ...styles.container,
      maxHeight,
      overflow: 'auto',
    }}>
      {messages.map((message) => {
        const isUser = message.role === 'user'
        const isSystem = message.role === 'system'

        const messageStyle = {
          ...styles.message,
          ...(isUser ? styles.userMessage : {}),
          ...(isSystem ? styles.systemMessage : {}),
          ...(!isUser && !isSystem ? styles.assistantMessage : {}),
        }

        return (
          <div key={message.id} style={messageStyle}>
            {!compact && (
              <div style={styles.messageHeader}>
                <span style={{
                  ...styles.roleLabel,
                  ...(isUser ? styles.userRole : {}),
                  ...(isSystem ? { color: '#F9E2AF' } : {}),
                  ...(!isUser && !isSystem ? styles.assistantRole : {}),
                }}>
                  {getRoleLabel(message.role)}
                </span>
                {message.timestamp && (
                  <span style={styles.timestamp}>{message.timestamp}</span>
                )}
              </div>
            )}

            <div style={styles.content}>
              {compact ? message.content.slice(0, 100) + (message.content.length > 100 ? '...' : '') : message.content}
            </div>

            {message.toolCalls && message.toolCalls.length > 0 && (
              <div style={styles.toolCallsContainer}>
                {message.toolCalls.map((tool) => (
                  <ToolCallCard
                    key={tool.id}
                    tool={tool}
                    defaultExpanded={tool.status === 'running' || tool.status === 'error'}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
