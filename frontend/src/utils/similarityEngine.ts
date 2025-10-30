import {
  HistoricalProject,
  ProjectFeatures,
  SimilarProjectRequest,
  ProjectMatch,
  SimilarityResult,
  MatchFactor,
  MatchWeights,
  BasicFeatures,
  CostFeatures,
  QualityFeatures,
  EstimateSuggestion,
  ConfidenceInterval,
  AdjustmentFactor,
  ApplicabilityFactor,
  ProjectType,
  QualityLevel
} from '@/types'

/**
 * 相似度计算引擎 - 用于计算项目间的相似度并提供成本估算建议
 */
export class SimilarityEngine {
  // 默认权重配置
  private static readonly DEFAULT_WEIGHTS: MatchWeights = {
    basic_weight: 0.3,      // 基础特征权重
    cost_weight: 0.4,       // 成本特征权重
    quality_weight: 0.2,    // 质量特征权重
    location_weight: 0.05,  // 地理位置权重
    temporal_weight: 0.05   // 时间因素权重
  }

  // 地区价格调整系数（示例数据）
  private static readonly REGIONAL_PRICE_FACTORS: Record<string, number> = {
    '北京市': 1.15,
    '上海市': 1.12,
    '广州市': 1.08,
    '深圳市': 1.10,
    '杭州市': 1.05,
    '南京市': 1.02,
    '成都市': 0.95,
    '重庆市': 0.92,
    '武汉市': 0.98,
    '西安市': 0.90
  }

  // 时间价格调整系数（考虑通货膨胀）
  private static readonly INFLATION_RATE = 0.03 // 年通胀率3%

  /**
   * 查找相似项目
   */
  static async findSimilarProjects(
    request: SimilarProjectRequest,
    historicalProjects: HistoricalProject[]
  ): Promise<ProjectMatch[]> {
    const weights = request.match_weights || this.DEFAULT_WEIGHTS
    const matches: ProjectMatch[] = []

    for (const project of historicalProjects) {
      // 应用过滤器
      if (!this.passesFilters(project, request.filters)) {
        continue
      }

      // 计算相似度
      const similarityResult = this.calculateOverallSimilarity(
        request.project_features,
        project.project_features,
        weights
      )

      // 检查最小相似度要求
      if (similarityResult.overall_score < (request.min_similarity_score || 0.5)) {
        continue
      }

      // 生成成本估算建议
      const costEstimates = this.generateCostEstimates(
        request.project_features,
        project,
        similarityResult
      )

      // 计算适用性因素
      const applicableFactors = this.calculateApplicabilityFactors(
        request.project_features,
        project,
        similarityResult
      )

      matches.push({
        historical_project: project,
        similarity_result: similarityResult,
        cost_estimates: costEstimates,
        applicable_factors: applicableFactors
      })
    }

    // 按相似度排序
    matches.sort((a, b) => b.similarity_result.overall_score - a.similarity_result.overall_score)

    // 限制结果数量
    const maxResults = request.max_results || 10
    return matches.slice(0, maxResults)
  }

  /**
   * 计算总体相似度
   */
  private static calculateOverallSimilarity(
    targetFeatures: ProjectFeatures,
    sourceFeatures: ProjectFeatures,
    weights: MatchWeights
  ): SimilarityResult {
    // 计算各维度相似度
    const basicSimilarity = this.calculateBasicSimilarity(
      targetFeatures.basic_features,
      sourceFeatures.basic_features
    )

    const costSimilarity = this.calculateCostSimilarity(
      targetFeatures.cost_features,
      sourceFeatures.cost_features
    )

    const qualitySimilarity = this.calculateQualitySimilarity(
      targetFeatures.quality_features,
      sourceFeatures.quality_features
    )

    const locationSimilarity = this.calculateLocationSimilarity(
      targetFeatures.basic_features.location,
      sourceFeatures.basic_features.location
    )

    const temporalSimilarity = this.calculateTemporalSimilarity(
      targetFeatures.basic_features.year_built,
      sourceFeatures.basic_features.year_built
    )

    // 计算加权总分
    const overallScore =
      basicSimilarity * weights.basic_weight +
      costSimilarity * weights.cost_weight +
      qualitySimilarity * weights.quality_weight +
      locationSimilarity * weights.location_weight +
      temporalSimilarity * weights.temporal_weight

    // 生成匹配因子
    const matchFactors: MatchFactor[] = [
      {
        factor_name: '项目类型匹配',
        similarity_score: this.calculateProjectTypeSimilarity(
          targetFeatures.basic_features.project_type,
          sourceFeatures.basic_features.project_type
        ),
        weight: weights.basic_weight * 0.3,
        contribution: 0,
        details: `目标: ${targetFeatures.basic_features.project_type}, 源: ${sourceFeatures.basic_features.project_type}`
      },
      {
        factor_name: '面积相似度',
        similarity_score: this.calculateAreaSimilarity(
          targetFeatures.basic_features.area,
          sourceFeatures.basic_features.area
        ),
        weight: weights.basic_weight * 0.3,
        contribution: 0,
        details: `目标: ${targetFeatures.basic_features.area}㎡, 源: ${sourceFeatures.basic_features.area}㎡`
      },
      {
        factor_name: '单位造价相似度',
        similarity_score: this.calculateUnitCostSimilarity(
          targetFeatures.cost_features.unit_cost,
          sourceFeatures.cost_features.unit_cost
        ),
        weight: weights.cost_weight * 0.5,
        contribution: 0,
        details: `目标: ¥${targetFeatures.cost_features.unit_cost}/㎡, 源: ¥${sourceFeatures.cost_features.unit_cost}/㎡`
      },
      {
        factor_name: '质量等级匹配',
        similarity_score: this.calculateQualityLevelSimilarity(
          targetFeatures.quality_features.quality_level,
          sourceFeatures.quality_features.quality_level
        ),
        weight: weights.quality_weight * 0.4,
        contribution: 0,
        details: `目标: ${targetFeatures.quality_features.quality_level}, 源: ${sourceFeatures.quality_features.quality_level}`
      }
    ]

    // 计算每个因子的贡献度
    matchFactors.forEach(factor => {
      factor.contribution = factor.similarity_score * factor.weight
    })

    // 计算置信度
    const confidenceLevel = this.calculateConfidenceLevel(overallScore, matchFactors)

    // 生成解释
    const explanation = this.generateSimilarityExplanation(matchFactors, overallScore)

    return {
      overall_score: Math.round(overallScore * 100) / 100,
      basic_similarity: Math.round(basicSimilarity * 100) / 100,
      cost_similarity: Math.round(costSimilarity * 100) / 100,
      quality_similarity: Math.round(qualitySimilarity * 100) / 100,
      location_similarity: Math.round(locationSimilarity * 100) / 100,
      temporal_similarity: Math.round(temporalSimilarity * 100) / 100,
      match_factors: matchFactors,
      confidence_level: Math.round(confidenceLevel * 100) / 100,
      explanation
    }
  }

  /**
   * 计算基础特征相似度
   */
  private static calculateBasicSimilarity(target: BasicFeatures, source: BasicFeatures): number {
    const typeSimilarity = this.calculateProjectTypeSimilarity(target.project_type, source.project_type)
    const areaSimilarity = this.calculateAreaSimilarity(target.area, source.area)
    const floorSimilarity = this.calculateFloorSimilarity(target.floors, source.floors)
    const structureSimilarity = this.calculateStructureSimilarity(target.structure_type, source.structure_type)

    return (typeSimilarity * 0.3 + areaSimilarity * 0.4 + floorSimilarity * 0.15 + structureSimilarity * 0.15)
  }

  /**
   * 计算成本特征相似度
   */
  private static calculateCostSimilarity(target: CostFeatures, source: CostFeatures): number {
    const unitCostSimilarity = this.calculateUnitCostSimilarity(target.unit_cost, source.unit_cost)
    const totalCostSimilarity = this.calculateTotalCostSimilarity(target.total_cost, source.total_cost)
    const costStructureSimilarity = this.calculateCostStructureSimilarity(target, source)

    return (unitCostSimilarity * 0.5 + totalCostSimilarity * 0.3 + costStructureSimilarity * 0.2)
  }

  /**
   * 计算质量特征相似度
   */
  private static calculateQualitySimilarity(target: QualityFeatures, source: QualityFeatures): number {
    const levelSimilarity = this.calculateQualityLevelSimilarity(target.quality_level, source.quality_level)
    const standardSimilarity = this.calculateStandardSimilarity(target.construction_standard, source.construction_standard)

    return (levelSimilarity * 0.7 + standardSimilarity * 0.3)
  }

  /**
   * 计算项目类型相似度
   */
  private static calculateProjectTypeSimilarity(target: ProjectType, source: ProjectType): number {
    return target === source ? 1.0 : 0.0
  }

  /**
   * 计算面积相似度
   */
  private static calculateAreaSimilarity(targetArea: number, sourceArea: number): number {
    if (targetArea === 0 || sourceArea === 0) return 0

    const ratio = Math.min(targetArea, sourceArea) / Math.max(targetArea, sourceArea)
    return ratio
  }

  /**
   * 计算层数相似度
   */
  private static calculateFloorSimilarity(targetFloors: number, sourceFloors: number): number {
    if (targetFloors === 0 || sourceFloors === 0) return 0

    const ratio = Math.min(targetFloors, sourceFloors) / Math.max(targetFloors, sourceFloors)
    return ratio
  }

  /**
   * 计算结构类型相似度
   */
  private static calculateStructureSimilarity(targetStructure: string, sourceStructure: string): number {
    if (!targetStructure || !sourceStructure) return 0.5

    // 简单的字符串匹配
    return targetStructure.toLowerCase() === sourceStructure.toLowerCase() ? 1.0 : 0.3
  }

  /**
   * 计算单位造价相似度
   */
  private static calculateUnitCostSimilarity(targetUnitCost: number, sourceUnitCost: number): number {
    if (targetUnitCost === 0 || sourceUnitCost === 0) return 0

    const ratio = Math.min(targetUnitCost, sourceUnitCost) / Math.max(targetUnitCost, sourceUnitCost)
    return ratio
  }

  /**
   * 计算总造价相似度
   */
  private static calculateTotalCostSimilarity(targetTotalCost: number, sourceTotalCost: number): number {
    if (targetTotalCost === 0 || sourceTotalCost === 0) return 0

    const ratio = Math.min(targetTotalCost, sourceTotalCost) / Math.max(targetTotalCost, sourceTotalCost)
    return ratio
  }

  /**
   * 计算成本结构相似度
   */
  private static calculateCostStructureSimilarity(target: CostFeatures, source: CostFeatures): number {
    const targetTotal = target.total_cost
    const sourceTotal = source.total_cost

    if (targetTotal === 0 || sourceTotal === 0) return 0.5

    // 计算各项成本占比的相似度
    const targetMaterialRatio = target.material_costs.reduce((sum, c) => sum + c.amount, 0) / targetTotal
    const sourceMaterialRatio = source.material_costs.reduce((sum, c) => sum + c.amount, 0) / sourceTotal

    const targetLaborRatio = target.labor_costs.reduce((sum, c) => sum + c.amount, 0) / targetTotal
    const sourceLaborRatio = source.labor_costs.reduce((sum, c) => sum + c.amount, 0) / sourceTotal

    const materialSimilarity = 1 - Math.abs(targetMaterialRatio - sourceMaterialRatio)
    const laborSimilarity = 1 - Math.abs(targetLaborRatio - sourceLaborRatio)

    return (materialSimilarity + laborSimilarity) / 2
  }

  /**
   * 计算质量等级相似度
   */
  private static calculateQualityLevelSimilarity(target: QualityLevel, source: QualityLevel): number {
    const levels = [QualityLevel.BASIC, QualityLevel.STANDARD, QualityLevel.PREMIUM]
    const targetIndex = levels.indexOf(target)
    const sourceIndex = levels.indexOf(source)

    if (targetIndex === -1 || sourceIndex === -1) return 0

    const distance = Math.abs(targetIndex - sourceIndex)
    return Math.max(0, 1 - distance * 0.3)
  }

  /**
   * 计算标准相似度
   */
  private static calculateStandardSimilarity(targetStandard: string, sourceStandard: string): number {
    if (!targetStandard || !sourceStandard) return 0.5

    return targetStandard.toLowerCase() === sourceStandard.toLowerCase() ? 1.0 : 0.4
  }

  /**
   * 计算地理位置相似度
   */
  private static calculateLocationSimilarity(targetLocation: string, sourceLocation: string): number {
    if (!targetLocation || !sourceLocation) return 0.5

    // 简单的省份/城市匹配
    const targetCity = this.extractCity(targetLocation)
    const sourceCity = this.extractCity(sourceLocation)

    if (targetCity === sourceCity) return 1.0
    if (this.extractProvince(targetLocation) === this.extractProvince(sourceLocation)) return 0.7

    return 0.3
  }

  /**
   * 计算时间相似度
   */
  private static calculateTemporalSimilarity(targetYear?: number, sourceYear?: number): number {
    if (!targetYear || !sourceYear) return 0.5

    const yearDiff = Math.abs(targetYear - sourceYear)
    return Math.max(0, 1 - yearDiff * 0.1)
  }

  /**
   * 提取城市名称
   */
  private static extractCity(location: string): string {
    const cities = ['北京市', '上海市', '广州市', '深圳市', '杭州市', '南京市', '成都市', '重庆市', '武汉市', '西安市']

    for (const city of cities) {
      if (location.includes(city)) return city
    }

    return location
  }

  /**
   * 提取省份名称
   */
  private static extractProvince(location: string): string {
    const provinces = ['北京', '上海', '广东', '浙江', '江苏', '四川', '湖北', '陕西']

    for (const province of provinces) {
      if (location.includes(province)) return province
    }

    return location
  }

  /**
   * 生成成本估算建议
   */
  private static generateCostEstimates(
    targetFeatures: ProjectFeatures,
    sourceProject: HistoricalProject,
    similarityResult: SimilarityResult
  ): EstimateSuggestion[] {
    const estimates: EstimateSuggestion[] = []
    const sourceCostFeatures = sourceProject.project_features.cost_features

    // 地区调整
    const locationAdjustment = this.calculateLocationAdjustment(
      targetFeatures.basic_features.location,
      sourceProject.project_features.basic_features.location
    )

    // 时间调整
    const temporalAdjustment = this.calculateTemporalAdjustment(
      targetFeatures.basic_features.year_built,
      sourceProject.project_features.basic_features.year_built
    )

    // 质量调整
    const qualityAdjustment = this.calculateQualityAdjustment(
      targetFeatures.quality_features.quality_level,
      sourceProject.project_features.quality_features.quality_level
    )

    // 计算调整后的单位造价
    const adjustedUnitCost = sourceCostFeatures.unit_cost * locationAdjustment * temporalAdjustment * qualityAdjustment

    // 生成主要成本类别建议
    const categories = ['土建工程', '装饰工程', '安装工程', '其他费用']

    for (const category of categories) {
      const categoryRatio = this.getCategoryRatio(category)
      const suggestedUnitCost = adjustedUnitCost * categoryRatio

      estimates.push({
        cost_category: category,
        suggested_unit_cost: suggestedUnitCost,
        confidence_interval: this.calculateConfidenceInterval(suggestedUnitCost, similarityResult.confidence_level),
        supporting_projects: [sourceProject.name],
        adjustment_factors: [
          {
            factor_name: '地区调整',
            adjustment_type: 'percentage',
            value: (locationAdjustment - 1) * 100,
            reason: `${targetFeatures.basic_features.location} vs ${sourceProject.project_features.basic_features.location}`
          },
          {
            factor_name: '时间调整',
            adjustment_type: 'percentage',
            value: (temporalAdjustment - 1) * 100,
            reason: `${targetFeatures.basic_features.year_built} vs ${sourceProject.project_features.basic_features.year_built}`
          },
          {
            factor_name: '质量调整',
            adjustment_type: 'percentage',
            value: (qualityAdjustment - 1) * 100,
            reason: `${targetFeatures.quality_features.quality_level} vs ${sourceProject.project_features.quality_features.quality_level}`
          }
        ],
        rationale: `基于相似项目 ${sourceProject.name} 的历史数据，经过地区、时间和质量因素调整后得出`
      })
    }

    return estimates
  }

  /**
   * 计算置信区间
   */
  private static calculateConfidenceInterval(value: number, confidenceLevel: number): ConfidenceInterval {
    const variance = value * 0.2 // 20%的方差
    const multiplier = confidenceLevel >= 0.8 ? 1.96 : confidenceLevel >= 0.6 ? 1.645 : 1.0

    return {
      lower_bound: Math.max(0, value - variance * multiplier),
      upper_bound: value + variance * multiplier,
      confidence_level: confidenceLevel
    }
  }

  /**
   * 计算地区调整系数
   */
  private static calculateLocationAdjustment(targetLocation: string, sourceLocation: string): number {
    const targetFactor = this.REGIONAL_PRICE_FACTORS[this.extractCity(targetLocation)] || 1.0
    const sourceFactor = this.REGIONAL_PRICE_FACTORS[this.extractCity(sourceLocation)] || 1.0

    return targetFactor / sourceFactor
  }

  /**
   * 计算时间调整系数
   */
  private static calculateTemporalAdjustment(targetYear?: number, sourceYear?: number): number {
    if (!targetYear || !sourceYear) return 1.0

    const yearsDiff = targetYear - sourceYear
    return Math.pow(1 + this.INFLATION_RATE, yearsDiff)
  }

  /**
   * 计算质量调整系数
   */
  private static calculateQualityAdjustment(targetQuality: QualityLevel, sourceQuality: QualityLevel): number {
    const qualityFactors = {
      [QualityLevel.BASIC]: 0.85,
      [QualityLevel.STANDARD]: 1.0,
      [QualityLevel.PREMIUM]: 1.25
    }

    return qualityFactors[targetQuality] / qualityFactors[sourceQuality]
  }

  /**
   * 获取成本类别比例
   */
  private static getCategoryRatio(category: string): number {
    const ratios: Record<string, number> = {
      '土建工程': 0.45,
      '装饰工程': 0.25,
      '安装工程': 0.20,
      '其他费用': 0.10
    }

    return ratios[category] || 0.25
  }

  /**
   * 计算适用性因素
   */
  private static calculateApplicabilityFactors(
    targetFeatures: ProjectFeatures,
    sourceProject: HistoricalProject,
    similarityResult: SimilarityResult
  ): ApplicabilityFactor[] {
    const factors: ApplicabilityFactor[] = []

    // 项目类型适用性
    factors.push({
      factor_name: '项目类型匹配度',
      relevance_score: similarityResult.basic_similarity,
      applicability: this.mapScoreToApplicability(similarityResult.basic_similarity),
      notes: `目标项目类型与历史项目匹配度: ${(similarityResult.basic_similarity * 100).toFixed(1)}%`
    })

    // 成本水平适用性
    factors.push({
      factor_name: '成本水平适用性',
      relevance_score: similarityResult.cost_similarity,
      applicability: this.mapScoreToApplicability(similarityResult.cost_similarity),
      notes: `单位造价水平相似度: ${(similarityResult.cost_similarity * 100).toFixed(1)}%`
    })

    // 地理位置适用性
    factors.push({
      factor_name: '地理位置相关性',
      relevance_score: similarityResult.location_similarity,
      applicability: this.mapScoreToApplicability(similarityResult.location_similarity),
      notes: `地理位置相似度: ${(similarityResult.location_similarity * 100).toFixed(1)}%`
    })

    return factors
  }

  /**
   * 映射分数到适用性等级
   */
  private static mapScoreToApplicability(score: number): 'highly_applicable' | 'moderately_applicable' | 'low_applicable' | 'not_applicable' {
    if (score >= 0.8) return 'highly_applicable'
    if (score >= 0.6) return 'moderately_applicable'
    if (score >= 0.4) return 'low_applicable'
    return 'not_applicable'
  }

  /**
   * 计算置信度
   */
  private static calculateConfidenceLevel(overallScore: number, matchFactors: MatchFactor[]): number {
    // 基于总分和关键因子的稳定性计算置信度
    const factorStability = this.calculateFactorStability(matchFactors)
    return overallScore * 0.7 + factorStability * 0.3
  }

  /**
   * 计算因子稳定性
   */
  private static calculateFactorStability(matchFactors: MatchFactor[]): number {
    if (matchFactors.length === 0) return 0.5

    const averageScore = matchFactors.reduce((sum, factor) => sum + factor.similarity_score, 0) / matchFactors.length
    const variance = matchFactors.reduce((sum, factor) =>
      sum + Math.pow(factor.similarity_score - averageScore, 2), 0) / matchFactors.length

    // 方差越小，稳定性越高
    return Math.max(0, 1 - variance)
  }

  /**
   * 生成相似度解释
   */
  private static generateSimilarityExplanation(matchFactors: MatchFactor[], overallScore: number): string {
    const topFactors = matchFactors
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)

    const factorDescriptions = topFactors.map(factor =>
      `${factor.factor_name}: ${(factor.similarity_score * 100).toFixed(1)}%`
    ).join('、')

    return `综合相似度得分: ${(overallScore * 100).toFixed(1)}%，主要匹配因素: ${factorDescriptions}`
  }

  /**
   * 检查项目是否通过过滤器
   */
  private static passesFilters(project: HistoricalProject, filters?: any[]): boolean {
    if (!filters || filters.length === 0) return true

    // 这里可以实现具体的过滤逻辑
    return true
  }
}