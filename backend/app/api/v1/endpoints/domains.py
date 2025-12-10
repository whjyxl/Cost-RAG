"""
知识领域API端点 - 领域管理和查询
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.domain import KnowledgeDomain
from app.services.domain_service import DomainService
from app.core.logging import logger

router = APIRouter()


@router.get("/", summary="获取所有领域")
async def get_domains(
    include_inactive: bool = Query(False, description="是否包含未启用的领域"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取所有知识领域列表

    Returns:
        List of domains with basic info
    """
    try:
        domain_service = DomainService(db)
        domains = await domain_service.get_all_domains(include_inactive=include_inactive)

        return {
            "success": True,
            "data": [
                {
                    "id": domain.id,
                    "domain_code": domain.domain_code,
                    "domain_name": domain.domain_name,
                    "description": domain.description,
                    "keywords": domain.keywords,
                    "color": domain.color,
                    "icon": domain.icon,
                    "display_order": domain.display_order,
                    "default_weight": domain.default_weight,
                    "is_active": domain.is_active,
                    "is_system": domain.is_system,
                }
                for domain in domains
            ],
            "total": len(domains)
        }

    except Exception as e:
        logger.error(f"获取领域列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取领域列表失败: {str(e)}")


@router.get("/{domain_code}", summary="获取领域详情")
async def get_domain_detail(
    domain_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取指定领域的详细信息"""
    try:
        domain_service = DomainService(db)
        domain = await domain_service.get_domain_by_code(domain_code)

        if not domain:
            raise HTTPException(status_code=404, detail=f"领域 '{domain_code}' 不存在")

        return {
            "success": True,
            "data": {
                "id": domain.id,
                "domain_code": domain.domain_code,
                "domain_name": domain.domain_name,
                "description": domain.description,
                "keywords": domain.keywords,
                "color": domain.color,
                "icon": domain.icon,
                "display_order": domain.display_order,
                "default_weight": domain.default_weight,
                "is_active": domain.is_active,
                "is_system": domain.is_system,
                "created_at": domain.created_at.isoformat() if domain.created_at else None,
                "updated_at": domain.updated_at.isoformat() if domain.updated_at else None,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取领域详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取领域详情失败: {str(e)}")


@router.get("/{domain_code}/nodes", summary="获取领域下的节点")
async def get_domain_nodes(
    domain_code: str,
    limit: int = Query(100, ge=1, le=1000, description="返回节点数量限制"),
    primary_only: bool = Query(False, description="是否只返回主领域节点"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取指定领域下的所有节点"""
    try:
        domain_service = DomainService(db)

        # 验证领域是否存在
        domain = await domain_service.get_domain_by_code(domain_code)
        if not domain:
            raise HTTPException(status_code=404, detail=f"领域 '{domain_code}' 不存在")

        # 获取节点
        nodes = await domain_service.get_nodes_by_domain(
            domain_code=domain_code,
            limit=limit,
            primary_only=primary_only
        )

        return {
            "success": True,
            "data": {
                "domain_code": domain_code,
                "domain_name": domain.domain_name,
                "nodes": [
                    {
                        "id": node.id,
                        "name": node.name,
                        "type": node.node_type,
                        "confidence": node.confidence,
                        "quality_score": node.quality_score,
                    }
                    for node in nodes
                ],
                "total": len(nodes),
                "primary_only": primary_only
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取领域节点失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取领域节点失败: {str(e)}")


@router.post("/infer", summary="推断问题所属领域")
async def infer_question_domains(
    question: str = Query(..., min_length=1, description="用户问题"),
    top_k: int = Query(3, ge=1, le=10, description="返回top K个领域"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    根据问题内容推断所属的知识领域

    Args:
        question: 用户问题
        top_k: 返回top K个相关领域

    Returns:
        推断的领域列表，按相关度降序排列
    """
    try:
        domain_service = DomainService(db)
        inferred_domains = await domain_service.infer_question_domains(
            question=question,
            top_k=top_k
        )

        return {
            "success": True,
            "data": {
                "question": question,
                "inferred_domains": inferred_domains,
                "total": len(inferred_domains)
            }
        }

    except Exception as e:
        logger.error(f"推断问题领域失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"推断问题领域失败: {str(e)}")


@router.get("/statistics/overview", summary="获取领域统计信息")
async def get_domain_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取所有领域的统计信息（节点数量等）"""
    try:
        domain_service = DomainService(db)
        stats = await domain_service.get_domain_statistics()

        return {
            "success": True,
            "data": stats
        }

    except Exception as e:
        logger.error(f"获取领域统计失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取领域统计失败: {str(e)}")


@router.post("/nodes/{node_id}/classify", summary="为节点分类")
async def classify_node(
    node_id: int,
    method: str = Query("rule", description="分类方法: rule/ai/manual"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    为指定节点自动分类并分配领域

    Args:
        node_id: 节点ID
        method: 分类方法

    Returns:
        分类结果
    """
    try:
        from sqlalchemy import select
        from app.models.knowledge import KnowledgeNode

        # 获取节点
        result = await db.execute(
            select(KnowledgeNode).where(KnowledgeNode.id == node_id)
        )
        node = result.scalar_one_or_none()

        if not node:
            raise HTTPException(status_code=404, detail=f"节点 {node_id} 不存在")

        # 分类
        domain_service = DomainService(db)
        domain_assignments = await domain_service.classify_node_by_rules(node)

        if not domain_assignments:
            return {
                "success": False,
                "message": "无法为该节点分类",
                "data": {
                    "node_id": node_id,
                    "node_name": node.name,
                    "assigned_domains": []
                }
            }

        # 分配领域
        count = await domain_service.assign_domains_to_node(
            node_id=node_id,
            domain_assignments=domain_assignments,
            method=method
        )

        # 获取分配结果
        node_domains = await domain_service.get_node_domains(node_id)

        return {
            "success": True,
            "data": {
                "node_id": node_id,
                "node_name": node.name,
                "assigned_domains": node_domains,
                "total_mappings": count
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"节点分类失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"节点分类失败: {str(e)}")


@router.post("/batch-classify", summary="批量分类节点")
async def batch_classify_nodes(
    node_ids: Optional[List[int]] = Query(None, description="节点ID列表，为空表示所有节点"),
    method: str = Query("rule", description="分类方法"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    批量为节点分类（用于数据迁移）

    Args:
        node_ids: 节点ID列表，None表示所有节点
        method: 分类方法

    Returns:
        批量分类结果统计
    """
    try:
        domain_service = DomainService(db)
        result = await domain_service.batch_assign_domains(
            node_ids=node_ids,
            method=method
        )

        return {
            "success": True,
            "data": result,
            "message": f"成功为 {result['assigned_nodes']}/{result['total_nodes']} 个节点分配领域"
        }

    except Exception as e:
        logger.error(f"批量分类失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"批量分类失败: {str(e)}")
