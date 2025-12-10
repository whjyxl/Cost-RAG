"""
文档下载API
提供原始文件下载功能
"""
from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os
import logging

from app.api.deps import get_db, get_current_user
from app.models.document import Document
from app.models.user import User
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/download/{document_id}")
async def download_document(
    document_id: int = Path(..., description="文档ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    下载原始文档文件
    
    返回原始上传的文件，保留所有格式、图片等内容
    """
    try:
        # 查询文档
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 检查权限（如果文档不是公开的，需要是创建者）
        if not document.is_public and document.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权访问此文档")
        
        # 获取文件路径
        file_path = document.file_path
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            logger.error(f"文件不存在: {file_path}")
            raise HTTPException(status_code=404, detail="原始文件不存在")
        
        # 获取文件名和扩展名
        filename = os.path.basename(file_path)
        
        # 返回文件
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/octet-stream',
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载文档失败: {str(e)}")
        raise HTTPException(status_code=500, detail="下载文档失败")


@router.get("/preview/{document_id}")
async def preview_document(
    document_id: int = Path(..., description="文档ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    在线预览文档（在浏览器中打开）
    
    对于PDF、图片等可以直接在浏览器预览的文件，使用inline方式
    """
    try:
        # 查询文档
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 检查权限
        if not document.is_public and document.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权访问此文档")
        
        # 获取文件路径
        file_path = document.file_path
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            logger.error(f"文件不存在: {file_path}")
            raise HTTPException(status_code=404, detail="原始文件不存在")
        
        # 获取文件名和扩展名
        filename = os.path.basename(file_path)
        ext = os.path.splitext(filename)[1].lower()
        
        # 根据文件类型设置MIME类型
        mime_types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.html': 'text/html',
        }
        
        media_type = mime_types.get(ext, 'application/octet-stream')
        
        # 返回文件（inline模式，浏览器尝试打开）
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=media_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"预览文档失败: {str(e)}")
        raise HTTPException(status_code=500, detail="预览文档失败")


@router.get("/info/{document_id}")
async def get_document_info(
    document_id: int = Path(..., description="文档ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取文档信息（包括原始文件路径）
    """
    try:
        # 查询文档
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 检查权限
        if not document.is_public and document.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权访问此文档")
        
        # 检查文件是否存在
        file_exists = os.path.exists(document.file_path)
        file_size = os.path.getsize(document.file_path) if file_exists else 0
        
        return {
            "id": document.id,
            "title": document.title,
            "description": document.description,
            "file_type": document.file_type,
            "file_path": document.file_path,
            "file_exists": file_exists,
            "file_size": file_size,
            "download_url": f"/api/v1/documents/download/{document.id}",
            "preview_url": f"/api/v1/documents/preview/{document.id}",
            "created_at": document.created_at.isoformat() if document.created_at else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取文档信息失败")
