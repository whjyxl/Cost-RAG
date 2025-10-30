"""
智能问答相关的Pydantic模式定义
"""
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from enum import Enum
from pydantic import BaseModel, Field, validator


class QueryType(str, Enum):
    """查询类型枚举"""
    SIMPLE = "simple"  # 简单查询
    COMPLEX = "complex"  # 复杂查询
    COST_ESTIMATION = "cost_estimation"  # 成本估算
    TECHNICAL = "technical"  # 技术咨询
    MARKET = "market"  # 市场分析
    REGULATORY = "regulatory"  # 法规咨询
    PROJECT_MANAGEMENT = "project_management"  # 项目管理
    MATERIAL = "material"  # 材料咨询
    EQUIPMENT = "equipment"  # 设备咨询


class DataSource(str, Enum):
    """数据源枚举"""
    DOCUMENTS = "documents"  # 文档检索
    KNOWLEDGE_GRAPH = "knowledge_graph"  # 知识图谱
    COST_DATABASE = "cost_database"  # 成本数据库
    AI_MODEL = "ai_model"  # AI模型生成
    WEB_SEARCH = "web_search"  # 网络搜索
    EXTERNAL_API = "external_api"  # 外部API


class AnswerQuality(str, Enum):
    """答案质量等级"""
    EXCELLENT = "excellent"  # 优秀
    GOOD = "good"  # 良好
    SATISFACTORY = "satisfactory"  # 满意
    NEEDS_IMPROVEMENT = "needs_improvement"  # 需要改进
    POOR = "poor"  # 较差


class RelevanceScore(BaseModel):
    """相关性评分"""
    document_id: Optional[int] = Field(None, description="文档ID")
    chunk_id: Optional[str] = Field(None, description="文档块ID")
    node_id: Optional[int] = Field(None, description="知识图谱节点ID")
    score: float = Field(..., ge=0.0, le=1.0, description="相关性分数")
    source_type: DataSource = Field(..., description="数据源类型")
    content_snippet: str = Field(..., description="内容片段")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")


class QueryRequest(BaseModel):
    """查询请求模式"""
    question: str = Field(..., min_length=5, max_length=1000, description="用户问题")
    query_type: Optional[QueryType] = Field(QueryType.SIMPLE, description="查询类型")
    context: Optional[str] = Field(None, max_length=2000, description="上下文信息")
    user_id: Optional[int] = Field(None, description="用户ID")
    session_id: Optional[str] = Field(None, description="会话ID")
    project_id: Optional[int] = Field(None, description="项目ID")
    filters: Dict[str, Any] = Field(default_factory=dict, description="查询过滤器")
    max_results: int = Field(10, ge=1, le=50, description="最大结果数")
    include_sources: List[DataSource] = Field(
        default=[DataSource.DOCUMENTS, DataSource.KNOWLEDGE_GRAPH, DataSource.COST_DATABASE],
        description="包含的数据源"
    )
    language: str = Field("zh", description="查询语言")
    priority: int = Field(1, ge=1, le=5, description="优先级")


class RetrievedDocument(BaseModel):
    """检索到的文档"""
    document_id: int
    title: str
    content: str
    file_path: str
    file_type: str
    relevance_score: float
    chunks: List[Dict[str, Any]]
    metadata: Dict[str, Any]


class RetrievedKnowledge(BaseModel):
    """检索到的知识"""
    node_id: int
    node_name: str
    node_type: str
    properties: Dict[str, Any]
    relationships: List[Dict[str, Any]]
    relevance_score: float
    explanation: str


class RetrievedCostData(BaseModel):
    """检索到的成本数据"""
    cost_id: Optional[int]
    item_name: str
    category: str
    unit: str
    price_range: Dict[str, float]
    region: Optional[str]
    time_period: str
    relevance_score: float
    source: str


class RetrievalResult(BaseModel):
    """检索结果"""
    query: str
    documents: List[RetrievedDocument] = Field(default_factory=list)
    knowledge: List[RetrievedKnowledge] = Field(default_factory=list)
    cost_data: List[RetrievedCostData] = Field(default_factory=list)
    total_retrieved: int = Field(0, description="总检索数量")
    processing_time: float = Field(..., description="处理时间（秒）")
    retrieval_method: str = Field(..., description="检索方法")


class AnswerGenerationRequest(BaseModel):
    """答案生成请求"""
    original_question: str = Field(..., description="原始问题")
    retrieved_context: RetrievalResult = Field(..., description="检索结果")
    query_type: QueryType = Field(..., description="查询类型")
    user_context: Optional[str] = Field(None, description="用户上下文")
    answer_style: str = Field("professional", description="答案风格")
    max_length: int = Field(2000, ge=100, le=5000, description="最大长度")
    include_references: bool = Field(True, description="是否包含引用")
    confidence_threshold: float = Field(0.7, ge=0.0, le=1.0, description="置信度阈值")


class GeneratedAnswer(BaseModel):
    """生成的答案"""
    answer: str = Field(..., description="答案内容")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="置信度分数")
    quality_score: float = Field(..., ge=0.0, le=1.0, description="质量分数")
    sources: List[Dict[str, Any]] = Field(default_factory=list, description="来源信息")
    references: List[Dict[str, Any]] = Field(default_factory=list, description="参考文献")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")
    generation_time: float = Field(..., description="生成时间（秒）")
    model_used: str = Field(..., description="使用的模型")
    token_usage: Dict[str, int] = Field(default_factory=dict, description="令牌使用统计")


class QueryResponse(BaseModel):
    """查询响应"""
    query_id: str = Field(..., description="查询ID")
    question: str = Field(..., description="用户问题")
    answer: GeneratedAnswer = Field(..., description="生成的答案")
    retrieval_result: RetrievalResult = Field(..., description="检索结果")
    query_type: QueryType = Field(..., description="查询类型")
    processing_time: float = Field(..., description="总处理时间")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="响应时间")
    user_id: Optional[int] = Field(None, description="用户ID")
    session_id: Optional[str] = Field(None, description="会话ID")
    satisfaction_score: Optional[float] = Field(None, ge=1.0, le=5.0, description="满意度评分")
    feedback: Optional[str] = Field(None, description="用户反馈")


class BatchQueryRequest(BaseModel):
    """批量查询请求"""
    queries: List[QueryRequest] = Field(..., min_items=1, max_items=10, description="查询列表")
    max_concurrent: int = Field(3, ge=1, le=10, description="最大并发数")
    fail_fast: bool = Field(True, description="是否快速失败")

    @validator('queries')
    def validate_queries(cls, v):
        """验证查询列表"""
        if not v:
            raise ValueError("查询列表不能为空")
        return v


class BatchQueryResponse(BaseModel):
    """批量查询响应"""
    batch_id: str = Field(..., description="批量查询ID")
    results: List[Union[QueryResponse, Dict[str, Any]]] = Field(..., description="响应结果列表")
    total_queries: int = Field(..., description="总查询数")
    successful_queries: int = Field(..., description="成功查询数")
    failed_queries: int = Field(..., description="失败查询数")
    total_processing_time: float = Field(..., description="总处理时间（秒）")
    errors: List[str] = Field(default_factory=list, description="错误信息列表")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ConversationContext(BaseModel):
    """对话上下文"""
    session_id: str = Field(..., description="会话ID")
    user_id: int = Field(..., description="用户ID")
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list, description="对话历史")
    context_summary: Optional[str] = Field(None, description="上下文摘要")
    active_topic: Optional[str] = Field(None, description="当前主题")
    entities: List[Dict[str, Any]] = Field(default_factory=list, description="识别的实体")
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class QuerySuggestion(BaseModel):
    """查询建议"""
    suggestion_id: str = Field(..., description="建议ID")
    suggested_query: str = Field(..., description="建议的查询")
    reasoning: str = Field(..., description="建议理由")
    confidence: float = Field(..., ge=0.0, le=1.0, description="建议置信度")
    category: str = Field(..., description="建议类别")
    context_relevance: float = Field(..., ge=0.0, le=1.0, description="上下文相关性")


class QueryAnalytics(BaseModel):
    """查询分析"""
    query_id: str
    user_id: Optional[int]
    query_type: QueryType
    question_length: int
    response_length: int
    processing_time: float
    confidence_score: float
    quality_score: float
    sources_count: int
    user_satisfaction: Optional[float]
    timestamp: datetime


class QualityMetrics(BaseModel):
    """质量指标"""
    accuracy: float = Field(..., ge=0.0, le=1.0, description="准确性")
    completeness: float = Field(..., ge=0.0, le=1.0, description="完整性")
    relevance: float = Field(..., ge=0.0, le=1.0, description="相关性")
    clarity: float = Field(..., ge=0.0, le=1.0, description="清晰度")
    usefulness: float = Field(..., ge=0.0, le=1.0, description="有用性")
    overall_score: float = Field(..., ge=0.0, le=1.0, description="总体分数")


class FeedbackRequest(BaseModel):
    """反馈请求"""
    query_id: str = Field(..., description="查询ID")
    user_id: int = Field(..., description="用户ID")
    rating: int = Field(..., ge=1, le=5, description="评分（1-5分）")
    feedback_text: Optional[str] = Field(None, max_length=1000, description="反馈文本")
    categories: List[str] = Field(default_factory=list, description="反馈类别")
    improvement_suggestions: Optional[str] = Field(None, max_length=500, description="改进建议")


class FeedbackResponse(BaseModel):
    """反馈响应"""
    feedback_id: str = Field(..., description="反馈ID")
    query_id: str = Field(..., description="查询ID")
    user_id: int = Field(..., description="用户ID")
    rating: int = Field(..., description="评分")
    feedback_text: Optional[str] = Field(None, description="反馈文本")
    categories: List[str] = Field(default_factory=list, description="反馈类别")
    improvement_suggestions: Optional[str] = Field(None, description="改进建议")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    processed: bool = Field(False, description="是否已处理")


# 验证器
@validator('question', pre=True)
def validate_question(cls, v):
    """验证问题内容"""
    if not isinstance(v, str):
        raise ValueError("问题必须是字符串")
    if len(v.strip()) < 5:
        raise ValueError("问题长度至少为5个字符")
    return v.strip()


@validator('max_results', pre=True)
def validate_max_results(cls, v):
    """验证最大结果数"""
    if isinstance(v, str):
        try:
            v = int(v)
        except ValueError:
            raise ValueError("最大结果数必须是整数")
    if not 1 <= v <= 50:
        raise ValueError("最大结果数必须在1-50之间")
    return v


@validator('confidence_score', 'quality_score', pre=True)
def validate_scores(cls, v):
    """验证分数"""
    if isinstance(v, str):
        try:
            v = float(v)
        except ValueError:
            raise ValueError("分数必须是数字")
    if not 0.0 <= v <= 1.0:
        raise ValueError("分数必须在0.0-1.0之间")
    return v


@validator('rating', pre=True)
def validate_rating(cls, v):
    """验证评分"""
    if isinstance(v, str):
        try:
            v = int(v)
        except ValueError:
            raise ValueError("评分必须是整数")
    if not 1 <= v <= 5:
        raise ValueError("评分必须在1-5之间")
    return v


# 工具函数
def create_query_id() -> str:
    """创建查询ID"""
    import uuid
    return f"query_{uuid.uuid4().hex[:12]}"


def create_feedback_id() -> str:
    """创建反馈ID"""
    import uuid
    return f"feedback_{uuid.uuid4().hex[:12]}"


def calculate_quality_score(
    accuracy: float,
    completeness: float,
    relevance: float,
    clarity: float,
    usefulness: float
) -> float:
    """计算总体质量分数"""
    weights = {
        'accuracy': 0.3,
        'completeness': 0.2,
        'relevance': 0.25,
        'clarity': 0.15,
        'usefulness': 0.1
    }

    total_score = (
        accuracy * weights['accuracy'] +
        completeness * weights['completeness'] +
        relevance * weights['relevance'] +
        clarity * weights['clarity'] +
        usefulness * weights['usefulness']
    )

    return round(total_score, 3)


def determine_answer_quality(score: float) -> AnswerQuality:
    """根据分数确定答案质量等级"""
    if score >= 0.9:
        return AnswerQuality.EXCELLENT
    elif score >= 0.8:
        return AnswerQuality.GOOD
    elif score >= 0.7:
        return AnswerQuality.SATISFACTORY
    elif score >= 0.6:
        return AnswerQuality.NEEDS_IMPROVEMENT
    else:
        return AnswerQuality.POOR