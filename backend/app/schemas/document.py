"""
文档相关的Pydantic模式定义
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class DocumentBase(BaseModel):
    """文档基础模式"""
    title: str = Field(..., min_length=1, max_length=500, description="文档标题")
    description: Optional[str] = Field(None, max_length=2000, description="文档描述")
    category: Optional[str] = Field(None, max_length=100, description="文档分类")
    tags: Optional[List[str]] = Field(default_factory=list, description="文档标签")
    project_id: Optional[int] = Field(None, description="关联项目ID")
    is_public: bool = Field(False, description="是否公开")


class DocumentCreate(DocumentBase):
    """创建文档模式"""
    pass


class DocumentUpdate(BaseModel):
    """更新文档模式"""
    title: Optional[str] = Field(None, min_length=1, max_length=500, description="文档标题")
    description: Optional[str] = Field(None, max_length=2000, description="文档描述")
    category: Optional[str] = Field(None, max_length=100, description="文档分类")
    tags: Optional[List[str]] = Field(None, description="文档标签")
    project_id: Optional[int] = Field(None, description="关联项目ID")
    is_public: Optional[bool] = Field(None, description="是否公开")


class DocumentMetadata(BaseModel):
    """文档元数据"""
    filename: str = Field(..., description="文件名")
    file_size: int = Field(..., description="文件大小（字节）")
    file_type: str = Field(..., description="文件类型")
    mime_type: Optional[str] = Field(None, description="MIME类型")
    page_count: Optional[int] = Field(None, description="页数")
    word_count: Optional[int] = Field(None, description="字数")
    author: Optional[str] = Field(None, description="作者")
    created_time: Optional[datetime] = Field(None, description="创建时间")
    modified_time: Optional[datetime] = Field(None, description="修改时间")
    language: Optional[str] = Field(None, description="语言")
    encoding: Optional[str] = Field(None, description="编码")


class DocumentChunk(BaseModel):
    """文档分块"""
    chunk_index: int = Field(..., description="分块索引")
    content: str = Field(..., description="分块内容")
    start_position: int = Field(..., description="开始位置")
    end_position: int = Field(..., description="结束位置")
    word_count: int = Field(..., description="字数")
    char_count: int = Field(..., description="字符数")
    vector_id: Optional[str] = Field(None, description="向量ID")


class DocumentProcessingStatus(BaseModel):
    """文档处理状态"""
    status: str = Field(..., description="处理状态: pending, processing, completed, failed")
    progress: float = Field(0.0, description="处理进度 0-1")
    error_message: Optional[str] = Field(None, description="错误信息")
    started_at: Optional[datetime] = Field(None, description="开始时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")


class Document(DocumentBase):
    """文档完整模式"""
    id: int = Field(..., description="文档ID")
    user_id: int = Field(..., description="用户ID")
    file_hash: str = Field(..., description="文件哈希")
    file_path: str = Field(..., description="文件路径")
    metadata: Optional[Dict[str, Any]] = Field(None, description="文档元数据")
    processing_status: DocumentProcessingStatus = Field(..., description="处理状态")
    total_length: Optional[int] = Field(None, description="总字符数")
    chunk_count: Optional[int] = Field(None, description="分块数量")
    is_active: bool = Field(True, description="是否活跃")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class DocumentSummary(BaseModel):
    """文档摘要模式"""
    id: int
    title: str
    description: Optional[str]
    category: Optional[str]
    tags: List[str]
    file_type: str
    file_size: int
    processing_status: str
    chunk_count: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentList(BaseModel):
    """文档列表响应模式"""
    documents: List[DocumentSummary]
    total: int
    page: int
    size: int
    pages: int


class DocumentUploadResponse(BaseModel):
    """文档上传响应模式"""
    document_id: int
    filename: str
    file_size: int
    status: str
    message: str


class DocumentSearchRequest(BaseModel):
    """文档搜索请求模式"""
    query: str = Field(..., min_length=1, max_length=1000, description="搜索查询")
    category: Optional[str] = Field(None, description="分类过滤")
    tags: Optional[List[str]] = Field(None, description="标签过滤")
    project_id: Optional[int] = Field(None, description="项目过滤")
    file_types: Optional[List[str]] = Field(None, description="文件类型过滤")
    date_from: Optional[datetime] = Field(None, description="开始日期")
    date_to: Optional[datetime] = Field(None, description="结束日期")
    limit: int = Field(10, ge=1, le=100, description="返回数量")
    offset: int = Field(0, ge=0, description="偏移量")


class DocumentSearchResult(BaseModel):
    """文档搜索结果模式"""
    document_id: int
    title: str
    description: Optional[str]
    relevance_score: float
    chunk_content: str
    chunk_index: int
    metadata: Optional[Dict[str, Any]]


class DocumentSearchResponse(BaseModel):
    """文档搜索响应模式"""
    results: List[DocumentSearchResult]
    total: int
    query: str
    search_time: float


class DocumentAnalytics(BaseModel):
    """文档分析模式"""
    total_documents: int
    total_size: int
    file_type_distribution: Dict[str, int]
    category_distribution: Dict[str, int]
    processing_status_distribution: Dict[str, int]
    upload_timeline: List[Dict[str, Any]]
    popular_tags: List[Dict[str, Any]]


class VectorSearchRequest(BaseModel):
    """向量搜索请求模式"""
    query: str = Field(..., min_length=1, max_length=1000, description="搜索查询")
    document_ids: Optional[List[int]] = Field(None, description="限制搜索的文档ID")
    filters: Optional[Dict[str, Any]] = Field(None, description="过滤条件")
    limit: int = Field(10, ge=1, le=50, description="返回数量")
    score_threshold: float = Field(0.7, ge=0.0, le=1.0, description="相似度阈值")


class VectorSearchResult(BaseModel):
    """向量搜索结果模式"""
    document_id: int
    chunk_index: int
    content: str
    relevance_score: float
    metadata: Optional[Dict[str, Any]]


class VectorSearchResponse(BaseModel):
    """向量搜索响应模式"""
    results: List[VectorSearchResult]
    total: int
    query: str
    search_time: float


class SimilarDocumentRequest(BaseModel):
    """相似文档请求模式"""
    document_id: int = Field(..., description="参考文档ID")
    limit: int = Field(10, ge=1, le=50, description="返回数量")


class SimilarDocumentResponse(BaseModel):
    """相似文档响应模式"""
    similar_documents: List[DocumentSummary]
    reference_document: DocumentSummary


class DocumentBatchProcess(BaseModel):
    """批量文档处理模式"""
    document_ids: List[int] = Field(..., min_items=1, description="文档ID列表")
    action: str = Field(..., description="操作类型: reprocess, delete, update_tags")


class DocumentBatchResponse(BaseModel):
    """批量操作响应模式"""
    success_count: int
    failed_count: int
    results: List[Dict[str, Any]]


# 验证器
@validator('tags', pre=True)
def validate_tags(cls, v):
    """验证标签格式"""
    if v is None:
        return []
    if isinstance(v, str):
        return [tag.strip() for tag in v.split(',') if tag.strip()]
    return v


@validator('file_types', pre=True)
def validate_file_types(cls, v):
    """验证文件类型格式"""
    if v is None:
        return []
    if isinstance(v, str):
        return [ft.strip().lower() for ft in v.split(',') if ft.strip()]
    return v