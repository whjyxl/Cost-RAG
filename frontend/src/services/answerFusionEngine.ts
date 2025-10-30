import {
  DataSourceResult,
  UnifiedQueryRequest,
  SourceAttribution,
  FusionStrategy,
  WeightedAnswer,
  ConflictResolution,
  SemanticSimilarity
} from '@/types'

/**
 * 答案融合引擎
 * 负责智能融合多个数据源的结果，处理冲突，并生成最优答案
 */
export class AnswerFusionEngine {
  private static instance: AnswerFusionEngine

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): AnswerFusionEngine {
    if (!AnswerFusionEngine.instance) {
      AnswerFusionEngine.instance = new AnswerFusionEngine()
    }
    return AnswerFusionEngine.instance
  }

  /**
   * 融合多个数据源的答案
   */
  async fuseAnswers(
    results: DataSourceResult[],
    request: UnifiedQueryRequest,
    strategy: FusionStrategy = 'weighted'
  ): Promise<{
    answer: string
    confidence: number
    sources: SourceAttribution[]
    metadata: {
      strategy: FusionStrategy
      sourcesUsed: number
      conflictsResolved: number
      processingTime: number
    }
  }> {
    const startTime = Date.now()

    try {
      // 过滤有效结果
      const validResults = results.filter(r => r.success && r.data)
      if (validResults.length === 0) {
        return {
          answer: '抱歉，没有找到相关信息来回答您的问题。',
          confidence: 0,
          sources: [],
          metadata: {
            strategy,
            sourcesUsed: 0,
            conflictsResolved: 0,
            processingTime: Date.now() - startTime
          }
        }
      }

      // 提取并预处理答案
      const extractedAnswers = await this.extractAndPreprocessAnswers(validResults)

      // 计算语义相似度
      const similarityMatrix = this.calculateSimilarityMatrix(extractedAnswers)

      // 检测和处理冲突
      const conflicts = this.detectConflicts(extractedAnswers, similarityMatrix)
      const resolvedAnswers = this.resolveConflicts(extractedAnswers, conflicts, strategy)

      // 应用融合策略
      const fusedResult = this.applyFusionStrategy(resolvedAnswers, request, strategy)

      // 生成最终答案
      const finalAnswer = this.generateFinalAnswer(fusedResult, request)

      return {
        answer: finalAnswer.text,
        confidence: finalAnswer.confidence,
        sources: fusedResult.sources,
        metadata: {
          strategy,
          sourcesUsed: validResults.length,
          conflictsResolved: conflicts.length,
          processingTime: Date.now() - startTime
        }
      }

    } catch (error) {
      console.error('答案融合失败:', error)
      return {
        answer: '答案融合过程中出现错误，请稍后重试。',
        confidence: 0,
        sources: [],
        metadata: {
          strategy,
          sourcesUsed: 0,
          conflictsResolved: 0,
          processingTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * 提取并预处理答案
   */
  private async extractAndPreprocessAnswers(
    results: DataSourceResult[]
  ): Promise<WeightedAnswer[]> {
    const answers: WeightedAnswer[] = []

    for (const result of results) {
      const rawAnswer = this.extractRawAnswer(result)
      if (rawAnswer) {
        // 预处理：清理文本、提取关键信息
        const processedAnswer = this.preprocessAnswer(rawAnswer)

        answers.push({
          text: processedAnswer.text,
          confidence: result.confidence,
          source: result.source,
          weight: this.calculateAnswerWeight(result),
          keyPoints: processedAnswer.keyPoints,
          entities: processedAnswer.entities,
          sentiment: processedAnswer.sentiment,
          complexity: processedAnswer.complexity
        })
      }
    }

    return answers
  }

  /**
   * 从结果中提取原始答案
   */
  private extractRawAnswer(result: DataSourceResult): string {
    const { data, source } = result

    if (!data) return ''

    switch (source.type) {
      case 'documents':
        return this.extractDocumentAnswer(data)

      case 'knowledge_graph':
        return this.extractKnowledgeGraphAnswer(data)

      case 'historical_data':
        return this.extractHistoricalDataAnswer(data)

      default:
        return this.extractGenericAnswer(data)
    }
  }

  /**
   * 预处理答案文本
   */
  private preprocessAnswer(rawAnswer: string): {
    text: string
    keyPoints: string[]
    entities: string[]
    sentiment: 'positive' | 'neutral' | 'negative'
    complexity: 'simple' | 'medium' | 'complex'
  } {
    // 清理文本
    let text = rawAnswer.trim()
    text = text.replace(/\s+/g, ' ')
    text = text.replace(/[^\w\s\u4e00-\u9fff.,!?;:()""''\[\]{}]/g, '')

    // 提取关键点
    const keyPoints = this.extractKeyPoints(text)

    // 提取实体
    const entities = this.extractEntities(text)

    // 分析情感
    const sentiment = this.analyzeSentiment(text)

    // 评估复杂度
    const complexity = this.assessComplexity(text)

    return {
      text,
      keyPoints,
      entities,
      sentiment,
      complexity
    }
  }

  /**
   * 计算答案权重
   */
  private calculateAnswerWeight(result: DataSourceResult): number {
    let weight = 1

    // 基于数据源优先级
    weight *= (result.source.priority || 1)

    // 基于置信度
    weight *= Math.pow(result.confidence, 0.8)

    // 基于数据源类型
    const typeWeights = {
      'knowledge_graph': 1.2,
      'documents': 1.0,
      'historical_data': 0.9
    }
    weight *= typeWeights[result.source.type as keyof typeof typeWeights] || 1

    // 基于响应时间
    const timeWeight = Math.max(0.7, 1 - (result.executionTime / 5000))
    weight *= timeWeight

    return Math.max(0.1, Math.min(3, weight))
  }

  /**
   * 计算语义相似度矩阵
   */
  private calculateSimilarityMatrix(answers: WeightedAnswer[]): SemanticSimilarity[][] {
    const matrix: SemanticSimilarity[][] = []

    for (let i = 0; i < answers.length; i++) {
      matrix[i] = []
      for (let j = 0; j < answers.length; j++) {
        if (i === j) {
          matrix[i][j] = { similarity: 1.0, confidence: 1.0 }
        } else {
          const similarity = this.calculateTextSimilarity(answers[i].text, answers[j].text)
          matrix[i][j] = similarity
        }
      }
    }

    return matrix
  }

  /**
   * 计算文本相似度
   */
  private calculateTextSimilarity(text1: string, text2: string): SemanticSimilarity {
    // 简化的相似度计算（实际应用中可以使用更复杂的算法）
    const words1 = this.tokenize(text1.toLowerCase())
    const words2 = this.tokenize(text2.toLowerCase())

    const intersection = new Set(words1.filter(word => words2.includes(word)))
    const union = new Set([...words1, ...words2])

    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0

    // 计算关键点重叠度
    const keyPoints1 = this.extractKeyPoints(text1)
    const keyPoints2 = this.extractKeyPoints(text2)
    const keyPointOverlap = this.calculateKeyPointOverlap(keyPoints1, keyPoints2)

    // 综合相似度
    const finalSimilarity = jaccardSimilarity * 0.6 + keyPointOverlap * 0.4

    return {
      similarity: Math.min(1, finalSimilarity),
      confidence: 0.8 // 固定置信度，实际中可以基于文本长度等因素计算
    }
  }

  /**
   * 检测答案冲突
   */
  private detectConflicts(
    answers: WeightedAnswer[],
    similarityMatrix: SemanticSimilarity[][]
  ): ConflictResolution[] {
    const conflicts: ConflictResolution[] = []

    for (let i = 0; i < answers.length; i++) {
      for (let j = i + 1; j < answers.length; j++) {
        const similarity = similarityMatrix[i][j]

        // 如果相似度低但置信度都高，可能存在冲突
        if (similarity.similarity < 0.3 &&
            answers[i].confidence > 0.6 &&
            answers[j].confidence > 0.6) {

          conflicts.push({
            type: 'contradiction',
            severity: 'medium',
            conflictingAnswers: [answers[i], answers[j]],
            similarity: similarity.similarity,
            suggestedResolution: this.suggestConflictResolution(answers[i], answers[j])
          })
        }
      }
    }

    // 检查事实性冲突
    const factualConflicts = this.detectFactualConflicts(answers)
    conflicts.push(...factualConflicts)

    return conflicts
  }

  /**
   * 解决冲突
   */
  private resolveConflicts(
    answers: WeightedAnswer[],
    conflicts: ConflictResolution[],
    strategy: FusionStrategy
  ): WeightedAnswer[] {
    let resolvedAnswers = [...answers]

    for (const conflict of conflicts) {
      switch (strategy) {
        case 'highest_confidence':
          resolvedAnswers = this.resolveByHighestConfidence(resolvedAnswers, conflict)
          break
        case 'weighted':
          resolvedAnswers = this.resolveByWeighting(resolvedAnswers, conflict)
          break
        case 'consensus':
          resolvedAnswers = this.resolveByConsensus(resolvedAnswers, conflict)
          break
        case 'comprehensive':
          resolvedAnswers = this.resolveComprehensively(resolvedAnswers, conflict)
          break
      }
    }

    return resolvedAnswers
  }

  /**
   * 应用融合策略
   */
  private applyFusionStrategy(
    answers: WeightedAnswer[],
    request: UnifiedQueryRequest,
    strategy: FusionStrategy
  ): {
    text: string
    confidence: number
    sources: SourceAttribution[]
  } {
    switch (strategy) {
      case 'highest_confidence':
        return this.applyHighestConfidenceStrategy(answers)

      case 'weighted':
        return this.applyWeightedStrategy(answers)

      case 'consensus':
        return this.applyConsensusStrategy(answers)

      case 'comprehensive':
        return this.applyComprehensiveStrategy(answers, request)

      default:
        return this.applyWeightedStrategy(answers)
    }
  }

  /**
   * 生成最终答案
   */
  private generateFinalAnswer(
    fusedResult: { text: string; confidence: number; sources: SourceAttribution[] },
    request: UnifiedQueryRequest
  ): {
    text: string
    confidence: number
  } {
    let finalText = fusedResult.text

    // 根据查询类型调整答案格式
    if (request.query.includes('如何') || request.query.includes('怎么')) {
      finalText = this.formatHowToAnswer(finalText)
    } else if (request.query.includes('什么是') || request.query.includes('定义')) {
      finalText = this.formatDefinitionAnswer(finalText)
    } else if (request.query.includes('比较') || request.query.includes('对比')) {
      finalText = this.formatComparisonAnswer(finalText)
    }

    return {
      text: finalText,
      confidence: fusedResult.confidence
    }
  }

  // ==================== 私有辅助方法 ====================

  private extractDocumentAnswer(data: any): string {
    if (data.items && data.items.length > 0) {
      const doc = data.items[0]
      return doc.content || doc.summary || doc.title || ''
    }
    return ''
  }

  private extractKnowledgeGraphAnswer(data: any): string {
    if (data.items && data.items.length > 0) {
      const node = data.items[0]
      const properties = Object.entries(node.properties || {})
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${value}`)
        .join('，')
      return `${node.label || node.name || ''}${properties ? '（' + properties + '）' : ''}`
    }
    return ''
  }

  private extractHistoricalDataAnswer(data: any): string {
    if (data.items && data.items.length > 0) {
      const project = data.items[0]
      const aspects = [
        project.project_name && `项目名称: ${project.project_name}`,
        project.project_type && `项目类型: ${project.project_type}`,
        project.area && `建筑面积: ${project.area}m²`,
        project.total_cost && `总成本: ${project.total_cost}万元`,
        project.unit_cost && `单位成本: ${project.unit_cost}元/m²`
      ].filter(Boolean)
      return aspects.join('，')
    }
    return ''
  }

  private extractGenericAnswer(data: any): string {
    if (typeof data === 'string') return data
    if (data.answer) return data.answer
    if (data.content) return data.content
    if (data.description) return data.description
    return JSON.stringify(data, null, 2)
  }

  private extractKeyPoints(text: string): string[] {
    // 简化的关键点提取
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim())
    return sentences.slice(0, 3).map(s => s.trim())
  }

  private extractEntities(text: string): string[] {
    // 简化的实体提取
    const entities: string[] = []

    // 提取数字和单位
    const numberPattern = /\d+(\.\d+)?(万|千|百|m²|元|万元|%)/g
    const matches = text.match(numberPattern)
    if (matches) {
      entities.push(...matches)
    }

    // 提取项目类型相关词汇
    const projectTypes = ['住宅', '商业', '工业', '办公', '学校', '医院', '基础设施']
    projectTypes.forEach(type => {
      if (text.includes(type)) {
        entities.push(type)
      }
    })

    return [...new Set(entities)]
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['良好', '优秀', '高', '优化', '提升', '改善', '成功']
    const negativeWords = ['问题', '困难', '失败', '低', '差', '不足', '缺陷']

    const positiveCount = positiveWords.filter(word => text.includes(word)).length
    const negativeCount = negativeWords.filter(word => text.includes(word)).length

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  private assessComplexity(text: string): 'simple' | 'medium' | 'complex' {
    const length = text.length
    const sentenceCount = text.split(/[。！？.!?]/).length
    const avgSentenceLength = length / sentenceCount

    if (length < 100 && avgSentenceLength < 20) return 'simple'
    if (length < 300 && avgSentenceLength < 30) return 'medium'
    return 'complex'
  }

  private tokenize(text: string): string[] {
    return text.split(/[\s\u4e00-\u9fff\W]+/).filter(token => token.length > 0)
  }

  private calculateKeyPointOverlap(points1: string[], points2: string[]): number {
    if (points1.length === 0 || points2.length === 0) return 0

    const set1 = new Set(points1.map(p => p.toLowerCase()))
    const set2 = new Set(points2.map(p => p.toLowerCase()))
    const intersection = new Set([...set1].filter(p => set2.has(p)))

    return intersection.size / Math.min(set1.size, set2.size)
  }

  private detectFactualConflicts(answers: WeightedAnswer[]): ConflictResolution[] {
    const conflicts: ConflictResolution[] = []

    // 检测数字冲突
    const numericConflicts = this.detectNumericConflicts(answers)
    conflicts.push(...numericConflicts)

    // 检测分类冲突
    const categoricalConflicts = this.detectCategoricalConflicts(answers)
    conflicts.push(...categoricalConflicts)

    return conflicts
  }

  private detectNumericConflicts(answers: WeightedAnswer[]): ConflictResolution[] {
    const conflicts: ConflictResolution[] = []

    // 提取所有数值
    const numericValues: { answer: WeightedAnswer; values: number[]; context: string }[] = []

    answers.forEach(answer => {
      const values = this.extractNumericValues(answer.text)
      if (values.length > 0) {
        numericValues.push({ answer, values, context: answer.text })
      }
    })

    // 比较数值
    for (let i = 0; i < numericValues.length; i++) {
      for (let j = i + 1; j < numericValues.length; j++) {
        const diff = this.calculateNumericDifference(
          numericValues[i].values,
          numericValues[j].values
        )

        if (diff > 0.2) { // 20%以上差异认为是冲突
          conflicts.push({
            type: 'factual',
            severity: 'low',
            conflictingAnswers: [numericValues[i].answer, numericValues[j].answer],
            similarity: 0.1,
            suggestedResolution: '需要进一步核实数据来源的准确性'
          })
        }
      }
    }

    return conflicts
  }

  private detectCategoricalConflicts(answers: WeightedAnswer[]): ConflictResolution[] {
    const conflicts: ConflictResolution[] = []

    // 检测项目类型冲突
    const projectTypes = this.extractProjectTypes(answers)
    if (projectTypes.length > 1) {
      const conflictingAnswers = answers.filter(a =>
        projectTypes.some(type => a.text.includes(type))
      )

      if (conflictingAnswers.length > 1) {
        conflicts.push({
          type: 'categorical',
          severity: 'low',
          conflictingAnswers,
          similarity: 0.2,
          suggestedResolution: '需要明确项目的具体类型'
        })
      }
    }

    return conflicts
  }

  private extractNumericValues(text: string): number[] {
    const regex = /\d+(\.\d+)?/g
    const matches = text.match(regex)
    return matches ? matches.map(m => parseFloat(m)) : []
  }

  private calculateNumericDifference(values1: number[], values2: number[]): number {
    if (values1.length === 0 || values2.length === 0) return 0

    const avg1 = values1.reduce((a, b) => a + b, 0) / values1.length
    const avg2 = values2.reduce((a, b) => a + b, 0) / values2.length

    return Math.abs(avg1 - avg2) / Math.max(avg1, avg2)
  }

  private extractProjectTypes(answers: WeightedAnswer[]): string[] {
    const types = ['住宅', '商业', '工业', '办公', '学校', '医院', '基础设施']
    const foundTypes: string[] = []

    answers.forEach(answer => {
      types.forEach(type => {
        if (answer.text.includes(type) && !foundTypes.includes(type)) {
          foundTypes.push(type)
        }
      })
    })

    return foundTypes
  }

  private suggestConflictResolution(answer1: WeightedAnswer, answer2: WeightedAnswer): string {
    if (answer1.confidence > answer2.confidence) {
      return `建议优先采用置信度更高的答案（${answer1.source.displayName}）`
    } else if (answer2.confidence > answer1.confidence) {
      return `建议优先采用置信度更高的答案（${answer2.source.displayName}）`
    } else {
      return '两个答案置信度相近，建议综合参考多个数据源'
    }
  }

  private resolveByHighestConfidence(answers: WeightedAnswer[], conflict: ConflictResolution): WeightedAnswer[] {
    // 保持高置信度的答案，降低冲突答案的权重
    return answers.map(answer => {
      if (conflict.conflictingAnswers.includes(answer)) {
        return {
          ...answer,
          weight: answer.weight * 0.5
        }
      }
      return answer
    })
  }

  private resolveByWeighting(answers: WeightedAnswer[], conflict: ConflictResolution): WeightedAnswer[] {
    // 基于权重调整冲突答案
    return answers.map(answer => {
      if (conflict.conflictingAnswers.includes(answer)) {
        return {
          ...answer,
          weight: answer.weight * 0.7
        }
      }
      return answer
    })
  }

  private resolveByConsensus(answers: WeightedAnswer[], conflict: ConflictResolution): WeightedAnswer[] {
    // 寻找共识部分，标记冲突部分
    return answers.map(answer => {
      if (conflict.conflictingAnswers.includes(answer)) {
        return {
          ...answer,
          weight: answer.weight * 0.8
        }
      }
      return answer
    })
  }

  private resolveComprehensively(answers: WeightedAnswer[], conflict: ConflictResolution): WeightedAnswer[] {
    // 综合考虑多种因素
    return answers.map(answer => {
      if (conflict.conflictingAnswers.includes(answer)) {
        const adjustmentFactor = this.calculateAdjustmentFactor(answer, conflict)
        return {
          ...answer,
          weight: answer.weight * adjustmentFactor
        }
      }
      return answer
    })
  }

  private calculateAdjustmentFactor(answer: WeightedAnswer, conflict: ConflictResolution): number {
    let factor = 1

    // 基于置信度调整
    factor *= Math.pow(answer.confidence, 0.5)

    // 基于数据源优先级调整
    factor *= Math.sqrt(answer.source.priority || 1)

    // 基于冲突严重性调整
    if (conflict.severity === 'high') factor *= 0.5
    else if (conflict.severity === 'medium') factor *= 0.7
    else factor *= 0.9

    return Math.max(0.3, Math.min(1, factor))
  }

  private applyHighestConfidenceStrategy(answers: WeightedAnswer[]): {
    text: string
    confidence: number
    sources: SourceAttribution[]
  } {
    const bestAnswer = answers.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    )

    return {
      text: bestAnswer.text,
      confidence: bestAnswer.confidence,
      sources: [{
        sourceId: bestAnswer.source.id,
        sourceName: bestAnswer.source.displayName,
        sourceType: bestAnswer.source.type,
        itemId: 'primary',
        itemTitle: '主要答案',
        relevanceScore: bestAnswer.confidence,
        excerpt: bestAnswer.text.substring(0, 100) + '...',
        lastUpdated: new Date().toISOString()
      }]
    }
  }

  private applyWeightedStrategy(answers: WeightedAnswer[]): {
    text: string
    confidence: number
    sources: SourceAttribution[]
  } {
    const totalWeight = answers.reduce((sum, a) => sum + a.weight, 0)
    const weightedConfidence = answers.reduce((sum, a) => sum + (a.confidence * a.weight), 0) / totalWeight

    // 按权重组合答案
    const sortedAnswers = answers.sort((a, b) => b.weight - a.weight)
    const combinedText = sortedAnswers
      .slice(0, 3)
      .map((answer, index) => {
        const prefix = index === 0 ? '主要信息：' : '补充信息：'
        return `${prefix}**${answer.source.displayName}**: ${answer.text}`
      })
      .join('\n\n')

    const sources = answers.map(answer => ({
      sourceId: answer.source.id,
      sourceName: answer.source.displayName,
      sourceType: answer.source.type,
      itemId: answer.source.id,
      itemTitle: answer.source.displayName,
      relevanceScore: answer.confidence,
      excerpt: answer.text.substring(0, 100) + '...',
      lastUpdated: new Date().toISOString()
    }))

    return {
      text: combinedText,
      confidence: Math.min(1, weightedConfidence),
      sources
    }
  }

  private applyConsensusStrategy(answers: WeightedAnswer[]): {
    text: string
    confidence: number
    sources: SourceAttribution[]
  } {
    // 寻找共同点
    const commonKeyPoints = this.findCommonKeyPoints(answers)
    const uniquePoints = this.findUniquePoints(answers)

    let consensusText = ''
    if (commonKeyPoints.length > 0) {
      consensusText = '综合多个数据源的信息：\n\n' + commonKeyPoints.join('\n')
    }

    if (uniquePoints.length > 0) {
      if (consensusText) consensusText += '\n\n'
      consensusText += '补充信息：\n' + uniquePoints.slice(0, 2).join('\n')
    }

    const sources = answers.map(answer => ({
      sourceId: answer.source.id,
      sourceName: answer.source.displayName,
      sourceType: answer.source.type,
      itemId: answer.source.id,
      itemTitle: answer.source.displayName,
      relevanceScore: answer.confidence,
      excerpt: answer.text.substring(0, 100) + '...',
      lastUpdated: new Date().toISOString()
    }))

    return {
      text: consensusText || '多个数据源提供了相关信息，但缺乏明确的共识。',
      confidence: answers.reduce((sum, a) => sum + a.confidence, 0) / answers.length * 0.8,
      sources
    }
  }

  private applyComprehensiveStrategy(answers: WeightedAnswer[], request: UnifiedQueryRequest): {
    text: string
    confidence: number
    sources: SourceAttribution[]
  } {
    // 综合分析多个维度的信息
    const analysis = this.performComprehensiveAnalysis(answers, request)

    let comprehensiveText = `基于多源数据分析的结果：\n\n`

    // 按重要性排序的信息
    const sortedInfo = analysis.insights.sort((a, b) => b.importance - a.importance)

    sortedInfo.forEach((insight, index) => {
      const sourceNames = insight.sources.map(s => s.displayName).join('、')
      comprehensiveText += `${index + 1}. ${insight.content}（来源：${sourceNames}）\n`
    })

    // 添加补充信息
    if (analysis.additionalInfo.length > 0) {
      comprehensiveText += '\n补充信息：\n'
      analysis.additionalInfo.forEach(info => {
        comprehensiveText += `• ${info}\n`
      })
    }

    const sources = answers.map(answer => ({
      sourceId: answer.source.id,
      sourceName: answer.source.displayName,
      sourceType: answer.source.type,
      itemId: answer.source.id,
      itemTitle: answer.source.displayName,
      relevanceScore: answer.confidence,
      excerpt: answer.text.substring(0, 100) + '...',
      lastUpdated: new Date().toISOString()
    }))

    return {
      text: comprehensiveText,
      confidence: analysis.overallConfidence,
      sources
    }
  }

  private findCommonKeyPoints(answers: WeightedAnswer[]): string[] {
    const allKeyPoints = answers.flatMap(a => a.keyPoints)
    const pointCounts = new Map<string, number>()

    allKeyPoints.forEach(point => {
      const count = pointCounts.get(point) || 0
      pointCounts.set(point, count + 1)
    })

    return Array.from(pointCounts.entries())
      .filter(([_, count]) => count >= Math.ceil(answers.length * 0.5))
      .map(([point]) => point)
  }

  private findUniquePoints(answers: WeightedAnswer[]): string[] {
    const allKeyPoints = answers.flatMap(a => a.keyPoints)
    const commonPoints = this.findCommonKeyPoints(answers)

    return allKeyPoints.filter(point => !commonPoints.includes(point))
      .slice(0, 5)
  }

  private performComprehensiveAnalysis(answers: WeightedAnswer[], request: UnifiedQueryRequest): {
    insights: Array<{
      content: string
      sources: DataSource[]
      importance: number
    }>
    additionalInfo: string[]
    overallConfidence: number
  } {
    const insights: Array<{
      content: string
      sources: DataSource[]
      importance: number
    }> = []
    const additionalInfo: string[] = []

    // 分析每个答案的重要性
    answers.forEach(answer => {
      const importance = this.calculateInsightImportance(answer, request)

      insights.push({
        content: answer.text,
        sources: [answer.source],
        importance
      })

      // 提取额外信息
      if (answer.entities.length > 0) {
        additionalInfo.push(`关键数据：${answer.entities.slice(0, 3).join('、')}`)
      }
    })

    // 计算整体置信度
    const overallConfidence = answers.reduce((sum, a) => sum + a.confidence * a.weight, 0) /
                             answers.reduce((sum, a) => sum + a.weight, 0)

    return {
      insights,
      additionalInfo,
      overallConfidence
    }
  }

  private calculateInsightImportance(answer: WeightedAnswer, request: UnifiedQueryRequest): number {
    let importance = answer.confidence * answer.weight

    // 基于答案类型调整重要性
    if (answer.source.type === 'knowledge_graph') {
      importance *= 1.2 // 知识图谱通常更准确
    }

    // 基于答案长度调整
    if (answer.text.length > 200) {
      importance *= 1.1 // 详细答案更重要
    }

    return importance
  }

  private formatHowToAnswer(text: string): string {
    if (!text.includes('步骤') && !text.includes('方法') && !text.includes('流程')) {
      return `**操作步骤：**\n${text.split('。').filter(s => s.trim()).map(s => `• ${s.trim()}`).join('\n')}`
    }
    return text
  }

  private formatDefinitionAnswer(text: string): string {
    if (!text.startsWith('**') && !text.includes('是指') && !text.includes('定义为')) {
      return `**定义：**\n${text}`
    }
    return text
  }

  private formatComparisonAnswer(text: string): string {
    if (!text.includes('对比') && !text.includes('区别') && !text.includes('不同')) {
      return `**对比分析：**\n${text}`
    }
    return text
  }
}

// 导出单例实例
export const answerFusionEngine = AnswerFusionEngine.getInstance()