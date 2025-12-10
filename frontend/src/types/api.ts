/**
 * API相关的类型定义
 */

import { AxiosError } from 'axios'

/**
 * API标准响应格式
 */
export interface ApiResponse<T = any> {
  data?: T
  message?: string
  error?: string
  error_code?: string
  type?: string
  details?: any
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T = any> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

/**
 * API错误响应格式
 */
export interface ApiErrorResponse {
  error: string
  message: string
  error_code?: string
  type?: string
  details?: any
  status_code?: number
}

/**
 * 认证相关响应
 */
export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  user: UserInfo
}

export interface UserInfo {
  id: number
  email: string
  full_name?: string
  is_active: boolean
  is_superuser: boolean
}

/**
 * 错误类型枚举
 */
export enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 扩展的Axios错误类型
 */
export interface ExtendedAxiosError<T = any> extends AxiosError<ApiErrorResponse> {
  errorType?: ApiErrorType
  retryable?: boolean
}

/**
 * API请求配置
 */
export interface ApiRequestConfig {
  showError?: boolean
  showSuccess?: boolean
  errorMessage?: string
  successMessage?: string
  retry?: boolean
  retryCount?: number
}









