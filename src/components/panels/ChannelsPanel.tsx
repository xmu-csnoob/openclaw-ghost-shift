/**
 * Channels Panel Component
 *
 * Displays connected channels status:
 * - Channel list (Discord/Slack/Telegram/Signal etc.)
 * - Connection status indicator (green/red/yellow)
 * - Unread message count
 */

import React from 'react'

export type ChannelStatus = 'online' | 'offline' | 'connecting'
export type ChannelType = 'discord' | 'slack' | 'telegram' | 'signal' | 'matrix' | 'irc'

export interface Channel {
  id: string
  type: ChannelType
  name: string
  status: ChannelStatus
  unreadCount: number
}

export interface ChannelsPanelProps {
  channels: Channel[]
  collapsed: boolean
}

const channelIcons: Record<ChannelType, string> = {
  discord: '🎮',
  slack: '💼',
  telegram: '✈️',
  signal: '📡',
  matrix: '🧱',
  irc: '💬',
}

const statusColors: Record<ChannelStatus, string> = {
  online: '#A6E3A1',
  offline: '#F38BA8',
  connecting: '#F9E2AF',
}

export function ChannelsPanel({ channels, collapsed }: ChannelsPanelProps): React.ReactElement {
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
    channelItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'space-between',
      padding: collapsed ? '6px 0' : '6px 8px',
      background: 'rgba(69, 71, 90, 0.2)',
      borderRadius: 4,
    },
    channelInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      flexShrink: 0,
    },
    icon: {
      fontSize: 12,
    },
    name: {
      fontSize: 11,
      color: '#CDD6F4',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    unread: {
      fontSize: 10,
      color: '#1E1E2E',
      background: '#F9E2AF',
      padding: '1px 5px',
      borderRadius: 8,
      fontWeight: 'bold' as const,
      minWidth: 18,
      textAlign: 'center' as const,
    },
  }

  const onlineCount = channels.filter(c => c.status === 'online').length

  if (collapsed) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={{ fontSize: 12 }}>📡</span>
        </div>
        <div style={{ ...styles.list, alignItems: 'center', marginTop: 6 }}>
          {channels.slice(0, 4).map(channel => (
            <div key={channel.id} style={{ position: 'relative' }}>
              <span style={styles.icon}>{channelIcons[channel.type]}</span>
              <span
                style={{
                  ...styles.statusDot,
                  background: statusColors[channel.status],
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  border: '1px solid #1E1E2E',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Channels</span>
        <span style={styles.count}>{onlineCount}/{channels.length}</span>
      </div>
      <div style={styles.list}>
        {channels.map(channel => (
          <div key={channel.id} style={styles.channelItem}>
            <div style={styles.channelInfo}>
              <span style={{ ...styles.statusDot, background: statusColors[channel.status] }} />
              <span style={styles.icon}>{channelIcons[channel.type]}</span>
              <span style={styles.name}>{channel.name}</span>
            </div>
            {channel.unreadCount > 0 && (
              <span style={styles.unread}>
                {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Mock data for testing
export const mockChannels: Channel[] = [
  { id: '1', type: 'discord', name: 'general', status: 'online', unreadCount: 12 },
  { id: '2', type: 'slack', name: '#dev-team', status: 'online', unreadCount: 3 },
  { id: '3', type: 'telegram', name: 'Project Alpha', status: 'connecting', unreadCount: 0 },
  { id: '4', type: 'signal', name: 'Private Group', status: 'offline', unreadCount: 0 },
  { id: '5', type: 'matrix', name: 'foss-chat', status: 'online', unreadCount: 47 },
]
