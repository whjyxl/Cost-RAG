"""
知识图谱服务模块 - 实体识别、关系抽取和图谱构建
"""
import asyncio
import json
import re
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from neo4j import GraphDatabase
import jieba
import jieba.posseg as pseg
from collections import defaultdict, Counter
import networkx as nx
from py2neo import Graph, Node, Relationship

from app.models.knowledge import KnowledgeNode, KnowledgeRelation, KnowledgePath
from app.models.document import Document, DocumentChunk
from app.schemas.knowledge import (
    EntityCreate, RelationCreate, PathCreate, EntityExtractionRequest,
    RelationExtractionRequest, GraphQueryRequest
)
from app.core.config import settings
from app.core.logging import logger


class KnowledgeGraphService:
    """知识图谱服务类"""

    def __init__(self):
        self.neo4j_driver = None
        self.graph = None
        self.entity_patterns = {
            'organization': r'(?:公司|企业|集团|机构|单位|部门)([\w\u4e00-\u9fa5]+)',
            'person': r'([\u4e00-\u9fa5]{2,4})(?:先生|女士|总经理|总监|工程师|专家)',
            'location': r'([\u4e00-\u9fa5]+(?:省|市|县|区|路|号))',
            'technology': r'(Python|Java|React|Vue|Angular|Spring|Django|Flask)',
            'cost': r'(?:成本|费用|预算|报价)(?:[\d,，、]+)(?:元|万元|千元)',
            'time': r'(\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{1,2}-\d{1,2})',
            'project': r'(?:项目|工程|任务)([\w\u4e00-\u9fa5]+)',
            'material': r'([\w\u4e00-\u9fa5]+(?:材料|设备|工具))',
            'standard': r'(GB|ISO|ASTM|JIS|DIN)(?:-\d+)+',
            'metric': r'([\d,，、]+)(?:mm|cm|m|kg|t|㎡|㎡|ℏ|kWh|MPa)'
        }
        self.relation_patterns = {
            'belong_to': r'(?:属于|隶属|归)',
            'contain': r'(?:包含|含有|包括)',
            'located_in': r'(?:位于|坐落|在)',
            'cost_of': r'(?:成本为|费用是|报价)',
            'implement': r'(?:实施|执行|建设)',
            'use': r'(?:使用|采用|应用)',
            'produce': r'(?:生产|制造|产出)',
            'require': r'(?:需要|要求|依赖)',
            'connect': r'(?:连接|关联|联系)',
            'manage': r'(?:管理|负责|主管)',
            'collaborate': r'(?:合作|协作|配合)',
            'before': r'(?:之前|早于|先于)',
            'after': r'(?:之后|晚于|后于)'
        }

    async def connect_neo4j(self) -> bool:
        """连接到Neo4j数据库"""
        try:
            self.neo4j_driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )

            # 测试连接
            with self.neo4j_driver.session() as session:
                session.run("RETURN 1")

            # 初始化py2neo图对象
            self.graph = Graph(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )

            logger.info("成功连接到Neo4j数据库")
            return True

        except Exception as e:
            logger.error(f"连接Neo4j失败: {str(e)}")
            return False

    async def disconnect_neo4j(self):
        """断开Neo4j连接"""
        if self.neo4j_driver:
            self.neo4j_driver.close()
            logger.info("Neo4j连接已关闭")

    async def extract_entities(
        self,
        text: str,
        extraction_method: str = "rule_based"
    ) -> List[Dict[str, Any]]:
        """
        从文本中提取实体

        Args:
            text: 输入文本
            extraction_method: 提取方法 (rule_based, jieba, hybrid)

        Returns:
            提取的实体列表
        """
        try:
            entities = []

            if extraction_method == "rule_based":
                entities = await self._extract_entities_by_rules(text)
            elif extraction_method == "jieba":
                entities = await self._extract_entities_by_jieba(text)
            elif extraction_method == "hybrid":
                # 混合方法：先规则提取，再用jieba补充
                rule_entities = await self._extract_entities_by_rules(text)
                jieba_entities = await self._extract_entities_by_jieba(text)
                entities = await self._merge_entities(rule_entities, jieba_entities)

            # 去重和评分
            entities = await self._deduplicate_entities(entities)

            logger.info(f"从文本中提取了 {len(entities)} 个实体")
            return entities

        except Exception as e:
            logger.error(f"实体提取失败: {str(e)}")
            return []

    async def _extract_entities_by_rules(self, text: str) -> List[Dict[str, Any]]:
        """基于规则提取实体"""
        entities = []

        for entity_type, pattern in self.entity_patterns.items():
            matches = re.finditer(pattern, text)
            for match in matches:
                entity = {
                    'text': match.group(1) if match.groups() else match.group(0),
                    'type': entity_type,
                    'start': match.start(),
                    'end': match.end(),
                    'confidence': 0.8,
                    'method': 'rule_based'
                }
                entities.append(entity)

        return entities

    async def _extract_entities_by_jieba(self, text: str) -> List[Dict[str, Any]]:
        """使用jieba提取实体"""
        entities = []

        # 词性标注
        words = pseg.cut(text)

        for word, flag in words:
            # 过滤停用词和短词
            if len(word) < 2 or flag in ['x', 'w', 'u', 'c', 'p']:
                continue

            entity_type = self._map_pos_to_entity_type(flag)
            if entity_type:
                entity = {
                    'text': word,
                    'type': entity_type,
                    'start': text.find(word),
                    'end': text.find(word) + len(word),
                    'confidence': 0.6,
                    'method': 'jieba',
                    'pos': flag
                }
                entities.append(entity)

        return entities

    async def _map_pos_to_entity_type(self, pos_flag: str) -> Optional[str]:
        """将词性映射到实体类型"""
        pos_mapping = {
            'nr': 'person',       # 人名
            'ns': 'location',     # 地名
            'nt': 'organization', # 机构名
            'nz': 'product',      # 其他专名
            'm': 'metric',        # 数词
            't': 'time',          # 时间词
            'eng': 'technology',  # 英文词
            'n': 'generic',       # 普通名词
        }
        return pos_mapping.get(pos_flag)

    async def _merge_entities(
        self,
        rule_entities: List[Dict],
        jieba_entities: List[Dict]
    ) -> List[Dict]:
        """合并不同方法提取的实体"""
        merged = defaultdict(list)

        # 按实体文本分组
        for entity in rule_entities + jieba_entities:
            key = (entity['text'].lower(), entity['type'])
            merged[key].append(entity)

        # 合并重复实体，选择最高置信度
        result = []
        for (text, entity_type), entity_list in merged.items():
            best_entity = max(entity_list, key=lambda x: x['confidence'])

            # 如果有多个方法都提取到了，提高置信度
            if len(entity_list) > 1:
                best_entity['confidence'] = min(0.95, best_entity['confidence'] + 0.1)
                best_entity['method'] = 'hybrid'

            result.append(best_entity)

        return result

    async def _deduplicate_entities(self, entities: List[Dict]) -> List[Dict]:
        """去重实体"""
        seen = set()
        deduplicated = []

        for entity in entities:
            key = (entity['text'].lower(), entity['type'], entity['start'])
            if key not in seen:
                seen.add(key)
                deduplicated.append(entity)

        return deduplicated

    async def extract_relations(
        self,
        text: str,
        entities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        从文本中提取关系

        Args:
            text: 输入文本
            entities: 已识别的实体列表

        Returns:
            提取的关系列表
        """
        try:
            relations = []

            # 基于规则的关系抽取
            rule_relations = await self._extract_relations_by_rules(text, entities)
            relations.extend(rule_relations)

            # 基于共现的关系抽取
            cooccurrence_relations = await self._extract_relations_by_cooccurrence(text, entities)
            relations.extend(cooccurrence_relations)

            # 去重关系
            relations = await self._deduplicate_relations(relations)

            logger.info(f"从文本中提取了 {len(relations)} 个关系")
            return relations

        except Exception as e:
            logger.error(f"关系提取失败: {str(e)}")
            return []

    async def _extract_relations_by_rules(
        self,
        text: str,
        entities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """基于规则提取关系"""
        relations = []

        for relation_type, pattern in self.relation_patterns.items():
            matches = re.finditer(pattern, text)

            for match in matches:
                # 查找关系词附近的关键词
                start_pos = max(0, match.start() - 50)
                end_pos = min(len(text), match.end() + 50)
                context = text[start_pos:end_pos]

                # 在上下文中查找实体
                related_entities = []
                for entity in entities:
                    if start_pos <= entity['start'] <= end_pos:
                        related_entities.append(entity)

                # 如果找到至少两个实体，创建关系
                if len(related_entities) >= 2:
                    relation = {
                        'source': related_entities[0],
                        'target': related_entities[1],
                        'type': relation_type,
                        'confidence': 0.7,
                        'context': context,
                        'method': 'rule_based'
                    }
                    relations.append(relation)

        return relations

    async def _extract_relations_by_cooccurrence(
        self,
        text: str,
        entities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """基于共现提取关系"""
        relations = []

        # 在同一句话中共现的实体
        sentences = re.split(r'[。！？\n]', text)

        for sentence in sentences:
            sentence_entities = []
            for entity in entities:
                if entity['start'] >= text.find(sentence) and \
                   entity['end'] <= text.find(sentence) + len(sentence):
                    sentence_entities.append(entity)

            # 为共现实体的每对创建关系
            for i in range(len(sentence_entities)):
                for j in range(i + 1, len(sentence_entities)):
                    entity1, entity2 = sentence_entities[i], sentence_entities[j]

                    # 根据实体类型推断关系
                    relation_type = self._infer_relation_type(entity1, entity2)

                    relation = {
                        'source': entity1,
                        'target': entity2,
                        'type': relation_type,
                        'confidence': 0.5,
                        'context': sentence,
                        'method': 'cooccurrence'
                    }
                    relations.append(relation)

        return relations

    async def _infer_relation_type(self, entity1: Dict, entity2: Dict) -> str:
        """根据实体类型推断关系类型"""
        type1, type2 = entity1['type'], entity2['type']

        # 定义实体类型之间的关系映射
        relation_map = {
            ('person', 'organization'): 'work_for',
            ('organization', 'person'): 'employ',
            ('person', 'location'): 'located_in',
            ('organization', 'location'): 'located_in',
            ('project', 'organization'): 'owned_by',
            ('organization', 'project'): 'own',
            ('material', 'project'): 'used_in',
            ('project', 'material'): 'use',
            ('technology', 'project'): 'implement_in',
            ('project', 'technology'): 'implement',
            ('cost', 'project'): 'cost_of',
            ('project', 'cost'): 'have_cost',
        }

        return relation_map.get((type1, type2), 'related_to')

    async def _deduplicate_relations(self, relations: List[Dict]) -> List[Dict]:
        """去重关系"""
        seen = set()
        deduplicated = []

        for relation in relations:
            # 创建关系的唯一标识
            source_text = relation['source']['text'].lower()
            target_text = relation['target']['text'].lower()
            relation_type = relation['type']

            key = (source_text, target_text, relation_type)
            reverse_key = (target_text, source_text, relation_type)

            if key not in seen and reverse_key not in seen:
                seen.add(key)
                deduplicated.append(relation)

        return deduplicated

    async def create_knowledge_node(
        self,
        entity_data: EntityCreate,
        user_id: int,
        db: AsyncSession
    ) -> KnowledgeNode:
        """
        创建知识节点

        Args:
            entity_data: 实体数据
            user_id: 用户ID
            db: 数据库会话

        Returns:
            创建的知识节点
        """
        try:
            # 检查节点是否已存在
            existing = await db.execute(
                select(KnowledgeNode).where(
                    and_(
                        KnowledgeNode.name == entity_data.name,
                        KnowledgeNode.type == entity_data.type,
                        KnowledgeNode.user_id == user_id
                    )
                )
            )
            existing_node = existing.scalar_one_or_none()

            if existing_node:
                return existing_node

            # 创建新节点
            node = KnowledgeNode(
                user_id=user_id,
                name=entity_data.name,
                type=entity_data.type,
                properties=entity_data.properties or {},
                confidence=entity_data.confidence,
                source=entity_data.source,
                metadata=entity_data.metadata or {}
            )

            db.add(node)
            await db.commit()
            await db.refresh(node)

            # 在Neo4j中创建节点
            await self._create_neo4j_node(node)

            logger.info(f"创建知识节点: {node.name} ({node.type})")
            return node

        except Exception as e:
            logger.error(f"创建知识节点失败: {str(e)}")
            await db.rollback()
            raise

    async def _create_neo4j_node(self, node: KnowledgeNode):
        """在Neo4j中创建节点"""
        try:
            if not self.neo4j_driver:
                await self.connect_neo4j()

            with self.neo4j_driver.session() as session:
                query = """
                CREATE (n:Entity {
                    id: $id,
                    name: $name,
                    type: $type,
                    properties: $properties,
                    confidence: $confidence,
                    source: $source,
                    user_id: $user_id,
                    created_at: $created_at
                })
                """

                session.run(query, {
                    'id': node.id,
                    'name': node.name,
                    'type': node.type,
                    'properties': json.dumps(node.properties),
                    'confidence': node.confidence,
                    'source': node.source,
                    'user_id': node.user_id,
                    'created_at': node.created_at.isoformat()
                })

        except Exception as e:
            logger.error(f"在Neo4j中创建节点失败: {str(e)}")

    async def create_knowledge_relation(
        self,
        relation_data: RelationCreate,
        user_id: int,
        db: AsyncSession
    ) -> KnowledgeRelation:
        """
        创建知识关系

        Args:
            relation_data: 关系数据
            user_id: 用户ID
            db: 数据库会话

        Returns:
            创建的知识关系
        """
        try:
            # 检查源节点和目标节点是否存在
            source_result = await db.execute(
                select(KnowledgeNode).where(
                    and_(
                        KnowledgeNode.id == relation_data.source_node_id,
                        KnowledgeNode.user_id == user_id
                    )
                )
            )
            source_node = source_result.scalar_one_or_none()

            target_result = await db.execute(
                select(KnowledgeNode).where(
                    and_(
                        KnowledgeNode.id == relation_data.target_node_id,
                        KnowledgeNode.user_id == user_id
                    )
                )
            )
            target_node = target_result.scalar_one_or_none()

            if not source_node or not target_node:
                raise ValueError("源节点或目标节点不存在")

            # 检查关系是否已存在
            existing = await db.execute(
                select(KnowledgeRelation).where(
                    and_(
                        KnowledgeRelation.source_node_id == relation_data.source_node_id,
                        KnowledgeRelation.target_node_id == relation_data.target_node_id,
                        KnowledgeRelation.type == relation_data.type,
                        KnowledgeRelation.user_id == user_id
                    )
                )
            )
            existing_relation = existing.scalar_one_or_none()

            if existing_relation:
                return existing_relation

            # 创建新关系
            relation = KnowledgeRelation(
                user_id=user_id,
                source_node_id=relation_data.source_node_id,
                target_node_id=relation_data.target_node_id,
                type=relation_data.type,
                properties=relation_data.properties or {},
                confidence=relation_data.confidence,
                source=relation_data.source,
                context=relation_data.context,
                metadata=relation_data.metadata or {}
            )

            db.add(relation)
            await db.commit()
            await db.refresh(relation)

            # 在Neo4j中创建关系
            await self._create_neo4j_relation(relation, source_node, target_node)

            logger.info(f"创建知识关系: {source_node.name} -> {target_node.name} ({relation.type})")
            return relation

        except Exception as e:
            logger.error(f"创建知识关系失败: {str(e)}")
            await db.rollback()
            raise

    async def _create_neo4j_relation(
        self,
        relation: KnowledgeRelation,
        source_node: KnowledgeNode,
        target_node: KnowledgeNode
    ):
        """在Neo4j中创建关系"""
        try:
            if not self.neo4j_driver:
                await self.connect_neo4j()

            with self.neo4j_driver.session() as session:
                query = """
                MATCH (source:Entity {id: $source_id}), (target:Entity {id: $target_id})
                CREATE (source)-[r:RELATION {
                    id: $id,
                    type: $type,
                    properties: $properties,
                    confidence: $confidence,
                    source: $source,
                    context: $context,
                    user_id: $user_id,
                    created_at: $created_at
                }]->(target)
                """

                session.run(query, {
                    'source_id': source_node.id,
                    'target_id': target_node.id,
                    'id': relation.id,
                    'type': relation.type,
                    'properties': json.dumps(relation.properties),
                    'confidence': relation.confidence,
                    'source': relation.source,
                    'context': relation.context,
                    'user_id': relation.user_id,
                    'created_at': relation.created_at.isoformat()
                })

        except Exception as e:
            logger.error(f"在Neo4j中创建关系失败: {str(e)}")

    async def process_document_knowledge(
        self,
        document_id: int,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        处理文档，提取知识并构建图谱

        Args:
            document_id: 文档ID
            user_id: 用户ID
            db: 数据库会话

        Returns:
            处理结果统计
        """
        try:
            # 获取文档内容
            document_result = await db.execute(
                select(Document).where(
                    and_(
                        Document.id == document_id,
                        Document.user_id == user_id
                    )
                )
            )
            document = document_result.scalar_one_or_none()

            if not document:
                raise ValueError("文档不存在")

            # 获取文档分块
            chunks_result = await db.execute(
                select(DocumentChunk).where(DocumentChunk.document_id == document_id)
            )
            chunks = chunks_result.scalars().all()

            if not chunks:
                raise ValueError("文档没有分块内容")

            # 统计结果
            total_entities = 0
            total_relations = 0
            total_nodes = 0
            total_edges = 0

            # 处理每个分块
            for chunk in chunks:
                # 提取实体
                entities = await self.extract_entities(chunk.content)

                # 提取关系
                relations = await self.extract_relations(chunk.content, entities)

                # 创建知识节点
                created_nodes = []
                for entity_data in entities:
                    entity_create = EntityCreate(
                        name=entity_data['text'],
                        type=entity_data['type'],
                        properties={'method': entity_data['method']},
                        confidence=entity_data['confidence'],
                        source=f"document_{document_id}_chunk_{chunk.id}"
                    )

                    try:
                        node = await self.create_knowledge_node(entity_create, user_id, db)
                        created_nodes.append(node)
                        total_nodes += 1
                    except Exception as e:
                        logger.warning(f"创建节点失败: {str(e)}")

                # 创建知识关系
                for relation_data in relations:
                    # 查找对应的节点
                    source_node = next((n for n in created_nodes
                                       if n.name == relation_data['source']['text']), None)
                    target_node = next((n for n in created_nodes
                                       if n.name == relation_data['target']['text']), None)

                    if source_node and target_node:
                        relation_create = RelationCreate(
                            source_node_id=source_node.id,
                            target_node_id=target_node.id,
                            type=relation_data['type'],
                            properties={'method': relation_data['method']},
                            confidence=relation_data['confidence'],
                            source=f"document_{document_id}_chunk_{chunk.id}",
                            context=relation_data.get('context', '')
                        )

                        try:
                            await self.create_knowledge_relation(relation_create, user_id, db)
                            total_edges += 1
                        except Exception as e:
                            logger.warning(f"创建关系失败: {str(e)}")

                total_entities += len(entities)
                total_relations += len(relations)

            result = {
                'document_id': document_id,
                'chunks_processed': len(chunks),
                'entities_extracted': total_entities,
                'relations_extracted': total_relations,
                'nodes_created': total_nodes,
                'edges_created': total_edges,
                'processing_time': datetime.utcnow().isoformat()
            }

            logger.info(f"文档 {document_id} 知识处理完成: {result}")
            return result

        except Exception as e:
            logger.error(f"处理文档知识失败: {str(e)}")
            raise

    async def query_knowledge_graph(
        self,
        query_request: GraphQueryRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        查询知识图谱

        Args:
            query_request: 查询请求
            user_id: 用户ID
            db: 数据库会话

        Returns:
            查询结果
        """
        try:
            if query_request.query_type == "node_search":
                return await self._search_nodes(query_request, user_id, db)
            elif query_request.query_type == "relation_search":
                return await self._search_relations(query_request, user_id, db)
            elif query_request.query_type == "path_search":
                return await self._search_paths(query_request, user_id, db)
            elif query_request.query_type == "cypher":
                return await self._execute_cypher_query(query_request, user_id)
            else:
                raise ValueError(f"不支持的查询类型: {query_request.query_type}")

        except Exception as e:
            logger.error(f"查询知识图谱失败: {str(e)}")
            raise

    async def _search_nodes(
        self,
        query_request: GraphQueryRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """搜索节点"""
        query = select(KnowledgeNode).where(KnowledgeNode.user_id == user_id)

        # 添加过滤条件
        if query_request.node_type:
            query = query.where(KnowledgeNode.type == query_request.node_type)

        if query_request.search_term:
            search_pattern = f"%{query_request.search_term}%"
            query = query.where(KnowledgeNode.name.ilike(search_pattern))

        if query_request.min_confidence:
            query = query.where(KnowledgeNode.confidence >= query_request.min_confidence)

        # 执行查询
        result = await db.execute(query)
        nodes = result.scalars().all()

        return {
            'nodes': [
                {
                    'id': node.id,
                    'name': node.name,
                    'type': node.type,
                    'properties': node.properties,
                    'confidence': node.confidence,
                    'source': node.source,
                    'created_at': node.created_at
                }
                for node in nodes
            ],
            'total': len(nodes)
        }

    async def _search_relations(
        self,
        query_request: GraphQueryRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """搜索关系"""
        query = select(KnowledgeRelation).where(KnowledgeRelation.user_id == user_id)

        # 添加过滤条件
        if query_request.relation_type:
            query = query.where(KnowledgeRelation.type == query_request.relation_type)

        if query_request.source_node_id:
            query = query.where(KnowledgeRelation.source_node_id == query_request.source_node_id)

        if query_request.target_node_id:
            query = query.where(KnowledgeRelation.target_node_id == query_request.target_node_id)

        # 执行查询
        result = await db.execute(query)
        relations = result.scalars().all()

        # 获取关联的节点信息
        node_ids = set()
        for relation in relations:
            node_ids.add(relation.source_node_id)
            node_ids.add(relation.target_node_id)

        nodes_result = await db.execute(
            select(KnowledgeNode).where(
                and_(
                    KnowledgeNode.id.in_(node_ids),
                    KnowledgeNode.user_id == user_id
                )
            )
        )
        nodes = {node.id: node for node in nodes_result.scalars().all()}

        return {
            'relations': [
                {
                    'id': relation.id,
                    'source_node': {
                        'id': nodes[relation.source_node_id].id,
                        'name': nodes[relation.source_node_id].name,
                        'type': nodes[relation.source_node_id].type
                    },
                    'target_node': {
                        'id': nodes[relation.target_node_id].id,
                        'name': nodes[relation.target_node_id].name,
                        'type': nodes[relation.target_node_id].type
                    },
                    'type': relation.type,
                    'properties': relation.properties,
                    'confidence': relation.confidence,
                    'context': relation.context,
                    'created_at': relation.created_at
                }
                for relation in relations if relation.source_node_id in nodes and relation.target_node_id in nodes
            ],
            'total': len(relations)
        }

    async def _search_paths(
        self,
        query_request: GraphQueryRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """搜索路径"""
        if not query_request.source_node_id or not query_request.target_node_id:
            raise ValueError("路径搜索需要指定源节点和目标节点")

        try:
            if not self.neo4j_driver:
                await self.connect_neo4j()

            with self.neo4j_driver.session() as session:
                # 使用Neo4j图算法查找最短路径
                cypher_query = """
                MATCH (start:Entity {id: $source_id, user_id: $user_id}),
                      (end:Entity {id: $target_id, user_id: $user_id})
                MATCH path = shortestPath((start)-[*1..6]-(end))
                RETURN path, length(path) as path_length
                ORDER BY path_length
                LIMIT $limit
                """

                result = session.run(cypher_query, {
                    'source_id': query_request.source_node_id,
                    'target_id': query_request.target_node_id,
                    'user_id': user_id,
                    'limit': query_request.limit or 10
                })

                paths = []
                for record in result:
                    path = record['path']
                    path_length = record['path_length']

                    # 提取路径中的节点和关系
                    nodes = []
                    relations = []

                    for node in path.nodes:
                        nodes.append({
                            'id': node['id'],
                            'name': node['name'],
                            'type': node['type']
                        })

                    for rel in path.relationships:
                        relations.append({
                            'type': rel['type'],
                            'properties': json.loads(rel.get('properties', '{}')),
                            'confidence': rel['confidence']
                        })

                    paths.append({
                        'nodes': nodes,
                        'relations': relations,
                        'length': path_length
                    })

                return {
                    'paths': paths,
                    'total': len(paths)
                }

        except Exception as e:
            logger.error(f"搜索路径失败: {str(e)}")
            return {'paths': [], 'total': 0}

    async def _execute_cypher_query(
        self,
        query_request: GraphQueryRequest,
        user_id: int
    ) -> Dict[str, Any]:
        """执行Cypher查询"""
        try:
            if not self.neo4j_driver:
                await self.connect_neo4j()

            with self.neo4j_driver.session() as session:
                # 在查询中添加用户ID过滤，确保数据安全
                modified_query = query_request.cypher_query.replace(
                    "MATCH (",
                    f"MATCH (n:Entity {{user_id: {user_id}}})"
                )

                result = session.run(modified_query)

                records = []
                for record in result:
                    records.append(dict(record))

                return {
                    'records': records,
                    'total': len(records)
                }

        except Exception as e:
            logger.error(f"执行Cypher查询失败: {str(e)}")
            raise

    async def get_knowledge_statistics(
        self,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """获取知识图谱统计信息"""
        try:
            # 节点统计
            node_count_query = select(func.count(KnowledgeNode.id)).where(
                KnowledgeNode.user_id == user_id
            )
            node_count_result = await db.execute(node_count_query)
            total_nodes = node_count_result.scalar() or 0

            # 关系统计
            relation_count_query = select(func.count(KnowledgeRelation.id)).where(
                KnowledgeRelation.user_id == user_id
            )
            relation_count_result = await db.execute(relation_count_query)
            total_relations = relation_count_result.scalar() or 0

            # 按类型统计节点
            node_type_query = select(
                KnowledgeNode.type,
                func.count().label('count')
            ).where(
                KnowledgeNode.user_id == user_id
            ).group_by(KnowledgeNode.type)

            node_type_result = await db.execute(node_type_query)
            node_types = {row.type: row.count for row in node_type_result}

            # 按类型统计关系
            relation_type_query = select(
                KnowledgeRelation.type,
                func.count().label('count')
            ).where(
                KnowledgeRelation.user_id == user_id
            ).group_by(KnowledgeRelation.type)

            relation_type_result = await db.execute(relation_type_query)
            relation_types = {row.type: row.count for row in relation_type_result}

            return {
                'total_nodes': total_nodes,
                'total_relations': total_relations,
                'node_types': node_types,
                'relation_types': relation_types,
                'graph_density': (2 * total_relations) / (total_nodes * (total_nodes - 1)) if total_nodes > 1 else 0,
                'updated_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"获取知识图谱统计失败: {str(e)}")
            return {
                'total_nodes': 0,
                'total_relations': 0,
                'node_types': {},
                'relation_types': {}
            }


# 全局知识图谱服务实例
knowledge_graph_service = KnowledgeGraphService()