import axios from 'axios'
import { APIStatus } from '../components/api/APIStatusIndicator'

export interface APIStatusResponse {
  provider: string
  status: 'connected' | 'disconnected' | 'unknown' | 'testing'
  lastCheck: string
  responseTime?: number
  error?: string
  configured: boolean
  availableModels?: string[]
  apiKeyValid?: boolean
}

export interface SystemStatusResponse {
  providers: APIStatusResponse[]
  overallStatus: 'healthy' | 'degraded' | 'down'
  lastUpdate: string
}

/**
 * API状态检查服务
 */
class ApiStatusService {
  private baseUrl = '/api/ai-models'
  private statusCache = new Map<string, { status: APIStatus; timestamp: number }>()
  private readonly CACHE_DURATION = 30000 // 30秒缓存

  /**
   * 检查单个提供商状态
   */
  async checkProviderStatus(provider: string): Promise<APIStatus> {
    const cacheKey = provider
    const cached = this.statusCache.get(cacheKey)

    // 检查缓存是否有效
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.status
    }

    try {
      const response = await axios.get(`${this.baseUrl}/status`)
      const systemStatus: SystemStatusResponse = response.data

      // 查找对应提供商的状态
      const providerStatus = systemStatus.providers.find(p => p.provider === provider)

      if (!providerStatus) {
        // 如果没有找到特定提供商，创建一个未知状态
        const unknownStatus: APIStatus = {
          provider,
          status: 'unknown',
          lastCheck: new Date().toLocaleString('zh-CN'),
          configured: false,
          error: '未找到该提供商的状态信息'
        }
        this.updateCache(cacheKey, unknownStatus)
        return unknownStatus
      }

      const apiStatus: APIStatus = {
        provider: providerStatus.provider,
        status: providerStatus.status,
        lastCheck: providerStatus.lastCheck,
        responseTime: providerStatus.responseTime,
        error: providerStatus.error,
        configured: providerStatus.configured
      }

      this.updateCache(cacheKey, apiStatus)
      return apiStatus
    } catch (error) {
      console.error(`检查${provider}状态失败:`, error)

      const errorStatus: APIStatus = {
        provider,
        status: 'disconnected',
        lastCheck: new Date().toLocaleString('zh-CN'),
        configured: false,
        error: this.getErrorMessage(error)
      }

      this.updateCache(cacheKey, errorStatus)
      return errorStatus
    }
  }

  /**
   * 测试特定提供商的连接
   */
  async testProviderConnection(provider: string, model?: string): Promise<APIStatus> {
    const cacheKey = `${provider}_test`

    try {
      const params = model ? { model } : {}
      const response = await axios.post(`${this.baseUrl}/test/${provider}`, params)

      const testResult: APIStatus = {
        provider,
        status: response.data.status === 'connected' ? 'connected' : 'disconnected',
        lastCheck: new Date().toLocaleString('zh-CN'),
        responseTime: response.data.responseTime,
        error: response.data.error,
        configured: response.data.configured || true
      }

      // 更新缓存
      this.updateCache(provider, testResult)
      this.updateCache(cacheKey, testResult)

      return testResult
    } catch (error) {
      console.error(`测试${provider}连接失败:`, error)

      const errorStatus: APIStatus = {
        provider,
        status: 'disconnected',
        lastCheck: new Date().toLocaleString('zh-CN'),
        configured: false,
        error: this.getErrorMessage(error)
      }

      this.updateCache(provider, errorStatus)
      this.updateCache(cacheKey, errorStatus)

      return errorStatus
    }
  }

  /**
   * 获取所有提供商状态
   */
  async getAllProvidersStatus(): Promise<APIStatus[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/providers`)
      const providersData = response.data

      if (!providersData.providers) {
        return []
      }

      const providerStatuses: APIStatus[] = []

      for (const [providerName, providerData] of Object.entries(providersData.providers)) {
        const status: APIStatus = {
          provider: providerName,
          status: (providerData as any).configured ? 'unknown' : 'disconnected',
          lastCheck: new Date().toLocaleString('zh-CN'),
          configured: (providerData as any).configured || false,
          error: (providerData as any).error
        }

        providerStatuses.push(status)
      }

      return providerStatuses
    } catch (error) {
      console.error('获取所有提供商状态失败:', error)
      return []
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<SystemStatusResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/status`)
      return response.data
    } catch (error) {
      console.error('获取系统状态失败:', error)
      return {
        providers: [],
        overallStatus: 'down',
        lastUpdate: new Date().toLocaleString('zh-CN')
      }
    }
  }

  /**
   * 检查API密钥是否有效
   */
  async validateApiKey(provider: string, apiKey: string): Promise<boolean> {
    try {
      // 这里应该调用后端的验证API密钥接口
      // 目前暂时返回true，因为后端还没有这个接口
      const response = await axios.post(`${this.baseUrl}/validate-key`, {
        provider,
        apiKey
      })

      return response.data.valid || false
    } catch (error) {
      console.error(`验证${provider} API密钥失败:`, error)
      return false
    }
  }

  /**
   * 清除缓存
   */
  clearCache(provider?: string): void {
    if (provider) {
      this.statusCache.delete(provider)
      this.statusCache.delete(`${provider}_test`)
    } else {
      this.statusCache.clear()
    }
  }

  /**
   * 更新缓存
   */
  private updateCache(key: string, status: APIStatus): void {
    this.statusCache.set(key, {
      status,
      timestamp: Date.now()
    })
  }

  /**
   * 获取错误信息
   */
  private getErrorMessage(error: any): string {
    if (error.response) {
      const status = error.response.status
      const data = error.response.data

      if (status === 401) {
        return 'API密钥无效或已过期'
      } else if (status === 403) {
        return '访问被拒绝，权限不足'
      } else if (status === 404) {
        return 'API端点不存在'
      } else if (status === 429) {
        return '请求过于频繁，请稍后重试'
      } else if (status >= 500) {
        return '服务器内部错误'
      }

      return data?.detail || data?.message || `HTTP ${status} 错误`
    } else if (error.request) {
      return '网络连接失败，请检查网络设置'
    } else {
      return error.message || '未知错误'
    }
  }

  /**
   * 格式化响应时间
   */
  formatResponseTime(responseTime?: number): string {
    if (!responseTime) return '-'
    if (responseTime < 1000) {
      return `${responseTime}ms`
    } else {
      return `${(responseTime / 1000).toFixed(2)}s`
    }
  }

  /**
   * 获取状态颜色
   */
  getStatusColor(status: APIStatus['status']): string {
    switch (status) {
      case 'connected': return '#52c41a'
      case 'disconnected': return '#ff4d4f'
      case 'testing': return '#1890ff'
      default: return '#faad14'
    }
  }

  /**
   * 获取状态文本
   */
  getStatusText(status: APIStatus['status']): string {
    switch (status) {
      case 'connected': return '已连接'
      case 'disconnected': return '连接失败'
      case 'testing': return '测试中...'
      default: return '未知状态'
    }
  }
}

// 创建单例实例
const apiStatusService = new ApiStatusService()

export default apiStatusService