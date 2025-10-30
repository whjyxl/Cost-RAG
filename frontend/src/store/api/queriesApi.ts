import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'
import {
  RAGQuery,
  CreateQueryRequest,
  QueryHistory,
  QueryFilter,
  ApiResponse,
  QueryResponse,
  QuerySuggestion,
  QueryTemplate,
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  Conversation,
  ChatMessage,
} from '@/types'

const baseQuery = fetchBaseQuery({
  baseUrl: '/api/v1/queries',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    return headers
  },
})

export const queriesApi = createApi({
  reducerPath: 'queriesApi',
  baseQuery,
  tagTypes: ['Query', 'QueryList', 'QueryHistory', 'Conversation', 'KnowledgeGraph'],
  endpoints: (builder) => ({
    // 执行RAG查询
    executeQuery: builder.mutation<QueryResponse, CreateQueryRequest>({
      query: (queryData) => ({
        url: '/execute',
        method: 'POST',
        body: queryData,
      }),
      invalidatesTags: ['QueryList', 'QueryHistory'],
      transformResponse: (response: ApiResponse<QueryResponse>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取查询历史
    getQueryHistory: builder.query<
      { items: QueryHistory[]; total: number },
      QueryFilter & {
        page?: number
        page_size?: number
        sort_by?: string
        sort_order?: 'asc' | 'desc'
      }
    >({
      query: (params) => ({
        url: '/history',
        params,
      }),
      providesTags: ['QueryHistory'],
      transformResponse: (response: ApiResponse<{ items: QueryHistory[]; total: number }>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取查询详情
    getQueryById: builder.query<RAGQuery, string>({
      query: (id) => `/${id}`,
      providesTags: (result, error, id) => [{ type: 'Query', id }],
      transformResponse: (response: ApiResponse<RAGQuery>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 删除查询
    deleteQuery: builder.mutation<void, string>({
      query: (id) => ({
        url: `/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['QueryList', 'QueryHistory'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 批量删除查询
    deleteQueries: builder.mutation<void, string[]>({
      query: (ids) => ({
        url: '/batch-delete',
        method: 'POST',
        body: { query_ids: ids },
      }),
      invalidatesTags: ['QueryList', 'QueryHistory'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 获取查询建议
    getQuerySuggestions: builder.query<QuerySuggestion[], { query: string; limit?: number }>({
      query: ({ query, limit = 5 }) => ({
        url: '/suggestions',
        params: { q: query, limit },
      }),
      transformResponse: (response: ApiResponse<QuerySuggestion[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取查询模板
    getQueryTemplates: builder.query<QueryTemplate[], { category?: string }>({
      query: ({ category }) => ({
        url: '/templates',
        params: category ? { category } : {},
      }),
      transformResponse: (response: ApiResponse<QueryTemplate[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 从模板创建查询
    createFromTemplate: builder.mutation<CreateQueryRequest, { templateId: string; parameters: Record<string, any> }>({
      query: ({ templateId, parameters }) => ({
        url: `/templates/${templateId}/create`,
        method: 'POST',
        body: { parameters },
      }),
      transformResponse: (response: ApiResponse<CreateQueryRequest>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 保存查询
    saveQuery: builder.mutation<RAGQuery, { query: string; name: string; description?: string; tags?: string[] }>({
      query: (queryData) => ({
        url: '/save',
        method: 'POST',
        body: queryData,
      }),
      invalidatesTags: ['QueryList'],
      transformResponse: (response: ApiResponse<RAGQuery>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 收藏查询
    favoriteQuery: builder.mutation<RAGQuery, string>({
      query: (id) => ({
        url: `/${id}/favorite`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Query', id }],
      transformResponse: (response: ApiResponse<RAGQuery>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 取消收藏查询
    unfavoriteQuery: builder.mutation<RAGQuery, string>({
      query: (id) => ({
        url: `/${id}/favorite`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Query', id }],
      transformResponse: (response: ApiResponse<RAGQuery>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 分享查询
    shareQuery: builder.mutation<{ share_url: string; share_token: string }, { id: string; permissions: string[] }>({
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

    // 导出查询结果
    exportQueryResult: builder.mutation<Blob, { id: string; format: 'excel' | 'pdf' | 'csv' }>({
      query: ({ id, format }) => ({
        url: `/${id}/export`,
        method: 'POST',
        body: { format },
        responseHandler: (response) => response.blob(),
      }),
    }),

    // 获取知识图谱
    getKnowledgeGraph: builder.query<KnowledgeGraph, { query?: string; node_type?: string; limit?: number }>({
      query: (params) => ({
        url: '/knowledge-graph',
        params,
      }),
      providesTags: ['KnowledgeGraph'],
      transformResponse: (response: ApiResponse<KnowledgeGraph>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 搜索图谱节点
    searchGraphNodes: builder.query<GraphNode[], { query: string; node_type?: string; limit?: number }>({
      query: (params) => ({
        url: '/knowledge-graph/nodes/search',
        params,
      }),
      transformResponse: (response: ApiResponse<GraphNode[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取节点详情
    getGraphNodeById: builder.query<GraphNode, string>({
      query: (id) => `/knowledge-graph/nodes/${id}`,
      providesTags: (result, error, id) => [{ type: 'KnowledgeGraph', id: `node-${id}` }],
      transformResponse: (response: ApiResponse<GraphNode>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取节点关系
    getNodeRelationships: builder.query<{ nodes: GraphNode[]; edges: GraphEdge[] }, { nodeId: string; depth?: number }>({
      query: ({ nodeId, depth = 2 }) => ({
        url: `/knowledge-graph/nodes/${nodeId}/relationships`,
        params: { depth },
      }),
      transformResponse: (response: ApiResponse<{ nodes: GraphNode[]; edges: GraphEdge[] }>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 创建对话
    createConversation: builder.mutation<Conversation, { title?: string }>({
      query: (data) => ({
        url: '/conversations',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Conversation'],
      transformResponse: (response: ApiResponse<Conversation>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取对话列表
    getConversations: builder.query<
      { items: Conversation[]; total: number },
      {
        page?: number
        page_size?: number
        sort_by?: string
        sort_order?: 'asc' | 'desc'
      }
    >({
      query: (params) => ({
        url: '/conversations',
        params,
      }),
      providesTags: ['Conversation'],
      transformResponse: (response: ApiResponse<{ items: Conversation[]; total: number }>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取对话详情
    getConversationById: builder.query<Conversation, string>({
      query: (id) => `/conversations/${id}`,
      providesTags: (result, error, id) => [{ type: 'Conversation', id }],
      transformResponse: (response: ApiResponse<Conversation>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 发送消息
    sendMessage: builder.mutation<ChatMessage, { conversationId: string; message: string; attachments?: string[] }>({
      query: ({ conversationId, ...data }) => ({
        url: `/conversations/${conversationId}/messages`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { conversationId }) => [{ type: 'Conversation', id: conversationId }],
      transformResponse: (response: ApiResponse<ChatMessage>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 删除对话
    deleteConversation: builder.mutation<void, string>({
      query: (id) => ({
        url: `/conversations/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Conversation'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 重命名对话
    renameConversation: builder.mutation<Conversation, { id: string; title: string }>({
      query: ({ id, title }) => ({
        url: `/conversations/${id}/rename`,
        method: 'POST',
        body: { title },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Conversation', id }],
      transformResponse: (response: ApiResponse<Conversation>) => {
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
  useExecuteQueryMutation,
  useGetQueryHistoryQuery,
  useLazyGetQueryHistoryQuery,
  useGetQueryByIdQuery,
  useDeleteQueryMutation,
  useDeleteQueriesMutation,
  useGetQuerySuggestionsQuery,
  useGetQueryTemplatesQuery,
  useCreateFromTemplateMutation,
  useSaveQueryMutation,
  useFavoriteQueryMutation,
  useUnfavoriteQueryMutation,
  useShareQueryMutation,
  useExportQueryResultMutation,
  useGetKnowledgeGraphQuery,
  useLazyGetKnowledgeGraphQuery,
  useSearchGraphNodesQuery,
  useGetGraphNodeByIdQuery,
  useGetNodeRelationshipsQuery,
  useCreateConversationMutation,
  useGetConversationsQuery,
  useLazyGetConversationsQuery,
  useGetConversationByIdQuery,
  useSendMessageMutation,
  useDeleteConversationMutation,
  useRenameConversationMutation,
} = queriesApi

// 导出endpoints供手动调用
export const queriesEndpoints = queriesApi.endpoints