"""
查询历史和结果数据模型
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Boolean, ForeignKey, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.session import Base


class QueryHistory(Base):
    """查询历史模型"""

    __tablename__ = "query_histories"

    id = Column(Integer, primary_key=True, index=True)

    # 用户信息
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String(100), nullable=True, index=True)  # 会话ID

    # 查询信息
    query_text = Column(Text, nullable=False)
    query_type = Column(String(50), nullable=False, index=True)  # qa, search, analysis
    query_category = Column(String(100), nullable=True)  # 查询分类

    # 查询参数
    data_sources = Column(ARRAY(String), nullable=True)  # 使用的數據源
    filters = Column(JSON, nullable=True)  # 筛选条件
    parameters = Column(JSON, nullable=True)  # 查询參數
    context = Column(JSON, nullable=True)  # 上下文信息

    # 查询结果统计
    result_count = Column(Integer, default=0)  # 结果数量
    response_time = Column(Float, nullable=True)  # 响应时间（秒）
    token_usage = Column(Integer, default=0)  # Token使用量
    cost = Column(Float, default=0.0)  # 查询成本

    # 质量评估
    satisfaction_score = Column(Integer, nullable=True)  # 满意度 1-5
    usefulness_score = Column(Float, nullable=True)  # 有用性评分 0-1
    feedback = Column(Text, nullable=True)  # 用户反馈

    # 查询状态
    status = Column(String(20), default="completed")  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    user = relationship("User", back_populates="query_histories")
    results = relationship("QueryResult", back_populates="query", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<QueryHistory(id={self.id}, type='{self.query_type}', user_id={self.user_id})>"

    @property
    def is_successful(self) -> bool:
        """检查查询是否成功"""
        return self.status == "completed" and self.error_message is None

    @property
    def duration(self) -> float:
        """获取查询持续时间"""
        if self.completed_at:
            return (self.completed_at - self.created_at).total_seconds()
        return 0.0

    def add_data_source(self, source: str):
        """添加数据源"""
        if not self.data_sources:
            self.data_sources = []
        if source not in self.data_sources:
            self.data_sources.append(source)


class QueryResult(Base):
    """查询结果模型"""

    __tablename__ = "query_results"

    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, ForeignKey("query_histories.id"), nullable=False, index=True)

    # 来源信息
    source_type = Column(String(50), nullable=False, index=True)  # document, knowledge_graph, llm
    source_id = Column(Integer, nullable=True)  # 源ID
    source_name = Column(String(200), nullable=True)  # 源名称

    # 内容信息
    content = Column(Text, nullable=False)
    title = Column(String(500), nullable=True)
    summary = Column(Text, nullable=True)
    excerpt = Column(Text, nullable=True)  # 摘录

    # 相关性评分
    relevance_score = Column(Float, nullable=True)  # 相关性评分 0-1
    confidence = Column(Float, nullable=True)  # 置信度 0-1
    similarity_score = Column(Float, nullable=True)  # 相似度评分 0-1

    # 排序信息
    rank = Column(Integer, nullable=True)  # 排名
    score = Column(Float, nullable=True)  # 综合评分

    # 元数据
    metadata = Column(JSON, nullable=True)  # 源特定元数据
    tags = Column(ARRAY(String), nullable=True)  # 标签
    categories = Column(ARRAY(String), nullable=True)  # 分类

    # 链接信息
    url = Column(String(1000), nullable=True)  # 原始链接
    file_path = Column(String(1000), nullable=True)  # 文件路径
    page_number = Column(Integer, nullable=True)  # 页码
    chunk_id = Column(Integer, nullable=True)  # 分块ID

    # 状态信息
    is_featured = Column(Boolean, default=False)  # 是否为推荐结果
    is_bookmarked = Column(Boolean, default=False)  # 是否已收藏
    is_hidden = Column(Boolean, default=False)  # 是否已隐藏

    # 用户交互
    click_count = Column(Integer, default=0)  # 点击次数
    view_time = Column(Float, default=0.0)  # 查看时间（秒）
    rating = Column(Integer, nullable=True)  # 用户评分

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    query = relationship("QueryHistory", back_populates="results")

    def __repr__(self):
        return f"<QueryResult(id={self.id}, source='{self.source_type}', score={self.score})>"

    @property
    def is_high_quality(self) -> bool:
        """检查是否为高质量结果"""
        return (
            self.relevance_score and
            self.relevance_score >= 0.8 and
            self.confidence and
            self.confidence >= 0.7
        )

    def get_content_preview(self, max_length: int = 200) -> str:
        """获取内容预览"""
        if not self.content:
            return ""
        if len(self.content) <= max_length:
            return self.content
        return self.content[:max_length] + "..."

    def add_tag(self, tag: str):
        """添加标签"""
        if not self.tags:
            self.tags = []
        if tag not in self.tags:
            self.tags.append(tag)


class UserFeedback(Base):
    """用户反馈模型"""

    __tablename__ = "user_feedback"

    id = Column(Integer, primary_key=True, index=True)

    # 关联信息
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    query_id = Column(Integer, ForeignKey("query_histories.id"), nullable=True)
    result_id = Column(Integer, ForeignKey("query_results.id"), nullable=True)

    # 反馈类型
    feedback_type = Column(String(50), nullable=False)  # rating, comment, correction, suggestion
    rating = Column(Integer, nullable=True)  # 评分 1-5

    # 反馈内容
    content = Column(Text, nullable=True)  # 反馈内容
    sentiment = Column(String(20), nullable=True)  # positive, negative, neutral

    # 改进建议
    suggested_answer = Column(Text, nullable=True)  # 建议答案
    correction_text = Column(Text, nullable=True)  # 纠正文本

    # 元数据
    metadata = Column(JSON, nullable=True)  # 额外元数据
    device_info = Column(JSON, nullable=True)  # 设备信息

    # 状态
    status = Column(String(20), default="pending")  # pending, reviewed, resolved
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_notes = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    user = relationship("User", foreign_keys=[user_id])
    query = relationship("QueryHistory")
    result = relationship("QueryResult")
    reviewer = relationship("User", foreign_keys=[reviewed_by])

    def __repr__(self):
        return f"<UserFeedback(id={self.id}, type='{self.feedback_type}', rating={self.rating})>"

    @property
    def is_positive(self) -> bool:
        """检查是否为正面反馈"""
        return self.sentiment == "positive" or (self.rating and self.rating >= 4)

    @property
    def requires_review(self) -> bool:
        """检查是否需要审核"""
        return self.status == "pending" and (self.suggested_answer or self.correction_text)