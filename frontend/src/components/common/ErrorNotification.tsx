import { message, notification } from 'antd'
import { AxiosError } from 'axios'
import logger from '@/utils/logger'

export interface ApiError {
  message?: string
  detail?: string
  error_code?: string
  type?: string
}

/**
 * 统一的错误处理工具
 */
export class ErrorHandler {
  /**
   * 处理API错误
   */
  static handleApiError(error: AxiosError<ApiError>, options?: {
    showNotification?: boolean
    showMessage?: boolean
    customMessage?: string
  }) {
    const { showNotification = true, showMessage = false, customMessage } = options || {}

    // 提取错误信息
    const errorData = error.response?.data
    const errorMessage = 
      customMessage ||
      errorData?.message ||
      errorData?.detail ||
      error.message ||
      '请求失败，请稍后重试'

    // 记录错误日志
    logger.error('API错误:', {
      status: error.response?.status,
      url: error.config?.url,
      message: errorMessage,
      error_code: errorData?.error_code,
    })

    // 显示错误提示
    if (showNotification) {
      notification.error({
        message: '操作失败',
        description: errorMessage,
        duration: 4.5,
        placement: 'topRight',
      })
    }

    if (showMessage) {
      message.error(errorMessage)
    }

    return errorMessage
  }

  /**
   * 处理网络错误
   */
  static handleNetworkError(error: Error, options?: {
    showNotification?: boolean
  }) {
    const { showNotification = true } = options || {}

    logger.error('网络错误:', error)

    const errorMessage = '网络连接失败，请检查网络连接'

    if (showNotification) {
      notification.error({
        message: '网络错误',
        description: errorMessage,
        duration: 4.5,
        placement: 'topRight',
      })
    }

    return errorMessage
  }

  /**
   * 处理超时错误
   */
  static handleTimeoutError(options?: {
    showNotification?: boolean
  }) {
    const { showNotification = true } = options || {}

    const errorMessage = '请求超时，请稍后重试'

    if (showNotification) {
      notification.warning({
        message: '请求超时',
        description: errorMessage,
        duration: 4.5,
        placement: 'topRight',
      })
    }

    return errorMessage
  }

  /**
   * 处理权限错误
   */
  static handlePermissionError(options?: {
    showNotification?: boolean
  }) {
    const { showNotification = true } = options || {}

    const errorMessage = '您没有权限执行此操作'

    if (showNotification) {
      notification.warning({
        message: '权限不足',
        description: errorMessage,
        duration: 4.5,
        placement: 'topRight',
      })
    }

    return errorMessage
  }

  /**
   * 显示成功消息
   */
  static showSuccess(message: string, description?: string) {
    notification.success({
      message,
      description,
      duration: 3,
      placement: 'topRight',
    })
  }

  /**
   * 显示警告消息
   */
  static showWarning(message: string, description?: string) {
    notification.warning({
      message,
      description,
      duration: 4,
      placement: 'topRight',
    })
  }

  /**
   * 显示信息消息
   */
  static showInfo(message: string, description?: string) {
    notification.info({
      message,
      description,
      duration: 3,
      placement: 'topRight',
    })
  }
}









