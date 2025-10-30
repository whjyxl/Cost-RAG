// 通用类型定义
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message: string
  timestamp: string
  request_id: string
}

export interface ApiError {
  code: string
  message: string
  details?: Array<{
    field: string
    message: string
  }>
}

export interface PaginationParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

// 认证相关类型
export interface LoginRequest {
  username: string
  password: string
  remember_me?: boolean
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface User {
  id: string
  username: string
  email: string
  full_name: string
  avatar_url?: string
  role: UserRole
  department?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export enum UserRole {
  ADMIN = 'admin',
  ENGINEER = 'engineer',
  ANALYST = 'analyst',
  VIEWER = 'viewer',
}

// 文档相关类型
export interface DocumentUploadRequest {
  file: File
  document_type: DocumentType
  project_id?: string
  metadata?: Record<string, any>
}

export enum DocumentType {
  COST_TEMPLATE = 'cost_template',
  SPECIFICATION = 'specification',
  CONTRACT = 'contract',
  DRAWING = 'drawing',
  REGULATION = 'regulation',
  OTHER = 'other',
}

export interface Document {
  id: string
  filename: string
  original_filename: string
  file_type: string
  file_size: number
  document_type: DocumentType
  content_summary?: string
  processing_status: ProcessingStatus
  upload_time: string
  processed_time?: string
  uploaded_by: string
  project_id?: string
  tags: string[]
  metadata: Record<string, any>
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 成本估算相关类型
export interface CostEstimateRequest {
  project_name: string
  project_type: ProjectType
  area: number
  quality_level: QualityLevel
  location: string
  specifications?: Record<string, any>
  template_id?: string
}

export enum ProjectType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  INDUSTRIAL = 'industrial',
  PUBLIC = 'public',
  MIXED = 'mixed',
}

export enum QualityLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
}

export interface CostEstimate {
  id: string
  project_name: string
  project_type: ProjectType
  area: number
  quality_level: QualityLevel
  location: string
  total_cost: number
  unit_cost: number
  breakdown: CostBreakdown[]
  created_at: string
  updated_at: string
  created_by: string
  status: EstimateStatus
  specifications?: Record<string, any>
}

export interface CostBreakdown {
  id: string
  level: number
  category: string
  subcategory?: string
  item_code?: string
  item_name: string
  unit: string
  quantity: number
  unit_price: number
  total_price: number
  cost_components: CostComponent[]
}

export interface CostComponent {
  component_type: string
  cost_type: string
  amount: number
  unit_price: number
  unit: string
}

export enum EstimateStatus {
  DRAFT = 'draft',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// 多项目对比相关类型
export interface ComparisonRequest {
  name: string
  description?: string
  projects: ComparisonProject[]
}

export interface ComparisonProject {
  project_name: string
  area: number
  project_type: ProjectType
  location: string
  cost_data: Record<string, number>
  quality_level: QualityLevel
}

export interface ComparisonResult {
  id: string
  name: string
  description?: string
  projects: ComparisonProject[]
  analysis: ComparisonAnalysis
  created_at: string
  created_by: string
}

export interface ComparisonAnalysis {
  cost_variance: number
  cost_efficiency_ranking: Array<{
    project_name: string
    efficiency_score: number
    rank: number
  }>
  key_differences: Array<{
    category: string
    variance_percentage: number
    highest_cost_project: string
    lowest_cost_project: string
  }>
  recommendations: string[]
}

// RAG查询相关类型
export interface QueryRequest {
  question: string
  context_type?: QueryContextType
  max_results?: number
  use_knowledge_graph?: boolean
  document_ids?: string[]
}

export enum QueryContextType {
  COST_ESTIMATION = 'cost_estimation',
  REGULATIONS = 'regulations',
  MATERIALS = 'materials',
  TECHNIQUES = 'techniques',
  GENERAL = 'general',
}

export interface QueryResponse {
  id: string
  question: string
  answer: string
  sources: QuerySource[]
  confidence_score: number
  processing_time: number
  created_at: string
}

export interface QuerySource {
  document_id: string
  document_name: string
  relevance_score: number
  snippet: string
  page_number?: number
  section?: string
}

// 知识图谱相关类型
export interface GraphNode {
  id: string
  label: string
  type: NodeType
  properties: Record<string, any>
  x?: number
  y?: number
}

export enum NodeType {
  PROJECT = 'project',
  MATERIAL = 'material',
  ACTIVITY = 'activity',
  RESOURCE = 'resource',
  SPECIFICATION = 'specification',
  REGULATION = 'regulation',
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relationship: string
  properties: Record<string, any>
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  statistics: {
    total_nodes: number
    total_edges: number
    node_types: Record<NodeType, number>
    relationship_types: Record<string, number>
  }
}

// 通知相关类型
export interface Notification {
  id: string
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  created_at: string
  data?: Record<string, any>
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

// 系统设置相关类型
export interface SystemSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  notifications: NotificationSettings
  api_settings: ApiSettings
}

export interface NotificationSettings {
  email_notifications: boolean
  push_notifications: boolean
  task_reminders: boolean
  system_updates: boolean
}

export interface ApiSettings {
  base_url: string
  timeout: number
  retry_attempts: number
  cache_enabled: boolean
}

// 历史项目数据相关类型
export interface HistoricalProject {
  id: string
  name: string
  source: HistoricalProjectSource
  excel_metadata?: ExcelMetadata
  project_features: ProjectFeatures
  cost_breakdown: DetailedCostBreakdown
  quality_indicators: QualityIndicators
  data_quality_score: number
  created_at: string
  updated_at: string
  created_by: string
}

export enum HistoricalProjectSource {
  EXCEL_UPLOAD = 'excel_upload',
  MANUAL_ENTRY = 'manual_entry',
  API_IMPORT = 'api_import',
}

export interface ExcelMetadata {
  filename: string
  sheet_name: string
  template_type: string
  parse_date: string
  file_size: number
  parsing_version: string
  detected_headers: string[]
  confidence_score: number
}

export interface ProjectFeatures {
  basic_features: BasicFeatures
  cost_features: CostFeatures
  quality_features: QualityFeatures
}

export interface BasicFeatures {
  project_type: ProjectType
  building_type: string
  structure_type: string
  area: number
  location: string
  floors: number
  year_built?: number
  construction_period: number
  design_standard?: string
}

export interface CostFeatures {
  total_cost: number
  unit_cost: number
  material_costs: CostComponent[]
  labor_costs: CostComponent[]
  equipment_costs: CostComponent[]
  overhead_costs: CostComponent[]
  other_costs: CostComponent[]
  cost_year: number
  currency: string
  inflation_adjusted_cost?: number
}

export interface QualityFeatures {
  quality_level: QualityLevel
  construction_standard: string
  technical_specifications: string[]
  material_grades: MaterialGrade[]
  quality_scores: QualityScore[]
}

export interface MaterialGrade {
  material_type: string
  grade: string
  standard: string
}

export interface QualityScore {
  aspect: string
  score: number
  max_score: number
  description?: string
}

export interface DetailedCostBreakdown extends CostBreakdown {
  material_breakdown: MaterialBreakdown[]
  labor_breakdown: LaborBreakdown[]
  detailed_components: DetailedComponent[]
}

export interface MaterialBreakdown {
  material_name: string
  specification: string
  unit: string
  quantity: number
  unit_price: number
  total_price: number
  supplier?: string
  brand?: string
}

export interface LaborBreakdown {
  work_type: string
  skill_level: string
  unit: string
  quantity: number
  unit_price: number
  total_price: number
  productivity_factor?: number
}

export interface DetailedComponent {
  component_name: string
  description: string
  measurement_basis: string
  unit: string
  quantity: number
  unit_price: number
  total_price: number
  cost_driver_factors: CostDriverFactor[]
}

export interface CostDriverFactor {
  factor_name: string
  factor_value: number
  impact_level: 'low' | 'medium' | 'high'
  description: string
}

export interface QualityIndicators {
  overall_quality_score: number
  completeness_score: number
  accuracy_score: number
  consistency_score: number
  reliability_score: number
  validation_status: ValidationStatus
  quality_issues: QualityIssue[]
}

export enum ValidationStatus {
  VALIDATED = 'validated',
  PENDING = 'pending',
  REJECTED = 'rejected',
  NEEDS_REVIEW = 'needs_review',
}

export interface QualityIssue {
  issue_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  suggested_action: string
  affected_fields: string[]
}

// Excel解析相关类型
export interface ExcelParseResult {
  success: boolean
  project_data: HistoricalProject
  confidence_score: number
  parsing_errors: ParseError[]
  warnings: string[]
  detected_template_type: string
  parsing_statistics: ParsingStatistics
}

export interface ParseError {
  row?: number
  column?: string
  field: string
  error_type: string
  message: string
  suggested_fix?: string
}

export interface ParsingStatistics {
  total_rows_processed: number
  successful_extractions: number
  failed_extractions: number
  data_coverage_percentage: number
  processing_time_seconds: number
}

// 智能匹配相关类型
export interface SimilarProjectRequest {
  project_features: ProjectFeatures
  max_results?: number
  min_similarity_score?: number
  match_weights?: MatchWeights
  filters?: ProjectFilter[]
}

export interface MatchWeights {
  basic_weight: number
  cost_weight: number
  quality_weight: number
  location_weight: number
  temporal_weight: number
}

export interface ProjectFilter {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between'
  value: any
}

export interface ProjectMatch {
  historical_project: HistoricalProject
  similarity_result: SimilarityResult
  cost_estimates: EstimateSuggestion[]
  applicable_factors: ApplicabilityFactor[]
}

export interface SimilarityResult {
  overall_score: number
  basic_similarity: number
  cost_similarity: number
  quality_similarity: number
  location_similarity: number
  temporal_similarity: number
  match_factors: MatchFactor[]
  confidence_level: number
  explanation: string
}

export interface MatchFactor {
  factor_name: string
  similarity_score: number
  weight: number
  contribution: number
  details: string
}

export interface EstimateSuggestion {
  cost_category: string
  suggested_unit_cost: number
  confidence_interval: ConfidenceInterval
  supporting_projects: string[]
  adjustment_factors: AdjustmentFactor[]
  rationale: string
}

export interface ConfidenceInterval {
  lower_bound: number
  upper_bound: number
  confidence_level: number
}

export interface AdjustmentFactor {
  factor_name: string
  adjustment_type: 'percentage' | 'absolute'
  value: number
  reason: string
}

export interface ApplicabilityFactor {
  factor_name: string
  relevance_score: number
  applicability: 'highly_applicable' | 'moderately_applicable' | 'low_applicable' | 'not_applicable'
  notes: string
}

// 历史数据搜索相关类型
export interface HistoricalProjectSearchParams {
  query?: string
  project_types?: ProjectType[]
  locations?: string[]
  area_range?: {
    min: number
    max: number
  }
  cost_range?: {
    min: number
    max: number
  }
  year_range?: {
    min: number
    max: number
  }
  quality_levels?: QualityLevel[]
  min_quality_score?: number
  data_sources?: HistoricalProjectSource[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

// 批量导入相关类型
export interface BatchImportRequest {
  files: File[]
  import_settings: ImportSettings
}

export interface ImportSettings {
  auto_detect_template: boolean
  skip_validation: boolean
  update_existing: boolean
  default_quality_level?: QualityLevel
  custom_mappings?: Record<string, string>
}

export interface BatchImportResult {
  total_files: number
  successful_imports: ImportResult[]
  failed_imports: ImportError[]
  processing_summary: ProcessingSummary
}

export interface ImportResult {
  filename: string
  project_id: string
  project_name: string
  confidence_score: number
  warnings: string[]
}

export interface ImportError {
  filename: string
  error_type: string
  error_message: string
  recovery_suggestions: string[]
}

export interface ProcessingSummary {
  total_processing_time: number
  average_confidence_score: number
  data_quality_distribution: Record<string, number>
  template_types_found: Record<string, number>
}

// ====== AI模型相关类型定义 ======

// LLM模型提供商类型
export type LLMProviderType =
  | 'openai'
  | 'claude'
  | 'glm'        // 智谱AI
  | 'kimi'       // 月之暗面
  | 'qwen'       // 阿里千问
  | 'wenxin'     // 百度文心一言
  | 'deepseek'   // 深度求索
  | 'yi'         // 零一万物
  | 'spark'      // 科大讯飞星火
  | 'local'      // 本地模型

// 模型能力特性
export interface ModelCapabilities {
  chat: boolean           // 对话能力
  reasoning: boolean      // 推理能力
  code: boolean          // 代码生成
  analysis: boolean       // 分析能力
  translation: boolean    // 翻译能力
  long_context: boolean   // 长上下文支持
  multimodal: boolean     // 多模态支持
  function_calling: boolean // 函数调用
}

// 模型定价信息
export interface ModelPricing {
  input: number          // 输入token价格 (每千tokens)
  output: number         // 输出token价格 (每千tokens)
  currency: string       // 货币单位
  unit: 'tokens' | 'characters' // 计价单位
}

// LLM模型定义
export interface LLMModel {
  id: string
  name: string
  displayName?: string
  provider: LLMProviderType
  contextLength: number     // 上下文长度
  maxTokens?: number        // 最大输出tokens
  pricing?: ModelPricing
  capabilities: ModelCapabilities
  description?: string
  tags?: string[]           // 标签
  status: 'active' | 'beta' | 'deprecated'
  releaseDate?: string
}

// LLM提供商配置
export interface LLMProvider {
  id: string
  name: string
  type: LLMProviderType
  displayName?: string
  logo?: string
  description?: string
  website?: string
  docsUrl?: string
  apiKeyRequired: boolean
  baseUrl?: string
  defaultHeaders?: Record<string, string>
  models: LLMModel[]
  supportedRegions?: string[]
  status: 'active' | 'beta' | 'maintenance'
}

// API配置
export interface LLMApiConfig {
  provider: LLMProviderType
  apiKey: string
  baseUrl?: string
  model: string
  maxTokens: number
  temperature: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  timeout: number
  retryCount: number
  enableCache: boolean
}

// 模型使用统计
export interface ModelUsageStats {
  provider: LLMProviderType
  model: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalTokens: {
    input: number
    output: number
    total: number
  }
  totalCost: number
  currency: string
  averageResponseTime: number
  lastUsed: string
}

// 模型性能指标
export interface ModelPerformanceMetrics {
  provider: LLMProviderType
  model: string
  responseTime: {
    average: number
    p50: number
    p95: number
    p99: number
  }
  successRate: number
  errorRate: number
  throughput: number         // 每秒请求数
  costEfficiency: number     // 成本效率评分
  qualityScore?: number      // 质量评分(用户反馈)
}

// 国产模型特定配置
export interface ChineseModelConfig extends LLMApiConfig {
  // 智谱AI特定配置
  glmConfig?: {
    searchEnabled?: boolean    // 是否启用搜索增强
    plugins?: string[]          // 插件列表
  }

  // 月之暗面特定配置
  kimiConfig?: {
    longContextMode?: boolean  // 长上下文模式
    searchEngine?: 'default' | 'bing' | 'google'
  }

  // 千问特定配置
  qwenConfig?: {
    enableSearch?: boolean     // 是否启用搜索
    streamOutput?: boolean     // 流式输出
  }

  // 文心一言特定配置
  wenxinConfig?: {
    systemPrompt?: string      // 系统提示词
    enableEnhancement?: boolean // 是否启用增强功能
  }

  // 深度求索特定配置
  deepseekConfig?: {
    codeMode?: boolean         // 代码模式
    reasoningMode?: boolean    // 推理模式
  }
}

// 模型比较结果
export interface ModelComparison {
  models: LLMModel[]
  metrics: {
    performance: ModelPerformanceMetrics[]
    cost: ModelUsageStats[]
    quality: Record<string, number>
  }
  recommendation: {
    bestOverall: string
    bestPerformance: string
    bestCost: string
    bestQuality: string
  }
}

// 智能模型选择配置
export interface SmartModelSelection {
  enabled: boolean
  rules: SelectionRule[]
  fallbackProvider: LLMProviderType
  fallbackModel: string
  costOptimization: boolean
  performanceOptimization: boolean
}

export interface SelectionRule {
  id: string
  name: string
  description: string
  conditions: RuleCondition[]
  action: RuleAction
  priority: number
  enabled: boolean
}

export interface RuleCondition {
  field: 'query_length' | 'query_type' | 'user_role' | 'time_of_day' | 'cost_limit'
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in'
  value: any
}

export interface RuleAction {
  type: 'select_model' | 'select_provider' | 'reject' | 'redirect'
  provider?: LLMProviderType
  model?: string
  message?: string
}

// ====== Embedding模型相关类型定义 ======

// Embedding模型提供商类型
export type EmbeddingProviderType =
  | 'openai'
  | 'glm'        // 智谱AI
  | 'kimi'       // 月之暗面
  | 'qwen'       // 阿里千问
  | 'wenxin'     // 百度文心一言
  | 'deepseek'   // 深度求索
  | 'yi'         // 零一万物
  | 'spark'      // 科大讯飞星火
  | 'local'      // 本地模型

// Embedding模型定义
export interface EmbeddingModel {
  id: string
  name: string
  displayName?: string
  provider: EmbeddingProviderType
  dimensions: number           // 向量维度
  maxTokens: number           // 最大tokens
  pricing?: EmbeddingPricing
  capabilities: EmbeddingCapabilities
  description?: string
  tags?: string[]           // 标签
  status: 'active' | 'beta' | 'deprecated'
  releaseDate?: string
}

// Embedding模型能力特性
export interface EmbeddingCapabilities {
  multilingual: boolean      // 多语言支持
  long_text: boolean        // 长文本支持
  code_embedding: boolean   // 代码嵌入
  semantic_search: boolean  // 语义搜索
  classification: boolean   // 分类任务
  clustering: boolean       // 聚类任务
  reranking: boolean        // 重排序
}

// Embedding模型定价信息
export interface EmbeddingPricing {
  input: number              // 输入token价格 (每千tokens)
  currency: string           // 货币单位
  unit: 'tokens' | 'characters' // 计价单位
}

// Embedding提供商配置
export interface EmbeddingProvider {
  id: string
  name: string
  type: EmbeddingProviderType
  displayName?: string
  logo?: string
  description?: string
  website?: string
  docsUrl?: string
  apiKeyRequired: boolean
  baseUrl?: string
  defaultHeaders?: Record<string, string>
  models: EmbeddingModel[]
  supportedRegions?: string[]
  status: 'active' | 'beta' | 'maintenance'
}

// Embedding API配置
export interface EmbeddingApiConfig {
  provider: EmbeddingProviderType
  apiKey: string
  baseUrl?: string
  model: string
  maxTokens: number
  timeout: number
  retryCount: number
  enableCache: boolean
  batchSize: number          // 批处理大小
  dimensions?: number       // 自定义维度（如果支持）
}

// Embedding使用统计
export interface EmbeddingUsageStats {
  provider: EmbeddingProviderType
  model: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalTokens: {
    input: number
    total: number
  }
  totalCost: number
  currency: string
  averageResponseTime: number
  lastUsed: string
}

// Embedding性能指标
export interface EmbeddingPerformanceMetrics {
  provider: EmbeddingProviderType
  model: string
  responseTime: {
    average: number
    p50: number
    p95: number
    p99: number
  }
  successRate: number
  errorRate: number
  throughput: number         // 每秒请求数
  costEfficiency: number     // 成本效率评分
  qualityScore?: number      // 质量评分(用户反馈)
}

// Embedding任务类型
export enum EmbeddingTaskType {
  DOCUMENT_INDEXING = 'document_indexing',    // 文档索引
  SEMANTIC_SEARCH = 'semantic_search',        // 语义搜索
  QUESTION_ANSWERING = 'question_answering',  // 问答
  CLASSIFICATION = 'classification',          // 分类
  CLUSTERING = 'clustering',                  // 聚类
  RERANKING = 'reranking',                    // 重排序
  CODE_SEARCH = 'code_search',                // 代码搜索
  RECOMMENDATION = 'recommendation'           // 推荐
}

// Embedding请求
export interface EmbeddingRequest {
  texts: string[]
  task_type?: EmbeddingTaskType
  model?: string
  dimensions?: number
  normalize?: boolean
  batch_size?: number
}

// Embedding响应
export interface EmbeddingResponse {
  embeddings: number[][]
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
  processing_time: number
}

// 向量相似度计算类型
export enum SimilarityMetric {
  COSINE = 'cosine',           // 余弦相似度
  EUCLIDEAN = 'euclidean',     // 欧几里得距离
  DOT_PRODUCT = 'dot_product', // 点积
  MANHATTAN = 'manhattan'      // 曼哈顿距离
}

// 向量搜索请求
export interface VectorSearchRequest {
  query_vector: number[]
  top_k: number
  similarity_threshold?: number
  similarity_metric: SimilarityMetric
  filters?: Record<string, any>
  include_metadata?: boolean
}

// 向量搜索结果
export interface VectorSearchResult {
  id: string
  score: number
  metadata?: Record<string, any>
  distance?: number
}

// 文档嵌入任务
export interface DocumentEmbeddingTask {
  id: string
  document_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  created_at: string
  updated_at: string
  error_message?: string
  result?: {
    chunks_embedded: number
    total_chunks: number
    embedding_model: string
    dimensions: number
  }
}

// Embedding模型比较结果
export interface EmbeddingModelComparison {
  models: EmbeddingModel[]
  metrics: {
    performance: EmbeddingPerformanceMetrics[]
    cost: EmbeddingUsageStats[]
    quality: Record<string, number>
  }
  recommendation: {
    bestOverall: string
    bestPerformance: string
    bestCost: string
    bestQuality: string
  }
}

// 智能Embedding模型选择配置
export interface SmartEmbeddingSelection {
  enabled: boolean
  rules: EmbeddingSelectionRule[]
  fallbackProvider: EmbeddingProviderType
  fallbackModel: string
  costOptimization: boolean
  performanceOptimization: boolean
}

export interface EmbeddingSelectionRule {
  id: string
  name: string
  description: string
  conditions: EmbeddingRuleCondition[]
  action: EmbeddingRuleAction
  priority: number
  enabled: boolean
}

export interface EmbeddingRuleCondition {
  field: 'text_length' | 'task_type' | 'language' | 'batch_size' | 'cost_limit'
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in'
  value: any
}

export interface EmbeddingRuleAction {
  type: 'select_model' | 'select_provider' | 'reject'
  provider?: EmbeddingProviderType
  model?: string
  message?: string
}

// ==================== 智能问答系统集成类型定义 ====================

// 数据源类型
export type DataSourceType = 'documents' | 'knowledge_graph' | 'historical_data'

// 数据源配置
export interface DataSource {
  id: string
  name: string
  type: DataSourceType
  enabled: boolean
  description: string
  icon: string
  healthStatus: 'healthy' | 'degraded' | 'unavailable'
  lastChecked?: string
  configuration: DataSourceConfig
}

export interface DataSourceConfig {
  priority: number
  weight: number
  timeout: number
  retryAttempts: number
  cacheEnabled: boolean
  maxResults?: number
  confidenceThreshold?: number
}

// 数据源优先级配置
export interface DataSourcePriority {
  source: DataSourceType
  weight: number
  enabled: boolean
}

// 统一查询请求
export interface UnifiedQueryRequest {
  query: string
  dataSources: DataSource[]
  context?: string
  priorities: DataSourcePriority[]
  maxResults?: number
  sessionId?: string
  userId?: string
}

// 查询进度
export interface QueryProgress {
  total: number
  completed: number
  failed: number
  progress: number
  sources: Record<string, {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout'
    progress: number
    error?: string
  }>
  startTime: number
  estimatedTime?: number
}

// 单个数据源的查询结果
export interface DataSourceResult {
  source: DataSourceType
  sourceId: string
  query: string
  response: any
  success: boolean
  responseTime: number
  resultCount: number
  relevanceScore: number
  confidenceScore: number
  metadata?: Record<string, any>
  error?: string
  timestamp: string
}

// 文档数据源结果
export interface DocumentQueryResult extends DataSourceResult {
  source: 'documents'
  response: {
    documents: Document[]
    highlights: DocumentHighlight[]
    totalCount: number
    facets?: DocumentFacet[]
  }
  relatedDocuments: Document[]
}

// 知识图谱数据源结果
export interface KnowledgeGraphResult extends DataSourceResult {
  source: 'knowledge_graph'
  response: {
    nodes: GraphNode[]
    edges: GraphEdge[]
    paths: GraphPath[]
    totalCount: number
  }
  relatedNodes: GraphNode[]
  contextNodes: GraphNode[]
}

// 历史数据数据源结果
export interface HistoricalDataResult extends DataSourceResult {
  source: 'historical_data'
  response: {
    projects: HistoricalProject[]
    statistics: HistoricalStatistics
    totalCount: number
  }
  relatedProjects: HistoricalProject[]
}

// 统一查询响应
export interface UnifiedQueryResponse {
  queryId: string
  query: string
  timestamp: string
  responseTime: number
  totalResults: number
  success: boolean
  unifiedAnswer: string
  fusionConfidence: number
  sourceResults: DataSourceResult[]
  sourceAttribution: SourceAttribution[]
  relatedContent: RelatedContent
  metadata: UnifiedQueryMetadata
}

// 来源归因信息
export interface SourceAttribution {
  source: DataSourceType
  sourceId: string
  confidence: number
  relevanceScore: number
  contributionWeight: number
  summary: string
  keyPoints: string[]
  citations: Citation[]
}

// 引用信息
export interface Citation {
  id: string
  title: string
  source: string
  url?: string
  content: string
  relevanceScore: number
  confidence: number
}

// 相关内容汇总
export interface RelatedContent {
  documents: Document[]
  graphNodes: GraphNode[]
  historicalProjects: HistoricalProject[]
  suggestions: QuerySuggestion[]
  followUpQuestions: string[]
}

// 查询建议
export interface QuerySuggestion {
  id: string
  text: string
  category: string
  relevanceScore: number
  source: DataSourceType
}

// 统一查询元数据
export interface UnifiedQueryMetadata {
  totalProcessingTime: number
  averageResponseTime: number
  sourceSuccessRate: Record<DataSourceType, number>
  cacheHitRate: number
  userContext: string
  sessionContext: string
  queryComplexity: 'simple' | 'medium' | 'complex'
}

// 查询缓存
export interface QueryCache {
  id: string
  query: string
  parameters: Record<string, any>
  response: UnifiedQueryResponse
  timestamp: string
  expiresAt: string
  hitCount: number
  lastAccessed: string
  dataSources: DataSourceType[]
}

// 数据源健康检查
export interface DataSourceHealthCheck {
  sourceId: string
  lastCheck: string
  status: 'healthy' | 'degraded' | 'unavailable'
  responseTime: number
  successRate: number
  errorMessage?: string
  metrics: Record<string, any>
}

// 智能推荐配置
export interface SmartRecommendationConfig {
  enabled: boolean
  algorithm: 'relevance_based' | 'popularity_based' | 'context_aware'
  minConfidence: number
  maxRecommendations: number
  learningEnabled: boolean
}

// 智能推荐结果
export interface SmartRecommendation {
  dataSources: DataSourcePriority[]
  reasoning: string
  confidence: number
  estimatedQuality: 'high' | 'medium' | 'low'
  alternatives: DataSourcePriority[]
}

// 查询历史
export interface QueryHistory {
  id: string
  query: string
  timestamp: string
  userId: string
  sessionId: string
  dataSources: DataSourceType[]
  responseTime: number
  satisfactionRating?: number
  feedback?: string
  resultCount: number
}

// 用户查询偏好
export interface UserQueryPreferences {
  defaultDataSources: DataSourceType[]
  favoriteDataSources: DataSourceType[]
  maxResults: number
  responseFormat: 'unified' | 'separated' | 'detailed'
  showConfidence: boolean
  showSourceAttribution: boolean
  enableSmartRecommendations: boolean
  autoExpandResults: boolean
}

// 查询会话上下文
export interface QueryContext {
  sessionId: string
  userId: string
  previousQueries: string[]
  userPreferences: UserQueryPreferences
  activeFilters: Record<string, any>
  conversationFlow: 'continuing' | 'new_topic' | 'follow_up'
}

// 查询分析结果
export interface QueryAnalysis {
  complexity: 'simple' | 'medium' | 'complex'
  intentCategory: 'factual' | 'comparative' | 'procedural' | 'creative'
  suggestedDataSources: DataSourceType[]
  keywords: string[]
  entities: QueryEntity[]
  expectedResponseType: 'factual' | 'procedural' | 'comparative'
}

// 查询实体
export interface QueryEntity {
  text: string
  type: string
  confidence: number
  source: string
  metadata?: Record<string, any>
}