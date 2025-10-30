import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'
import {
  CostEstimate,
  CreateEstimateRequest,
  UpdateEstimateRequest,
  EstimateFilter,
  ApiResponse,
  CostItem,
  EstimateSummary,
  ComparisonResult,
  HistoricalProject,
  ExcelParseResult,
  HistoricalProjectSearchParams,
  SimilarProjectRequest,
  ProjectMatch,
  BatchImportRequest,
  BatchImportResult,
  PaginatedResponse,
} from '@/types'

const baseQuery = fetchBaseQuery({
  baseUrl: '/api/v1/estimates',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    return headers
  },
})

export const estimatesApi = createApi({
  reducerPath: 'estimatesApi',
  baseQuery,
  tagTypes: ['Estimate', 'EstimateList', 'CostItem', 'HistoricalProject', 'HistoricalProjectList'],
  endpoints: (builder) => ({
    // 创建成本估算
    createEstimate: builder.mutation<CostEstimate, CreateEstimateRequest>({
      query: (estimateData) => ({
        url: '/',
        method: 'POST',
        body: estimateData,
      }),
      invalidatesTags: ['EstimateList'],
      transformResponse: (response: ApiResponse<CostEstimate>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取估算列表
    getEstimates: builder.query<
      { items: CostEstimate[]; total: number },
      EstimateFilter & {
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
      providesTags: ['EstimateList'],
      transformResponse: (response: ApiResponse<{ items: CostEstimate[]; total: number }>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取估算详情
    getEstimateById: builder.query<CostEstimate, string>({
      query: (id) => `/${id}`,
      providesTags: (result, error, id) => [{ type: 'Estimate', id }],
      transformResponse: (response: ApiResponse<CostEstimate>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 更新估算
    updateEstimate: builder.mutation<CostEstimate, { id: string; updates: UpdateEstimateRequest }>({
      query: ({ id, updates }) => ({
        url: `/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Estimate', id }],
      transformResponse: (response: ApiResponse<CostEstimate>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 删除估算
    deleteEstimate: builder.mutation<void, string>({
      query: (id) => ({
        url: `/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['EstimateList'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 批量删除估算
    deleteEstimates: builder.mutation<void, string[]>({
      query: (ids) => ({
        url: '/batch-delete',
        method: 'POST',
        body: { estimate_ids: ids },
      }),
      invalidatesTags: ['EstimateList'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 复制估算
    copyEstimate: builder.mutation<CostEstimate, { id: string; name: string }>({
      query: ({ id, name }) => ({
        url: `/${id}/copy`,
        method: 'POST',
        body: { name },
      }),
      invalidatesTags: ['EstimateList'],
      transformResponse: (response: ApiResponse<CostEstimate>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 添加成本项
    addCostItem: builder.mutation<CostItem, { estimateId: string; item: Omit<CostItem, 'id'> }>({
      query: ({ estimateId, item }) => ({
        url: `/${estimateId}/items`,
        method: 'POST',
        body: item,
      }),
      invalidatesTags: (result, error, { estimateId }) => [{ type: 'Estimate', id: estimateId }],
      transformResponse: (response: ApiResponse<CostItem>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 更新成本项
    updateCostItem: builder.mutation<CostItem, { estimateId: string; itemId: string; updates: Partial<CostItem> }>({
      query: ({ estimateId, itemId, updates }) => ({
        url: `/${estimateId}/items/${itemId}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { estimateId }) => [{ type: 'Estimate', id: estimateId }],
      transformResponse: (response: ApiResponse<CostItem>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 删除成本项
    deleteCostItem: builder.mutation<void, { estimateId: string; itemId: string }>({
      query: ({ estimateId, itemId }) => ({
        url: `/${estimateId}/items/${itemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { estimateId }) => [{ type: 'Estimate', id: estimateId }],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 获取估算摘要
    getEstimateSummary: builder.query<EstimateSummary, string>({
      query: (id) => `/${id}/summary`,
      providesTags: (result, error, id) => [{ type: 'Estimate', id }],
      transformResponse: (response: ApiResponse<EstimateSummary>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 导出估算
    exportEstimate: builder.mutation<Blob, { id: string; format: 'excel' | 'pdf' }>({
      query: ({ id, format }) => ({
        url: `/${id}/export`,
        method: 'POST',
        body: { format },
        responseHandler: (response) => response.blob(),
      }),
    }),

    // 获取估算模板
    getEstimateTemplates: builder.query<CostEstimate[], void>({
      query: () => '/templates',
      transformResponse: (response: ApiResponse<CostEstimate[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 从模板创建估算
    createFromTemplate: builder.mutation<CostEstimate, { templateId: string; name: string; projectInfo: any }>({
      query: ({ templateId, ...data }) => ({
        url: `/templates/${templateId}/create`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['EstimateList'],
      transformResponse: (response: ApiResponse<CostEstimate>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 计算估算
    calculateEstimate: builder.mutation<CostEstimate, string>({
      query: (id) => ({
        url: `/${id}/calculate`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Estimate', id }],
      transformResponse: (response: ApiResponse<CostEstimate>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取成本项建议
    getCostItemSuggestions: builder.query<CostItem[], { estimateId: string; category?: string }>({
      query: ({ estimateId, category }) => ({
        url: `/${estimateId}/suggestions`,
        params: category ? { category } : {},
      }),
      transformResponse: (response: ApiResponse<CostItem[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // ===== 历史项目数据相关API =====

    // Excel项目解析
    parseExcelProject: builder.mutation<ExcelParseResult, FormData>({
      query: (formData) => ({
        url: '/historical/parse-excel',
        method: 'POST',
        body: formData,
        formData: true,
      }),
      transformResponse: (response: ApiResponse<ExcelParseResult>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 批量Excel项目解析
    batchParseExcelProjects: builder.mutation<ExcelParseResult[], FormData[]>({
      query: (formDataArray) => ({
        url: '/historical/batch-parse-excel',
        method: 'POST',
        body: formDataArray,
      }),
      transformResponse: (response: ApiResponse<ExcelParseResult[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取历史项目列表
    getHistoricalProjects: builder.query<PaginatedResponse<HistoricalProject>, HistoricalProjectSearchParams>({
      query: (params) => ({
        url: '/historical',
        params,
      }),
      providesTags: ['HistoricalProjectList'],
      transformResponse: (response: ApiResponse<PaginatedResponse<HistoricalProject>>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取历史项目详情
    getHistoricalProjectById: builder.query<HistoricalProject, string>({
      query: (id) => `/historical/${id}`,
      providesTags: (result, error, id) => [{ type: 'HistoricalProject', id }],
      transformResponse: (response: ApiResponse<HistoricalProject>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 创建历史项目
    createHistoricalProject: builder.mutation<HistoricalProject, Omit<HistoricalProject, 'id' | 'created_at' | 'updated_at' | 'created_by'>>({
      query: (projectData) => ({
        url: '/historical',
        method: 'POST',
        body: projectData,
      }),
      invalidatesTags: ['HistoricalProjectList'],
      transformResponse: (response: ApiResponse<HistoricalProject>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 更新历史项目
    updateHistoricalProject: builder.mutation<HistoricalProject, { id: string; data: Partial<HistoricalProject> }>({
      query: ({ id, data }) => ({
        url: `/historical/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'HistoricalProject', id }],
      transformResponse: (response: ApiResponse<HistoricalProject>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 删除历史项目
    deleteHistoricalProject: builder.mutation<void, string>({
      query: (id) => ({
        url: `/historical/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['HistoricalProjectList'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 批量删除历史项目
    deleteHistoricalProjects: builder.mutation<void, string[]>({
      query: (ids) => ({
        url: '/historical/batch-delete',
        method: 'POST',
        body: { project_ids: ids },
      }),
      invalidatesTags: ['HistoricalProjectList'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 搜索相似项目
    findSimilarProjects: builder.query<ProjectMatch[], SimilarProjectRequest>({
      query: (requestData) => ({
        url: '/historical/similar-projects',
        method: 'POST',
        body: requestData,
      }),
      transformResponse: (response: ApiResponse<ProjectMatch[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 批量导入历史项目
    batchImportHistoricalProjects: builder.mutation<BatchImportResult, BatchImportRequest>({
      query: (importRequest) => ({
        url: '/historical/batch-import',
        method: 'POST',
        body: importRequest,
      }),
      invalidatesTags: ['HistoricalProjectList'],
      transformResponse: (response: ApiResponse<BatchImportResult>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取历史项目统计信息
    getHistoricalProjectStatistics: builder.query<{
      total_projects: number
      project_type_distribution: Record<string, number>
      quality_level_distribution: Record<string, number>
      average_unit_cost: number
      cost_range: { min: number; max: number }
      data_source_distribution: Record<string, number>
      recent_uploads: HistoricalProject[]
    }, void>({
      query: () => '/historical/statistics',
      transformResponse: (response: ApiResponse<any>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 导出历史项目数据
    exportHistoricalProjects: builder.mutation<Blob, {
      project_ids?: string[]
      format: 'excel' | 'csv' | 'json'
      filters?: HistoricalProjectSearchParams
    }>({
      query: (exportData) => ({
        url: '/historical/export',
        method: 'POST',
        body: exportData,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // 验证历史项目数据质量
    validateHistoricalProjectData: builder.mutation<{
      validation_score: number
      issues: Array<{
        type: string
        severity: string
        message: string
        suggestions: string[]
      }>
      recommendations: string[]
    }, { project_id: string }>({
      query: ({ project_id }) => ({
        url: `/historical/${project_id}/validate`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<any>) => {
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
  useCreateEstimateMutation,
  useGetEstimatesQuery,
  useLazyGetEstimatesQuery,
  useGetEstimateByIdQuery,
  useUpdateEstimateMutation,
  useDeleteEstimateMutation,
  useDeleteEstimatesMutation,
  useCopyEstimateMutation,
  useAddCostItemMutation,
  useUpdateCostItemMutation,
  useDeleteCostItemMutation,
  useGetEstimateSummaryQuery,
  useExportEstimateMutation,
  useGetEstimateTemplatesQuery,
  useCreateFromTemplateMutation,
  useCalculateEstimateMutation,
  useGetCostItemSuggestionsQuery,
  // 历史项目相关hooks
  useParseExcelProjectMutation,
  useBatchParseExcelProjectsMutation,
  useGetHistoricalProjectsQuery,
  useLazyGetHistoricalProjectsQuery,
  useGetHistoricalProjectByIdQuery,
  useCreateHistoricalProjectMutation,
  useUpdateHistoricalProjectMutation,
  useDeleteHistoricalProjectMutation,
  useDeleteHistoricalProjectsMutation,
  useLazyFindSimilarProjectsQuery,
  useBatchImportHistoricalProjectsMutation,
  useGetHistoricalProjectStatisticsQuery,
  useExportHistoricalProjectsMutation,
  useValidateHistoricalProjectDataMutation,
} = estimatesApi

// 导出endpoints供手动调用
export const estimatesEndpoints = estimatesApi.endpoints