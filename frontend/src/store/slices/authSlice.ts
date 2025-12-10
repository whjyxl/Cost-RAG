import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { User, LoginRequest, LoginResponse } from '@/types'
import logger from '@/utils/logger'
import { request, AxiosError } from '@/utils/request'
import { ApiErrorResponse } from '@/types/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  lastLoginTime: number | null
}

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,
  error: null,
  lastLoginTime: localStorage.getItem('lastLoginTime')
    ? parseInt(localStorage.getItem('lastLoginTime')!)
    : null,
}

// 异步thunk actions
export const loginUser = createAsyncThunk<LoginResponse, LoginRequest>(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      logger.debug('开始登录请求...', credentials.email)

      // 确保字段名正确：前端使用email字段，与后端保持一致
      const requestData = {
        email: credentials.email,
        password: credentials.password,
        remember_me: credentials.remember_me || false
      }

      // 使用统一的API客户端
      // request拦截器已经返回response.data，所以直接得到LoginResponse类型
      const response = await request.post('/api/v1/auth/login', requestData)
      const data = response as unknown as LoginResponse
      logger.debug('登录响应:', { hasToken: !!data.access_token })

      // 保存到localStorage - 修复：无论是否记住我都保存token，否则用户无法正常使用
      if (data.access_token) {
        localStorage.setItem('accessToken', data.access_token)
        logger.debug('Token已保存到localStorage')
      }

      localStorage.setItem('refreshToken', data.refresh_token || '')
      localStorage.setItem('lastLoginTime', Date.now().toString())

      logger.info('登录成功，用户信息:', data.user)
      return data
    } catch (error) {
      logger.error('登录失败:', error)
      const axiosError = error as AxiosError<ApiErrorResponse>
      const errorMessage = 
        axiosError.response?.data?.message ||
        axiosError.message ||
        '登录失败，请重试'
      return rejectWithValue(errorMessage)
    }
  }
)

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await request.post('/api/v1/auth/logout')
    } catch (error) {
      // 即使logout API失败，也要清除本地数据
      logger.warn('Logout API failed:', error)
    }

    // 清除localStorage
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('lastLoginTime')
  }
)

export const refreshAccessToken = createAsyncThunk<string, void>(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState }
      const refreshToken = state.auth.refreshToken

      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await request.post('/api/v1/auth/refresh', {
        refresh_token: refreshToken
      })
      const data = response as unknown as { access_token: string }
      const accessToken = data.access_token
      localStorage.setItem('accessToken', accessToken)
      return accessToken
    } catch (error) {
      // 刷新token失败，清除认证信息
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('lastLoginTime')

      const axiosError = error as AxiosError<ApiErrorResponse>
      const errorMessage = 
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Token刷新失败'
      return rejectWithValue(errorMessage)
    }
  }
)

export const getCurrentUser = createAsyncThunk<User, void>(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('No access token available')
      }

      const response = await request.get('/api/v1/auth/me')
      const data = response as unknown as User
      return data
    } catch (error) {
      const axiosError = error as AxiosError<ApiErrorResponse>
      const errorMessage = 
        axiosError.response?.data?.message ||
        axiosError.message ||
        '获取用户信息失败'
      return rejectWithValue(errorMessage)
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // 清除错误
    clearError: (state) => {
      state.error = null
    },

    // 设置加载状态
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },

    // 更新用户信息
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },

    // 检查token有效性
    checkTokenValidity: (state) => {
      const token = state.accessToken
      if (token) {
        try {
          // 解析JWT token
          const payload = JSON.parse(atob(token.split('.')[1]))
          const currentTime = Date.now() / 1000

          if (payload.exp < currentTime) {
            // Token过期
            state.isAuthenticated = false
            state.accessToken = null
            state.refreshToken = null
            state.user = null
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
          }
        } catch (error) {
          // Token无效
          state.isAuthenticated = false
          state.accessToken = null
          state.refreshToken = null
          state.user = null
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        }
      }
    },

    // 从localStorage恢复认证状态
    restoreAuthState: (state) => {
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')
      const lastLoginTime = localStorage.getItem('lastLoginTime')

      state.accessToken = accessToken
      state.refreshToken = refreshToken
      state.lastLoginTime = lastLoginTime ? parseInt(lastLoginTime) : null
      state.isAuthenticated = !!accessToken
    },
  },
  extraReducers: (builder) => {
    // 登录
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<LoginResponse>) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.user = action.payload.user
        state.accessToken = action.payload.access_token
        state.refreshToken = action.payload.refresh_token
        state.lastLoginTime = Date.now()
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.error = action.payload as string
      })

    // 登出
    builder
      .addCase(logout.pending, (state) => {
        state.isLoading = true
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.lastLoginTime = null
        state.error = null
      })
      .addCase(logout.rejected, (state) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.lastLoginTime = null
      })

    // 刷新token
    builder
      .addCase(refreshAccessToken.pending, (state) => {
        state.isLoading = true
      })
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.isLoading = false
        state.accessToken = action.payload
        state.error = null
      })
      .addCase(refreshAccessToken.rejected, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.lastLoginTime = null
        state.error = action.payload as string
      })

    // 获取当前用户
    builder
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getCurrentUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.isLoading = false
        state.user = action.payload
        state.isAuthenticated = true
        state.error = null
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

// 导出actions
export const {
  clearError,
  setLoading,
  updateUser,
  checkTokenValidity,
  restoreAuthState,
} = authSlice.actions

// thunk actions已在定义时导出

// 选择器
export const selectAuth = (state: { auth: AuthState }) => state.auth
export const selectUser = (state: { auth: AuthState }) => state.auth.user
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error

export default authSlice.reducer