import { useState, useEffect, useCallback, useRef } from 'react'
import { message } from 'antd'
import { APIStatus } from '../components/api/APIStatusIndicator'
import apiStatusService from '../services/apiStatusService'

export interface UseAPIStatusOptions {
  provider?: string
  autoRefresh?: boolean
  refreshInterval?: number
  showToast?: boolean
}

export interface UseAPIStatusReturn {
  status: APIStatus | null
  allStatuses: APIStatus[]
  loading: boolean
  error: string | null
  testConnection: (provider?: string, model?: string) => Promise<APIStatus | null>
  refreshStatus: (provider?: string) => Promise<void>
  clearCache: (provider?: string) => void
  isHealthy: boolean
  lastUpdate: Date | null
}

export const useAPIStatus = (options: UseAPIStatusOptions = {}): UseAPIStatusReturn => {
  const {
    provider: defaultProvider,
    autoRefresh = false,
    refreshInterval = 30000, // 30秒
    showToast = true
  } = options

  // 状态管理
  const [status, setStatus] = useState<APIStatus | null>(null)
  const [allStatuses, setAllStatuses] = useState<APIStatus[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // 定时器引用
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef<boolean>(true)

  // 检查单个提供商状态
  const checkProviderStatus = useCallback(async (providerName: string): Promise<APIStatus | null> => {
    if (!mountedRef.current) return null

    try {
      const providerStatus = await apiStatusService.checkProviderStatus(providerName)

      if (mountedRef.current) {
        setStatus(providerStatus)
        setError(null)
        setLastUpdate(new Date())
      }

      return providerStatus
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '检查状态失败'

      if (mountedRef.current) {
        setError(errorMessage)
      }

      if (showToast) {
        message.error(`检查${providerName}状态失败: ${errorMessage}`)
      }

      return null
    }
  }, [showToast])

  // 检查所有提供商状态
  const checkAllProvidersStatus = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return

    setLoading(true)
    setError(null)

    try {
      const statuses = await apiStatusService.getAllProvidersStatus()

      if (mountedRef.current) {
        setAllStatuses(statuses)
        setLastUpdate(new Date())
      }

      // 如果指定了默认提供商，同时检查其详细状态
      if (defaultProvider && statuses.length > 0) {
        const defaultStatus = statuses.find(s => s.provider === defaultProvider)
        if (defaultStatus) {
          await checkProviderStatus(defaultProvider)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取所有提供商状态失败'

      if (mountedRef.current) {
        setError(errorMessage)
      }

      if (showToast) {
        message.error(`获取API状态失败: ${errorMessage}`)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [defaultProvider, checkProviderStatus, showToast])

  // 测试连接
  const testConnection = useCallback(async (providerName?: string, model?: string): Promise<APIStatus | null> => {
    const targetProvider = providerName || defaultProvider

    if (!targetProvider) {
      if (showToast) {
        message.error('请指定要测试的提供商')
      }
      return null
    }

    if (!mountedRef.current) return null

    setLoading(true)
    setError(null)

    try {
      // 先设置为测试中状态
      const testingStatus: APIStatus = {
        provider: targetProvider,
        status: 'testing',
        lastCheck: new Date().toLocaleString('zh-CN'),
        configured: true
      }

      if (mountedRef.current) {
        setStatus(testingStatus)
      }

      const result = await apiStatusService.testProviderConnection(targetProvider, model)

      if (mountedRef.current) {
        setStatus(result)
        setLastUpdate(new Date())

        // 更新allStatuses中的对应项
        setAllStatuses(prev =>
          prev.map(s => s.provider === targetProvider ? result : s)
        )
      }

      if (showToast) {
        if (result.status === 'connected') {
          message.success(`${targetProvider}连接测试成功`)
        } else {
          message.error(`${targetProvider}连接测试失败: ${result.error}`)
        }
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '连接测试失败'

      if (mountedRef.current) {
        setError(errorMessage)

        // 设置为断开连接状态
        const failedStatus: APIStatus = {
          provider: targetProvider,
          status: 'disconnected',
          lastCheck: new Date().toLocaleString('zh-CN'),
          configured: false,
          error: errorMessage
        }

        setStatus(failedStatus)
        setAllStatuses(prev =>
          prev.map(s => s.provider === targetProvider ? failedStatus : s)
        )
      }

      if (showToast) {
        message.error(`${targetProvider}连接测试失败: ${errorMessage}`)
      }

      return null
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [defaultProvider, showToast])

  // 刷新状态
  const refreshStatus = useCallback(async (providerName?: string): Promise<void> => {
    if (providerName) {
      await checkProviderStatus(providerName)
    } else {
      await checkAllProvidersStatus()
    }
  }, [checkProviderStatus, checkAllProvidersStatus])

  // 清除缓存
  const clearCache = useCallback((providerName?: string): void => {
    apiStatusService.clearCache(providerName)

    if (providerName) {
      // 清除特定提供商的缓存状态
      setStatus(null)
      setAllStatuses(prev => prev.filter(s => s.provider !== providerName))
    } else {
      // 清除所有缓存
      setStatus(null)
      setAllStatuses([])
    }

    setLastUpdate(null)
    setError(null)
  }, [])

  // 计算整体健康状态
  const isHealthy = allStatuses.length > 0 &&
    allStatuses.some(s => s.status === 'connected') &&
    !allStatuses.some(s => s.status === 'disconnected')

  // 初始化
  useEffect(() => {
    mountedRef.current = true

    // 加载初始状态
    if (defaultProvider) {
      checkProviderStatus(defaultProvider)
    } else {
      checkAllProvidersStatus()
    }

    return () => {
      mountedRef.current = false
    }
  }, [defaultProvider, checkProviderStatus, checkAllProvidersStatus])

  // 自动刷新
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (defaultProvider) {
          checkProviderStatus(defaultProvider)
        } else {
          checkAllProvidersStatus()
        }
      }, refreshInterval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }
  }, [autoRefresh, refreshInterval, defaultProvider, checkProviderStatus, checkAllProvidersStatus])

  return {
    status,
    allStatuses,
    loading,
    error,
    testConnection,
    refreshStatus,
    clearCache,
    isHealthy,
    lastUpdate
  }
}

// 便捷hooks
export const useSingleAPIStatus = (provider: string, options: Omit<UseAPIStatusOptions, 'provider'> = {}) => {
  return useAPIStatus({ ...options, provider })
}

export const useAllAPIStatus = (options: Omit<UseAPIStatusOptions, 'provider'> = {}) => {
  return useAPIStatus({ ...options, autoRefresh: true })
}

export default useAPIStatus