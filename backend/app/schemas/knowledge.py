"""
知识图谱相关的Pydantic模式定义
"""
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from enum import Enum
from pydantic import BaseModel, Field, validator


class EntityType(str, Enum):
    """实体类型枚举"""
    PERSON = "person"  # 人物
    ORGANIZATION = "organization"  # 组织机构
    LOCATION = "location"  # 地点
    PROJECT = "project"  # 项目
    TECHNOLOGY = "technology"  # 技术
    MATERIAL = "material"  # 材料
    EQUIPMENT = "equipment"  # 设备
    COST = "cost"  # 成本
    TIME = "time"  # 时间
    STANDARD = "standard"  # 标准
    METRIC = "metric"  # 指标
    PRODUCT = "product"  # 产品
    PROCESS = "process"  # 流程
    DOCUMENT = "document"  # 文档
    REGULATION = "regulation"  # 法规
    GENERIC = "generic"  # 通用


class RelationType(str, Enum):
    """关系类型枚举"""
    BELONG_TO = "belong_to"  # 属于
    CONTAIN = "contain"  # 包含
    LOCATED_IN = "located_in"  # 位于
    WORK_FOR = "work_for"  # 为...工作
    EMPLOY = "employ"  # 雇佣
    OWN = "own"  # 拥有
    OWNED_BY = "owned_by"  # 被...拥有
    USE = "use"  # 使用
    USED_IN = "used_in"  # 在...中使用
    IMPLEMENT = "implement"  # 实施
    IMPLEMENT_IN = "implement_in"  # 在...中实施
    PRODUCE = "produce"  # 生产
    PRODUCED_BY = "produced_by"  # 由...生产
    REQUIRE = "require"  # 需要
    REQUIRED_BY = "required_by"  # 被...需要
    MANAGE = "manage"  # 管理
    MANAGED_BY = "managed_by"  # 被...管理
    COLLABORATE = "collaborate"  # 合作
    CONNECT = "connect"  # 连接
    COST_OF = "cost_of"  # ...的成本
    HAVE_COST = "have_cost"  # 有成本
    BEFORE = "before"  # 之前
    AFTER = "after"  # 之后
    RELATED_TO = "related_to"  # 相关于


class ExtractionMethod(str, Enum):
    """提取方法枚举"""
    RULE_BASED = "rule_based"  # 基于规则
    JIEBA = "jieba"  # 结巴分词
    HYBRID = "hybrid"  # 混合方法
    MANUAL = "manual"  # 手动标注
    ML = "machine_learning"  # 机器学习
    DEEP_LEARNING = "deep_learning"  # 深度学习


# 实体相关模式
class EntityBase(BaseModel):
    """实体基础模式"""
    name: str = Field(..., min_length=1, max_length=200, description="实体名称")
    type: EntityType = Field(..., description="实体类型")
    properties: Optional[Dict[str, Any]] = Field(default_factory=dict, description="实体属性")
    confidence: float = Field(0.5, ge=0.0, le=1.0, description="置信度")
    source: Optional[str] = Field(None, max_length=500, description="来源")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="元数据")


class EntityCreate(EntityBase):
    """创建实体模式"""
    pass


class EntityUpdate(BaseModel):
    """更新实体模式"""
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="实体名称")
    type: Optional[EntityType] = Field(None, description="实体类型")
    properties: Optional[Dict[str, Any]] = Field(None, description="实体属性")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="置信度")


class KnowledgeNode(EntityBase):
    """知识节点完整模式"""
    id: int = Field(..., description="节点ID")
    user_id: int = Field(..., description="用户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class KnowledgeNodeSummary(BaseModel):
    """知识节点摘要模式"""
    id: int
    name: str
    type: str
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True


# 关系相关模式
class RelationBase(BaseModel):
    """关系基础模式"""
    type: RelationType = Field(..., description="关系类型")
    properties: Optional[Dict[str, Any]] = Field(default_factory=dict, description="关系属性")
    confidence: float = Field(0.5, ge=0.0, le=1.0, description="置信度")
    source: Optional[str] = Field(None, max_length=500, description="来源")
    context: Optional[str] = Field(None, max_length=1000, description="上下文")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="元数据")


class RelationCreate(RelationBase):
    """创建关系模式"""
    source_node_id: int = Field(..., description="源节点ID")
    target_node_id: int = Field(..., description="目标节点ID")

    @validator('target_node_id')
    def validate_different_nodes(cls, v, values):
        """验证源节点和目标节点不同"""
        if 'source_node_id' in values and v == values['source_node_id']:
            raise ValueError('源节点和目标节点不能相同')
        return v


class RelationUpdate(BaseModel):
    """更新关系模式"""
    type: Optional[RelationType] = Field(None, description="关系类型")
    properties: Optional[Dict[str, Any]] = Field(None, description="关系属性")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="置信度")
    context: Optional[str] = Field(None, max_length=1000, description="上下文")


class KnowledgeRelation(RelationBase):
    """知识关系完整模式"""
    id: int = Field(..., description="关系ID")
    user_id: int = Field(..., description="用户ID")
    source_node_id: int = Field(..., description="源节点ID")
    target_node_id: int = Field(..., description="目标节点ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class KnowledgeRelationSummary(BaseModel):
    """知识关系摘要模式"""
    id: int
    source_node_id: int
    target_node_id: int
    type: str
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True


# 路径相关模式
class PathBase(BaseModel):
    """路径基础模式"""
    source_node_id: int = Field(..., description="源节点ID")
    target_node_id: int = Field(..., description="目标节点ID")
    properties: Optional[Dict[str, Any]] = Field(default_factory=dict, description="路径属性")
    confidence: float = Field(0.5, ge=0.0, le=1.0, description="置信度")


class PathCreate(PathBase):
    """创建路径模式"""
    path_nodes: List[int] = Field(..., min_items=2, description="路径节点ID列表")
    path_relations: List[int] = Field(..., min_items=1, description="路径关系ID列表")


class KnowledgePath(PathBase):
    """知识路径完整模式"""
    id: int = Field(..., description="路径ID")
    user_id: int = Field(..., description="用户ID")
    path_length: int = Field(..., description="路径长度")
    created_at: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True


# 提取请求模式
class EntityExtractionRequest(BaseModel):
    """实体提取请求模式"""
    text: str = Field(..., min_length=1, max_length=10000, description="输入文本")
    method: ExtractionMethod = Field(ExtractionMethod.HYBRID, description="提取方法")
    entity_types: Optional[List[EntityType]] = Field(None, description="限制提取的实体类型")
    min_confidence: float = Field(0.3, ge=0.0, le=1.0, description="最小置信度")
    max_entities: int = Field(100, ge=1, le=1000, description="最大实体数量")


class RelationExtractionRequest(BaseModel):
    """关系提取请求模式"""
    text: str = Field(..., min_length=1, max_length=10000, description="输入文本")
    entities: List[Dict[str, Any]] = Field(..., description="已识别的实体列表")
    method: ExtractionMethod = Field(ExtractionMethod.HYBRID, description="提取方法")
    relation_types: Optional[List[RelationType]] = Field(None, description="限制提取的关系类型")
    min_confidence: float = Field(0.3, ge=0.0, le=1.0, description="最小置信度")
    max_relations: int = Field(50, ge=1, le=500, description="最大关系数量")


class DocumentProcessingRequest(BaseModel):
    """文档处理请求模式"""
    document_id: int = Field(..., description="文档ID")
    extraction_methods: List[ExtractionMethod] = Field(
        default=[ExtractionMethod.HYBRID],
        description="提取方法列表"
    )
    entity_types: Optional[List[EntityType]] = Field(None, description="限制提取的实体类型")
    relation_types: Optional[List[RelationType]] = Field(None, description="限制提取的关系类型")
    min_confidence: float = Field(0.3, ge=0.0, le=1.0, description="最小置信度")


# 查询请求模式
class GraphQueryRequest(BaseModel):
    """图谱查询请求模式"""
    query_type: str = Field(..., description="查询类型")
    search_term: Optional[str] = Field(None, description="搜索关键词")
    node_type: Optional[EntityType] = Field(None, description="节点类型过滤")
    relation_type: Optional[RelationType] = Field(None, description="关系类型过滤")
    source_node_id: Optional[int] = Field(None, description="源节点ID")
    target_node_id: Optional[int] = Field(None, description="目标节点ID")
    min_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="最小置信度")
    limit: Optional[int] = Field(20, ge=1, le=100, description="返回数量限制")
    cypher_query: Optional[str] = Field(None, description="Cypher查询语句")


# 响应模式
class ExtractionResult(BaseModel):
    """提取结果模式"""
    entities: List[Dict[str, Any]] = Field(..., description="提取的实体")
    relations: List[Dict[str, Any]] = Field(..., description="提取的关系")
    processing_time: float = Field(..., description="处理时间（秒）")
    method: str = Field(..., description="使用的提取方法")
    confidence_distribution: Dict[str, int] = Field(..., description="置信度分布")


class GraphQueryResult(BaseModel):
    """图谱查询结果模式"""
    query_type: str = Field(..., description="查询类型")
    total: int = Field(..., description="结果总数")
    nodes: Optional[List[Dict[str, Any]]] = Field(None, description="节点列表")
    relations: Optional[List[Dict[str, Any]]] = Field(None, description="关系列表")
    paths: Optional[List[Dict[str, Any]]] = Field(None, description="路径列表")
    records: Optional[List[Dict[str, Any]]] = Field(None, description="查询记录")
    execution_time: float = Field(..., description="执行时间（秒）")


class KnowledgeStatistics(BaseModel):
    """知识图谱统计模式"""
    total_nodes: int = Field(..., description="总节点数")
    total_relations: int = Field(..., description="总关系数")
    node_types: Dict[str, int] = Field(..., description="按类型统计的节点")
    relation_types: Dict[str, int] = Field(..., description="按类型统计的关系")
    graph_density: float = Field(..., description="图密度")
    updated_at: str = Field(..., description="更新时间")


class DocumentProcessingResult(BaseModel):
    """文档处理结果模式"""
    document_id: int = Field(..., description="文档ID")
    chunks_processed: int = Field(..., description="处理的分块数量")
    entities_extracted: int = Field(..., description="提取的实体数量")
    relations_extracted: int = Field(..., description="提取的关系数量")
    nodes_created: int = Field(..., description="创建的节点数量")
    edges_created: int = Field(..., description="创建的边数量")
    processing_time: str = Field(..., description="处理时间")


class GraphVisualizationData(BaseModel):
    """图谱可视化数据模式"""
    nodes: List[Dict[str, Any]] = Field(..., description="节点数据")
    edges: List[Dict[str, Any]] = Field(..., description="边数据")
    layout: Optional[str] = Field("force", description="布局算法")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="元数据")


# 验证器
@validator('entities', pre=True)
def validate_entities(cls, v):
    """验证实体列表"""
    if v is None:
        return []
    if not isinstance(v, list):
        raise ValueError('实体必须是列表')
    return v


@validator('properties', 'metadata', pre=True)
def validate_dict_fields(cls, v):
    """验证字典字段"""
    if v is None:
        return {}
    if not isinstance(v, dict):
        raise ValueError('必须是字典类型')
    return v


@validator('entity_types', 'relation_types', pre=True)
def validate_type_lists(cls, v):
    """验证类型列表"""
    if v is None:
        return None
    if not isinstance(v, list):
        raise ValueError('必须是列表类型')
    return v


@validator('cypher_query')
def validate_cypher_query(cls, v):
    """验证Cypher查询语句"""
    if v is not None:
        # 基本的Cypher语法检查
        if not any(keyword in v.upper() for keyword in ['MATCH', 'CREATE', 'MERGE', 'DELETE', 'RETURN']):
            raise ValueError('无效的Cypher查询语句')
    return v


# 工具函数
def convert_entity_type(value: Union[str, EntityType]) -> EntityType:
    """转换实体类型"""
    if isinstance(value, EntityType):
        return value
    try:
        return EntityType(value.lower())
    except ValueError:
        raise ValueError(f"无效的实体类型: {value}")


def convert_relation_type(value: Union[str, RelationType]) -> RelationType:
    """转换关系类型"""
    if isinstance(value, RelationType):
        return value
    try:
        return RelationType(value.lower())
    except ValueError:
        raise ValueError(f"无效的关系类型: {value}")


def convert_extraction_method(value: Union[str, ExtractionMethod]) -> ExtractionMethod:
    """转换提取方法"""
    if isinstance(value, ExtractionMethod):
        return value
    try:
        return ExtractionMethod(value.lower())
    except ValueError:
        raise ValueError(f"无效的提取方法: {value}")