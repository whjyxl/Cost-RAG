import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'

// 基础查询配置
const baseQuery = fetchBaseQuery({
  baseUrl: '/api/v1/documents',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    return headers
  },
})

export const documentsApi = createApi({
  reducerPath: 'documentsApi',
  baseQuery,
  tagTypes: ['Document', 'DocumentList'],
  endpoints: (builder) => ({
    // 上传文档
    uploadDocument: builder.mutation({
      query: (formData: FormData) => ({
        url: '/upload',
        method: 'POST',
        body: formData,
        formData: true,
      }),
      invalidatesTags: ['DocumentList'],
    }),

    // 获取文档列表
    getDocuments: builder.query({
      query: (params) => ({
        url: '',
        params,
      }),
      providesTags: ['DocumentList'],
    }),

    // 获取文档统计信息
    getDocumentStats: builder.query({
      query: () => '/stats',
      providesTags: ['DocumentList'],
    }),

    // 获取文档详情
    getDocumentById: builder.query({
      query: (id) => `/${id}`,
      providesTags: (result, error, id) => [{ type: 'Document', id }],
    }),

    // 更新文档信息
    updateDocument: builder.mutation({
      query: ({ id, updates }) => ({
        url: `/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Document', id }],
    }),

    // 删除文档
    deleteDocument: builder.mutation({
      query: (id) => ({
        url: `/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['DocumentList'],
    }),
  }),
})

// 导出hooks
export const {
  useUploadDocumentMutation,
  useGetDocumentsQuery,
  useLazyGetDocumentsQuery,
  useGetDocumentByIdQuery,
  useGetDocumentStatsQuery,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
} = documentsApi

// 导出endpoints供手动调用
export const documentsEndpoints = documentsApi.endpoints