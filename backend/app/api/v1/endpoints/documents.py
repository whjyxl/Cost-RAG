"""
文档管理API端点
"""
import time
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.document import (
    Document, DocumentCreate, DocumentUpdate, DocumentList,
    DocumentUploadResponse, DocumentSearchRequest, DocumentSearchResponse,
    VectorSearchRequest, VectorSearchResponse, DocumentAnalytics,
    SimilarDocumentRequest, SimilarDocumentResponse,
    DocumentBatchProcess, DocumentBatchResponse
)
from app.services.document_service import document_service
from app.core.logging import logger
from app.core.security import create_access_token
import secrets

router = APIRouter()

# 临时预览token存储（生产环境应使用Redis）
preview_tokens = {}


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    project_id: Optional[int] = Form(None),
    is_public: bool = Form(False),
    generate_knowledge_graph: bool = Form(True),  # 是否生成知识图谱，默认为True
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    上传文档

    支持的文件格式：PDF, DOCX, DOC, TXT, MD, HTML, XLSX, XLS, CSV, PPTX, PPT, JPG, PNG等
    最大文件大小：100MB
    """
    try:
        # 处理标签
        tag_list = []
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

        # 创建文档数据
        document_data = DocumentCreate(
            title=title,
            description=description,
            category=category,
            tags=tag_list,
            project_id=project_id,
            is_public=is_public
        )

        # 上传文档
        document = await document_service.upload_document(
            file=file,
            user_id=current_user.id,
            document_data=document_data,
            db=db,
            generate_knowledge_graph=generate_knowledge_graph  # 传递知识图谱生成选项
        )

        return DocumentUploadResponse(
            document_id=document.id,
            filename=file.filename,
            file_size=int(document.file_size),  # 从Document模型获取文件大小
            status="processing",  # 修改为processing状态，更准确反映文档正在后台处理
            message="文档上传成功，正在后台处理中。请稍后刷新页面查看处理结果。"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"文档上传API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="文档上传失败")


@router.get("/", response_model=DocumentList)
async def get_documents(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    category: Optional[str] = Query(None, description="分类过滤"),
    project_id: Optional[int] = Query(None, description="项目ID过滤"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取用户文档列表"""
    try:
        skip = (page - 1) * size
        documents, total = await document_service.get_documents(
            user_id=current_user.id,
            skip=skip,
            limit=size,
            category=category,
            project_id=project_id,
            search=search,
            db=db
        )

        # 转换为摘要格式
        document_summaries = []
        for doc in documents:
            raw_progress = getattr(doc, 'processing_progress', 0.0) or 0.0
            # 兼容旧数据：如果进度在0-1之间，按百分比换算
            progress = raw_progress * 100 if 0 < raw_progress <= 1 else raw_progress

            document_summaries.append({
                "id": doc.id,
                "title": doc.title,
                "description": doc.description or "",
                "category": doc.category or "",
                "tags": doc.tags or [],
                "file_name": doc.file_name,
                "file_type": doc.file_extension or "",
                "file_size": doc.file_size or 0,
                "mime_type": doc.mime_type or "",
                "processing_status": doc.status or "pending",
                "processing_progress": progress,
                "chunk_count": getattr(doc, 'chunk_count', 0),
                "vector_count": getattr(doc, 'vector_count', 0),
                "created_at": doc.created_at,
                "updated_at": doc.updated_at or doc.created_at
            })

        pages = (total + size - 1) // size

        return DocumentList(
            documents=document_summaries,
            total=total,
            page=page,
            size=size,
            pages=pages
        )

    except Exception as e:
        logger.error(f"获取文档列表API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取文档列表失败")


@router.get("/{document_id}", response_model=Document)
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取文档详情"""
    try:
        document = await document_service.get_document(
            document_id=document_id,
            user_id=current_user.id,
            db=db
        )

        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        return document

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档详情API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取文档详情失败")


@router.put("/{document_id}", response_model=Document)
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新文档信息"""
    try:
        document = await document_service.update_document(
            document_id=document_id,
            document_update=document_update,
            user_id=current_user.id,
            db=db
        )

        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        return document

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新文档API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="更新文档失败")


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除文档"""
    try:
        success = await document_service.delete_document(
            document_id=document_id,
            user_id=current_user.id,
            db=db
        )

        if not success:
            raise HTTPException(status_code=404, detail="文档不存在")

        return {"message": "文档删除成功"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除文档API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="删除文档失败")


@router.post("/search", response_model=DocumentSearchResponse)
async def search_documents(
    search_request: DocumentSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """搜索文档"""
    try:
        start_time = time.time()
        results = await document_service.search_documents(
            search_request=search_request,
            user_id=current_user.id,
            db=db
        )
        search_time = time.time() - start_time

        return DocumentSearchResponse(
            results=results,
            total=len(results),
            query=search_request.query,
            search_time=search_time
        )

    except Exception as e:
        logger.error(f"文档搜索API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="文档搜索失败")


@router.post("/vector-search", response_model=VectorSearchResponse)
async def vector_search_documents(
    search_request: VectorSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """向量搜索文档"""
    try:
        start_time = time.time()
        results = await document_service.vector_search(
            search_request=search_request,
            user_id=current_user.id,
            db=db
        )
        search_time = time.time() - start_time

        return VectorSearchResponse(
            results=results,
            total=len(results),
            query=search_request.query,
            search_time=search_time
        )

    except Exception as e:
        logger.error(f"向量搜索API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="向量搜索失败")


@router.get("/{document_id}/preview-url")
async def get_preview_url(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """生成临时预览URL"""
    try:
        # 验证文档权限
        document = await document_service.get_document(
            document_id=document_id,
            user_id=current_user.id,
            db=db
        )
        
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 生成临时token（5分钟有效）
        token = secrets.token_urlsafe(32)
        preview_tokens[token] = {
            'document_id': document_id,
            'expires_at': time.time() + 300  # 5分钟
        }
        
        # 返回预览URL
        preview_url = f"/api/v1/documents/preview/{token}"
        return {
            'preview_url': preview_url,
            'expires_in': 300
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成预览URL失败: {str(e)}")
        raise HTTPException(status_code=500, detail="生成预览URL失败")


@router.get("/preview/{token}")
async def preview_document(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """通过临时token预览文档（无需认证）"""
    try:
        # 验证token
        if token not in preview_tokens:
            raise HTTPException(status_code=404, detail="预览链接无效")
        
        token_data = preview_tokens[token]
        
        # 检查是否过期
        if time.time() > token_data['expires_at']:
            del preview_tokens[token]
            raise HTTPException(status_code=410, detail="预览链接已过期")
        
        document_id = token_data['document_id']
        
        # 获取文档（不验证用户权限）
        from sqlalchemy import select
        from app.models.document import Document as DocumentModel
        
        result = await db.execute(
            select(DocumentModel).where(DocumentModel.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        import os
        if not os.path.exists(document.file_path):
            raise HTTPException(status_code=404, detail="文件不存在")
        
        def iterfile(file_path: str):
            with open(file_path, mode="rb") as file_like:
                yield from file_like
        
        from urllib.parse import quote
        
        filename = document.file_name or f'document_{document_id}'
        encoded_filename = quote(filename)
        file_type = document.mime_type or 'application/octet-stream'
        
        return StreamingResponse(
            iterfile(document.file_path),
            media_type=file_type,
            headers={
                "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"预览文档失败: {str(e)}")
        raise HTTPException(status_code=500, detail="预览失败")


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """下载文档文件"""
    try:
        document = await document_service.get_document(
            document_id=document_id,
            user_id=current_user.id,
            db=db
        )

        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        import os
        if not os.path.exists(document.file_path):
            raise HTTPException(status_code=404, detail="文件不存在")

        def iterfile(file_path: str):
            with open(file_path, mode="rb") as file_like:
                yield from file_like

        from urllib.parse import quote
        
        filename = document.file_name or f'document_{document_id}'
        # URL编码文件名以支持中文
        encoded_filename = quote(filename)
        file_type = document.mime_type or 'application/octet-stream'

        return StreamingResponse(
            iterfile(document.file_path),
            media_type=file_type,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"文档下载API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="文档下载失败")


@router.get("/{document_id}/chunks")
async def get_document_chunks(
    document_id: int,
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取文档分块"""
    try:
        from app.models.document import DocumentChunk
        from sqlalchemy import select, func

        # 验证文档存在
        document = await document_service.get_document(
            document_id=document_id,
            user_id=current_user.id,
            db=db
        )

        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        # 获取分块
        skip = (page - 1) * size
        count_query = select(func.count(DocumentChunk.id)).where(
            DocumentChunk.document_id == document_id
        )
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        chunks_query = select(DocumentChunk).where(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).offset(skip).limit(size)
        chunks_result = await db.execute(chunks_query)
        chunks = chunks_result.scalars().all()

        pages = (total + size - 1) // size

        return {
            "document_id": document_id,
            "chunks": [
                {
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char
                }
                for chunk in chunks
            ],
            "total": total,
            "page": page,
            "size": size,
            "pages": pages
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档分块API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取文档分块失败")


@router.get("/analytics/summary", response_model=DocumentAnalytics)
async def get_document_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取文档分析统计"""
    try:
        analytics = await document_service.get_document_analytics(
            user_id=current_user.id,
            db=db
        )
        return analytics

    except Exception as e:
        logger.error(f"获取文档分析API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取文档分析失败")


@router.get("/supported-formats")
async def get_supported_formats():
    """获取支持的文件格式列表"""
    try:
        from app.services.document_processor import document_processor
        formats = await document_processor.get_supported_formats()
        return {
            "supported_formats": formats,
            "max_file_size_mb": 100,
            "description": "支持以下文件格式的文档上传和处理"
        }

    except Exception as e:
        logger.error(f"获取支持格式API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取支持格式失败")


@router.post("/batch-process", response_model=DocumentBatchResponse)
async def batch_process_documents(
    batch_request: DocumentBatchProcess,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """批量处理文档"""
    try:
        success_count = 0
        failed_count = 0
        results = []

        for document_id in batch_request.document_ids:
            try:
                if batch_request.action == "delete":
                    success = await document_service.delete_document(
                        document_id=document_id,
                        user_id=current_user.id,
                        db=db
                    )
                    if success:
                        success_count += 1
                        results.append({
                            "document_id": document_id,
                            "status": "success",
                            "message": "删除成功"
                        })
                    else:
                        failed_count += 1
                        results.append({
                            "document_id": document_id,
                            "status": "failed",
                            "message": "文档不存在或无权限"
                        })
                else:
                    # 其他批量操作待实现
                    failed_count += 1
                    results.append({
                        "document_id": document_id,
                        "status": "failed",
                        "message": f"不支持的操作: {batch_request.action}"
                    })

            except Exception as e:
                failed_count += 1
                results.append({
                    "document_id": document_id,
                    "status": "failed",
                    "message": str(e)
                })

        return DocumentBatchResponse(
            success_count=success_count,
            failed_count=failed_count,
            results=results
        )

    except Exception as e:
        logger.error(f"批量处理API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="批量处理失败")


@router.get("/{document_id}/status")
async def get_document_processing_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取文档处理状态"""
    try:
        document = await document_service.get_document(
            document_id=document_id,
            user_id=current_user.id,
            db=db
        )

        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        return {
            "document_id": document_id,
            "status": document.status or 'pending',
            "progress": document.processing_progress or 0.0,
            "error_message": document.error_message
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档状态API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取文档状态失败")


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """提取文档内容"""
    try:
        from app.models.document import DocumentChunk
        from sqlalchemy import select

        # 验证文档存在
        document = await document_service.get_document(
            document_id=document_id,
            user_id=current_user.id,
            db=db
        )

        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        # 获取所有分块
        chunks_query = select(DocumentChunk).where(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index)
        chunks_result = await db.execute(chunks_query)
        chunks = chunks_result.scalars().all()

        return {
            "document_id": document_id,
            "title": document.title,
            "chunks": [
                {
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content
                }
                for chunk in chunks
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"提取文档内容API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="提取文档内容失败")


@router.put("/{document_id}/tags")
async def update_document_tags(
    document_id: int,
    tags_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新文档标签"""
    try:
        # 验证文档存在
        document = await document_service.get_document(
            document_id=document_id,
            user_id=current_user.id,
            db=db
        )

        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")

        # 更新标签
        new_tags = tags_data.get('tags', [])
        if not isinstance(new_tags, list):
            raise HTTPException(status_code=400, detail="标签必须是数组格式")

        document.tags = new_tags
        await db.commit()
        await db.refresh(document)

        return {
            "document_id": document_id,
            "tags": document.tags,
            "message": "标签更新成功"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新文档标签API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="更新文档标签失败")