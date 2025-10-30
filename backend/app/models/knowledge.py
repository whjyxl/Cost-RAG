"""
知识图谱数据模型
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Boolean, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime, timezone

from app.db.session import Base


class KnowledgeNode(Base):
    """知识节点模型"""

    __tablename__ = "knowledge_nodes"

    id = Column(Integer, primary_key=True, index=True)

    # 节点基本信息
    name = Column(String(500), nullable=False, index=True)
    node_type = Column(String(100), nullable=False, index=True)  # 材料、工艺、规范、项目等
    category = Column(String(100), nullable=True)  # 子分类
    alias = Column(ARRAY(String), nullable=True)  # 别名

    # 描述信息
    description = Column(Text, nullable=True)
    definition = Column(Text, nullable=True)  # 标准定义
    properties = Column(JSON, nullable=True)  # 属性信息

    # 向量数据
    embedding_vector = Column(ARRAY(Float), nullable=True)  # 嵌入向量
    embedding_model = Column(String(100), nullable=True)
    embedding_dimension = Column(Integer, nullable=True)

    # 置信度和质量
    confidence = Column(Float, nullable=True)  # 置信度 0-1
    quality_score = Column(Float, nullable=True)  # 质量评分 0-100
    reliability = Column(String(20), default="medium")  # high, medium, low

    # 来源信息
    source_type = Column(String(50), nullable=True)  # document, manual, api
    source_id = Column(Integer, nullable=True)  # 源ID
    source_url = Column(String(1000), nullable=True)
    extraction_date = Column(DateTime(timezone=True), nullable=True)

    # 统计信息
    reference_count = Column(Integer, default=0)  # 引用次数
    relation_count = Column(Integer, default=0)  # 关系数目
    query_count = Column(Integer, default=0)  # 查询次数

    # 权重和重要性
    importance = Column(Float, default=0.0)  # 重要性权重
    popularity = Column(Float, default=0.0)  # 流行度

    # 状态信息
    status = Column(String(20), default="active")  # active, inactive, deleted
    verified = Column(Boolean, default=False)  # 是否已验证
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    verified_user = relationship("User")
    outgoing_relations = relationship(
        "KnowledgeRelation",
        foreign_keys="KnowledgeRelation.source_node_id",
        back_populates="source_node",
        cascade="all, delete-orphan"
    )
    incoming_relations = relationship(
        "KnowledgeRelation",
        foreign_keys="KnowledgeRelation.target_node_id",
        back_populates="target_node",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<KnowledgeNode(id={self.id}, name='{self.name}', type='{self.node_type}')>"

    @property
    def is_verified(self) -> bool:
        """检查是否已验证"""
        return self.verified and self.verified_at is not None

    def add_property(self, key: str, value):
        """添加属性"""
        if not self.properties:
            self.properties = {}
        self.properties[key] = value

    def get_property(self, key: str, default=None):
        """获取属性"""
        if not self.properties:
            return default
        return self.properties.get(key, default)

    def update_statistics(self):
        """更新统计信息"""
        self.relation_count = len(self.outgoing_relations) + len(self.incoming_relations)


class KnowledgeRelation(Base):
    """知识关系模型"""

    __tablename__ = "knowledge_relations"

    id = Column(Integer, primary_key=True, index=True)

    # 关系两端
    source_node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=False, index=True)
    target_node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=False, index=True)

    # 关系类型和方向
    relation_type = Column(String(100), nullable=False, index=True)  # 包含、属于、依赖、相关等
    relation_subtype = Column(String(100), nullable=True)  # 子类型
    direction = Column(String(20), default="directed")  # directed, undirected, bidirectional

    # 关系属性
    properties = Column(JSON, nullable=True)  # 关系属性
    weight = Column(Float, default=1.0)  # 关系权重
    strength = Column(Float, nullable=True)  # 关系强度 0-1

    # 置信度和质量
    confidence = Column(Float, nullable=True)  # 置信度 0-1
    reliability = Column(String(20), default="medium")  # high, medium, low

    # 来源信息
    source_type = Column(String(50), nullable=True)  # document, manual, api
    source_id = Column(Integer, nullable=True)
    extraction_method = Column(String(100), nullable=True)  # 提取方法

    # 上下文信息
    context = Column(Text, nullable=True)  # 关系上下文
    evidence = Column(JSON, nullable=True)  # 支持证据

    # 时间属性
    valid_from = Column(DateTime(timezone=True), nullable=True)  # 有效期开始
    valid_to = Column(DateTime(timezone=True), nullable=True)  # 有效期结束
    temporal_type = Column(String(20), default="permanent")  # permanent, temporal, seasonal

    # 统计信息
    reference_count = Column(Integer, default=0)  # 引用次数
    validation_count = Column(Integer, default=0)  # 验证次数

    # 状态信息
    status = Column(String(20), default="active")  # active, inactive, deleted
    verified = Column(Boolean, default=False)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    source_node = relationship("KnowledgeNode", foreign_keys=[source_node_id], back_populates="outgoing_relations")
    target_node = relationship("KnowledgeNode", foreign_keys=[target_node_id], back_populates="incoming_relations")
    verified_user = relationship("User")

    # 复合索引
    __table_args__ = (
        Index('idx_relation_nodes_type', 'source_node_id', 'target_node_id', 'relation_type'),
        Index('idx_relation_type_weight', 'relation_type', 'weight'),
    )

    def __repr__(self):
        return f"<KnowledgeRelation(id={self.id}, type='{self.relation_type}', weight={self.weight})>"

    @property
    def is_temporal(self) -> bool:
        """检查是否为时间性关系"""
        return self.temporal_type in ["temporal", "seasonal"]

    @property
    def is_valid(self) -> bool:
        """检查关系是否有效"""
        now = datetime.now(timezone.utc)

        if self.valid_from and now < self.valid_from:
            return False

        if self.valid_to and now > self.valid_to:
            return False

        return True

    def add_property(self, key: str, value):
        """添加属性"""
        if not self.properties:
            self.properties = {}
        self.properties[key] = value

    def get_property(self, key: str, default=None):
        """获取属性"""
        if not self.properties:
            return default
        return self.properties.get(key, default)


class KnowledgePath(Base):
    """知识路径模型"""

    __tablename__ = "knowledge_paths"

    id = Column(Integer, primary_key=True, index=True)

    # 路径信息
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    path_type = Column(String(100), nullable=False)  # reasoning, causal, hierarchical

    # 路径节点序列（JSON数组存储节点ID序列）
    node_sequence = Column(JSON, nullable=False)
    relation_sequence = Column(JSON, nullable=False)  # 对应的关系序列

    # 路径属性
    length = Column(Integer, nullable=False)  # 路径长度（节点数）
    weight = Column(Float, default=1.0)  # 路径权重
    confidence = Column(Float, nullable=True)  # 置信度

    # 统计信息
    usage_count = Column(Integer, default=0)  # 使用次数
    success_rate = Column(Float, nullable=True)  # 成功率

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<KnowledgePath(id={self.id}, name='{self.name}', length={self.length})>"

    @property
    def node_ids(self) -> list:
        """获取节点ID列表"""
        return self.node_sequence if self.node_sequence else []

    @property
    def relation_types(self) -> list:
        """获取关系类型列表"""
        return self.relation_sequence if self.relation_sequence else []