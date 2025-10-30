"""
文档服务层 - 业务逻辑处理
"""
import os
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from fastapi import UploadFile, HTTPException
import numpy as np

from app.models.document import Document, DocumentChunk
from app.models.user import User
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentSearchRequest,
    VectorSearchRequest, DocumentProcessingStatus
)
from app.services.document_processor import document_processor
from app.services.vector_service import vector_service
from app.core.config import settings
from app.core.logging import logger


class DocumentService:
    """文档服务类"""

    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def upload_document(
        self,
        file: UploadFile,
        user_id: int,
        document_data: DocumentCreate,
        db: AsyncSession
    ) -> Document:
        """
        上传并处理文档

        Args:
            file: 上传的文件
            user_id: 用户ID
            document_data: 文档数据
            db: 数据库会话

        Returns:
            创建的文档对象
        """
        try:
            # 1. 验证文件
            if not file.filename:
                raise HTTPException(status_code=400, detail="文件名不能为空")

            # 2. 保存文件
            file_path = await self._save_uploaded_file(file)

            # 3. 验证文件
            validation_result = await document_processor.validate_file(file_path)
            if not validation_result['valid']:
                # 删除文件
                os.remove(file_path)
                raise HTTPException(status_code=400, detail=validation_result['error'])

            # 4. 计算文件哈希
            file_hash = await document_processor._calculate_file_hash(file_path)

            # 5. 检查是否已存在相同文件
            existing_doc = await self._get_document_by_hash(file_hash, user_id, db)
            if existing_doc:
                # 删除文件
                os.remove(file_path)
                raise HTTPException(status_code=409, detail="文件已存在")

            # 6. 创建文档记录
            document = Document(
                user_id=user_id,
                title=document_data.title,
                description=document_data.description,
                category=document_data.category,
                tags=document_data.tags or [],
                project_id=document_data.project_id,
                is_public=document_data.is_public,
                file_hash=file_hash,
                file_path=str(file_path),
                processing_status=DocumentProcessingStatus(
                    status="pending",
                    progress=0.0,
                    started_at=datetime.utcnow()
                )
            )

            db.add(document)
            await db.commit()
            await db.refresh(document)

            # 7. 异步处理文档
            await self._process_document_async(document.id, file_path, file.filename)

            logger.info(f"文档上传成功: {file.filename}, ID: {document.id}")
            return document

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"文档上传失败: {str(e)}")
            # 清理文件
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail="文档上传失败")

    async def _save_uploaded_file(self, file: UploadFile) -> Path:
        """保存上传的文件"""
        # 生成唯一文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
        file_path = self.upload_dir / filename

        # 保存文件
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            return file_path
        except Exception as e:
            logger.error(f"文件保存失败: {str(e)}")
            raise HTTPException(status_code=500, detail="文件保存失败")

    async def _process_document_async(self, document_id: int, file_path: Path, filename: str):
        """异步处理文档"""
        try:
            # 这里应该使用任务队列（如Celery），暂时简化处理
            await self._process_document(document_id, str(file_path), filename)
        except Exception as e:
            logger.error(f"异步文档处理失败: {str(e)}")

    async def _process_document(self, document_id: int, file_path: str, filename: str):
        """处理文档（文本提取、分块、向量化）"""
        from app.db.session import get_db_session

        async with get_db_session() as db:
            try:
                # 获取文档记录
                result = await db.execute(select(Document).where(Document.id == document_id))
                document = result.scalar_one_or_none()
                if not document:
                    logger.error(f"文档不存在: {document_id}")
                    return

                # 更新处理状态
                document.processing_status.status = "processing"
                document.processing_status.progress = 0.1
                await db.commit()

                # 处理文档
                process_result = await document_processor.process_document(file_path, filename)

                if process_result['processing_status'] == 'error':
                    # 处理失败
                    document.processing_status.status = "failed"
                    document.processing_status.error_message = process_result.get('error_message', '未知错误')
                    document.processing_status.progress = 0.0
                    document.processing_status.completed_at = datetime.utcnow()
                    await db.commit()
                    return

                # 更新文档信息
                document.metadata = process_result.get('metadata', {})
                document.total_length = process_result.get('total_length', 0)
                document.chunk_count = process_result.get('chunk_count', 0)
                document.processing_status.progress = 0.8
                await db.commit()

                # 保存文档分块
                chunks = process_result.get('chunks', [])
                embeddings = process_result.get('embeddings')

                if chunks and embeddings is not None:
                    # 保存分块到数据库
                    for chunk in chunks:
                        document_chunk = DocumentChunk(
                            document_id=document_id,
                            chunk_index=chunk['chunk_index'],
                            content=chunk['content'],
                            start_position=chunk.get('start_position', 0),
                            end_position=chunk.get('end_position', 0),
                            word_count=chunk.get('word_count', 0),
                            char_count=chunk.get('char_count', 0)
                        )
                        db.add(document_chunk)

                    await db.commit()

                    # 向量化并存储
                    try:
                        await vector_service.connect()
                        metadata = {
                            'document_id': document_id,
                            'title': document.title,
                            'category': document.category,
                            'tags': document.tags,
                            'file_type': document.metadata.get('file_type', ''),
                            **document.metadata
                        }

                        vector_ids = await vector_service.add_document_vectors(
                            document_id=document_id,
                            chunks=chunks,
                            embeddings=embeddings,
                            metadata=metadata
                        )

                        # 更新分块的向量ID
                        for i, chunk in enumerate(chunks):
                            if i < len(vector_ids):
                                result = await db.execute(
                                    select(DocumentChunk).where(
                                        and_(
                                            DocumentChunk.document_id == document_id,
                                            DocumentChunk.chunk_index == chunk['chunk_index']
                                        )
                                    )
                                )
                                db_chunk = result.scalar_one_or_none()
                                if db_chunk:
                                    db_chunk.vector_id = vector_ids[i]

                        await db.commit()

                    except Exception as e:
                        logger.error(f"向量化失败: {str(e)}")
                        # 向量化失败不影响文档处理完成

                # 标记处理完成
                document.processing_status.status = "completed"
                document.processing_status.progress = 1.0
                document.processing_status.completed_at = datetime.utcnow()
                await db.commit()

                logger.info(f"文档处理完成: {document_id}")

            except Exception as e:
                logger.error(f"文档处理失败 {document_id}: {str(e)}")
                # 标记处理失败
                if document:
                    document.processing_status.status = "failed"
                    document.processing_status.error_message = str(e)
                    document.processing_status.completed_at = datetime.utcnow()
                    await db.commit()

    async def get_document(
        self,
        document_id: int,
        user_id: int,
        db: AsyncSession
    ) -> Optional[Document]:
        """获取文档详情"""
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == document_id,
                    Document.user_id == user_id,
                    Document.is_active == True
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_documents(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
        category: Optional[str] = None,
        project_id: Optional[int] = None,
        search: Optional[str] = None,
        db: AsyncSession
    ) -> Tuple[List[Document], int]:
        """获取用户文档列表"""
        query = select(Document).where(
            and_(
                Document.user_id == user_id,
                Document.is_active == True
            )
        )

        # 添加过滤条件
        if category:
            query = query.where(Document.category == category)

        if project_id:
            query = query.where(Document.project_id == project_id)

        if search:
            query = query.where(
                or_(
                    Document.title.ilike(f"%{search}%"),
                    Document.description.ilike(f"%{search}%")
                )
            )

        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # 分页查询
        query = query.order_by(desc(Document.created_at)).offset(skip).limit(limit)
        result = await db.execute(query)
        documents = result.scalars().all()

        return list(documents), total

    async def update_document(
        self,
        document_id: int,
        document_update: DocumentUpdate,
        user_id: int,
        db: AsyncSession
    ) -> Optional[Document]:
        """更新文档信息"""
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == document_id,
                    Document.user_id == user_id,
                    Document.is_active == True
                )
            )
        )
        document = result.scalar_one_or_none()

        if not document:
            return None

        # 更新字段
        update_data = document_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(document, field, value)

        document.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(document)

        return document

    async def delete_document(
        self,
        document_id: int,
        user_id: int,
        db: AsyncSession
    ) -> bool:
        """删除文档"""
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == document_id,
                    Document.user_id == user_id,
                    Document.is_active == True
                )
            )
        )
        document = result.scalar_one_or_none()

        if not document:
            return False

        # 软删除
        document.is_active = False
        document.updated_at = datetime.utcnow()
        await db.commit()

        # 删除向量数据
        try:
            await vector_service.delete_document_vectors(document_id)
        except Exception as e:
            logger.error(f"删除向量数据失败: {str(e)}")

        # 删除文件
        try:
            if os.path.exists(document.file_path):
                os.remove(document.file_path)
        except Exception as e:
            logger.error(f"删除文件失败: {str(e)}")

        logger.info(f"文档删除成功: {document_id}")
        return True

    async def search_documents(
        self,
        search_request: DocumentSearchRequest,
        user_id: int,
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """搜索文档"""
        query = select(Document).where(
            and_(
                Document.user_id == user_id,
                Document.is_active == True
            )
        )

        # 添加搜索条件
        if search_request.query:
            query = query.where(
                or_(
                    Document.title.ilike(f"%{search_request.query}%"),
                    Document.description.ilike(f"%{search_request.query}%")
                )
            )

        if search_request.category:
            query = query.where(Document.category == search_request.category)

        if search_request.project_id:
            query = query.where(Document.project_id == search_request.project_id)

        if search_request.tags:
            for tag in search_request.tags:
                query = query.where(Document.tags.contains([tag]))

        if search_request.file_types:
            file_type_conditions = []
            for file_type in search_request.file_types:
                file_type_conditions.append(
                    Document.metadata['file_type'].astext == file_type
                )
            query = query.where(or_(*file_type_conditions))

        if search_request.date_from:
            query = query.where(Document.created_at >= search_request.date_from)

        if search_request.date_to:
            query = query.where(Document.created_at <= search_request.date_to)

        # 限制结果数量
        query = query.order_by(desc(Document.created_at)).limit(search_request.limit)
        result = await db.execute(query)
        documents = result.scalars().all()

        # 转换为搜索结果格式
        search_results = []
        for doc in documents:
            search_results.append({
                'document_id': doc.id,
                'title': doc.title,
                'description': doc.description,
                'category': doc.category,
                'tags': doc.tags,
                'file_type': doc.metadata.get('file_type', '') if doc.metadata else '',
                'file_size': doc.metadata.get('file_size', 0) if doc.metadata else 0,
                'processing_status': doc.processing_status.status,
                'chunk_count': doc.chunk_count,
                'created_at': doc.created_at,
                'updated_at': doc.updated_at,
                'relevance_score': 1.0  # 简化处理
            })

        return search_results

    async def vector_search(
        self,
        search_request: VectorSearchRequest,
        user_id: int,
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """向量搜索"""
        try:
            # 连接向量数据库
            await vector_service.connect()

            # 生成查询向量
            from sentence_transformers import SentenceTransformer
            embedding_model = SentenceTransformer('shibing624/text2vec-base-chinese')
            query_vector = embedding_model.encode([search_request.query])[0]

            # 构建过滤条件
            filters = {'user_id': user_id}
            if search_request.filters:
                filters.update(search_request.filters)

            # 执行向量搜索
            vector_results = await vector_service.search_similar_vectors(
                query_vector=query_vector,
                limit=search_request.limit,
                score_threshold=search_request.score_threshold,
                filters=filters
            )

            # 获取文档信息
            results = []
            for result in vector_results:
                payload = result['payload']
                document_id = payload.get('document_id')

                # 验证文档权限
                doc_result = await db.execute(
                    select(Document).where(
                        and_(
                            Document.id == document_id,
                            Document.user_id == user_id,
                            Document.is_active == True
                        )
                    )
                )
                document = doc_result.scalar_one_or_none()

                if document:
                    results.append({
                        'document_id': document_id,
                        'chunk_index': payload.get('chunk_index', 0),
                        'content': payload.get('content', ''),
                        'relevance_score': result['score'],
                        'metadata': {
                            'title': document.title,
                            'category': document.category,
                            'file_type': payload.get('file_type', ''),
                            'char_count': payload.get('char_count', 0),
                            'word_count': payload.get('word_count', 0)
                        }
                    })

            return results

        except Exception as e:
            logger.error(f"向量搜索失败: {str(e)}")
            return []

    async def get_document_analytics(self, user_id: int, db: AsyncSession) -> Dict[str, Any]:
        """获取文档分析数据"""
        try:
            # 基础统计
            total_docs_query = select(func.count(Document.id)).where(
                and_(
                    Document.user_id == user_id,
                    Document.is_active == True
                )
            )
            total_docs_result = await db.execute(total_docs_query)
            total_documents = total_docs_result.scalar() or 0

            # 文件类型分布
            file_type_query = select(
                func.json_extract(Document.metadata, '$.file_type').label('file_type'),
                func.count().label('count')
            ).where(
                and_(
                    Document.user_id == user_id,
                    Document.is_active == True,
                    Document.metadata.isnot(None)
                )
            ).group_by('file_type')
            file_type_result = await db.execute(file_type_query)
            file_type_distribution = {
                row.file_type or 'unknown': row.count
                for row in file_type_result
            }

            # 分类分布
            category_query = select(
                Document.category,
                func.count().label('count')
            ).where(
                and_(
                    Document.user_id == user_id,
                    Document.is_active == True,
                    Document.category.isnot(None)
                )
            ).group_by(Document.category)
            category_result = await db.execute(category_query)
            category_distribution = {
                row.category: row.count
                for row in category_result
            }

            # 处理状态分布
            status_query = select(
                Document.processing_status['status'].astext.label('status'),
                func.count().label('count')
            ).where(
                and_(
                    Document.user_id == user_id,
                    Document.is_active == True
                )
            ).group_by('status')
            status_result = await db.execute(status_query)
            processing_status_distribution = {
                row.status: row.count
                for row in status_result
            }

            # 上传时间线（最近7天）
            from datetime import datetime, timedelta
            seven_days_ago = datetime.utcnow() - timedelta(days=7)
            timeline_query = select(
                func.date(Document.created_at).label('date'),
                func.count().label('count')
            ).where(
                and_(
                    Document.user_id == user_id,
                    Document.is_active == True,
                    Document.created_at >= seven_days_ago
                )
            ).group_by(func.date(Document.created_at)).order_by('date')
            timeline_result = await db.execute(timeline_query)
            upload_timeline = [
                {'date': str(row.date), 'count': row.count}
                for row in timeline_result
            ]

            # 热门标签
            tags_query = select(
                func.json_each(Document.tags).label('tag'),
                func.count().label('count')
            ).where(
                and_(
                    Document.user_id == user_id,
                    Document.is_active == True,
                    Document.tags.isnot(None)
                )
            ).group_by('tag').order_by(desc('count')).limit(10)
            tags_result = await db.execute(tags_query)
            popular_tags = [
                {'tag': row.tag, 'count': row.count}
                for row in tags_result
            ]

            # 文件总大小
            size_query = select(
                func.sum(func.cast(func.json_extract(Document.metadata, '$.file_size'), func.Integer))
            ).where(
                and_(
                    Document.user_id == user_id,
                    Document.is_active == True,
                    Document.metadata.isnot(None)
                )
            )
            size_result = await db.execute(size_query)
            total_size = size_result.scalar() or 0

            return {
                'total_documents': total_documents,
                'total_size': total_size,
                'file_type_distribution': file_type_distribution,
                'category_distribution': category_distribution,
                'processing_status_distribution': processing_status_distribution,
                'upload_timeline': upload_timeline,
                'popular_tags': popular_tags
            }

        except Exception as e:
            logger.error(f"获取文档分析失败: {str(e)}")
            return {
                'total_documents': 0,
                'total_size': 0,
                'file_type_distribution': {},
                'category_distribution': {},
                'processing_status_distribution': {},
                'upload_timeline': [],
                'popular_tags': []
            }

    async def _get_document_by_hash(
        self,
        file_hash: str,
        user_id: int,
        db: AsyncSession
    ) -> Optional[Document]:
        """根据文件哈希获取文档"""
        result = await db.execute(
            select(Document).where(
                and_(
                    Document.file_hash == file_hash,
                    Document.user_id == user_id,
                    Document.is_active == True
                )
            )
        )
        return result.scalar_one_or_none()


# 全局文档服务实例
document_service = DocumentService()