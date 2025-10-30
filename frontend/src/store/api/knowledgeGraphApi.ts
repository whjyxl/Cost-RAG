import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'
import {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphPath,
  GraphFilter,
  ApiResponse,
  GraphStatistics,
  GraphLayout,
  GraphExport,
  GraphImport,
  KnowledgeEntity,
  EntityRelationship,
  GraphVisualization,
  GraphSearchResult,
  GraphCluster,
  GraphRecommendation,
} from '@/types'

const baseQuery = fetchBaseQuery({
  baseUrl: '/api/v1/knowledge-graph',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
    return headers
  },
})

export const knowledgeGraphApi = createApi({
  reducerPath: 'knowledgeGraphApi',
  baseQuery,
  tagTypes: ['KnowledgeGraph', 'GraphNode', 'GraphEdge', 'GraphCluster'],
  endpoints: (builder) => ({
    // 获取知识图谱概览
    getKnowledgeGraph: builder.query<KnowledgeGraph, GraphFilter>({
      query: (params) => ({
        url: '',
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

    // 获取图谱统计信息
    getGraphStatistics: builder.query<GraphStatistics, { graph_id?: string }>({
      query: ({ graph_id }) => ({
        url: '/statistics',
        params: graph_id ? { graph_id } : {},
      }),
      providesTags: ['KnowledgeGraph'],
      transformResponse: (response: ApiResponse<GraphStatistics>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 搜索图谱节点
    searchNodes: builder.query<GraphSearchResult[], { query: string; node_types?: string[]; limit?: number }>({
      query: ({ query, node_types, limit = 20 }) => ({
        url: '/nodes/search',
        params: { q: query, node_types: node_types?.join(','), limit },
      }),
      transformResponse: (response: ApiResponse<GraphSearchResult[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取节点详情
    getNodeById: builder.query<GraphNode, { id: string; include_neighbors?: boolean }>({
      query: ({ id, include_neighbors = false }) => ({
        url: `/nodes/${id}`,
        params: { include_neighbors },
      }),
      providesTags: (result, error, { id }) => [{ type: 'GraphNode', id }],
      transformResponse: (response: ApiResponse<GraphNode>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 创建节点
    createNode: builder.mutation<GraphNode, Omit<GraphNode, 'id'>>({
      query: (nodeData) => ({
        url: '/nodes',
        method: 'POST',
        body: nodeData,
      }),
      invalidatesTags: ['KnowledgeGraph', 'GraphNode'],
      transformResponse: (response: ApiResponse<GraphNode>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 更新节点
    updateNode: builder.mutation<GraphNode, { id: string; updates: Partial<GraphNode> }>({
      query: ({ id, updates }) => ({
        url: `/nodes/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'GraphNode', id }],
      transformResponse: (response: ApiResponse<GraphNode>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 删除节点
    deleteNode: builder.mutation<void, string>({
      query: (id) => ({
        url: `/nodes/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['KnowledgeGraph', 'GraphNode'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 批量删除节点
    deleteNodes: builder.mutation<void, string[]>({
      query: (ids) => ({
        url: '/nodes/batch-delete',
        method: 'POST',
        body: { node_ids: ids },
      }),
      invalidatesTags: ['KnowledgeGraph', 'GraphNode'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 获取节点关系
    getNodeRelationships: builder.query<{ edges: GraphEdge[]; nodes: GraphNode[] }, { nodeId: string; depth?: number; relationship_types?: string[] }>({
      query: ({ nodeId, depth = 1, relationship_types }) => ({
        url: `/nodes/${nodeId}/relationships`,
        params: {
          depth,
          relationship_types: relationship_types?.join(',')
        },
      }),
      transformResponse: (response: ApiResponse<{ edges: GraphEdge[]; nodes: GraphNode[] }>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 创建关系
    createEdge: builder.mutation<GraphEdge, Omit<GraphEdge, 'id'>>({
      query: (edgeData) => ({
        url: '/edges',
        method: 'POST',
        body: edgeData,
      }),
      invalidatesTags: ['KnowledgeGraph', 'GraphEdge'],
      transformResponse: (response: ApiResponse<GraphEdge>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 更新关系
    updateEdge: builder.mutation<GraphEdge, { id: string; updates: Partial<GraphEdge> }>({
      query: ({ id, updates }) => ({
        url: `/edges/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'GraphEdge', id }],
      transformResponse: (response: ApiResponse<GraphEdge>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 删除关系
    deleteEdge: builder.mutation<void, string>({
      query: (id) => ({
        url: `/edges/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['KnowledgeGraph', 'GraphEdge'],
      transformResponse: (response: ApiResponse<void>) => {
        if (!response.success) {
          throw new Error(response.message)
        }
      },
    }),

    // 查找最短路径
    findShortestPath: builder.query<GraphPath, { source: string; target: string; max_depth?: number }>({
      query: ({ source, target, max_depth = 10 }) => ({
        url: '/paths/shortest',
        params: { source, target, max_depth },
      }),
      transformResponse: (response: ApiResponse<GraphPath>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 查找所有路径
    findAllPaths: builder.query<GraphPath[], { source: string; target: string; max_depth?: number; max_paths?: number }>({
      query: ({ source, target, max_depth = 5, max_paths = 100 }) => ({
        url: '/paths/all',
        params: { source, target, max_depth, max_paths },
      }),
      transformResponse: (response: ApiResponse<GraphPath[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取节点邻居
    getNodeNeighbors: builder.query<GraphNode[], { id: string; depth?: number; node_types?: string[] }>({
      query: ({ id, depth = 1, node_types }) => ({
        url: `/nodes/${id}/neighbors`,
        params: { depth, node_types: node_types?.join(',') },
      }),
      transformResponse: (response: ApiResponse<GraphNode[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取图谱布局
    getGraphLayout: builder.query<GraphLayout, { layout_type?: string; node_ids?: string[] }>({
      query: ({ layout_type = 'force', node_ids }) => ({
        url: '/layout',
        params: { layout_type, node_ids: node_ids?.join(',') },
      }),
      transformResponse: (response: ApiResponse<GraphLayout>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 计算布局
    calculateLayout: builder.mutation<GraphLayout, { layout_type: string; node_ids?: string[]; layout_options?: Record<string, any> }>({
      query: ({ layout_type, node_ids, layout_options }) => ({
        url: '/layout/calculate',
        method: 'POST',
        body: { layout_type, node_ids, layout_options },
      }),
      transformResponse: (response: ApiResponse<GraphLayout>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取图谱聚类
    getGraphClusters: builder.query<GraphCluster[], { algorithm?: string; parameters?: Record<string, any> }>({
      query: ({ algorithm = 'louvain', parameters }) => ({
        url: '/clusters',
        params: { algorithm, ...(parameters && { parameters: JSON.stringify(parameters) }) },
      }),
      providesTags: ['GraphCluster'],
      transformResponse: (response: ApiResponse<GraphCluster[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 计算聚类
    calculateClusters: builder.mutation<GraphCluster[], { algorithm: string; parameters?: Record<string, any> }>({
      query: ({ algorithm, parameters }) => ({
        url: '/clusters/calculate',
        method: 'POST',
        body: { algorithm, parameters },
      }),
      invalidatesTags: ['GraphCluster'],
      transformResponse: (response: ApiResponse<GraphCluster[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取推荐节点
    getNodeRecommendations: builder.query<GraphRecommendation[], { node_id: string; limit?: number; recommendation_type?: string }>({
      query: ({ node_id, limit = 10, recommendation_type = 'similar' }) => ({
        url: `/nodes/${node_id}/recommendations`,
        params: { limit, recommendation_type },
      }),
      transformResponse: (response: ApiResponse<GraphRecommendation[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取可视化配置
    getVisualizationConfig: builder.query<GraphVisualization, { graph_id?: string }>({
      query: ({ graph_id }) => ({
        url: '/visualization',
        params: graph_id ? { graph_id } : {},
      }),
      transformResponse: (response: ApiResponse<GraphVisualization>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 更新可视化配置
    updateVisualizationConfig: builder.mutation<GraphVisualization, { config: Partial<GraphVisualization>; graph_id?: string }>({
      query: ({ config, graph_id }) => ({
        url: '/visualization',
        method: 'PUT',
        body: { config, graph_id },
      }),
      transformResponse: (response: ApiResponse<GraphVisualization>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 导出图谱
    exportGraph: builder.mutation<GraphExport, { format: string; node_ids?: string[]; include_edges?: boolean }>({
      query: ({ format, node_ids, include_edges = true }) => ({
        url: '/export',
        method: 'POST',
        body: { format, node_ids, include_edges },
      }),
      transformResponse: (response: ApiResponse<GraphExport>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 导入图谱
    importGraph: builder.mutation<GraphImport, { file: File; format: string; merge_strategy?: string }>({
      query: (data) => {
        const formData = new FormData()
        formData.append('file', data.file)
        formData.append('format', data.format)
        if (data.merge_strategy) {
          formData.append('merge_strategy', data.merge_strategy)
        }

        return {
          url: '/import',
          method: 'POST',
          body: formData,
          formData: true,
        }
      },
      invalidatesTags: ['KnowledgeGraph', 'GraphNode', 'GraphEdge'],
      transformResponse: (response: ApiResponse<GraphImport>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取实体信息
    getKnowledgeEntity: builder.query<KnowledgeEntity, { entity_id: string; include_relations?: boolean }>({
      query: ({ entity_id, include_relations = false }) => ({
        url: `/entities/${entity_id}`,
        params: { include_relations },
      }),
      transformResponse: (response: ApiResponse<KnowledgeEntity>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 搜索实体
    searchEntities: builder.query<KnowledgeEntity[], { query: string; entity_types?: string[]; limit?: number }>({
      query: ({ query, entity_types, limit = 20 }) => ({
        url: '/entities/search',
        params: { q: query, entity_types: entity_types?.join(','), limit },
      }),
      transformResponse: (response: ApiResponse<KnowledgeEntity[]>) => {
        if (!response.success || !response.data) {
          throw new Error(response.message)
        }
        return response.data
      },
    }),

    // 获取实体关系
    getEntityRelationships: builder.query<EntityRelationship[], { entity_id: string; relationship_types?: string[]; limit?: number }>({
      query: ({ entity_id, relationship_types, limit = 50 }) => ({
        url: `/entities/${entity_id}/relationships`,
        params: { relationship_types: relationship_types?.join(','), limit },
      }),
      transformResponse: (response: ApiResponse<EntityRelationship[]>) => {
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
  useGetKnowledgeGraphQuery,
  useLazyGetKnowledgeGraphQuery,
  useGetGraphStatisticsQuery,
  useSearchNodesQuery,
  useGetNodeByIdQuery,
  useCreateNodeMutation,
  useUpdateNodeMutation,
  useDeleteNodeMutation,
  useDeleteNodesMutation,
  useGetNodeRelationshipsQuery,
  useCreateEdgeMutation,
  useUpdateEdgeMutation,
  useDeleteEdgeMutation,
  useFindShortestPathQuery,
  useFindAllPathsQuery,
  useGetNodeNeighborsQuery,
  useGetGraphLayoutQuery,
  useCalculateLayoutMutation,
  useGetGraphClustersQuery,
  useCalculateClustersMutation,
  useGetNodeRecommendationsQuery,
  useGetVisualizationConfigQuery,
  useUpdateVisualizationConfigMutation,
  useExportGraphMutation,
  useImportGraphMutation,
  useGetKnowledgeEntityQuery,
  useSearchEntitiesQuery,
  useGetEntityRelationshipsQuery,
} = knowledgeGraphApi

// 导出endpoints供手动调用
export const knowledgeGraphEndpoints = knowledgeGraphApi.endpoints