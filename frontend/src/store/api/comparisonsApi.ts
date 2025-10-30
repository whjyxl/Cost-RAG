import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'
import {
  ProjectComparison,
  CreateComparisonRequest,
  UpdateComparisonRequest,
  ComparisonFilter,
  ApiResponse,
  ComparisonMetric,
  ComparisonChart,
  ComparisonSummary,
  ScenarioAnalysis,
} from '@/types'

const baseQuery = fetchBaseQuery({
  baseUrl: '/api/v1/comparisons',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    return headers
  },
})

export const comparisonsApi = createApi({
  reducerPath: 'comparisonsApi',
  baseQuery,
  tagTypes: ['Comparison', 'ComparisonList', 'ComparisonChart'],
  endpoints: (builder) => ({
    // 创建项目对比
    createComparison: builder.mutation<ProjectComparison, CreateComparisonRequest>({
      query: (comparisonData) => ({
        url: '/',
        method: 'POST',
        body: comparisonData,
      }),
      invalidatesTags: ['ComparisonList'],
      transformResponse: (response: ApiResponse<ProjectComparison>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取对比列表
    getComparisons: builder.query<
      { items: ProjectComparison[]; total: number },
      ComparisonFilter & {
        page?: number
        page_size?: number
        sort_by?: string
        sort_order?: 'asc' | 'desc'
      }
    >({
      query: (params) => ({
        url: '',
        params,
      }),
      providesTags: ['ComparisonList'],
      transformResponse: (response: ApiResponse<{ items: ProjectComparison[]; total: number }>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取对比详情
    getComparisonById: builder.query<ProjectComparison, string>({
      query: (id) => `/${id}`,
      providesTags: (result, error, id) => [{ type: 'Comparison', id }],
      transformResponse: (response: ApiResponse<ProjectComparison>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 更新对比
    updateComparison: builder.mutation<ProjectComparison, { id: string; updates: UpdateComparisonRequest }>({
      query: ({ id, updates }) => ({
        url: `/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Comparison', id }],
      transformResponse: (response: ApiResponse<ProjectComparison>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 删除对比
    deleteComparison: builder.mutation<void, string>({
      query: (id) => ({
        url: `/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ComparisonList'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 批量删除对比
    deleteComparisons: builder.mutation<void, string[]>({
      query: (ids) => ({
        url: '/batch-delete',
        method: 'POST',
        body: { comparison_ids: ids },
      }),
      invalidatesTags: ['ComparisonList'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 添加项目到对比
    addProjectToComparison: builder.mutation<ProjectComparison, { comparisonId: string; projectId: string }>({
      query: ({ comparisonId, projectId }) => ({
        url: `/${comparisonId}/projects`,
        method: 'POST',
        body: { project_id: projectId },
      }),
      invalidatesTags: (result, error, { comparisonId }) => [{ type: 'Comparison', id: comparisonId }],
      transformResponse: (response: ApiResponse<ProjectComparison>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 从对比中移除项目
    removeProjectFromComparison: builder.mutation<ProjectComparison, { comparisonId: string; projectId: string }>({
      query: ({ comparisonId, projectId }) => ({
        url: `/${comparisonId}/projects/${projectId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { comparisonId }) => [{ type: 'Comparison', id: comparisonId }],
      transformResponse: (response: ApiResponse<ProjectComparison>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取对比指标
    getComparisonMetrics: builder.query<ComparisonMetric[], { comparisonId: string; category?: string }>({
      query: ({ comparisonId, category }) => ({
        url: `/${comparisonId}/metrics`,
        params: category ? { category } : {},
      }),
      providesTags: (result, error, { comparisonId }) => [{ type: 'Comparison', id: comparisonId }],
      transformResponse: (response: ApiResponse<ComparisonMetric[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 生成对比图表
    generateComparisonChart: builder.mutation<ComparisonChart, { comparisonId: string; chartType: string; metrics: string[] }>({
      query: ({ comparisonId, ...data }) => ({
        url: `/${comparisonId}/charts`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { comparisonId }) => [{ type: 'ComparisonChart', id: comparisonId }],
      transformResponse: (response: ApiResponse<ComparisonChart>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取对比图表
    getComparisonCharts: builder.query<ComparisonChart[], string>({
      query: (comparisonId) => `/${comparisonId}/charts`,
      providesTags: (result, error, comparisonId) => [{ type: 'ComparisonChart', id: comparisonId }],
      transformResponse: (response: ApiResponse<ComparisonChart[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 删除对比图表
    deleteComparisonChart: builder.mutation<void, { comparisonId: string; chartId: string }>({
      query: ({ comparisonId, chartId }) => ({
        url: `/${comparisonId}/charts/${chartId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { comparisonId }) => [{ type: 'ComparisonChart', id: comparisonId }],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 获取对比摘要
    getComparisonSummary: builder.query<ComparisonSummary, string>({
      query: (id) => `/${id}/summary`,
      providesTags: (result, error, id) => [{ type: 'Comparison', id }],
      transformResponse: (response: ApiResponse<ComparisonSummary>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 导出对比报告
    exportComparison: builder.mutation<Blob, { id: string; format: 'excel' | 'pdf' | 'powerpoint' }>({
      query: ({ id, format }) => ({
        url: `/${id}/export`,
        method: 'POST',
        body: { format },
        responseHandler: (response) => response.blob(),
      }),
    }),

    // 场景分析
    performScenarioAnalysis: builder.mutation<ScenarioAnalysis, { comparisonId: string; scenarios: any[] }>({
      query: ({ comparisonId, scenarios }) => ({
        url: `/${comparisonId}/scenarios`,
        method: 'POST',
        body: { scenarios },
      }),
      invalidatesTags: (result, error, { comparisonId }) => [{ type: 'Comparison', id: comparisonId }],
      transformResponse: (response: ApiResponse<ScenarioAnalysis>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取场景分析结果
    getScenarioAnalysis: builder.query<ScenarioAnalysis, string>({
      query: (comparisonId) => `/${comparisonId}/scenarios`,
      providesTags: (result, error, comparisonId) => [{ type: 'Comparison', id: comparisonId }],
      transformResponse: (response: ApiResponse<ScenarioAnalysis>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 复制对比
    copyComparison: builder.mutation<ProjectComparison, { id: string; name: string }>({
      query: ({ id, name }) => ({
        url: `/${id}/copy`,
        method: 'POST',
        body: { name },
      }),
      invalidatesTags: ['ComparisonList'],
      transformResponse: (response: ApiResponse<ProjectComparison>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 分享对比
    shareComparison: builder.mutation<{ share_url: string; share_token: string }, { id: string; permissions: string[] }>({
      query: ({ id, permissions }) => ({
        url: `/${id}/share`,
        method: 'POST',
        body: { permissions },
      }),
      transformResponse: (response: ApiResponse<{ share_url: string; share_token: string }>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),
  }),
})

// 导出hooks
export const {
  useCreateComparisonMutation,
  useGetComparisonsQuery,
  useLazyGetComparisonsQuery,
  useGetComparisonByIdQuery,
  useUpdateComparisonMutation,
  useDeleteComparisonMutation,
  useDeleteComparisonsMutation,
  useAddProjectToComparisonMutation,
  useRemoveProjectFromComparisonMutation,
  useGetComparisonMetricsQuery,
  useGenerateComparisonChartMutation,
  useGetComparisonChartsQuery,
  useDeleteComparisonChartMutation,
  useGetComparisonSummaryQuery,
  useExportComparisonMutation,
  usePerformScenarioAnalysisMutation,
  useGetScenarioAnalysisQuery,
  useCopyComparisonMutation,
  useShareComparisonMutation,
} = comparisonsApi

// 导出endpoints供手动调用
export const comparisonsEndpoints = comparisonsApi.endpoints