"""
向量数据库服务模块 - 基于Qdrant的向量存储和检索
"""
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition,
    MatchValue, SearchRequest, SearchParams, RecommendRequest
)
from app.core.config import settings
from app.core.logging import logger


class VectorService:
    """向量数据库服务 - Qdrant"""

    def __init__(self):
        self.client = None
        self.collection_name = "documents"
        self.vector_size = 768  # text2vec-base-chinese的向量维度

    async def connect(self) -> bool:
        """连接到Qdrant服务器"""
        try:
            self.client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                timeout=30
            )

            # 测试连接
            collections = self.client.get_collections().collections
            logger.info(f"成功连接到Qdrant，现有集合: {[c.name for c in collections]}")

            # 确保文档集合存在
            await self._ensure_collection_exists()
            return True

        except Exception as e:
            logger.error(f"连接Qdrant失败: {str(e)}")
            return False

    async def disconnect(self):
        """断开Qdrant连接"""
        if self.client:
            self.client.close()
            logger.info("Qdrant连接已关闭")

    async def _ensure_collection_exists(self):
        """确保文档集合存在"""
        try:
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]

            if self.collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE
                    )
                )
                logger.info(f"创建集合: {self.collection_name}")
            else:
                logger.info(f"集合已存在: {self.collection_name}")

        except Exception as e:
            logger.error(f"创建集合失败: {str(e)}")
            raise

    async def add_document_vectors(
        self,
        document_id: int,
        chunks: List[Dict[str, Any]],
        embeddings: np.ndarray,
        metadata: Dict[str, Any]
    ) -> List[int]:
        """
        添加文档向量到数据库

        Args:
            document_id: 文档ID
            chunks: 文本分块列表
            embeddings: 向量数组
            metadata: 文档元数据

        Returns:
            添加的向量点ID列表
        """
        try:
            if not self.client:
                await self.connect()

            points = []
            point_ids = []

            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                point_id = f"{document_id}_{i}"

                # 构建点数据
                point_data = {
                    'document_id': document_id,
                    'chunk_index': i,
                    'content': chunk['content'],
                    'char_count': chunk.get('char_count', 0),
                    'word_count': chunk.get('word_count', 0),
                    'start_position': chunk.get('start_position', 0),
                    'end_position': chunk.get('end_position', 0),
                    **metadata  # 包含文档元数据
                }

                point = PointStruct(
                    id=point_id,
                    vector=embedding.tolist(),
                    payload=point_data
                )

                points.append(point)
                point_ids.append(point_id)

            # 批量插入
            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )

            logger.info(f"成功添加 {len(points)} 个向量点，文档ID: {document_id}")
            return point_ids

        except Exception as e:
            logger.error(f"添加向量失败: {str(e)}")
            raise

    async def search_similar_vectors(
        self,
        query_vector: np.ndarray,
        limit: int = 10,
        score_threshold: float = 0.7,
        document_ids: Optional[List[int]] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        搜索相似向量

        Args:
            query_vector: 查询向量
            limit: 返回结果数量
            score_threshold: 相似度阈值
            document_ids: 限制搜索的文档ID列表
            filters: 额外过滤条件

        Returns:
            相似向量结果列表
        """
        try:
            if not self.client:
                await self.connect()

            # 构建过滤器
            search_filter = None
            if document_ids or filters:
                conditions = []

                if document_ids:
                    conditions.append(
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(any=document_ids)
                        )
                    )

                if filters:
                    for key, value in filters.items():
                        conditions.append(
                            FieldCondition(
                                key=key,
                                match=MatchValue(value=value)
                            )
                        )

                if conditions:
                    search_filter = Filter(must=conditions)

            # 执行搜索
            search_result = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector.tolist(),
                query_filter=search_filter,
                limit=limit,
                score_threshold=score_threshold,
                search_params=SearchParams(
                    exact=False,
                    hnsw_ef=128
                )
            )

            # 格式化结果
            results = []
            for scored_point in search_result:
                result = {
                    'id': scored_point.id,
                    'score': scored_point.score,
                    'payload': scored_point.payload
                }
                results.append(result)

            logger.info(f"向量搜索完成，返回 {len(results)} 个结果")
            return results

        except Exception as e:
            logger.error(f"向量搜索失败: {str(e)}")
            return []

    async def delete_document_vectors(self, document_id: int) -> bool:
        """删除指定文档的所有向量"""
        try:
            if not self.client:
                await self.connect()

            # 构建过滤器
            delete_filter = Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id)
                    )
                ]
            )

            # 删除向量
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=delete_filter
            )

            logger.info(f"成功删除文档 {document_id} 的所有向量")
            return True

        except Exception as e:
            logger.error(f"删除向量失败: {str(e)}")
            return False

    async def update_document_vectors(
        self,
        document_id: int,
        chunks: List[Dict[str, Any]],
        embeddings: np.ndarray,
        metadata: Dict[str, Any]
    ) -> List[int]:
        """更新文档向量（先删除再添加）"""
        try:
            # 先删除旧向量
            await self.delete_document_vectors(document_id)

            # 添加新向量
            return await self.add_document_vectors(
                document_id, chunks, embeddings, metadata
            )

        except Exception as e:
            logger.error(f"更新向量失败: {str(e)}")
            raise

    async def get_document_chunks(
        self,
        document_id: int,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """获取文档的所有分块"""
        try:
            if not self.client:
                await self.connect()

            # 构建过滤器
            search_filter = Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id)
                    )
                ]
            )

            # 搜索（使用全零向量获取所有点）
            dummy_vector = np.zeros(self.vector_size)

            search_result = self.client.search(
                collection_name=self.collection_name,
                query_vector=dummy_vector.tolist(),
                query_filter=search_filter,
                limit=limit or 1000,
                with_payload=True
            )

            # 按chunk_index排序
            results = []
            for scored_point in search_result:
                chunk_data = scored_point.payload
                chunk_data['score'] = scored_point.score
                results.append(chunk_data)

            results.sort(key=lambda x: x.get('chunk_index', 0))
            return results

        except Exception as e:
            logger.error(f"获取文档分块失败: {str(e)}")
            return []

    async def recommend_similar_documents(
        self,
        positive_document_ids: List[int],
        negative_document_ids: Optional[List[int]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        基于文档ID推荐相似文档

        Args:
            positive_document_ids: 正例文档ID列表
            negative_document_ids: 负例文档ID列表（可选）
            limit: 返回结果数量

        Returns:
            推荐文档列表
        """
        try:
            if not self.client:
                await self.connect()

            # 获取正例文档的向量
            positive_vectors = []
            for doc_id in positive_document_ids:
                chunks = await self.get_document_chunks(doc_id, limit=1)
                if chunks:
                    # 这里简化处理，实际应该获取文档的代表性向量
                    chunk_content = chunks[0].get('content', '')
                    # 需要重新编码获取向量，这里简化处理
                    pass

            # 这里简化实现，实际应该基于向量做推荐
            # 暂时返回相似文档ID
            results = []
            for doc_id in positive_document_ids:
                similar_chunks = await self.get_document_chunks(doc_id)
                if similar_chunks:
                    results.append({
                        'document_id': doc_id,
                        'chunks_count': len(similar_chunks),
                        'relevance_score': 1.0
                    })

            return results[:limit]

        except Exception as e:
            logger.error(f"文档推荐失败: {str(e)}")
            return []

    async def get_collection_info(self) -> Dict[str, Any]:
        """获取集合信息"""
        try:
            if not self.client:
                await self.connect()

            collection_info = self.client.get_collection(self.collection_name)

            return {
                'name': self.collection_name,
                'vectors_count': collection_info.points_count,
                'vectors_size': collection_info.config.params.vectors.size,
                'distance': collection_info.config.params.distance.name,
                'status': collection_info.status
            }

        except Exception as e:
            logger.error(f"获取集合信息失败: {str(e)}")
            return {}

    async def health_check(self) -> bool:
        """健康检查"""
        try:
            if not self.client:
                return await self.connect()

            # 尝试获取集合信息
            await self.get_collection_info()
            return True

        except Exception as e:
            logger.error(f"向量数据库健康检查失败: {str(e)}")
            return False


# 全局向量服务实例
vector_service = VectorService()