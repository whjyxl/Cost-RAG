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

router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    project_id: Optional[int] = Form(None),
    is_public: bool = Form(False),
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
            db=db
        )

        return DocumentUploadResponse(
            document_id=document.id,
            filename=file.filename,
            file_size=file.size if hasattr(file, 'size') else 0,
            status="success",
            message="文档上传成功，正在处理中"
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
            document_summaries.append({
                "id": doc.id,
                "title": doc.title,
                "description": doc.description,
                "category": doc.category,
                "tags": doc.tags,
                "file_type": doc.metadata.get('file_type', '') if doc.metadata else '',
                "file_size": doc.metadata.get('file_size', 0) if doc.metadata else 0,
                "processing_status": doc.processing_status.status,
                "chunk_count": doc.chunk_count,
                "created_at": doc.created_at,
                "updated_at": doc.updated_at
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

        filename = document.metadata.get('filename', f'document_{document_id}') if document.metadata else f'document_{document_id}'
        file_type = document.metadata.get('file_type', '') if document.metadata else ''

        return StreamingResponse(
            iterfile(document.file_path),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
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
                    "start_position": chunk.start_position,
                    "end_position": chunk.end_position,
                    "word_count": chunk.word_count,
                    "char_count": chunk.char_count,
                    "vector_id": chunk.vector_id
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
            "status": document.processing_status.status,
            "progress": document.processing_status.progress,
            "error_message": document.processing_status.error_message,
            "started_at": document.processing_status.started_at,
            "completed_at": document.processing_status.completed_at
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档状态API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取文档状态失败")