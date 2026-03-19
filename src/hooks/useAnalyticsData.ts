import { startTransition, useEffect, useMemo, useState } from 'react'
import { i18n } from '../content/i18n.js'
import { t } from '../content/locale.js'
import { apiClient } from '../services/ApiClient.js'
import type {
  AgentSession,
  PublicAnalyticsCompareResponse,
  PublicAnalyticsTrendsResponse,
  PublicMetricsLive,
  PublicModelsDistributionResponse,
  PublicOfficeStatus,
  PublicZonesHeatmapResponse,
} from '../services/types.js'
import {
  ANALYTICS_COMPARE_REFRESH_MS,
  ANALYTICS_REFRESH_MS,
  ANALYTICS_TREND_HOURS,
  METRICS_LIVE_REFRESH_MS,
} from '../pages/ghost-shift/surfaceShared.js'

export function useAnalyticsData() {
  const [metricsLive, setMetricsLive] = useState<PublicMetricsLive | null>(null)
  const [analyticsTrends, setAnalyticsTrends] = useState<PublicAnalyticsTrendsResponse | null>(null)
  const [analyticsCompare, setAnalyticsCompare] = useState<PublicAnalyticsCompareResponse | null>(null)
  const [zonesHeatmap, setZonesHeatmap] = useState<PublicZonesHeatmapResponse | null>(null)
  const [modelsDistribution, setModelsDistribution] = useState<PublicModelsDistributionResponse | null>(null)
  const [gatewayStatus, setGatewayStatus] = useState<PublicOfficeStatus | null>(null)
  const [sessionInventory, setSessionInventory] = useState<AgentSession[]>([])
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchMetrics = async () => {
      try {
        const [metricsResponse, statusResponse] = await Promise.all([
          apiClient.getMetricsLive(),
          apiClient.getStatus(),
        ])

        if (cancelled) return

        startTransition(() => {
          setMetricsLive(metricsResponse)
          setGatewayStatus(statusResponse)
        })
        setAnalyticsError(null)
        setIsAnalyticsLoading(false)
      } catch {
        if (cancelled) return
        setAnalyticsError((previous) => previous ?? t(i18n.status.apiUnavailable))
        setIsAnalyticsLoading(false)
      }
    }

    fetchMetrics()
    const intervalId = window.setInterval(fetchMetrics, METRICS_LIVE_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchAnalyticsBatch = async () => {
      try {
        const [trendsResponse, zonesResponse, modelsResponse, sessionsResponse] = await Promise.all([
          apiClient.getAnalyticsTrends(ANALYTICS_TREND_HOURS),
          apiClient.getZonesHeatmap(),
          apiClient.getModelsDistribution(),
          apiClient.getSessions(),
        ])

        if (cancelled) return

        startTransition(() => {
          setAnalyticsTrends(trendsResponse)
          setZonesHeatmap(zonesResponse)
          setModelsDistribution(modelsResponse)
          setSessionInventory(sessionsResponse)
        })
        setAnalyticsError(null)
        setIsAnalyticsLoading(false)
      } catch {
        if (cancelled) return
        setAnalyticsError((previous) => previous ?? t(i18n.status.apiUnavailable))
        setIsAnalyticsLoading(false)
      }
    }

    fetchAnalyticsBatch()
    const intervalId = window.setInterval(fetchAnalyticsBatch, ANALYTICS_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchCompare = async () => {
      try {
        const response = await apiClient.getAnalyticsCompare()
        if (cancelled) return

        startTransition(() => {
          setAnalyticsCompare(response)
        })
        setAnalyticsError(null)
        setIsAnalyticsLoading(false)
      } catch {
        if (cancelled) return
        setAnalyticsError((previous) => previous ?? t(i18n.status.apiUnavailable))
        setIsAnalyticsLoading(false)
      }
    }

    fetchCompare()
    const intervalId = window.setInterval(fetchCompare, ANALYTICS_COMPARE_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  const analyticsLoading = useMemo(
    () =>
      isAnalyticsLoading &&
      !metricsLive &&
      !analyticsTrends &&
      !analyticsCompare &&
      !zonesHeatmap &&
      !modelsDistribution &&
      !gatewayStatus &&
      sessionInventory.length === 0,
    [
      analyticsCompare,
      analyticsTrends,
      gatewayStatus,
      isAnalyticsLoading,
      metricsLive,
      modelsDistribution,
      sessionInventory.length,
      zonesHeatmap,
    ],
  )

  return {
    metricsLive,
    analyticsTrends,
    analyticsCompare,
    zonesHeatmap,
    modelsDistribution,
    gatewayStatus,
    sessionInventory,
    analyticsError,
    isAnalyticsLoading,
    analyticsLoading,
  }
}
