"""
文档管理数据模型
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Boolean, ForeignKey, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, UUID
import uuid

from app.db.session import Base


class Document(Base):
    """文档模型"""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, index=True)

    # 基本信息
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Float, nullable=False)  # 文件大小（字节）

    # 文件类型和格式
    mime_type = Column(String(100), nullable=False)
    file_extension = Column(String(10), nullable=False)
    encoding = Column(String(20), nullable=True)

    # 文档分类
    category = Column(String(100), nullable=True)  # 合同、技术规范、标准、案例等
    tags = Column(ARRAY(String), nullable=True)  # 标签
    keywords = Column(ARRAY(String), nullable=True)  # 关键词

    # 处理状态
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    processing_progress = Column(Float, default=0.0)  # 处理进度 0-100
    error_message = Column(Text, nullable=True)

    # 向量化信息
    embedding_model = Column(String(100), nullable=True)
    embedding_dimension = Column(Integer, nullable=True)
    chunk_count = Column(Integer, default=0)
    vector_count = Column(Integer, default=0)

    # 内容统计
    page_count = Column(Integer, nullable=True)
    word_count = Column(Integer, nullable=True)
    char_count = Column(Integer, nullable=True)

    # 权限和访问
    is_public = Column(Boolean, default=False)
    access_level = Column(String(20), default="private")  # private, team, public
    allowed_users = Column(ARRAY(Integer), nullable=True)

    # 元数据
    metadata = Column(JSON, nullable=True)  # 文档元数据
    extracted_data = Column(JSON, nullable=True)  # 提取的结构化数据
    thumbnail = Column(LargeBinary, nullable=True)  # 缩略图

    # 上传信息
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    upload_ip = Column(String(45), nullable=True)
    upload_source = Column(String(50), nullable=True)  # web, api, batch

    # 版本信息
    version = Column(String(20), default="1.0")
    parent_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    is_latest = Column(Boolean, default=True)

    # 质量评分
    quality_score = Column(Float, nullable=True)  # 文档质量评分 0-100
    relevance_score = Column(Float, nullable=True)  # 相关性评分

    # 使用统计
    view_count = Column(Integer, default=0)
    download_count = Column(Integer, default=0)
    reference_count = Column(Integer, default=0)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    uploaded_by_user = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    parent_document = relationship("Document", remote_side=[id])
    child_documents = relationship("Document", remote_side=[parent_document_id])

    def __repr__(self):
        return f"<Document(id={self.id}, title='{self.title}', status='{self.status}')>"

    @property
    def file_size_mb(self) -> float:
        """获取文件大小（MB）"""
        return self.file_size / (1024 * 1024)

    @property
    def is_processing(self) -> bool:
        """检查是否正在处理"""
        return self.status == "processing"

    @property
    def is_processed(self) -> bool:
        """检查是否已处理完成"""
        return self.status == "completed"

    def add_tag(self, tag: str):
        """添加标签"""
        if not self.tags:
            self.tags = []
        if tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: str):
        """移除标签"""
        if self.tags and tag in self.tags:
            self.tags.remove(tag)

    def get_content_preview(self, max_length: int = 200) -> str:
        """获取内容预览"""
        # 从第一个chunk获取预览
        if self.chunks:
            first_chunk = self.chunks[0]
            content = first_chunk.content
            if len(content) > max_length:
                return content[:max_length] + "..."
            return content
        return ""


class DocumentChunk(Base):
    """文档分块模型"""

    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)

    # 分块信息
    chunk_index = Column(Integer, nullable=False)  # 分块索引
    chunk_type = Column(String(50), default="text")  # text, table, image
    level = Column(Integer, nullable=True)  # 层级（用于标题）

    # 内容
    content = Column(Text, nullable=False)
    clean_content = Column(Text, nullable=True)  # 清理后的内容
    summary = Column(Text, nullable=True)  # 摘要

    # 位置信息
    page_number = Column(Integer, nullable=True)
    start_char = Column(Integer, nullable=True)
    end_char = Column(Integer, nullable=True)
    bbox = Column(JSON, nullable=True)  # 边界框坐标

    # 向量数据
    embedding_vector = Column(ARRAY(Float), nullable=True)  # 嵌入向量
    embedding_model = Column(String(100), nullable=True)

    # 元数据
    metadata = Column(JSON, nullable=True)
    language = Column(String(10), nullable=True)  # 语言
    token_count = Column(Integer, nullable=True)

    # 质量评估
    quality_score = Column(Float, nullable=True)
    relevance_score = Column(Float, nullable=True)

    # 父子关系
    parent_chunk_id = Column(Integer, ForeignKey("document_chunks.id"), nullable=True)
    child_chunks = relationship("DocumentChunk", remote_side=[parent_chunk_id])

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    document = relationship("Document", back_populates="chunks")
    parent_chunk = relationship("DocumentChunk", remote_side=[id])

    def __repr__(self):
        return f"<DocumentChunk(id={self.id}, document_id={self.document_id}, chunk_index={self.chunk_index})>"

    @property
    def content_length(self) -> int:
        """获取内容长度"""
        return len(self.content) if self.content else 0

    def get_text_preview(self, max_length: int = 100) -> str:
        """获取文本预览"""
        if not self.content:
            return ""
        if len(self.content) <= max_length:
            return self.content
        return self.content[:max_length] + "..."

    def is_high_quality(self) -> bool:
        """判断是否为高质量分块"""
        return (
            self.quality_score and
            self.quality_score >= 0.7 and
            self.content_length >= 50
        )