"""
知识图谱批量删除API端点
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, or_
from pydantic import BaseModel, Field

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.knowledge import KnowledgeNode, KnowledgeRelation
from app.models.domain import NodeDomainMapping
from app.services.knowledge_graph_service import knowledge_graph_service
from app.core.logging import logger

router = APIRouter()


class BatchDeleteRequest(BaseModel):
    """批量删除请求"""
    # 删除方式（互斥）
    node_ids: Optional[List[int]] = Field(None, description="要删除的节点ID列表")
    node_types: Optional[List[str]] = Field(None, description="要删除的节点类型列表")
    name_pattern: Optional[str] = Field(None, description="节点名称模糊匹配（包含关键词）")
    min_quality_score: Optional[float] = Field(None, description="删除低于此质量分数的节点")
    delete_all: bool = Field(False, description="删除所有节点（危险操作）")

    # 其他选项
    cascade_delete_relations: bool = Field(True, description="是否级联删除相关关系")
    dry_run: bool = Field(False, description="仅预览，不实际删除")


class BatchDeleteResult(BaseModel):
    """批量删除结果"""
    success: bool
    deleted_nodes_count: int
    deleted_relations_count: int
    deleted_node_ids: List[int]
    message: str
    preview_nodes: Optional[List[dict]] = None  # dry_run时返回预览


@router.post("/nodes/batch-delete", response_model=BatchDeleteResult)
async def batch_delete_nodes(
    delete_request: BatchDeleteRequest = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    批量删除知识节点

    支持多种删除方式：
    1. 按节点ID列表删除
    2. 按节点类型批量删除
    3. 按名称模糊匹配删除
    4. 按质量分数删除低质量节点
    5. 删除所有节点（需确认）

    注意：
    - 删除节点会自动删除相关的关系（cascade_delete_relations=True）
    - 建议先使用dry_run=True预览要删除的节点
    - delete_all操作需谨慎使用
    """
    try:
        # 验证删除方式（确保只有一种方式）
        delete_methods = [
            delete_request.node_ids is not None,
            delete_request.node_types is not None,
            delete_request.name_pattern is not None,
            delete_request.min_quality_score is not None,
            delete_request.delete_all
        ]

        if sum(delete_methods) == 0:
            raise HTTPException(
                status_code=400,
                detail="必须指定至少一种删除方式"
            )

        if sum(delete_methods) > 1:
            raise HTTPException(
                status_code=400,
                detail="只能选择一种删除方式"
            )

        # 构建查询条件
        conditions = []

        if delete_request.node_ids:
            conditions.append(KnowledgeNode.id.in_(delete_request.node_ids))

        if delete_request.node_types:
            conditions.append(KnowledgeNode.node_type.in_(delete_request.node_types))

        if delete_request.name_pattern:
            conditions.append(KnowledgeNode.name.like(f"%{delete_request.name_pattern}%"))

        if delete_request.min_quality_score is not None:
            conditions.append(
                or_(
                    KnowledgeNode.quality_score < delete_request.min_quality_score,
                    KnowledgeNode.quality_score.is_(None)
                )
            )

        # 查询要删除的节点
        if delete_request.delete_all:
            query = select(KnowledgeNode)
        else:
            query = select(KnowledgeNode).where(or_(*conditions))

        result = await db.execute(query)
        nodes_to_delete = result.scalars().all()

        if not nodes_to_delete:
            return BatchDeleteResult(
                success=True,
                deleted_nodes_count=0,
                deleted_relations_count=0,
                deleted_node_ids=[],
                message="没有找到符合条件的节点"
            )

        node_ids_to_delete = [node.id for node in nodes_to_delete]

        # Dry run - 仅预览
        if delete_request.dry_run:
            preview_nodes = [
                {
                    "id": node.id,
                    "name": node.name,
                    "type": node.node_type,
                    "quality_score": node.quality_score,
                    "created_at": node.created_at.isoformat() if node.created_at else None
                }
                for node in nodes_to_delete
            ]

            return BatchDeleteResult(
                success=True,
                deleted_nodes_count=len(nodes_to_delete),
                deleted_relations_count=0,
                deleted_node_ids=node_ids_to_delete,
                message=f"预览模式：将删除 {len(nodes_to_delete)} 个节点",
                preview_nodes=preview_nodes
            )

        # 实际删除
        deleted_relations_count = 0

        # 删除相关关系
        if delete_request.cascade_delete_relations:
            # 删除源节点或目标节点在删除列表中的关系
            delete_relations_stmt = delete(KnowledgeRelation).where(
                or_(
                    KnowledgeRelation.source_node_id.in_(node_ids_to_delete),
                    KnowledgeRelation.target_node_id.in_(node_ids_to_delete)
                )
            )

            # 先查询要删除的关系数量
            count_stmt = select(func.count(KnowledgeRelation.id)).where(
                or_(
                    KnowledgeRelation.source_node_id.in_(node_ids_to_delete),
                    KnowledgeRelation.target_node_id.in_(node_ids_to_delete)
                )
            )
            count_result = await db.execute(count_stmt)
            deleted_relations_count = count_result.scalar()

            # 执行删除
            await db.execute(delete_relations_stmt)

        # 删除节点
        delete_nodes_stmt = delete(KnowledgeNode).where(
            KnowledgeNode.id.in_(node_ids_to_delete)
        )
        await db.execute(delete_nodes_stmt)

        await db.commit()

        # 同步删除Neo4j中的节点（最佳努力，失败不影响结果）
        for node_id in node_ids_to_delete:
            try:
                await knowledge_graph_service.delete_node_from_neo4j(node_id)
            except Exception as neo4j_error:
                logger.warning(f"Neo4j节点 {node_id} 删除失败: {neo4j_error}")

        logger.info(
            f"用户 {current_user.id} 批量删除了 {len(nodes_to_delete)} 个节点，"
            f"{deleted_relations_count} 个关系"
        )

        return BatchDeleteResult(
            success=True,
            deleted_nodes_count=len(nodes_to_delete),
            deleted_relations_count=deleted_relations_count,
            deleted_node_ids=node_ids_to_delete,
            message=f"成功删除 {len(nodes_to_delete)} 个节点和 {deleted_relations_count} 个关系"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量删除节点API错误: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"批量删除失败: {str(e)}")


@router.get("/nodes/count")
async def count_nodes_by_criteria(
    node_type: Optional[str] = None,
    name_pattern: Optional[str] = None,
    min_quality_score: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    按条件统计节点数量（用于删除前预览）
    """
    try:
        conditions = []

        if node_type:
            conditions.append(KnowledgeNode.node_type == node_type)

        if name_pattern:
            conditions.append(KnowledgeNode.name.like(f"%{name_pattern}%"))

        if min_quality_score is not None:
            conditions.append(
                or_(
                    KnowledgeNode.quality_score < min_quality_score,
                    KnowledgeNode.quality_score.is_(None)
                )
            )

        if conditions:
            query = select(func.count(KnowledgeNode.id)).where(or_(*conditions))
        else:
            query = select(func.count(KnowledgeNode.id))

        result = await db.execute(query)
        count = result.scalar()

        return {
            "count": count,
            "criteria": {
                "node_type": node_type,
                "name_pattern": name_pattern,
                "min_quality_score": min_quality_score
            }
        }

    except Exception as e:
        logger.error(f"统计节点数量API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="统计节点数量失败")


@router.get("/nodes/types")
async def get_node_type_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取各类型节点的统计信息（用于批量删除前参考）
    """
    try:
        # 按类型统计节点数量
        query = select(
            KnowledgeNode.node_type,
            func.count(KnowledgeNode.id).label('count'),
            func.avg(KnowledgeNode.quality_score).label('avg_quality')
        ).group_by(KnowledgeNode.node_type)

        result = await db.execute(query)
        stats = result.all()

        type_stats = [
            {
                "node_type": row.node_type,
                "count": row.count,
                "avg_quality": float(row.avg_quality) if row.avg_quality else None
            }
            for row in stats
        ]

        # 总节点数
        total_query = select(func.count(KnowledgeNode.id))
        total_result = await db.execute(total_query)
        total_count = total_result.scalar()

        return {
            "total_count": total_count,
            "type_statistics": type_stats
        }

    except Exception as e:
        logger.error(f"获取节点类型统计API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取统计信息失败")


# ========== 一键清空功能 ==========

class ClearAllPreviewResponse(BaseModel):
    """清空前预览响应"""
    total_nodes: int
    total_relations: int
    total_domain_mappings: int
    node_type_distribution: List[dict]
    domain_distribution: List[dict]
    oldest_node_date: Optional[str] = None
    newest_node_date: Optional[str] = None
    warning_message: str


class ClearAllRequest(BaseModel):
    """一键清空请求"""
    confirmation_token: str = Field(..., description="确认令牌（必须为 'CONFIRM_CLEAR_ALL'）")
    clear_domain_mappings: bool = Field(True, description="是否同时清空领域映射数据")
    clear_neo4j: bool = Field(True, description="是否同时清空Neo4j图数据库")


class ClearAllResponse(BaseModel):
    """一键清空响应"""
    success: bool
    deleted_nodes: int
    deleted_relations: int
    deleted_domain_mappings: int
    cleared_neo4j: bool
    duration_seconds: float
    message: str


@router.get("/nodes/clear-preview", response_model=ClearAllPreviewResponse)
async def get_clear_all_preview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取一键清空前的预览信息

    返回将要删除的数据统计，帮助用户确认是否真的要执行清空操作
    """
    try:
        # 1. 统计总节点数
        total_nodes_result = await db.execute(select(func.count(KnowledgeNode.id)))
        total_nodes = total_nodes_result.scalar()

        # 2. 统计总关系数
        total_relations_result = await db.execute(select(func.count(KnowledgeRelation.id)))
        total_relations = total_relations_result.scalar()

        # 3. 统计总领域映射数
        total_mappings_result = await db.execute(select(func.count(NodeDomainMapping.id)))
        total_domain_mappings = total_mappings_result.scalar()

        # 4. 节点类型分布
        type_stats_query = select(
            KnowledgeNode.node_type,
            func.count(KnowledgeNode.id).label('count')
        ).group_by(KnowledgeNode.node_type).order_by(func.count(KnowledgeNode.id).desc())

        type_stats_result = await db.execute(type_stats_query)
        node_type_distribution = [
            {"node_type": row.node_type, "count": row.count}
            for row in type_stats_result.all()
        ]

        # 5. 领域分布
        from app.models.domain import KnowledgeDomain
        domain_stats_query = select(
            KnowledgeDomain.domain_name,
            func.count(NodeDomainMapping.id).label('count')
        ).join(NodeDomainMapping).group_by(KnowledgeDomain.domain_name).order_by(func.count(NodeDomainMapping.id).desc())

        domain_stats_result = await db.execute(domain_stats_query)
        domain_distribution = [
            {"domain_name": row.domain_name, "count": row.count}
            for row in domain_stats_result.all()
        ]

        # 6. 最早和最新节点时间
        oldest_query = select(func.min(KnowledgeNode.created_at))
        oldest_result = await db.execute(oldest_query)
        oldest_date = oldest_result.scalar()

        newest_query = select(func.max(KnowledgeNode.created_at))
        newest_result = await db.execute(newest_query)
        newest_date = newest_result.scalar()

        # 生成警告信息
        warning_message = (
            f"⚠️ 警告：此操作将永久删除所有知识图谱数据！\n"
            f"即将删除：\n"
            f"  • {total_nodes} 个知识节点\n"
            f"  • {total_relations} 个关系\n"
            f"  • {total_domain_mappings} 个领域映射\n"
            f"此操作不可恢复，请谨慎操作！"
        )

        return ClearAllPreviewResponse(
            total_nodes=total_nodes,
            total_relations=total_relations,
            total_domain_mappings=total_domain_mappings,
            node_type_distribution=node_type_distribution,
            domain_distribution=domain_distribution,
            oldest_node_date=oldest_date.isoformat() if oldest_date else None,
            newest_node_date=newest_date.isoformat() if newest_date else None,
            warning_message=warning_message
        )

    except Exception as e:
        logger.error(f"获取清空预览失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取清空预览失败: {str(e)}")


@router.post("/nodes/clear-all", response_model=ClearAllResponse)
async def clear_all_nodes(
    request: ClearAllRequest = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    一键清空所有知识图谱节点（危险操作）

    安全机制：
    1. 必须提供正确的确认令牌 'CONFIRM_CLEAR_ALL'
    2. 记录操作日志
    3. 支持选择是否清空领域映射
    4. 返回详细的删除统计

    使用步骤：
    1. 先调用 GET /nodes/clear-preview 查看预览信息
    2. 确认后调用此接口，传入确认令牌
    """
    import time
    start_time = time.time()

    try:
        # 1. 验证确认令牌
        if request.confirmation_token != "CONFIRM_CLEAR_ALL":
            raise HTTPException(
                status_code=400,
                detail="确认令牌错误！请传入正确的确认令牌 'CONFIRM_CLEAR_ALL'"
            )

        # 2. 记录操作日志
        logger.warning(
            f"⚠️ 用户 {current_user.id} ({current_user.username}) 正在执行一键清空操作！"
        )

        # 3. 统计要删除的数据（用于返回）
        total_nodes_result = await db.execute(select(func.count(KnowledgeNode.id)))
        total_nodes = total_nodes_result.scalar()

        total_relations_result = await db.execute(select(func.count(KnowledgeRelation.id)))
        total_relations = total_relations_result.scalar()

        total_mappings_result = await db.execute(select(func.count(NodeDomainMapping.id)))
        total_domain_mappings = total_mappings_result.scalar()

        if total_nodes == 0:
            return ClearAllResponse(
                success=True,
                deleted_nodes=0,
                deleted_relations=0,
                deleted_domain_mappings=0,
                cleared_neo4j=False,
                duration_seconds=0.0,
                message="知识图谱已经是空的，无需清空"
            )

        # 4. 删除领域映射（如果选择）
        deleted_mappings = 0
        if request.clear_domain_mappings:
            logger.info("删除领域映射数据...")
            await db.execute(delete(NodeDomainMapping))
            deleted_mappings = total_domain_mappings

        # 5. 删除关系（级联删除）
        logger.info("删除知识关系...")
        await db.execute(delete(KnowledgeRelation))

        # 6. 删除节点
        logger.info("删除知识节点...")
        await db.execute(delete(KnowledgeNode))

        # 7. 提交事务
        await db.commit()

        # 8. 清空Neo4j（可选，最佳努力）
        cleared_neo4j = False
        if request.clear_neo4j:
            try:
                logger.info("尝试清空Neo4j图数据库...")
                # 注意：这里需要实现Neo4j的清空逻辑
                # knowledge_graph_service 可能需要添加 clear_all_from_neo4j 方法
                if hasattr(knowledge_graph_service, 'neo4j_driver') and knowledge_graph_service.neo4j_driver:
                    # 这是一个示例，实际实现需要根据Neo4j驱动来调整
                    logger.info("Neo4j清空功能待实现")
                    cleared_neo4j = False
                else:
                    logger.info("Neo4j未连接，跳过清空")
            except Exception as neo4j_error:
                logger.warning(f"Neo4j清空失败（不影响主流程）: {neo4j_error}")

        duration = time.time() - start_time

        # 9. 记录成功日志
        logger.warning(
            f"✅ 一键清空完成！用户: {current_user.username}, "
            f"删除节点: {total_nodes}, 删除关系: {total_relations}, "
            f"删除映射: {deleted_mappings}, 耗时: {duration:.2f}秒"
        )

        return ClearAllResponse(
            success=True,
            deleted_nodes=total_nodes,
            deleted_relations=total_relations,
            deleted_domain_mappings=deleted_mappings,
            cleared_neo4j=cleared_neo4j,
            duration_seconds=round(duration, 2),
            message=f"成功清空知识图谱！删除了 {total_nodes} 个节点、{total_relations} 个关系、{deleted_mappings} 个领域映射"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"一键清空失败: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"一键清空失败: {str(e)}")
