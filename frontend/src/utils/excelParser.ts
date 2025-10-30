import * as XLSX from 'xlsx'
import {
  HistoricalProject,
  ExcelParseResult,
  ProjectFeatures,
  BasicFeatures,
  CostFeatures,
  QualityFeatures,
  DetailedCostBreakdown,
  MaterialBreakdown,
  LaborBreakdown,
  DetailedComponent,
  CostComponent,
  ExcelMetadata,
  ParseError,
  ParsingStatistics,
  QualityIndicators,
  ValidationStatus,
  QualityIssue,
  ProjectType,
  QualityLevel,
  HistoricalProjectSource
} from '@/types'

/**
 * Excel解析器 - 用于智能解析Excel格式的工程造价数据
 */
export class ExcelParser {
  private static readonly TEMPLATE_PATTERNS = {
    // 标准造价预算表格式
    STANDARD_BUDGET: {
      keywords: ['项目名称', '建筑面积', '总造价', '单位造价', '分部分项', '措施项目', '其他项目'],
      requiredHeaders: ['项目名称', '建筑面积', '总造价'],
      confidence: 0.9
    },
    // 简化格式
    SIMPLE: {
      keywords: ['项目', '面积', '造价', '成本'],
      requiredHeaders: ['项目', '造价'],
      confidence: 0.7
    },
    // 详细清单格式
    DETAILED_LIST: {
      keywords: ['序号', '项目编码', '项目名称', '单位', '工程量', '综合单价', '合价'],
      requiredHeaders: ['项目名称', '工程量', '综合单价'],
      confidence: 0.95
    }
  }

  /**
   * 解析Excel文件并返回历史项目数据
   */
  static async parseExcelFile(file: File): Promise<ExcelParseResult> {
    const startTime = Date.now()
    const parseErrors: ParseError[] = []
    const warnings: string[] = []

    try {
      // 读取Excel文件
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      })

      if (workbook.SheetNames.length === 0) {
        throw new Error('Excel文件中没有找到工作表')
      }

      // 选择主要工作表
      const sheetName = this.selectMainSheet(workbook)
      const worksheet = workbook.Sheets[sheetName]

      // 解析数据
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        dateNF: 'yyyy-mm-dd'
      })

      if (jsonData.length === 0) {
        throw new Error('工作表中没有找到数据')
      }

      // 检测模板类型
      const templateType = this.detectTemplateType(jsonData as string[][])
      if (!templateType) {
        warnings.push('未能识别Excel模板类型，将使用通用解析方式')
      }

      // 提取项目数据
      const projectData = this.extractProjectData(jsonData as string[][], templateType, parseErrors)

      // 验证数据质量
      const qualityIndicators = this.validateDataQuality(projectData, parseErrors)

      // 计算解析统计信息
      const processingTime = Date.now() - startTime
      const parsingStatistics: ParsingStatistics = {
        total_rows_processed: jsonData.length,
        successful_extractions: jsonData.length - parseErrors.length,
        failed_extractions: parseErrors.length,
        data_coverage_percentage: this.calculateDataCoverage(projectData),
        processing_time_seconds: processingTime / 1000
      }

      // 生成Excel元数据
      const excelMetadata: ExcelMetadata = {
        filename: file.name,
        sheet_name: sheetName,
        template_type: templateType || 'unknown',
        parse_date: new Date().toISOString(),
        file_size: file.size,
        parsing_version: '1.0.0',
        detected_headers: this.extractHeaders(jsonData as string[][]),
        confidence_score: this.calculateConfidenceScore(projectData, templateType, parseErrors)
      }

      const historicalProject: HistoricalProject = {
        id: this.generateId(),
        name: projectData.name || file.name.replace(/\.[^/.]+$/, ''),
        source: HistoricalProjectSource.EXCEL_UPLOAD,
        excel_metadata: excelMetadata,
        project_features: projectData.features,
        cost_breakdown: projectData.costBreakdown,
        quality_indicators: qualityIndicators,
        data_quality_score: qualityIndicators.overall_quality_score,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'current_user' // 这里应该从用户上下文获取
      }

      return {
        success: parseErrors.length === 0 || parseErrors.length < jsonData.length * 0.3,
        project_data: historicalProject,
        confidence_score: excelMetadata.confidence_score,
        parsing_errors: parseErrors,
        warnings: warnings,
        detected_template_type: templateType || 'unknown',
        parsing_statistics: parsingStatistics
      }

    } catch (error) {
      parseErrors.push({
        error_type: 'FILE_PARSE_ERROR',
        message: error instanceof Error ? error.message : '文件解析失败',
        field: 'file',
        suggested_fix: '请检查Excel文件格式是否正确，确保文件未损坏'
      })

      return {
        success: false,
        project_data: {} as HistoricalProject,
        confidence_score: 0,
        parsing_errors: parseErrors,
        warnings: warnings,
        detected_template_type: 'unknown',
        parsing_statistics: {
          total_rows_processed: 0,
          successful_extractions: 0,
          failed_extractions: 1,
          data_coverage_percentage: 0,
          processing_time_seconds: (Date.now() - startTime) / 1000
        }
      }
    }
  }

  /**
   * 选择主要工作表
   */
  private static selectMainSheet(workbook: XLSX.WorkBook): string {
    // 优先选择包含数据最多的工作表
    let maxDataSheet = workbook.SheetNames[0]
    let maxRowCount = 0

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1')
      const rowCount = range.e.r - range.s.r + 1

      if (rowCount > maxRowCount) {
        maxRowCount = rowCount
        maxDataSheet = sheetName
      }
    }

    return maxDataSheet
  }

  /**
   * 检测Excel模板类型
   */
  private static detectTemplateType(data: string[][]): string | null {
    const headers = data[0] || []
    const headerText = headers.join(' ').toLowerCase()

    for (const [templateName, template] of Object.entries(this.TEMPLATE_PATTERNS)) {
      const matchCount = template.keywords.filter(keyword =>
        headerText.includes(keyword.toLowerCase())
      ).length

      const hasRequiredHeaders = template.requiredHeaders.every(header =>
        headers.some(h => h.toLowerCase().includes(header.toLowerCase()))
      )

      if (matchCount >= template.keywords.length * 0.6 && hasRequiredHeaders) {
        return templateName
      }
    }

    return null
  }

  /**
   * 提取项目数据
   */
  private static extractProjectData(
    data: string[][],
    templateType: string | null,
    errors: ParseError[]
  ): {
    name: string
    features: ProjectFeatures
    costBreakdown: DetailedCostBreakdown
  } {
    const headers = data[0] || []
    const rows = data.slice(1)

    // 提取基本信息
    const basicInfo = this.extractBasicInfo(headers, rows, errors)

    // 提取成本信息
    const costInfo = this.extractCostInfo(headers, rows, errors)

    // 提取质量信息
    const qualityInfo = this.extractQualityInfo(headers, rows, errors)

    // 构建项目特征
    const features: ProjectFeatures = {
      basic_features: basicInfo,
      cost_features: costInfo,
      quality_features: qualityInfo
    }

    // 构建成本分解
    const costBreakdown = this.buildCostBreakdown(headers, rows, errors)

    return {
      name: basicInfo.building_type || '未知项目',
      features,
      costBreakdown
    }
  }

  /**
   * 提取基本信息
   */
  private static extractBasicInfo(headers: string[], rows: string[][], errors: ParseError[]): BasicFeatures {
    const getValue = (header: string): string => {
      const index = headers.findIndex(h => h.toLowerCase().includes(header.toLowerCase()))
      return index >= 0 && rows[0] ? String(rows[0][index] || '') : ''
    }

    const getNumericValue = (header: string): number => {
      const value = getValue(header)
      const num = parseFloat(value.replace(/[,，]/g, ''))
      return isNaN(num) ? 0 : num
    }

    return {
      project_type: this.parseProjectType(getValue('项目类型')),
      building_type: getValue('建筑类型') || getValue('工程类型'),
      structure_type: getValue('结构类型') || getValue('结构形式'),
      area: getNumericValue('建筑面积'),
      location: getValue('建设地点') || getValue('项目地点'),
      floors: getNumericValue('层数'),
      year_built: getNumericValue('建设年份') || undefined,
      construction_period: getNumericValue('建设工期') || getNumericValue('工期'),
      design_standard: getValue('设计标准')
    }
  }

  /**
   * 提取成本信息
   */
  private static extractCostInfo(headers: string[], rows: string[][], errors: ParseError[]): CostFeatures {
    const getValue = (header: string): string => {
      const index = headers.findIndex(h => h.toLowerCase().includes(header.toLowerCase()))
      return index >= 0 && rows[0] ? String(rows[0][index] || '') : ''
    }

    const getNumericValue = (header: string): number => {
      const value = getValue(header)
      const num = parseFloat(value.replace(/[,，]/g, ''))
      return isNaN(num) ? 0 : num
    }

    const totalCost = getNumericValue('总造价') || getNumericValue('总投资')
    const area = getNumericValue('建筑面积')
    const unitCost = totalCost > 0 && area > 0 ? totalCost / area : getNumericValue('单位造价')

    return {
      total_cost: totalCost,
      unit_cost: unitCost,
      material_costs: this.extractCostComponents(headers, rows, ['材料', '主材']),
      labor_costs: this.extractCostComponents(headers, rows, ['人工', '工资']),
      equipment_costs: this.extractCostComponents(headers, rows, ['设备', '机械']),
      overhead_costs: this.extractCostComponents(headers, rows, ['管理', '规费']),
      other_costs: this.extractCostComponents(headers, rows, ['其他', '税金']),
      cost_year: new Date().getFullYear(),
      currency: 'CNY'
    }
  }

  /**
   * 提取质量信息
   */
  private static extractQualityInfo(headers: string[], rows: string[][], errors: ParseError[]): QualityFeatures {
    const getValue = (header: string): string => {
      const index = headers.findIndex(h => h.toLowerCase().includes(header.toLowerCase()))
      return index >= 0 && rows[0] ? String(rows[0][index] || '') : ''
    }

    return {
      quality_level: this.parseQualityLevel(getValue('质量等级') || getValue('质量标准')),
      construction_standard: getValue('施工标准') || getValue('建设标准'),
      technical_specifications: this.extractTechnicalSpecifications(headers, rows),
      material_grades: [],
      quality_scores: []
    }
  }

  /**
   * 提取成本组件
   */
  private static extractCostComponents(headers: string[], rows: string[][], keywords: string[]): CostComponent[] {
    const components: CostComponent[] = []

    for (const keyword of keywords) {
      const index = headers.findIndex(h => h.toLowerCase().includes(keyword.toLowerCase()))
      if (index >= 0 && rows[0]) {
        const value = parseFloat(String(rows[0][index] || '0').replace(/[,，]/g, ''))
        if (!isNaN(value) && value > 0) {
          components.push({
            component_type: keyword,
            cost_type: keyword,
            amount: value,
            unit_price: value,
            unit: '元'
          })
        }
      }
    }

    return components
  }

  /**
   * 构建成本分解
   */
  private static buildCostBreakdown(headers: string[], rows: string[][], errors: ParseError[]): DetailedCostBreakdown {
    return {
      id: this.generateId(),
      level: 1,
      category: '总造价',
      item_name: '工程造价',
      unit: '项',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      cost_components: [],
      material_breakdown: [],
      labor_breakdown: [],
      detailed_components: []
    }
  }

  /**
   * 验证数据质量
   */
  private static validateDataQuality(projectData: any, errors: ParseError[]): QualityIndicators {
    const qualityIssues: QualityIssue[] = []

    // 检查必填字段
    if (!projectData.features.basic_features.area) {
      qualityIssues.push({
        issue_type: 'MISSING_REQUIRED_FIELD',
        severity: 'high',
        description: '缺少建筑面积信息',
        suggested_action: '请补充建筑面积数据',
        affected_fields: ['area']
      })
    }

    if (!projectData.features.cost_features.total_cost) {
      qualityIssues.push({
        issue_type: 'MISSING_REQUIRED_FIELD',
        severity: 'high',
        description: '缺少总造价信息',
        suggested_action: '请补充总造价数据',
        affected_fields: ['total_cost']
      })
    }

    // 计算质量分数
    const completenessScore = Math.max(0, 100 - qualityIssues.length * 10)
    const accuracyScore = errors.length === 0 ? 100 : Math.max(0, 100 - errors.length * 15)
    const consistencyScore = 85 // 默认一致性分数
    const reliabilityScore = 90 // 默认可靠性分数
    const overallScore = (completenessScore + accuracyScore + consistencyScore + reliabilityScore) / 4

    return {
      overall_quality_score: overallScore,
      completeness_score: completenessScore,
      accuracy_score: accuracyScore,
      consistency_score: consistencyScore,
      reliability_score: reliabilityScore,
      validation_status: overallScore >= 80 ? ValidationStatus.VALIDATED : ValidationStatus.NEEDS_REVIEW,
      quality_issues: qualityIssues
    }
  }

  /**
   * 提取技术规格
   */
  private static extractTechnicalSpecifications(headers: string[], rows: string[][]): string[] {
    const specs: string[] = []

    // 这里可以根据实际需求扩展
    const specKeywords = ['防火', '抗震', '节能', '环保']

    for (const keyword of specKeywords) {
      const index = headers.findIndex(h => h.toLowerCase().includes(keyword.toLowerCase()))
      if (index >= 0 && rows[0] && rows[0][index]) {
        specs.push(`${keyword}: ${rows[0][index]}`)
      }
    }

    return specs
  }

  /**
   * 提取表头
   */
  private static extractHeaders(data: string[][]): string[] {
    return data[0] || []
  }

  /**
   * 计算数据覆盖率
   */
  private static calculateDataCoverage(projectData: any): number {
    const totalFields = 10 // 预期字段总数
    const filledFields = Object.values(projectData.features.basic_features).filter(v => v !== undefined && v !== null && v !== '').length
    return (filledFields / totalFields) * 100
  }

  /**
   * 计算置信度分数
   */
  private static calculateConfidenceScore(
    projectData: any,
    templateType: string | null,
    errors: ParseError[]
  ): number {
    let score = 50 // 基础分数

    // 模板类型匹配加分
    if (templateType) {
      score += 20
    }

    // 数据完整性加分
    const coverage = this.calculateDataCoverage(projectData)
    score += (coverage / 100) * 20

    // 错误扣分
    score -= errors.length * 5

    return Math.max(0, Math.min(100, score))
  }

  /**
   * 解析项目类型
   */
  private static parseProjectType(typeText: string): ProjectType {
    const text = typeText.toLowerCase()
    if (text.includes('住宅') || text.includes('居住')) return ProjectType.RESIDENTIAL
    if (text.includes('商业') || text.includes('办公') || text.includes('写字楼')) return ProjectType.COMMERCIAL
    if (text.includes('工业') || text.includes('厂房') || text.includes('仓库')) return ProjectType.INDUSTRIAL
    if (text.includes('公共') || text.includes('学校') || text.includes('医院')) return ProjectType.PUBLIC
    return ProjectType.MIXED
  }

  /**
   * 解析质量等级
   */
  private static parseQualityLevel(levelText: string): QualityLevel {
    const text = levelText.toLowerCase()
    if (text.includes('高端') || text.includes('精装') || text.includes('优质')) return QualityLevel.PREMIUM
    if (text.includes('标准') || text.includes('普通') || text.includes('合格')) return QualityLevel.STANDARD
    return QualityLevel.BASIC
  }

  /**
   * 生成唯一ID
   */
  private static generateId(): string {
    return `excel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 批量解析Excel文件
   */
  static async parseBatchExcelFiles(files: File[]): Promise<ExcelParseResult[]> {
    const results: ExcelParseResult[] = []

    for (const file of files) {
      try {
        const result = await this.parseExcelFile(file)
        results.push(result)
      } catch (error) {
        results.push({
          success: false,
          project_data: {} as HistoricalProject,
          confidence_score: 0,
          parsing_errors: [{
            error_type: 'BATCH_PARSE_ERROR',
            message: error instanceof Error ? error.message : '批量解析失败',
            field: 'file',
            suggested_fix: '请检查文件格式'
          }],
          warnings: [],
          detected_template_type: 'unknown',
          parsing_statistics: {
            total_rows_processed: 0,
            successful_extractions: 0,
            failed_extractions: 1,
            data_coverage_percentage: 0,
            processing_time_seconds: 0
          }
        })
      }
    }

    return results
  }
}