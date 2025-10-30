import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { User, LoginRequest, LoginResponse } from '@/types'

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
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '登录失败')
      }

      // 保存到localStorage
      if (credentials.remember_me) {
        localStorage.setItem('accessToken', data.access_token)
        localStorage.setItem('refreshToken', data.refresh_token)
        localStorage.setItem('lastLoginTime', Date.now().toString())
      }

      return data
    } catch (error: any) {
      return rejectWithValue(
        error.message || '登录失败，请重试'
      )
    }
  }
)

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })
    } catch (error) {
      // 即使logout API失败，也要清除本地数据
      console.warn('Logout API failed:', error)
    }

    // 清除localStorage
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('lastLoginTime')
  }
)

export const refreshAccessToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState }
      const refreshToken = state.auth.refreshToken

      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Token刷新失败')
      }

      localStorage.setItem('accessToken', data.access_token)
      return data.access_token
    } catch (error: any) {
      // 刷新token失败，清除认证信息
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('lastLoginTime')

      return rejectWithValue(
        error.message || 'Token刷新失败'
      )
    }
  }
)

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('No access token available')
      }

      const response = await fetch('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '获取用户信息失败')
      }

      return data
    } catch (error: any) {
      return rejectWithValue(
        error.message || '获取用户信息失败'
      )
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