import axios, { 
  AxiosInstance, 
  InternalAxiosRequestConfig, 
  AxiosResponse,
  AxiosRequestConfig,
  AxiosError,
  CancelTokenSource
} from 'axios'
import logger from './logger'
import { ErrorHandler } from '@/components/common/ErrorNotification'
import { ApiErrorResponse } from '@/types/api'

// API响应基础类型
export interface ApiResponse<T = any> {
  data?: T
  message?: string
  error?: string
  error_code?: string
}

// 请求重试配置
interface RetryConfig {
  retries?: number
  retryDelay?: number
  retryCondition?: (error: AxiosError) => boolean
}

// 扩展请求配置
export interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  retry?: RetryConfig
  skipErrorHandler?: boolean
  skipAuth?: boolean
}

// 创建axios实例
const request: AxiosInstance = axios.create({
  baseURL: '',  // 移除重复的/api前缀，让前端代码直接使用完整路径
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求取消Token映射
const cancelTokenMap = new Map<string, CancelTokenSource>()

/**
 * 创建可取消的请求
 */
function createCancelToken(key: string): CancelTokenSource {
  // 如果已存在，先取消之前的请求
  const existing = cancelTokenMap.get(key)
  if (existing) {
    existing.cancel('Request cancelled due to new request')
  }

  const source = axios.CancelToken.source()
  cancelTokenMap.set(key, source)
  return source
}

/**
 * 取消请求
 */
function cancelRequest(key: string) {
  const source = cancelTokenMap.get(key)
  if (source) {
    source.cancel('Request cancelled by user')
    cancelTokenMap.delete(key)
  }
}

/**
 * 请求重试函数
 */
async function retryRequest(
  error: AxiosError,
  config: InternalAxiosRequestConfig,
  retryConfig: RetryConfig
): Promise<AxiosResponse> {
  const { retries = 3, retryDelay = 1000, retryCondition } = retryConfig

  // 检查是否应该重试
  if (retryCondition && !retryCondition(error)) {
    throw error
  }

  // 检查重试次数
  const retryCount = (config as any).__retryCount || 0
  if (retryCount >= retries) {
    throw error
  }

  // 增加重试计数
  (config as any).__retryCount = retryCount + 1

  // 等待后重试
  await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)))

  logger.debug(`请求重试 (${retryCount + 1}/${retries}):`, config.url)

  // 重新发起请求
  return request(config)
}

// 请求拦截器
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 跳过认证的请求不添加token
    const extendedConfig = config as ExtendedAxiosRequestConfig
    if (!extendedConfig.skipAuth) {
      // 从localStorage获取token
      const token = localStorage.getItem('accessToken')
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    // 添加请求时间戳（用于性能监控）
    ;(config as any).__requestStartTime = Date.now()

    return config
  },
  (error) => {
    logger.error('请求拦截器错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  <T = any>(response: AxiosResponse<T>) => {
    // 计算请求耗时
    const requestStartTime = (response.config as any).__requestStartTime
    if (requestStartTime) {
      const duration = Date.now() - requestStartTime
      logger.debug(`请求完成: ${response.config.url} (${duration}ms)`)
    }

    return response.data as T
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const config = error.config as ExtendedAxiosRequestConfig

    // 如果是取消请求，直接抛出
    if (axios.isCancel(error)) {
      logger.debug('请求已取消:', config?.url)
      return Promise.reject(error)
    }

    // 检查是否需要重试
    if (config?.retry && !(config as any).__retryCount) {
      try {
        const retryResponse = await retryRequest(error, config as InternalAxiosRequestConfig, config.retry)
        return retryResponse.data
      } catch (retryError) {
        // 重试失败，继续错误处理流程
      }
    }

    // 跳过错误处理的请求（某些场景需要手动处理错误）
    if (config?.skipErrorHandler) {
      return Promise.reject(error)
    }

    // 使用ErrorHandler统一处理错误
    const errorData = error.response?.data
    const status = error.response?.status

    if (status === 401) {
      // 只有真正的401认证错误才清除本地存储并跳转到登录页
      // 排除登录API本身的401错误，避免清除刚获取的token
      const isLoginApi = config?.url?.includes('/api/v1/auth/login')

      if (!isLoginApi) {
        // 显示友好的提示消息
        import('antd').then(({ message }) => {
          message.warning('登录已过期，请重新登录', 2)
        })
        
        logger.warn('401 认证失败，跳转到登录页')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('lastLoginTime')
        
        // 延迟跳转，让用户看到提示
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      } else {
        logger.debug('登录API返回401，不清除localStorage')
      }
    } else if (status === 403) {
      // 403权限错误
      ErrorHandler.handlePermissionError()
    } else if (error.code === 'ECONNABORTED') {
      // 请求超时
      ErrorHandler.handleTimeoutError()
    } else if (!error.response) {
      // 网络错误
      ErrorHandler.handleNetworkError(error)
    } else {
      // 其他错误
      ErrorHandler.handleApiError(error)
    }

    return Promise.reject(error)
  }
)

// 类型辅助：由于响应拦截器返回response.data，所以实际返回类型是T而不是AxiosResponse<T>
type RequestResponse<T> = T

// 导出常用的请求方法（带类型定义）
// 注意：响应拦截器已经返回response.data，所以直接返回T类型
export const get = <T = any>(
  url: string, 
  config?: ExtendedAxiosRequestConfig
): Promise<RequestResponse<T>> => {
  return request.get(url, config) as Promise<RequestResponse<T>>
}

export const post = <T = any, D = any>(
  url: string, 
  data?: D, 
  config?: ExtendedAxiosRequestConfig
): Promise<RequestResponse<T>> => {
  return request.post(url, data, config) as Promise<RequestResponse<T>>
}

export const put = <T = any, D = any>(
  url: string, 
  data?: D, 
  config?: ExtendedAxiosRequestConfig
): Promise<RequestResponse<T>> => {
  return request.put(url, data, config) as Promise<RequestResponse<T>>
}

export const del = <T = any>(
  url: string, 
  config?: ExtendedAxiosRequestConfig
): Promise<RequestResponse<T>> => {
  return request.delete(url, config) as Promise<RequestResponse<T>>
}

export { request }
export default request

// 导出类型和工具函数
export type { AxiosError, AxiosRequestConfig, AxiosResponse }
export { createCancelToken, cancelRequest }