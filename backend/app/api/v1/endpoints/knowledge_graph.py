"""
知识图谱API端点
"""
import time
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.knowledge import (
    KnowledgeNode, KnowledgeNodeSummary, KnowledgeRelation, KnowledgeRelationSummary,
    EntityCreate, RelationCreate, EntityExtractionRequest, RelationExtractionRequest,
    DocumentProcessingRequest, DocumentProcessingResult, GraphQueryRequest,
    GraphQueryResult, KnowledgeStatistics, GraphVisualizationData
)
from app.services.knowledge_graph_service import knowledge_graph_service
from app.core.logging import logger

router = APIRouter()


@router.post("/entities", response_model=KnowledgeNode)
async def create_knowledge_entity(
    entity_data: EntityCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    创建知识实体节点

    支持多种实体类型：人物、组织、地点、项目、技术、材料、设备、成本等
    """
    try:
        node = await knowledge_graph_service.create_knowledge_node(
            entity_data=entity_data,
            user_id=current_user.id,
            db=db
        )
        return node

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"创建知识实体API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="创建知识实体失败")


@router.post("/relations", response_model=KnowledgeRelation)
async def create_knowledge_relation(
    relation_data: RelationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    创建知识关系

    支持多种关系类型：属于、包含、位于、使用、管理等
    """
    try:
        relation = await knowledge_graph_service.create_knowledge_relation(
            relation_data=relation_data,
            user_id=current_user.id,
            db=db
        )
        return relation

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"创建知识关系API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="创建知识关系失败")


@router.post("/extract/entities", response_model=List[Dict[str, Any]])
async def extract_entities(
    extraction_request: EntityExtractionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    从文本中提取实体

    支持多种提取方法：基于规则、结巴分词、混合方法
    """
    try:
        start_time = time.time()
        entities = await knowledge_graph_service.extract_entities(
            text=extraction_request.text,
            extraction_method=extraction_request.method.value
        )

        # 过滤结果
        filtered_entities = []
        for entity in entities:
            if entity['confidence'] >= extraction_request.min_confidence:
                if not extraction_request.entity_types or \
                   entity['type'] in [et.value for et in extraction_request.entity_types]:
                    filtered_entities.append(entity)

        # 限制数量
        filtered_entities = filtered_entities[:extraction_request.max_entities]

        processing_time = time.time() - start_time
        logger.info(f"实体提取完成，耗时: {processing_time:.2f}秒，提取 {len(filtered_entities)} 个实体")

        return filtered_entities

    except Exception as e:
        logger.error(f"实体提取API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="实体提取失败")


@router.post("/extract/relations", response_model=List[Dict[str, Any]])
async def extract_relations(
    extraction_request: RelationExtractionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    从文本和实体中提取关系

    基于规则和共现方法提取实体间的关系
    """
    try:
        start_time = time.time()
        relations = await knowledge_graph_service.extract_relations(
            text=extraction_request.text,
            entities=extraction_request.entities
        )

        # 过滤结果
        filtered_relations = []
        for relation in relations:
            if relation['confidence'] >= extraction_request.min_confidence:
                if not extraction_request.relation_types or \
                   relation['type'] in [rt.value for rt in extraction_request.relation_types]:
                    filtered_relations.append(relation)

        # 限制数量
        filtered_relations = filtered_relations[:extraction_request.max_relations]

        processing_time = time.time() - start_time
        logger.info(f"关系提取完成，耗时: {processing_time:.2f}秒，提取 {len(filtered_relations)} 个关系")

        return filtered_relations

    except Exception as e:
        logger.error(f"关系提取API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="关系提取失败")


@router.post("/process-document", response_model=DocumentProcessingResult)
async def process_document_knowledge(
    processing_request: DocumentProcessingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    处理文档，提取知识并构建图谱

    自动从文档分块中提取实体和关系，构建知识图谱
    """
    try:
        start_time = time.time()
        result = await knowledge_graph_service.process_document_knowledge(
            document_id=processing_request.document_id,
            user_id=current_user.id,
            db=db
        )

        processing_time = time.time() - start_time
        logger.info(f"文档知识处理完成，耗时: {processing_time:.2f}秒")

        return DocumentProcessingResult(
            document_id=result['document_id'],
            chunks_processed=result['chunks_processed'],
            entities_extracted=result['entities_extracted'],
            relations_extracted=result['relations_extracted'],
            nodes_created=result['nodes_created'],
            edges_created=result['edges_created'],
            processing_time=f"{processing_time:.2f}秒"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"文档知识处理API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="文档知识处理失败")


@router.post("/query", response_model=GraphQueryResult)
async def query_knowledge_graph(
    query_request: GraphQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    查询知识图谱

    支持多种查询类型：节点搜索、关系搜索、路径搜索、Cypher查询
    """
    try:
        start_time = time.time()
        result = await knowledge_graph_service.query_knowledge_graph(
            query_request=query_request,
            user_id=current_user.id,
            db=db
        )

        execution_time = time.time() - start_time
        logger.info(f"知识图谱查询完成，耗时: {execution_time:.2f}秒")

        return GraphQueryResult(
            query_type=query_request.query_type,
            total=result.get('total', 0),
            nodes=result.get('nodes'),
            relations=result.get('relations'),
            paths=result.get('paths'),
            records=result.get('records'),
            execution_time=execution_time
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"知识图谱查询API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="知识图谱查询失败")


@router.get("/nodes", response_model=List[KnowledgeNodeSummary])
async def get_knowledge_nodes(
    node_type: Optional[str] = Query(None, description="节点类型过滤"),
    search_term: Optional[str] = Query(None, description="搜索关键词"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="最小置信度"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取知识节点列表"""
    try:
        query_request = GraphQueryRequest(
            query_type="node_search",
            node_type=node_type,
            search_term=search_term,
            min_confidence=min_confidence,
            limit=limit
        )

        result = await knowledge_graph_service.query_knowledge_graph(
            query_request=query_request,
            user_id=current_user.id,
            db=db
        )

        nodes = result.get('nodes', [])
        return [
            KnowledgeNodeSummary(
                id=node['id'],
                name=node['name'],
                type=node['type'],
                confidence=node['confidence'],
                created_at=node['created_at']
            )
            for node in nodes
        ]

    except Exception as e:
        logger.error(f"获取知识节点API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取知识节点失败")


@router.get("/nodes/{node_id}", response_model=KnowledgeNode)
async def get_knowledge_node(
    node_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取知识节点详情"""
    try:
        query_request = GraphQueryRequest(
            query_type="node_search",
            search_term="",  # 将通过ID精确查找
            limit=1
        )

        # 查询特定节点
        from sqlalchemy import select
        from app.models.knowledge import KnowledgeNode

        result = await db.execute(
            select(KnowledgeNode).where(
                and_(
                    KnowledgeNode.id == node_id,
                    KnowledgeNode.user_id == current_user.id
                )
            )
        )
        node = result.scalar_one_or_none()

        if not node:
            raise HTTPException(status_code=404, detail="知识节点不存在")

        return node

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取知识节点详情API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取知识节点详情失败")


@router.get("/relations", response_model=List[KnowledgeRelationSummary])
async def get_knowledge_relations(
    relation_type: Optional[str] = Query(None, description="关系类型过滤"),
    source_node_id: Optional[int] = Query(None, description="源节点ID"),
    target_node_id: Optional[int] = Query(None, description="目标节点ID"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取知识关系列表"""
    try:
        query_request = GraphQueryRequest(
            query_type="relation_search",
            relation_type=relation_type,
            source_node_id=source_node_id,
            target_node_id=target_node_id,
            limit=limit
        )

        result = await knowledge_graph_service.query_knowledge_graph(
            query_request=query_request,
            user_id=current_user.id,
            db=db
        )

        relations = result.get('relations', [])
        return [
            KnowledgeRelationSummary(
                id=relation['id'],
                source_node_id=relation['source_node']['id'],
                target_node_id=relation['target_node']['id'],
                type=relation['type'],
                confidence=relation['confidence'],
                created_at=relation['created_at']
            )
            for relation in relations
        ]

    except Exception as e:
        logger.error(f"获取知识关系API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取知识关系失败")


@router.get("/paths", response_model=GraphQueryResult)
async def find_knowledge_paths(
    source_node_id: int = Query(..., description="源节点ID"),
    target_node_id: int = Query(..., description="目标节点ID"),
    max_length: int = Query(6, ge=1, le=10, description="最大路径长度"),
    limit: int = Query(5, ge=1, le=20, description="返回路径数量"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """查找知识路径"""
    try:
        query_request = GraphQueryRequest(
            query_type="path_search",
            source_node_id=source_node_id,
            target_node_id=target_node_id,
            limit=limit
        )

        result = await knowledge_graph_service.query_knowledge_graph(
            query_request=query_request,
            user_id=current_user.id,
            db=db
        )

        # 过滤路径长度
        if 'paths' in result:
            filtered_paths = [
                path for path in result['paths']
                if path['length'] <= max_length
            ]
            result['paths'] = filtered_paths[:limit]
            result['total'] = len(filtered_paths)

        return GraphQueryResult(
            query_type="path_search",
            total=result.get('total', 0),
            paths=result.get('paths'),
            execution_time=0.0
        )

    except Exception as e:
        logger.error(f"查找知识路径API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="查找知识路径失败")


@router.post("/cypher-query", response_model=GraphQueryResult)
async def execute_cypher_query(
    cypher_query: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """执行Cypher查询"""
    try:
        # 安全检查：确保查询包含必要的过滤条件
        if "user_id" not in cypher_query and "Entity" in cypher_query:
            # 自动添加用户过滤条件以确保数据安全
            cypher_query = cypher_query.replace("MATCH (n:Entity)", "MATCH (n:Entity {user_id: " + str(current_user.id) + "})")

        query_request = GraphQueryRequest(
            query_type="cypher",
            cypher_query=cypher_query
        )

        result = await knowledge_graph_service.query_knowledge_graph(
            query_request=query_request,
            user_id=current_user.id,
            db=db
        )

        return GraphQueryResult(
            query_type="cypher",
            total=result.get('total', 0),
            records=result.get('records'),
            execution_time=0.0
        )

    except Exception as e:
        logger.error(f"执行Cypher查询API错误: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Cypher查询执行失败: {str(e)}")


@router.get("/statistics", response_model=KnowledgeStatistics)
async def get_knowledge_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取知识图谱统计信息"""
    try:
        stats = await knowledge_graph_service.get_knowledge_statistics(
            user_id=current_user.id,
            db=db
        )
        return stats

    except Exception as e:
        logger.error(f"获取知识图谱统计API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取知识图谱统计失败")


@router.get("/visualization", response_model=GraphVisualizationData)
async def get_graph_visualization_data(
    node_type: Optional[str] = Query(None, description="节点类型过滤"),
    max_nodes: int = Query(100, ge=1, le=500, description="最大节点数量"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取图谱可视化数据"""
    try:
        # 获取节点
        node_query_request = GraphQueryRequest(
            query_type="node_search",
            node_type=node_type,
            limit=max_nodes
        )

        node_result = await knowledge_graph_service.query_knowledge_graph(
            query_request=node_query_request,
            user_id=current_user.id,
            db=db
        )

        nodes = node_result.get('nodes', [])
        node_ids = [node['id'] for node in nodes]

        # 获取关系
        relation_query_request = GraphQueryRequest(
            query_type="relation_search",
            limit=max_nodes * 2
        )

        relation_result = await knowledge_graph_service.query_knowledge_graph(
            query_request=relation_query_request,
            user_id=current_user.id,
            db=db
        )

        relations = relation_result.get('relations', [])

        # 过滤关系，只包含查询到的节点之间的关系
        filtered_relations = []
        for relation in relations:
            if (relation['source_node']['id'] in node_ids and
                relation['target_node']['id'] in node_ids):
                filtered_relations.append(relation)

        # 构建可视化数据
        viz_nodes = []
        for node in nodes:
            viz_nodes.append({
                'id': str(node['id']),
                'label': node['name'],
                'type': node['type'],
                'properties': {
                    'confidence': node['confidence'],
                    'created_at': node['created_at']
                },
                'size': 10 + (node['confidence'] * 10),  # 基于置信度调整节点大小
                'color': _get_node_color(node['type'])
            })

        viz_edges = []
        for relation in filtered_relations:
            viz_edges.append({
                'id': str(relation['id']),
                'source': str(relation['source_node']['id']),
                'target': str(relation['target_node']['id']),
                'label': relation['type'],
                'properties': {
                    'confidence': relation['confidence'],
                    'context': relation['context']
                },
                'width': 1 + (relation['confidence'] * 2),  # 基于置信度调整边宽度
                'color': _get_edge_color(relation['type'])
            })

        return GraphVisualizationData(
            nodes=viz_nodes,
            edges=viz_edges,
            layout="force",
            metadata={
                'total_nodes': len(viz_nodes),
                'total_edges': len(viz_edges),
                'node_types': list(set(node['type'] for node in viz_nodes)),
                'relation_types': list(set(edge['label'] for edge in viz_edges)),
                'generated_at': datetime.utcnow().isoformat()
            }
        )

    except Exception as e:
        logger.error(f"获取图谱可视化数据API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取图谱可视化数据失败")


@router.get("/entity-types")
async def get_entity_types():
    """获取支持的实体类型列表"""
    try:
        from app.schemas.knowledge import EntityType

        types = [
            {
                "value": entity_type.value,
                "label": entity_type.value.replace("_", " ").title(),
                "description": get_entity_type_description(entity_type)
            }
            for entity_type in EntityType
        ]

        return {
            "entity_types": types
        }

    except Exception as e:
        logger.error(f"获取实体类型API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取实体类型失败")


@router.get("/relation-types")
async def get_relation_types():
    """获取支持的关系类型列表"""
    try:
        from app.schemas.knowledge import RelationType

        types = [
            {
                "value": relation_type.value,
                "label": relation_type.value.replace("_", " ").title(),
                "description": get_relation_type_description(relation_type)
            }
            for relation_type in RelationType
        ]

        return {
            "relation_types": types
        }

    except Exception as e:
        logger.error(f"获取关系类型API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取关系类型失败")


@router.get("/extraction-methods")
async def get_extraction_methods():
    """获取支持的提取方法列表"""
    try:
        from app.schemas.knowledge import ExtractionMethod

        methods = [
            {
                "value": method.value,
                "label": method.value.replace("_", " ").title(),
                "description": get_extraction_method_description(method)
            }
            for method in ExtractionMethod
        ]

        return {
            "extraction_methods": methods
        }

    except Exception as e:
        logger.error(f"获取提取方法API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取提取方法失败")


# 辅助函数
def _get_node_color(node_type: str) -> str:
    """根据节点类型返回颜色"""
    color_map = {
        "person": "#FF6B6B",
        "organization": "#4ECDC4",
        "location": "#45B7D1",
        "project": "#96CEB4",
        "technology": "#FFEAA7",
        "material": "#DDA0DD",
        "equipment": "#98D8C8",
        "cost": "#FFB6C1",
        "time": "#87CEEB",
        "standard": "#F0E68C",
        "metric": "#D3D3D3",
        "product": "#FFA07A",
        "process": "#20B2AA",
        "document": "#9370DB",
        "regulation": "#CD5C5C",
        "generic": "#808080"
    }
    return color_map.get(node_type, "#808080")


def _get_edge_color(relation_type: str) -> str:
    """根据关系类型返回颜色"""
    color_map = {
        "belong_to": "#FF69B4",
        "contain": "#32CD32",
        "located_in": "#1E90FF",
        "work_for": "#FF8C00",
        "employ": "#FF4500",
        "own": "#9370DB",
        "owned_by": "#BA55D3",
        "use": "#20B2AA",
        "used_in": "#48D1CC",
        "implement": "#FF1493",
        "implement_in": "#FF69B4",
        "produce": "#228B22",
        "produced_by": "#32CD32",
        "require": "#FF6347",
        "required_by": "#FF7F50",
        "manage": "#4682B4",
        "managed_by": "#5F9EA0",
        "collaborate": "#FFD700",
        "connect": "#9ACD32",
        "cost_of": "#DC143C",
        "have_cost": "#B22222",
        "before": "#4169E1",
        "after": "#6495ED",
        "related_to": "#808080"
    }
    return color_map.get(relation_type, "#808080")


def get_entity_type_description(entity_type):
    """获取实体类型描述"""
    descriptions = {
        "person": "人物实体，如人员姓名、职位等",
        "organization": "组织机构实体，如公司、部门、团体等",
        "location": "地点实体，如国家、城市、地址等",
        "project": "项目实体，如工程项目、研究项目等",
        "technology": "技术实体，如编程语言、框架、工具等",
        "material": "材料实体，如建筑材料、原材料等",
        "equipment": "设备实体，如机器设备、工具等",
        "cost": "成本实体，如预算、费用、价格等",
        "time": "时间实体，如日期、时间段等",
        "standard": "标准实体，如国家标准、行业标准等",
        "metric": "指标实体，如度量单位、数量等",
        "product": "产品实体，如成品、商品等",
        "process": "流程实体，如工作流程、工艺流程等",
        "document": "文档实体，如报告、规范、合同等",
        "regulation": "法规实体，如法律、法规、政策等",
        "generic": "通用实体，无法归入特定类别的实体"
    }
    return descriptions.get(entity_type.value, "未知实体类型")


def get_relation_type_description(relation_type):
    """获取关系类型描述"""
    descriptions = {
        "belong_to": "属于关系，表示从属关系",
        "contain": "包含关系，表示包含关系",
        "located_in": "位于关系，表示位置关系",
        "work_for": "工作关系，表示雇佣关系",
        "employ": "雇佣关系，表示用人单位",
        "own": "拥有关系，表示所有权",
        "owned_by": "被拥有关系，表示归属关系",
        "use": "使用关系，表示使用关系",
        "used_in": "被使用关系，表示应用场景",
        "implement": "实施关系，表示执行实现",
        "implement_in": "在...中实施，表示实施场景",
        "produce": "生产关系，表示制造产出",
        "produced_by": "被生产关系，表示来源",
        "require": "需要关系，表示依赖关系",
        "required_by": "被需要关系，表示被依赖",
        "manage": "管理关系，表示管理控制",
        "managed_by": "被管理关系，表示被管理",
        "collaborate": "合作关系，表示协作关系",
        "connect": "连接关系，表示关联关系",
        "cost_of": "成本关系，表示成本归属",
        "have_cost": "有成本关系，表示成本属性",
        "before": "时序关系，表示先后顺序",
        "after": "时序关系，表示先后顺序",
        "related_to": "相关关系，表示关联关系"
    }
    return descriptions.get(relation_type.value, "未知关系类型")


def get_extraction_method_description(method):
    """获取提取方法描述"""
    descriptions = {
        "rule_based": "基于规则的提取方法，使用预定义的正则表达式模式",
        "jieba": "基于结巴分词的提取方法，使用中文分词和词性标注",
        "hybrid": "混合提取方法，结合规则和统计方法的优势",
        "manual": "手动标注方法，由人工进行实体和关系标注",
        "machine_learning": "机器学习方法，使用传统机器学习算法",
        "deep_learning": "深度学习方法，使用神经网络等深度学习模型"
    }
    return descriptions.get(method.value, "未知提取方法")