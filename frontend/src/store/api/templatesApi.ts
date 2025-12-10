import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'

// 类型定义
export interface ProjectTemplateCostItem {
  id: number
  template_id: number
  item_code: string
  item_name: string
  item_type: string
  total_price: number | null
  unit_price: number | null
  notes: string | null
  is_primary_section: boolean
  is_secondary_section: boolean
  primary_section_code: string | null
  row_number: number | null
  created_at: string
  updated_at: string | null
}

export interface ProjectTemplate {
  id: number
  name: string
  project_type: string | null
  area: number
  floors: string | null
  underground_floors: number | null
  aboveground_floors: number | null
  start_date: string | null
  completion_date: string | null
  total_cost: number | null
  unit_cost: number | null
  source_file: string | null
  parsed_at: string
  is_enabled: boolean
  created_by: number | null
  created_at: string
  updated_at: string | null
  cost_items: ProjectTemplateCostItem[]
}

export interface ProjectTemplateList {
  templates: ProjectTemplate[]
  total: number
  page: number
  size: number
  pages: number
}

export interface TemplateSearchParams {
  page?: number
  size?: number
  is_enabled?: boolean
  project_type?: string
}

export interface SaveParsedDataResponse {
  template_ids: number[]
  message: string
}

// 基础查询配置
const baseQuery = fetchBaseQuery({
  baseUrl: '/api/v1/templates',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    return headers
  },
})

export const templatesApi = createApi({
  reducerPath: 'templatesApi',
  baseQuery,
  tagTypes: ['Template', 'TemplateList'],
  endpoints: (builder) => ({
    // 上传Excel文件
    uploadExcel: builder.mutation<SaveParsedDataResponse, FormData>({
      query: (formData) => ({
        url: '/upload',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['TemplateList'],
    }),

    // 获取模板列表
    getTemplates: builder.query<ProjectTemplateList, TemplateSearchParams>({
      query: (params = {}) => ({
        url: '/',
        params: {
          page: params.page || 1,
          size: params.size || 20,
          ...params,
        },
      }),
      providesTags: ['TemplateList'],
    }),

    // 获取模板详情
    getTemplateById: builder.query<ProjectTemplate, number>({
      query: (id) => `/${id}`,
      providesTags: (result, error, id) => [{ type: 'Template', id }],
    }),

    // 更新模板
    updateTemplate: builder.mutation<ProjectTemplate, { id: number; data: Partial<ProjectTemplate> }>({
      query: ({ id, data }) => ({
        url: `/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Template', id },
        'TemplateList',
      ],
    }),

    // 删除模板
    deleteTemplate: builder.mutation<{ message: string }, number>({
      query: (id) => ({
        url: `/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['TemplateList'],
    }),
  }),
})

export const {
  useUploadExcelMutation,
  useGetTemplatesQuery,
  useLazyGetTemplatesQuery,
  useGetTemplateByIdQuery,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
} = templatesApi
