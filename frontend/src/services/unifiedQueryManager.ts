import {
  UnifiedQueryRequest,
  UnifiedQueryResponse,
  DataSource,
  DataSourceResult,
  QueryProgress,
  SourceAttribution,
  SmartRecommendation,
  QueryCache,
  UserQueryContext
} from '@/types'

import documentApi from '@/services/documentApi'
import knowledgeGraphApi from '@/services/knowledgeGraphApi'
import { estimatesApi } from '@/store/api/estimatesApi'

/**
 * 统一查询管理器
 * 负责协调多个数据源的查询，管理查询进度，并提供统一的结果融合
 */
export class UnifiedQueryManager {
  private static instance: UnifiedQueryManager
  private activeQueries = new Map<string, QueryProgress>()
  private queryCache = new Map<string, QueryCache>()
  private maxConcurrentQueries = 5
  private defaultTimeout = 30000 // 30秒超时

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): UnifiedQueryManager {
    if (!UnifiedQueryManager.instance) {
      UnifiedQueryManager.instance = new UnifiedQueryManager()
    }
    return UnifiedQueryManager.instance
  }

  /**
   * 执行统一查询
   */
  async executeQuery(request: UnifiedQueryRequest): Promise<UnifiedQueryResponse> {
    const queryId = this.generateQueryId(request)
    const startTime = Date.now()

    try {
      // 检查缓存
      const cached = this.getFromCache(request)
      if (cached) {
        return {
          ...cached,
          queryId,
          timestamp: new Date().toISOString(),
          fromCache: true,
          executionTime: Date.now() - startTime
        }
      }

      // 创建查询进度跟踪
      const progress: QueryProgress = {
        queryId,
        status: 'executing',
        startTime: new Date().toISOString(),
        currentStep: 'initializing',
        completedSteps: [],
        totalSteps: this.calculateTotalSteps(request),
        percentage: 0,
        estimatedTimeRemaining: 0,
        errors: []
      }

      this.activeQueries.set(queryId, progress)

      // 验证数据源配置
      const validatedSources = this.validateDataSources(request.dataSources)
      if (validatedSources.length === 0) {
        throw new Error('没有可用的数据源')
      }

      // 更新进度
      this.updateProgress(queryId, {
        currentStep: 'querying_data_sources',
        percentage: 10
      })

      // 并发查询所有数据源
      const sourceResults = await this.executeSourceQueries(
        queryId,
        validatedSources,
        request
      )

      // 更新进度
      this.updateProgress(queryId, {
        currentStep: 'fusing_results',
        percentage: 80
      })

      // 融合结果
      const fusedResult = await this.fuseResults(sourceResults, request)

      // 生成智能推荐
      const recommendations = await this.generateRecommendations(
        request,
        fusedResult
      )

      // 生成响应
      const response: UnifiedQueryResponse = {
        queryId,
        success: true,
        fusedAnswer: fusedResult.answer,
        confidence: fusedResult.confidence,
        sourceResults,
        recommendations,
        progress,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        fromCache: false
      }

      // 更新进度
      this.updateProgress(queryId, {
        status: 'completed',
        currentStep: 'completed',
        percentage: 100,
        completedTime: new Date().toISOString()
      })

      // 缓存结果
      this.saveToCache(request, response)

      // 清理活动查询
      setTimeout(() => {
        this.activeQueries.delete(queryId)
      }, 5000)

      return response

    } catch (error) {
      // 处理错误
      const errorMessage = error instanceof Error ? error.message : '未知错误'

      this.updateProgress(queryId, {
        status: 'failed',
        currentStep: 'error',
        errors: [...(this.activeQueries.get(queryId)?.errors || []), errorMessage],
        completedTime: new Date().toISOString()
      })

      return {
        queryId,
        success: false,
        error: errorMessage,
        sourceResults: [],
        recommendations: [],
        progress: this.activeQueries.get(queryId)!,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        fromCache: false
      }
    }
  }

  /**
   * 并发执行多个数据源查询
   */
  private async executeSourceQueries(
    queryId: string,
    dataSources: DataSource[],
    request: UnifiedQueryRequest
  ): Promise<DataSourceResult[]> {
    const results: DataSourceResult[] = []

    // 按优先级分组
    const sourcesByPriority = this.groupSourcesByPriority(dataSources)

    // 按优先级顺序执行查询
    for (const [priority, sources] of sourcesByPriority.entries()) {
      const promises = sources.map(source =>
        this.executeSingleSourceQuery(queryId, source, request)
          .catch(error => ({
            source,
            success: false,
            error: error.message,
            data: null,
            executionTime: 0,
            timestamp: new Date().toISOString()
          } as DataSourceResult))
      )

      const batchResults = await Promise.allSettled(promises)

      // 处理批次结果
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.error(`数据源查询失败: ${sources[index].name}`, result.reason)
          results.push({
            source: sources[index],
            success: false,
            error: result.reason?.message || '查询失败',
            data: null,
            executionTime: 0,
            timestamp: new Date().toISOString()
          })
        }
      })

      // 更新进度
      const completedPercentage = Math.round(
        ((priority + 1) / sourcesByPriority.size) * 70 + 10
      )
      this.updateProgress(queryId, {
        percentage: completedPercentage,
        completedSteps: Array.from(sourcesByPriority.keys())
          .filter(p => p <= priority)
          .map(p => `priority_${p}`)
      })

      // 如果是低优先级且已有足够结果，可以考虑提前终止
      if (priority > 0 && this.shouldStopEarly(results, request)) {
        break
      }
    }

    return results
  }

  /**
   * 执行单个数据源查询
   */
  private async executeSingleSourceQuery(
    queryId: string,
    source: DataSource,
    request: UnifiedQueryRequest
  ): Promise<DataSourceResult> {
    const startTime = Date.now()

    try {
      let data: any = null
      let confidence = 0

      switch (source.type) {
        case 'documents':
          data = await this.queryDocuments(source, request)
          confidence = this.calculateDocumentConfidence(data, source)
          break

        case 'knowledge_graph':
          data = await this.queryKnowledgeGraph(source, request)
          confidence = this.calculateKnowledgeGraphConfidence(data, source)
          break

        case 'historical_data':
          data = await this.queryHistoricalData(source, request)
          confidence = this.calculateHistoricalDataConfidence(data, source)
          break

        default:
          throw new Error(`不支持的数据源类型: ${source.type}`)
      }

      return {
        source,
        success: true,
        data,
        confidence,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        attribution: this.generateAttribution(source, data)
      }

    } catch (error) {
      throw new Error(`数据源 ${source.name} 查询失败: ${error.message}`)
    }
  }

  /**
   * 查询文档数据源
   */
  private async queryDocuments(
    source: DataSource,
    request: UnifiedQueryRequest
  ): Promise<any> {
    try {
      const response = await documentApi.searchDocuments({
        query: request.query,
        limit: source.config.maxResults || 10,
        filters: source.config.filters || {},
        include_content: true
      })

      return response.data
    } catch (error) {
      console.error('文档查询失败:', error)
      throw error
    }
  }

  /**
   * 查询知识图谱数据源
   */
  private async queryKnowledgeGraph(
    source: DataSource,
    request: UnifiedQueryRequest
  ): Promise<any> {
    try {
      const response = await knowledgeGraphApi.searchNodes({
        query: request.query,
        node_types: source.config.nodeTypes,
        limit: source.config.maxResults || 20
      })

      return response.data
    } catch (error) {
      console.error('知识图谱查询失败:', error)
      throw error
    }
  }

  /**
   * 查询历史数据源
   */
  private async queryHistoricalData(
    source: DataSource,
    request: UnifiedQueryRequest
  ): Promise<any> {
    try {
      const response = await estimatesApi.findSimilarProjects({
        project_name: request.query,
        project_type: source.config.projectTypes,
        limit: source.config.maxResults || 15
      })

      return response.data
    } catch (error) {
      console.error('历史数据查询失败:', error)
      throw error
    }
  }

  /**
   * 融合多个数据源的结果
   */
  private async fuseResults(
    sourceResults: DataSourceResult[],
    request: UnifiedQueryRequest
  ): Promise<{ answer: string; confidence: number; sources: SourceAttribution[] }> {
    const successfulResults = sourceResults.filter(r => r.success)

    if (successfulResults.length === 0) {
      return {
        answer: '抱歉，没有找到相关信息。',
        confidence: 0,
        sources: []
      }
    }

    // 按置信度和优先级排序结果
    const sortedResults = successfulResults.sort((a, b) => {
      const priorityDiff = (b.source.priority || 0) - (a.source.priority || 0)
      if (priorityDiff !== 0) return priorityDiff
      return b.confidence - a.confidence
    })

    // 提取所有来源信息
    const sources = sortedResults.flatMap(r => r.attribution || [])

    // 构建融合答案
    let fusedAnswer = ''
    let totalConfidence = 0
    let weightSum = 0

    for (const result of sortedResults) {
      const weight = this.calculateResultWeight(result, request)
      const contribution = this.extractAnswerFromResult(result, request)

      if (contribution) {
        if (fusedAnswer) {
          fusedAnswer += '\n\n'
        }
        fusedAnswer += `**${result.source.displayName}**: ${contribution}`

        totalConfidence += result.confidence * weight
        weightSum += weight
      }
    }

    // 计算平均置信度
    const averageConfidence = weightSum > 0 ? totalConfidence / weightSum : 0

    // 如果没有有效内容，提供默认回答
    if (!fusedAnswer) {
      fusedAnswer = '根据多个数据源的分析，暂时无法找到确切答案。建议尝试更具体的查询词汇。'
    }

    return {
      answer: fusedAnswer,
      confidence: Math.min(averageConfidence, 1),
      sources
    }
  }

  /**
   * 从单个结果中提取答案
   */
  private extractAnswerFromResult(
    result: DataSourceResult,
    request: UnifiedQueryRequest
  ): string {
    if (!result.data) return ''

    switch (result.source.type) {
      case 'documents':
        return this.extractDocumentAnswer(result.data)

      case 'knowledge_graph':
        return this.extractKnowledgeGraphAnswer(result.data)

      case 'historical_data':
        return this.extractHistoricalDataAnswer(result.data)

      default:
        return JSON.stringify(result.data, null, 2)
    }
  }

  /**
   * 从文档结果提取答案
   */
  private extractDocumentAnswer(data: any): string {
    if (data.items && data.items.length > 0) {
      const doc = data.items[0]
      return doc.content ? doc.content.substring(0, 500) + '...' : doc.title || '文档内容'
    }
    return ''
  }

  /**
   * 从知识图谱结果提取答案
   */
  private extractKnowledgeGraphAnswer(data: any): string {
    if (data.items && data.items.length > 0) {
      const node = data.items[0]
      const properties = Object.entries(node.properties || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      return `${node.label} (${properties})`
    }
    return ''
  }

  /**
   * 从历史数据结果提取答案
   */
  private extractHistoricalDataAnswer(data: any): string {
    if (data.items && data.items.length > 0) {
      const project = data.items[0]
      return `项目: ${project.project_name}, 类型: ${project.project_type}, 面积: ${project.area}m²`
    }
    return ''
  }

  /**
   * 生成智能推荐
   */
  private async generateRecommendations(
    request: UnifiedQueryRequest,
    fusedResult: { answer: string; confidence: number; sources: SourceAttribution[] }
  ): Promise<SmartRecommendation[]> {
    const recommendations: SmartRecommendation[] = []

    // 基于置信度的推荐
    if (fusedResult.confidence < 0.5) {
      recommendations.push({
        type: 'query_refinement',
        title: '建议优化查询',
        description: '当前查询结果的置信度较低，建议使用更具体的关键词',
        action: {
          type: 'modify_query',
          suggestedQuery: this.suggestBetterQuery(request.query),
          reason: '提高查询精确度'
        }
      })
    }

    // 基于数据源的推荐
    const sourceTypes = fusedResult.sources.map(s => s.sourceType)
    if (!sourceTypes.includes('documents')) {
      recommendations.push({
        type: 'data_source',
        title: '建议包含文档搜索',
        description: '添加文档数据源可能获得更准确的信息',
        action: {
          type: 'add_data_source',
          sourceType: 'documents',
          reason: '补充文档信息'
        }
      })
    }

    // 基于查询历史的推荐
    const relatedQueries = this.getRelatedQueries(request.query)
    if (relatedQueries.length > 0) {
      recommendations.push({
        type: 'related_query',
        title: '相关查询',
        description: '其他用户还查询了以下问题',
        action: {
          type: 'execute_query',
          suggestedQuery: relatedQueries[0],
          reason: '扩展相关信息'
        }
      })
    }

    return recommendations
  }

  /**
   * 工具方法
   */
  private generateQueryId(request: UnifiedQueryRequest): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private calculateTotalSteps(request: UnifiedQueryRequest): number {
    return 3 + request.dataSources.length // 初始化 + 查询 + 融合 + 每个数据源
  }

  private validateDataSources(sources: DataSource[]): DataSource[] {
    return sources.filter(source => {
      if (!source.enabled) return false
      if (!source.config || Object.keys(source.config).length === 0) return false
      return true
    })
  }

  private groupSourcesByPriority(sources: DataSource[]): Map<number, DataSource[]> {
    const grouped = new Map<number, DataSource[]>()

    sources.forEach(source => {
      const priority = source.priority || 1
      if (!grouped.has(priority)) {
        grouped.set(priority, [])
      }
      grouped.get(priority)!.push(source)
    })

    // 按优先级排序
    const sorted = new Map([...grouped.entries()].sort((a, b) => a[0] - b[0]))
    return sorted
  }

  private shouldStopEarly(results: DataSourceResult[], request: UnifiedQueryRequest): boolean {
    const successfulResults = results.filter(r => r.success)
    const highConfidenceResults = successfulResults.filter(r => r.confidence > 0.8)

    // 如果已有高置信度结果且数据源数量充足，可以提前终止
    return highConfidenceResults.length >= 2 && successfulResults.length >= request.dataSources.length * 0.6
  }

  private calculateDocumentConfidence(data: any, source: DataSource): number {
    if (!data || !data.items || data.items.length === 0) return 0
    return Math.min(0.9, 0.3 + (data.items.length * 0.1))
  }

  private calculateKnowledgeGraphConfidence(data: any, source: DataSource): number {
    if (!data || !data.items || data.items.length === 0) return 0
    return Math.min(0.95, 0.4 + (data.items.length * 0.08))
  }

  private calculateHistoricalDataConfidence(data: any, source: DataSource): number {
    if (!data || !data.items || data.items.length === 0) return 0
    return Math.min(0.85, 0.35 + (data.items.length * 0.12))
  }

  private calculateResultWeight(result: DataSourceResult, request: UnifiedQueryRequest): number {
    let weight = 1

    // 基于优先级
    weight *= (result.source.priority || 1)

    // 基于置信度
    weight *= result.confidence

    // 基于响应时间（越快越好）
    const timeWeight = Math.max(0.5, 1 - (result.executionTime / 10000))
    weight *= timeWeight

    return weight
  }

  private generateAttribution(source: DataSource, data: any): SourceAttribution[] {
    if (!data || !data.items) return []

    return data.items.slice(0, 5).map((item: any, index: number) => ({
      sourceId: source.id,
      sourceName: source.displayName,
      sourceType: source.type,
      itemId: item.id || `${source.type}_${index}`,
      itemTitle: item.title || item.label || item.project_name || '未知项目',
      itemUrl: item.url || item.link,
      relevanceScore: item.similarity_score || item.confidence || 0.8,
      excerpt: item.content || item.description || `来源: ${source.displayName}`,
      lastUpdated: item.updated_at || item.created_at || new Date().toISOString()
    }))
  }

  private suggestBetterQuery(originalQuery: string): string {
    // 简单的查询优化建议
    if (originalQuery.length < 5) {
      return originalQuery + ' 详细信息'
    }
    return originalQuery
  }

  private getRelatedQueries(query: string): string[] {
    // 模拟相关查询（实际应用中应该从历史记录中获取）
    const relatedQueries: Record<string, string[]> = {
      '成本': ['成本估算', '成本控制', '成本分析'],
      '项目': ['项目管理', '项目规划', '项目执行'],
      '文档': ['文档管理', '文档搜索', '文档分类']
    }

    for (const [key, queries] of Object.entries(relatedQueries)) {
      if (query.includes(key)) {
        return queries
      }
    }

    return []
  }

  private updateProgress(queryId: string, updates: Partial<QueryProgress>): void {
    const current = this.activeQueries.get(queryId)
    if (current) {
      this.activeQueries.set(queryId, { ...current, ...updates })
    }
  }

  private getFromCache(request: UnifiedQueryRequest): QueryCache | null {
    const cacheKey = this.generateCacheKey(request)
    const cached = this.queryCache.get(cacheKey)

    if (cached && Date.now() - new Date(cached.timestamp).getTime() < 300000) { // 5分钟缓存
      return cached
    }

    return null
  }

  private saveToCache(request: UnifiedQueryRequest, response: UnifiedQueryResponse): void {
    const cacheKey = this.generateCacheKey(request)
    this.queryCache.set(cacheKey, {
      queryId: response.queryId,
      request,
      response,
      timestamp: new Date().toISOString()
    })

    // 清理过期缓存
    this.cleanExpiredCache()
  }

  private generateCacheKey(request: UnifiedQueryRequest): string {
    return `${request.query}_${JSON.stringify(request.dataSources.map(ds => ds.id)).substring(0, 50)}`
  }

  private cleanExpiredCache(): void {
    const now = Date.now()
    for (const [key, cache] of this.queryCache.entries()) {
      if (now - new Date(cache.timestamp).getTime() > 300000) { // 5分钟
        this.queryCache.delete(key)
      }
    }
  }

  /**
   * 公共API方法
   */
  public getQueryProgress(queryId: string): QueryProgress | null {
    return this.activeQueries.get(queryId) || null
  }

  public cancelQuery(queryId: string): boolean {
    const progress = this.activeQueries.get(queryId)
    if (progress && progress.status === 'executing') {
      this.updateProgress(queryId, {
        status: 'cancelled',
        currentStep: 'cancelled',
        completedTime: new Date().toISOString()
      })
      return true
    }
    return false
  }

  public clearCache(): void {
    this.queryCache.clear()
  }

  public getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.queryCache.size,
      hitRate: 0.75 // 模拟缓存命中率
    }
  }
}

// 导出单例实例
export const unifiedQueryManager = UnifiedQueryManager.getInstance()