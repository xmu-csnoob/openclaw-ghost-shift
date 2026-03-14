/**
 * State Mapper for OpenClaw Agent -> Pixel Character Animation
 *
 * Maps OpenClaw agent states and tool usage to pixel character animations:
 * - READ: Agent is reading/thinking (Read, Grep, Glob, WebFetch, WebSearch)
 * - TYPE: Agent is writing/running commands (Write, Edit, Bash, Task)
 * - IDLE: Agent is waiting or idle
 */

import type { CharacterState } from '../office/types'

/** Tools that show reading animation */
const READING_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'WebFetch',
  'WebSearch',
  'Agent',  // Reading from sub-agents
])

/** Tools that show typing animation */
const TYPING_TOOLS = new Set([
  'Write',
  'Edit',
  'Bash',
  'NotebookEdit',
  'Task',  // Running tasks
])

export interface MappedState {
  characterState: CharacterState
  currentTool: string | null
  showWaitingBubble: boolean
}

/**
 * Map OpenClaw agent event to character animation state
 */
export function mapAgentStatus(
  status: 'active' | 'waiting' | 'thinking' | 'idle' | undefined,
  tool: string | undefined,
): MappedState {
  // Waiting state - show bubble with checkmark
  if (status === 'waiting') {
    return {
      characterState: 'idle',
      currentTool: null,
      showWaitingBubble: true,
    }
  }

  // Thinking state - reading animation
  if (status === 'thinking') {
    return {
      characterState: 'type',  // TYPE with reading animation
      currentTool: 'Read',
      showWaitingBubble: false,
    }
  }

  // Active with tool
  if (status === 'active' && tool) {
    const isReading = READING_TOOLS.has(tool)
    const isTyping = TYPING_TOOLS.has(tool)

    if (isReading) {
      return {
        characterState: 'type',
        currentTool: tool,
        showWaitingBubble: false,
      }
    }

    if (isTyping) {
      return {
        characterState: 'type',
        currentTool: tool,
        showWaitingBubble: false,
      }
    }

    // Default: typing animation for unknown tools
    return {
      characterState: 'type',
      currentTool: tool,
      showWaitingBubble: false,
    }
  }

  // Idle or unknown state
  return {
    characterState: 'idle',
    currentTool: null,
    showWaitingBubble: false,
  }
}

/**
 * Check if a tool should show reading animation
 */
export function isReadingTool(tool: string | null): boolean {
  if (!tool) return false
  return READING_TOOLS.has(tool)
}

/**
 * Get display label for agent status
 */
export function getStatusLabel(status: string | undefined, tool: string | undefined): string {
  if (status === 'waiting') return 'Waiting for input'
  if (status === 'thinking') return 'Thinking...'
  if (status === 'active' && tool) {
    switch (tool) {
      case 'Read': return 'Reading file...'
      case 'Write': return 'Writing file...'
      case 'Edit': return 'Editing code...'
      case 'Bash': return 'Running command...'
      case 'Grep': return 'Searching...'
      case 'Glob': return 'Finding files...'
      case 'Task': return 'Running task...'
      case 'Agent': return 'Delegating to agent...'
      case 'WebFetch': return 'Fetching web...'
      case 'WebSearch': return 'Searching web...'
      default: return `Using ${tool}...`
    }
  }
  return 'Idle'
}
