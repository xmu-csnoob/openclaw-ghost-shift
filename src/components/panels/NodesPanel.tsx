/**
 * Nodes Panel Component
 *
 * Displays available nodes:
 * - Node list
 * - Capability tags (camera/screen/location/voice etc.)
 * - Online status
 */

import React from 'react'

export type NodeCapability = 'camera' | 'screen' | 'location' | 'voice' | 'files' | 'browser' | 'terminal'

export interface Node {
  id: string
  name: string
  capabilities: NodeCapability[]
  online: boolean
  lastSeen?: string
}

export interface NodesPanelProps {
  nodes: Node[]
  collapsed: boolean
}

const capabilityIcons: Record<NodeCapability, string> = {
  camera: '📷',
  screen: '🖥️',
  location: '📍',
  voice: '🎤',
  files: '📁',
  browser: '🌐',
  terminal: '⌨️',
}

const capabilityColors: Record<NodeCapability, string> = {
  camera: '#F38BA8',
  screen: '#89B4FA',
  location: '#A6E3A1',
  voice: '#F9E2AF',
  files: '#CBA6F7',
  browser: '#94E2D5',
  terminal: '#FAB387',
}

export function NodesPanel({ nodes, collapsed }: NodesPanelProps): React.ReactElement {
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
    nodeItem: {
      padding: collapsed ? '4px 0' : '6px 8px',
      background: 'rgba(69, 71, 90, 0.2)',
      borderRadius: 4,
    },
    nodeInfo: {
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
    name: {
      fontSize: 11,
      color: '#CDD6F4',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    tags: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: 3,
      marginTop: 4,
    },
    tag: {
      fontSize: 9,
      padding: '1px 4px',
      borderRadius: 2,
      background: 'rgba(30, 30, 46, 0.5)',
    },
  }

  const onlineCount = nodes.filter(n => n.online).length

  if (collapsed) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={{ fontSize: 12 }}>🖥️</span>
        </div>
        <div style={{ ...styles.list, alignItems: 'center', marginTop: 6 }}>
          {nodes.slice(0, 4).map(node => (
            <div key={node.id} style={{ position: 'relative' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  background: 'rgba(69, 71, 90, 0.4)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                }}
              >
                {node.name.charAt(0).toUpperCase()}
              </div>
              <span
                style={{
                  ...styles.statusDot,
                  background: node.online ? '#A6E3A1' : '#6C7086',
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
        <span style={styles.title}>Nodes</span>
        <span style={styles.count}>{onlineCount}/{nodes.length}</span>
      </div>
      <div style={styles.list}>
        {nodes.map(node => (
          <div key={node.id} style={styles.nodeItem}>
            <div style={styles.nodeInfo}>
              <span
                style={{
                  ...styles.statusDot,
                  background: node.online ? '#A6E3A1' : '#6C7086',
                }}
              />
              <span style={styles.name}>{node.name}</span>
            </div>
            {node.capabilities.length > 0 && (
              <div style={styles.tags}>
                {node.capabilities.map(cap => (
                  <span
                    key={cap}
                    style={{
                      ...styles.tag,
                      color: capabilityColors[cap],
                    }}
                  >
                    {capabilityIcons[cap]} {cap}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Mock data for testing
export const mockNodes: Node[] = [
  {
    id: '1',
    name: 'macbook-pro',
    capabilities: ['camera', 'screen', 'voice', 'files', 'browser', 'terminal'],
    online: true,
  },
  {
    id: '2',
    name: 'iphone-15',
    capabilities: ['camera', 'location', 'voice', 'files'],
    online: true,
  },
  {
    id: '3',
    name: 'raspberry-pi',
    capabilities: ['terminal', 'files'],
    online: false,
    lastSeen: '2h ago',
  },
  {
    id: '4',
    name: 'windows-pc',
    capabilities: ['screen', 'files', 'browser', 'terminal'],
    online: true,
  },
]
