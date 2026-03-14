import type { AgentSession, PublicOfficeSnapshot, PublicOfficeStatus } from './types'

function normalizeAPIBase(value: string): string {
  return value.replace(/\/+$/, '')
}

function resolveAPIBase(): string {
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

class ApiClient {
  private async getJSON<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`)
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

  async getSnapshot(): Promise<PublicOfficeSnapshot> {
    return this.getJSON<PublicOfficeSnapshot>('/public/snapshot')
  }
}

export const apiClient = new ApiClient()
