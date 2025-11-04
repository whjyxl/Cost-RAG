import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

// 创建axios实例
const request: AxiosInstance = axios.create({
  baseURL: '',  // 移除重复的/api前缀，让前端代码直接使用完整路径
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从localStorage获取token
    const token = localStorage.getItem('accessToken')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data
  },
  (error) => {
    console.error('API请求错误:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message
    })

    if (error.response?.status === 401) {
      // 只有真正的401认证错误才清除本地存储并跳转到登录页
      // 排除登录API本身的401错误，避免清除刚获取的token
      const isLoginApi = error.config?.url?.includes('/api/v1/auth/login')

      if (!isLoginApi) {
        console.warn('401 认证失败，跳转到登录页')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('lastLoginTime')
        window.location.href = '/login'
      } else {
        console.warn('登录API返回401，不清除localStorage')
      }
    } else if (error.response?.status === 403) {
      // 403权限错误，不跳转到登录页，只显示错误信息
      console.warn('403 权限不足')
      // 不清除token，不跳转
    } else if (error.code === 'ECONNABORTED') {
      // 请求超时，不跳转
      console.warn('请求超时')
    } else if (!error.response) {
      // 网络错误，不跳转
      console.warn('网络连接错误')
    }

    return Promise.reject(error)
  }
)

export { request }
export default request

// 导出常用的请求方法
export const get = (url: string, config?: any) => {
  return request.get(url, config)
}

export const post = (url: string, data?: any, config?: any) => {
  return request.post(url, data, config)
}

export const put = (url: string, data?: any, config?: any) => {
  return request.put(url, data, config)
}

export const del = (url: string, config?: any) => {
  return request.delete(url, config)
}