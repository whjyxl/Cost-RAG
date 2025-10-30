import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'
import { LoginRequest, LoginResponse, User, ApiResponse } from '@/types'

// 基础查询配置
const baseQuery = fetchBaseQuery({
  baseUrl: '/api/v1/auth',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    headers.set('content-type', 'application/json')
    return headers
  },
})

// 带错误处理的baseQuery
const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
  let result = await baseQuery(args, api, extraOptions)

  // 处理401错误
  if (result.error && result.error.status === 401) {
    console.log('Token expired, attempting to refresh...')

    // 尝试刷新token
    const refreshResult = await baseQuery(
      {
        url: '/refresh',
        method: 'POST',
        body: {
          refresh_token: (api.getState() as RootState).auth.refreshToken,
        },
      },
      api,
      extraOptions
    )

    if (refreshResult.data) {
      // 刷新成功，重试原始请求
      const newToken = (refreshResult.data as LoginResponse).access_token
      api.dispatch({ type: 'auth/setAccessToken', payload: newToken })

      // 重新设置headers
      const headers = new Headers()
      headers.set('authorization', `Bearer ${newToken}`)
      headers.set('content-type', 'application/json')

      // 重试原始请求
      result = await baseQuery(
        {
          ...args,
          headers,
        },
        api,
        extraOptions
      )
    } else {
      // 刷新失败，登出用户
      api.dispatch(logout())
    }
  }

  return result
}

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Auth'],
  endpoints: (builder) => ({
    // 登录
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
      transformResponse: (response: ApiResponse<LoginResponse>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 登出
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth', 'User'],
    }),

    // 刷新token
    refreshToken: builder.mutation<LoginResponse, { refresh_token: string }>({
      query: ({ refresh_token }) => ({
        url: '/refresh',
        method: 'POST',
        body: { refresh_token },
      }),
      invalidatesTags: ['Auth'],
      transformResponse: (response: ApiResponse<LoginResponse>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取当前用户信息
    getCurrentUser: builder.query<User, void>({
      query: () => '/me',
      providesTags: ['User'],
      transformResponse: (response: ApiResponse<User>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 更新用户信息
    updateUser: builder.mutation<User, Partial<User>>({
      query: (userData) => ({
        url: '/me',
        method: 'PUT',
        body: userData,
      }),
      invalidatesTags: ['User'],
      transformResponse: (response: ApiResponse<User>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 修改密码
    changePassword: builder.mutation<void, {
      current_password: string
      new_password: string
    }>({
      query: (passwordData) => ({
        url: '/change-password',
        method: 'POST',
        body: passwordData,
      }),
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 忘记密码
    forgotPassword: builder.mutation<void, { email: string }>({
      query: ({ email }) => ({
        url: '/forgot-password',
        method: 'POST',
        body: { email },
      }),
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 重置密码
    resetPassword: builder.mutation<void, {
      token: string
      new_password: string
    }>({
      query: ({ token, new_password }) => ({
        url: '/reset-password',
        method: 'POST',
        body: { token, new_password },
      }),
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 验证邮箱
    verifyEmail: builder.mutation<void, { token: string }>({
      query: ({ token }) => ({
        url: '/verify-email',
        method: 'POST',
        body: { token },
      }),
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 重新发送验证邮件
    resendVerificationEmail: builder.mutation<void, void>({
      query: () => ({
        url: '/resend-verification',
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),
  }),
})

// 导出hooks
export const {
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetCurrentUserQuery,
  useUpdateUserMutation,
  useChangePasswordMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
} = authApi

// 导出endpoints供手动调用
export const authEndpoints = authApi.endpoints