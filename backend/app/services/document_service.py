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
from app.services.knowledge_graph_service import KnowledgeGraphService
from app.core.config import settings
from app.core.logging import logger


class DocumentService:
    """文档服务类"""

    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.knowledge_graph_service = KnowledgeGraphService()

    async def upload_document(
        self,
        file: UploadFile,
        user_id: int,
        document_data: DocumentCreate,
        db: AsyncSession,
        generate_knowledge_graph: bool = True  # 是否生成知识图谱
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

            # 4. 计算文件哈希和提取元数据
            file_hash = await document_processor._calculate_file_hash(file_path)

            # 5. 提取文件元数据
            file_stats = os.stat(file_path)
            file_extension = Path(file.filename).suffix.lower()

            # 获取MIME类型
            import mimetypes
            mime_type = file.content_type or mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'

            # 6. 检查是否已存在相同文件
            existing_doc = await self._get_document_by_hash(file_hash, user_id, db)
            if existing_doc:
                # 删除文件
                os.remove(file_path)
                raise HTTPException(status_code=409, detail="文件已存在")

            # 7. 创建文档记录（包含所有必填字段）
            document = Document(
                uploaded_by=user_id,
                title=document_data.title,
                description=document_data.description,
                category=document_data.category,
                tags=document_data.tags or [],
                is_public=document_data.is_public,
                file_hash=file_hash,
                file_path=str(file_path),
                # 文件元数据字段（必填）
                file_name=file.filename,
                file_size=file_stats.st_size,
                mime_type=mime_type,
                file_extension=file_extension,
                # 处理状态
                status="pending",
                processing_progress=0.0
            )

            db.add(document)
            await db.commit()
            await db.refresh(document)

            # 8. 异步处理文档
            await self._process_document_async(document.id, file_path, file.filename, generate_knowledge_graph)

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

    async def _process_document_async(self, document_id: int, file_path: Path, filename: str, generate_knowledge_graph: bool = True):
        """异步处理文档"""
        try:
            # 这里应该使用任务队列（如Celery），暂时简化处理
            await self._process_document(document_id, str(file_path), filename, generate_knowledge_graph)
        except Exception as e:
            logger.error(
                f"异步文档处理失败 [document_id={document_id}, filename={filename}]: {str(e)}",
                exc_info=True  # 添加完整的堆栈跟踪
            )
            # 确保文档状态被标记为失败
            try:
                from app.db.session import AsyncSessionLocal
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(Document).where(Document.id == document_id))
                    document = result.scalar_one_or_none()
                    if document and document.status != "failed":
                        document.status = "failed"
                        document.error_message = str(e)
                        document.processing_progress = 0.0
                        await db.commit()
                        logger.info(f"文档 {document_id} 状态已更新为失败")
            except Exception as update_error:
                logger.error(f"更新文档失败状态时出错 [document_id={document_id}]: {update_error}", exc_info=True)

    async def _process_document(self, document_id: int, file_path: str, filename: str, generate_knowledge_graph: bool = True):
        """处理文档（文本提取、分块、向量化）
        
        Args:
            document_id: 文档ID
            file_path: 文件路径
            filename: 文件名
            generate_knowledge_graph: 是否生成知识图谱，默认True
        """
        from app.db.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            try:
                # 获取文档记录
                result = await db.execute(select(Document).where(Document.id == document_id))
                document = result.scalar_one_or_none()
                if not document:
                    logger.error(f"文档不存在: {document_id}")
                    return

                # 更新处理状态
                document.status = "processing"
                document.processing_progress = 10.0

                await db.commit()

                # 处理文档
                process_result = await document_processor.process_document(file_path, filename)

                if process_result['processing_status'] == 'error':
                    # 处理失败
                    document.status = "failed"
                    document.error_message = process_result.get('error_message', '未知错误')
                    document.processing_progress = 0.0
                    await db.commit()
                    return

                # 更新文档信息
                document.doc_metadata = process_result.get('metadata', {})
                document.word_count = process_result.get('word_count', 0)
                document.chunk_count = process_result.get('chunk_count', 0)
                document.processing_progress = 80.0

                await db.commit()

                # 保存文档分块
                chunks = process_result.get('chunks', [])
                embeddings = process_result.get('embeddings')
                
                # 获取embedding配置（用于保存模型名称）
                embedding_config = None
                try:
                    from app.models.system_config import SystemConfig
                    config_result = await db.execute(
                        select(SystemConfig).where(
                            SystemConfig.category == 'embedding',
                            SystemConfig.is_active == True
                        )
                    )
                    configs = config_result.scalars().all()
                    embedding_config = {}
                    for config in configs:
                        key = config.config_key.replace('embedding_', '')
                        embedding_config[key] = config.config_value
                except Exception as e:
                    logger.warning(f"获取embedding配置失败: {str(e)}")
                
                # 调试日志
                logger.info(f"文档 {document_id} - chunks数量: {len(chunks)}, embeddings类型: {type(embeddings)}, embeddings是否为None: {embeddings is None}")
                if embeddings is not None:
                    logger.info(f"文档 {document_id} - embeddings长度: {len(embeddings) if isinstance(embeddings, list) else 'N/A'}")

                if chunks:
                    # 保存分块到数据库
                    for i, chunk in enumerate(chunks):
                        # 获取对应的向量
                        embedding_vector = None
                        embedding_model_name = None
                        
                        if embeddings is not None and i < len(embeddings):
                            # 转换为列表格式
                            emb = embeddings[i]
                            if hasattr(emb, 'tolist'):
                                embedding_vector = emb.tolist()
                            elif isinstance(emb, (list, tuple)):
                                embedding_vector = list(emb)
                            else:
                                embedding_vector = [float(x) for x in emb]
                            
                            # 获取模型名称
                            if embedding_config:
                                provider = embedding_config.get('provider', 'unknown')
                                model = embedding_config.get('model', 'unknown')
                                embedding_model_name = f"{provider}/{model}"
                        
                        document_chunk = DocumentChunk(
                            document_id=document_id,
                            chunk_index=chunk['chunk_index'],
                            content=chunk['content'],
                            start_char=chunk.get('start_char', 0),
                            end_char=chunk.get('end_char', 0),
                            embedding_vector=embedding_vector,
                            embedding_model=embedding_model_name
                        )
                        db.add(document_chunk)

                    await db.commit()

                    # 向量化并存储（仅在embeddings可用时）
                    logger.info(f"文档 {document_id} - 准备检查向量存储条件: embeddings is not None={embeddings is not None}, len(embeddings)={len(embeddings) if embeddings else 0}")
                    if embeddings is not None and len(embeddings) > 0:
                        logger.info(f"文档 {document_id} - 进入向量存储代码块")
                        try:
                            await vector_service.connect()
                            logger.info(f"文档 {document_id} - vector_service连接成功")
                            metadata = {
                                'document_id': document_id,
                                'title': document.title,
                                'category': document.category,
                                'tags': document.tags,
                                'file_type': document.file_extension or '',
                                'file_size': document.file_size or 0,
                                'mime_type': document.mime_type or ''
                            }
                            if document.doc_metadata:
                                metadata.update(document.doc_metadata)

                            vector_ids = await vector_service.add_document_vectors(
                                document_id=document_id,
                                chunks=chunks,
                                embeddings=embeddings,
                                metadata=metadata
                            )

                            # 更新vector_count字段
                            document.vector_count = len(embeddings)
                            logger.info(f"文档 {document_id} - 向量存储成功，更新vector_count={len(embeddings)}")
                            
                            # 向量ID已存储到Qdrant，保存vector_count到数据库
                            await db.commit()

                        except Exception as e:
                            logger.error(f"向量化失败: {str(e)}")
                            # 向量化失败不影响文档处理完成
                    else:
                        logger.warning(f"文档 {document_id} 未生成向量，跳过向量化存储")

                # 生成知识图谱（在向量化之后）
                if generate_knowledge_graph:
                    try:
                        logger.info(f"开始为文档 {document_id} 生成知识图谱...")
                        document.processing_progress = 90.0
                        await db.commit()

                        # 调用知识图谱服务处理文档
                        kg_result = await self.knowledge_graph_service.process_document_knowledge(
                            document_id=document_id,
                            user_id=document.uploaded_by,
                            db=db
                        )

                        if kg_result:
                            logger.info(
                                f"知识图谱生成成功 [document_id={document_id}]: "
                                f"实体={kg_result.get('entities_count', 0)}, "
                                f"关系={kg_result.get('relations_count', 0)}"
                            )
                        else:
                            logger.warning(f"文档 {document_id} 知识图谱生成返回空结果")

                    except Exception as kg_error:
                        # 知识图谱生成失败不影响文档处理完成
                        logger.error(
                            f"知识图谱生成失败 [document_id={document_id}]: {str(kg_error)}",
                            exc_info=True
                        )
                        # 不抛出异常，让文档处理继续完成
                else:
                    logger.info(f"文档 {document_id} 跳过知识图谱生成（用户选择）")

                # 标记处理完成
                document.status = "completed"
                document.processing_progress = 100.0

                await db.commit()

                logger.info(f"文档处理完成: {document_id}")

            except Exception as e:
                logger.error(f"文档处理失败 {document_id}: {str(e)}")
                await db.rollback()
                # 标记处理失败
                try:
                    result = await db.execute(select(Document).where(Document.id == document_id))
                    document = result.scalar_one_or_none()
                    if document:
                        document.status = "failed"
                        document.error_message = str(e)
                        await db.commit()
                except Exception as commit_error:
                    logger.error(f"更新文档失败状态时出错: {commit_error}")
            finally:
                await db.close()

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
                    Document.uploaded_by == user_id
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_documents(
        self,
        user_id: int,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 20,
        category: Optional[str] = None,
        project_id: Optional[int] = None,
        search: Optional[str] = None
    ) -> Tuple[List[Document], int]:
        """获取用户文档列表"""
        query = select(Document).where(
            Document.uploaded_by == user_id
        )

        # 添加过滤条件
        if category:
            query = query.where(Document.category == category)

        # TODO: project_id field doesn't exist in Document model yet
        # if project_id:
        #     query = query.where(Document.project_id == project_id)

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
                    Document.uploaded_by == user_id
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
                    Document.uploaded_by == user_id
                )
            )
        )
        document = result.scalar_one_or_none()

        if not document:
            return False

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

        # 真删除（从数据库中删除记录）
        await db.delete(document)
        await db.commit()

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
            Document.uploaded_by == user_id
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
                    Document.file_extension == file_type
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
                'file_type': doc.file_extension or '',
                'file_size': doc.file_size or 0,
                'processing_status': doc.status or 'pending',
                'chunk_count': doc.chunk_count,
                'created_at': doc.created_at,
                'updated_at': doc.updated_at or doc.created_at,
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

            # 从数据库读取embedding配置
            from sqlalchemy import select
            from app.models.system_config import SystemConfig
            from app.db.session import AsyncSessionLocal
            
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(SystemConfig).where(
                        SystemConfig.category == "embedding",
                        SystemConfig.is_active == True
                    )
                )
                configs = result.scalars().all()
                
                embedding_config = {}
                for config in configs:
                    key = config.config_key.replace("embedding_", "")
                    embedding_config[key] = config.config_value
            
            provider = embedding_config.get('provider', 'dashscope')
            model = embedding_config.get('model', 'text-embedding-v2')
            api_key = embedding_config.get('api_key', '')
            
            logger.info(f"查询向量生成 - 供应商：{provider}, 模型：{model}")
            
            # 生成查询向量
            query_vector = None
            if provider in ['dashscope', 'qwen'] and api_key:
                try:
                    import dashscope
                    from dashscope import TextEmbedding
                    
                    dashscope.api_key = api_key
                    
                    # 根据模型名称选择对应的模型
                    model_enum = TextEmbedding.Models.text_embedding_v2
                    if 'v1' in model.lower():
                        model_enum = TextEmbedding.Models.text_embedding_v1
                    elif 'v3' in model.lower():
                        model_enum = TextEmbedding.Models.text_embedding_v3
                    
                    response = TextEmbedding.call(
                        model=model_enum,
                        input=search_request.query[:2000]
                    )
                    
                    if response.status_code == 200:
                        query_vector = response.output['embeddings'][0]['embedding']
                        logger.info(f'使用{provider}/{model}生成查询向量成功')
                except Exception as e:
                    logger.error(f"生成查询向量失败: {str(e)}")
            
            if query_vector is None:
                logger.error("无法生成查询向量，embedding配置可能有误")
                return []
            
            filters = {}
            # 只在需要时添加用户过滤
            # if search_request.filters and search_request.filters.get('user_only'):
            #     filters['user_id'] = user_id
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
                            or_(Document.is_public == True, Document.uploaded_by == user_id)
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
                or_(Document.is_public == True, Document.uploaded_by == user_id)
            )
            total_docs_result = await db.execute(total_docs_query)
            total_documents = total_docs_result.scalar() or 0

            # 文件类型分布
            file_type_query = select(
                Document.file_extension.label('file_type'),
                func.count().label('count')
            ).where(
                and_(
                    or_(Document.is_public == True, Document.uploaded_by == user_id),
                    Document.file_extension.isnot(None)
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
                    or_(Document.is_public == True, Document.uploaded_by == user_id),
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
                Document.status.label('status'),
                func.count().label('count')
            ).where(
                or_(Document.is_public == True, Document.uploaded_by == user_id)
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
                    or_(Document.is_public == True, Document.uploaded_by == user_id),
                    Document.created_at >= seven_days_ago
                )
            ).group_by(func.date(Document.created_at)).order_by('date')
            timeline_result = await db.execute(timeline_query)
            upload_timeline = [
                {'date': str(row.date), 'count': row.count}
                for row in timeline_result
            ]

            # 热门标签（PostgreSQL使用unnest，SQLite使用json_each）
            try:
                if settings.DATABASE_URL.startswith('sqlite'):
                    # SQLite语法
                    tags_query = select(
                        func.json_each(Document.tags).label('tag'),
                        func.count().label('count')
                    ).where(
                        and_(
                            or_(Document.is_public == True, Document.uploaded_by == user_id),
                            Document.tags.isnot(None)
                        )
                    ).group_by('tag').order_by(desc('count')).limit(10)
                else:
                    # PostgreSQL语法
                    tags_query = select(
                        func.unnest(Document.tags).label('tag'),
                        func.count().label('count')
                    ).where(
                        and_(
                            or_(Document.is_public == True, Document.uploaded_by == user_id),
                            Document.tags.isnot(None),
                            func.array_length(Document.tags, 1).isnot(None)
                        )
                    ).group_by('tag').order_by(desc('count')).limit(10)

                tags_result = await db.execute(tags_query)
                popular_tags = [
                    {'tag': row.tag, 'count': row.count}
                    for row in tags_result
                ]
            except Exception as e:
                logger.warning(f"热门标签查询失败: {str(e)}")
                popular_tags = []

            # 文件总大小
            size_query = select(
                func.sum(Document.file_size)
            ).where(
                or_(Document.is_public == True, Document.uploaded_by == user_id)
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
                    or_(Document.is_public == True, Document.uploaded_by == user_id)
                )
            )
        )
        return result.scalar_one_or_none()


# 全局文档服务实例
document_service = DocumentService()