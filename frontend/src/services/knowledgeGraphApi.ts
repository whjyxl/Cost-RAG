import {
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  NodeType,
  QueryRequest,
  QueryResponse,
  ApiResponse,
  PaginatedResponse,
  PaginationParams
} from '@/types'

// 知识图谱API客户端
class KnowledgeGraphApi {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl: string = import.meta.env.VITE_API_BASE_URL, timeout: number = 10000) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeout),
      ...options,
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error('Knowledge Graph API request failed:', error)
      throw error
    }
  }

  // 获取知识图谱统计信息
  async getStatistics(): Promise<ApiResponse<KnowledgeGraph['statistics']>> {
    return this.request('/knowledge-graph/statistics')
  }

  // 获取完整知识图谱
  async getKnowledgeGraph(params?: {
    node_types?: NodeType[]
    limit?: number
    include_properties?: boolean
  }): Promise<ApiResponse<KnowledgeGraph>> {
    const searchParams = new URLSearchParams()

    if (params?.node_types?.length) {
      searchParams.set('node_types', params.node_types.join(','))
    }
    if (params?.limit) {
      searchParams.set('limit', params.limit.toString())
    }
    if (params?.include_properties !== undefined) {
      searchParams.set('include_properties', params.include_properties.toString())
    }

    const query = searchParams.toString()
    return this.request(`/knowledge-graph${query ? `?${query}` : ''}`)
  }

  // 搜索知识图谱节点
  async searchNodes(params: {
    query: string
    node_types?: NodeType[]
    limit?: number
    offset?: number
  }): Promise<ApiResponse<PaginatedResponse<GraphNode>>> {
    const searchParams = new URLSearchParams()
    searchParams.set('query', params.query)

    if (params.node_types?.length) {
      searchParams.set('node_types', params.node_types.join(','))
    }
    if (params.limit) {
      searchParams.set('limit', params.limit.toString())
    }
    if (params.offset) {
      searchParams.set('offset', params.offset.toString())
    }

    return this.request(`/knowledge-graph/nodes/search?${searchParams}`)
  }

  // 获取节点详情
  async getNodeDetail(nodeId: string): Promise<ApiResponse<GraphNode>> {
    return this.request(`/knowledge-graph/nodes/${nodeId}`)
  }

  // 获取节点的邻居节点
  async getNodeNeighbors(params: {
    nodeId: string
    depth?: number
    relationship_types?: string[]
    limit?: number
  }): Promise<ApiResponse<{
    center_node: GraphNode
    neighbors: GraphNode[]
    edges: GraphEdge[]
  }>> {
    const searchParams = new URLSearchParams()

    if (params.depth) {
      searchParams.set('depth', params.depth.toString())
    }
    if (params.relationship_types?.length) {
      searchParams.set('relationship_types', params.relationship_types.join(','))
    }
    if (params.limit) {
      searchParams.set('limit', params.limit.toString())
    }

    return this.request(`/knowledge-graph/nodes/${params.nodeId}/neighbors?${searchParams}`)
  }

  // 获取节点路径
  async getNodePath(params: {
    sourceId: string
    targetId: string
    max_depth?: number
  }): Promise<ApiResponse<{
    path: GraphNode[]
    edges: GraphEdge[]
    path_length: number
  }>> {
    const searchParams = new URLSearchParams()

    if (params.max_depth) {
      searchParams.set('max_depth', params.max_depth.toString())
    }

    return this.request(`/knowledge-graph/nodes/${params.sourceId}/path/${params.targetId}?${searchParams}`)
  }

  // 基于知识图谱的问答
  async askWithKnowledgeGraph(request: QueryRequest): Promise<ApiResponse<QueryResponse>> {
    return this.request('/knowledge-graph/query', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  // 获取推荐的相关实体
  async getRelatedEntities(params: {
    nodeId: string
    relationship_types?: string[]
    limit?: number
  }): Promise<ApiResponse<{
    nodes: GraphNode[]
    edges: GraphEdge[]
    relevance_scores: Array<{
      node_id: string
      score: number
      reason: string
    }>
  }>> {
    const searchParams = new URLSearchParams()

    if (params.relationship_types?.length) {
      searchParams.set('relationship_types', params.relationship_types.join(','))
    }
    if (params.limit) {
      searchParams.set('limit', params.limit.toString())
    }

    return this.request(`/knowledge-graph/nodes/${params.nodeId}/related?${searchParams}`)
  }

  // 获取知识图谱的可视化数据
  async getVisualizationData(params: {
    center_node_id?: string
    node_types?: NodeType[]
    depth?: number
    max_nodes?: number
    layout_algorithm?: 'force' | 'circular' | 'hierarchical' | 'grid'
  }): Promise<ApiResponse<{
    nodes: Array<GraphNode & { x: number; y: number; size: number; color: string }>
    edges: Array<GraphEdge & { width: number; color: string }>
    layout: {
      algorithm: string
      width: number
      height: number
    }
  }>> {
    const searchParams = new URLSearchParams()

    if (params.center_node_id) {
      searchParams.set('center_node_id', params.center_node_id)
    }
    if (params.node_types?.length) {
      searchParams.set('node_types', params.node_types.join(','))
    }
    if (params.depth) {
      searchParams.set('depth', params.depth.toString())
    }
    if (params.max_nodes) {
      searchParams.set('max_nodes', params.max_nodes.toString())
    }
    if (params.layout_algorithm) {
      searchParams.set('layout_algorithm', params.layout_algorithm)
    }

    return this.request(`/knowledge-graph/visualization?${searchParams}`)
  }

  // 获取知识图谱的统计趋势数据
  async getStatisticsTrend(params: {
    period?: 'day' | 'week' | 'month' | 'year'
    start_date?: string
    end_date?: string
  }): Promise<ApiResponse<{
    period: string
    data: Array<{
      date: string
      nodes_count: number
      edges_count: number
      node_types_distribution: Record<NodeType, number>
      top_relationships: Array<{
        type: string
        count: number
      }>
    }>
  }>> {
    const searchParams = new URLSearchParams()

    if (params.period) {
      searchParams.set('period', params.period)
    }
    if (params.start_date) {
      searchParams.set('start_date', params.start_date)
    }
    if (params.end_date) {
      searchParams.set('end_date', params.end_date)
    }

    return this.request(`/knowledge-graph/statistics/trend?${searchParams}`)
  }

  // 导出知识图谱数据
  async exportGraph(params: {
    format?: 'json' | 'csv' | 'graphml' | 'gexf'
    node_types?: NodeType[]
    include_properties?: boolean
  }): Promise<Blob> {
    const searchParams = new URLSearchParams()

    if (params.format) {
      searchParams.set('format', params.format)
    }
    if (params.node_types?.length) {
      searchParams.set('node_types', params.node_types.join(','))
    }
    if (params.include_properties !== undefined) {
      searchParams.set('include_properties', params.include_properties.toString())
    }

    const url = `${this.baseUrl}/knowledge-graph/export?${searchParams}`

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout * 2), // 导出可能需要更长时间
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`)
      }

      return response.blob()
    } catch (error) {
      console.error('Knowledge graph export failed:', error)
      throw error
    }
  }

  // 实体消歧（解决同名实体问题）
  async disambiguateEntity(params: {
    entity_name: string
    context?: string
    node_types?: NodeType[]
  }): Promise<ApiResponse<Array<{
    node: GraphNode
    confidence_score: number
    match_reason: string
  }>>> {
    const searchParams = new URLSearchParams()
    searchParams.set('entity_name', params.entity_name)

    if (params.context) {
      searchParams.set('context', params.context)
    }
    if (params.node_types?.length) {
      searchParams.set('node_types', params.node_types.join(','))
    }

    return this.request(`/knowledge-graph/disambiguate?${searchParams}`)
  }

  // 智能推荐相关文档或实体
  async getRecommendations(params: {
    query?: string
    node_ids?: string[]
    recommendation_type?: 'documents' | 'entities' | 'relationships'
    limit?: number
  }): Promise<ApiResponse<{
    recommendations: Array<{
      id: string
      title: string
      type: 'document' | 'entity' | 'relationship'
      relevance_score: number
      description?: string
      metadata?: Record<string, any>
    }>
    }>> {
    const searchParams = new URLSearchParams()

    if (params.query) {
      searchParams.set('query', params.query)
    }
    if (params.node_ids?.length) {
      searchParams.set('node_ids', params.node_ids.join(','))
    }
    if (params.recommendation_type) {
      searchParams.set('recommendation_type', params.recommendation_type)
    }
    if (params.limit) {
      searchParams.set('limit', params.limit.toString())
    }

    return this.request(`/knowledge-graph/recommendations?${searchParams}`)
  }
}

// 创建API实例
export const knowledgeGraphApi = new KnowledgeGraphApi()

// 导出类型和API
export default knowledgeGraphApi
export { KnowledgeGraphApi }