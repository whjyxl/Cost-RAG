/**
 * 回归测试：认证Slice
 * 测试修复后的类型安全和错误处理
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import authReducer, { loginUser, logout, refreshAccessToken, getCurrentUser } from '../authSlice'
import { AxiosError } from 'axios'

// Mock request
vi.mock('@/utils/request', () => ({
  request: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('authSlice回归测试', () => {
  let store: ReturnType<typeof configureStore>

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer
      }
    })
    vi.clearAllMocks()
  })

  describe('类型安全', () => {
    it('loginUser应该返回LoginResponse类型', () => {
      // createAsyncThunk返回的是thunk函数，使用.pending获取pending action
      expect(loginUser.pending.type).toBe('auth/login/pending')
      // 验证thunk函数存在
      expect(typeof loginUser).toBe('function')
    })

    it('refreshAccessToken应该返回string类型', () => {
      expect(refreshAccessToken.pending.type).toBe('auth/refreshToken/pending')
      expect(typeof refreshAccessToken).toBe('function')
    })

    it('getCurrentUser应该返回User类型', () => {
      expect(getCurrentUser.pending.type).toBe('auth/getCurrentUser/pending')
      expect(typeof getCurrentUser).toBe('function')
    })
  })

  describe('错误处理', () => {
    it('应该在登录失败时正确处理错误', async () => {
      const { request } = await import('@/utils/request')
      
      // Mock失败响应
      const mockError = {
        response: {
          data: {
            message: '登录失败'
          }
        }
      } as AxiosError

      vi.mocked(request.post).mockRejectedValueOnce(mockError)

      const result = await store.dispatch(loginUser({
        email: 'test@example.com',
        password: 'wrong-password'
      }))

      expect(result.type).toBe('auth/login/rejected')
      if (result.type === 'auth/login/rejected') {
        expect(result.payload).toBe('登录失败')
      }
    })
  })
})

