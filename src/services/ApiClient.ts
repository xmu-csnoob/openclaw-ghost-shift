import type {
  AgentSession,
  PublicOfficeSnapshot,
  PublicOfficeStatus,
  PublicReplayResponse,
  PublicTimelineResponse,
  SessionFilterStatus,
} from './types'

export function normalizeAPIBase(value: string): string {
  return value.replace(/\/+$/, '')
}

export function resolveAPIBase(): string {
  const envBase = normalizeAPIBase(import.meta.env.VITE_PUBLIC_API_BASE?.trim() || '')
  if (envBase) {
    return envBase
  }

  if (typeof window === 'undefined') {
    return '/api'
  }

  const globalBase = normalizeAPIBase(
    ((window as Window & { __GHOST_SHIFT_API_BASE__?: string }).__GHOST_SHIFT_API_BASE__ || '').trim(),
  )
  if (globalBase) {
    return globalBase
  }

  const path = window.location.pathname
  if (path === '/office' || path.startsWith('/office/')) {
    return '/office/api'
  }

  return '/api'
}

export const API_BASE = resolveAPIBase()

export type Session = AgentSession
export type APIStatus = PublicOfficeStatus

export class ApiClient {
  constructor(private readonly base: string = API_BASE) {}

  private async getJSON<T>(path: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`)
    if (!res.ok) {
      throw new Error(`API request failed: ${res.status}`)
    }
    return res.json()
  }

  async getSessions(): Promise<Session[]> {
    return this.getJSON<Session[]>('/sessions')
  }

  async getStatus(): Promise<APIStatus> {
    return this.getJSON<APIStatus>('/status')
  }

  async getSnapshot(filterStatus?: SessionFilterStatus): Promise<PublicOfficeSnapshot> {
    const query = new URLSearchParams()
    if (filterStatus && filterStatus !== 'all') {
      query.set('status', filterStatus)
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return this.getJSON<PublicOfficeSnapshot>(`/public/snapshot${suffix}`)
  }

  async getTimeline(since?: string, until?: string): Promise<PublicTimelineResponse> {
    const query = new URLSearchParams()
    if (since) query.set('since', since)
    if (until) query.set('until', until)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return this.getJSON<PublicTimelineResponse>(`/public/timeline${suffix}`)
  }

  async getReplay(since?: string, until?: string): Promise<PublicReplayResponse> {
    const query = new URLSearchParams()
    if (since) query.set('since', since)
    if (until) query.set('until', until)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return this.getJSON<PublicReplayResponse>(`/public/replay${suffix}`)
  }
}

export function createApiClient(base: string = API_BASE): ApiClient {
  return new ApiClient(base)
}

export const apiClient = createApiClient()
