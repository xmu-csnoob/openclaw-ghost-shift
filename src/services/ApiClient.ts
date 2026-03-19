import type {
  AgentSession,
  PublicAgentStats,
  PublicAnalyticsCompareResponse,
  PublicAnalyticsTrendsResponse,
  PublicMetricsLive,
  PublicModelsDistributionResponse,
  PublicOfficeSnapshot,
  PublicOfficeStatus,
  PublicReplayResponse,
  PublicTimelineResponse,
  PublicZonesHeatmapResponse,
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

  private buildQuery(params: Record<string, string | number | undefined>): string {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') continue
      query.set(key, String(value))
    }
    return query.size > 0 ? `?${query.toString()}` : ''
  }

  async getSnapshot(filterStatus?: SessionFilterStatus): Promise<PublicOfficeSnapshot> {
    const suffix = this.buildQuery({
      status: filterStatus && filterStatus !== 'all' ? filterStatus : undefined,
    })
    return this.getJSON<PublicOfficeSnapshot>(`/public/snapshot${suffix}`)
  }

  async getTimeline(since?: string, until?: string): Promise<PublicTimelineResponse> {
    const suffix = this.buildQuery({ since, until })
    return this.getJSON<PublicTimelineResponse>(`/public/timeline${suffix}`)
  }

  async getReplay(since?: string, until?: string): Promise<PublicReplayResponse> {
    const suffix = this.buildQuery({ since, until })
    return this.getJSON<PublicReplayResponse>(`/public/replay${suffix}`)
  }

  async getMetricsLive(): Promise<PublicMetricsLive> {
    return this.getJSON<PublicMetricsLive>('/public/metrics/live')
  }

  async getAnalyticsTrends(hours: number = 6): Promise<PublicAnalyticsTrendsResponse> {
    const suffix = this.buildQuery({ hours })
    return this.getJSON<PublicAnalyticsTrendsResponse>(`/public/analytics/trends${suffix}`)
  }

  async getAnalyticsCompare(): Promise<PublicAnalyticsCompareResponse> {
    return this.getJSON<PublicAnalyticsCompareResponse>('/public/analytics/compare')
  }

  async getZonesHeatmap(since?: string, until?: string): Promise<PublicZonesHeatmapResponse> {
    const suffix = this.buildQuery({ since, until })
    return this.getJSON<PublicZonesHeatmapResponse>(`/public/zones/heatmap${suffix}`)
  }

  async getModelsDistribution(since?: string, until?: string): Promise<PublicModelsDistributionResponse> {
    const suffix = this.buildQuery({ since, until })
    return this.getJSON<PublicModelsDistributionResponse>(`/public/models/distribution${suffix}`)
  }

  async getAgentStats(publicId: string, since?: string, until?: string): Promise<PublicAgentStats> {
    const suffix = this.buildQuery({ since, until })
    return this.getJSON<PublicAgentStats>(`/public/agent/${encodeURIComponent(publicId)}${suffix}`)
  }
}

export function createApiClient(base: string = API_BASE): ApiClient {
  return new ApiClient(base)
}

export const apiClient = createApiClient()
