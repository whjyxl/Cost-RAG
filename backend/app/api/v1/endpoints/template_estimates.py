"""
基于模板的成本估算API端点
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.project import CostEstimate, CostItem
from sqlalchemy import select
from app.schemas.estimation import (
    EstimationRequest,
    EstimationResponse,
    TemplateMatch,
    EstimationSummary
)
from app.services.cost_estimation.estimation_service import EstimationService
from app.services.cost_estimation.template_matcher import TemplateMatcher
from app.core.logging import logger

router = APIRouter()

# 初始化服务
estimation_service = EstimationService()
template_matcher = TemplateMatcher()


@router.post("/estimate", response_model=EstimationResponse)
async def create_estimate(
    request: EstimationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    基于模板创建成本估算
    
    - **name**: 项目名称
    - **project_type**: 项目类型（commercial_residential, office, industrial, infrastructure）
    - **area**: 建筑面积（平方米）
    - **location**: 项目位置
    - **start_date**: 计划开工日期
    """
    try:
        logger.info(f"收到估算请求: {request.name}, 类型: {request.project_type}, 面积: {request.area}, 模板ID: {request.template_id}")

        # 如果未提供项目类型但指定了模板ID,从模板继承项目类型
        project_type = request.project_type
        if not project_type and request.template_id:
            from sqlalchemy import select
            from app.models.project_template import ProjectTemplate
            template_result = await db.execute(
                select(ProjectTemplate).where(ProjectTemplate.id == request.template_id)
            )
            template = template_result.scalar_one_or_none()
            if template:
                # 获取模板的project_type,处理枚举类型
                if hasattr(template.project_type, 'value'):
                    project_type = template.project_type.value
                else:
                    project_type = str(template.project_type) if template.project_type else None
                logger.info(f"从模板ID {request.template_id} 继承项目类型: {project_type}")

        # 使用模板匹配服务进行估算
        result = await estimation_service.estimate_from_template(
            project_name=request.name,
            area=request.area,
            user_id=current_user.id,
            db=db,
            project_type=project_type,
            start_date=request.start_date,
            template_id=request.template_id,  # 使用请求中的 template_id
            auto_match=request.template_id is None,  # 只有在没有指定template_id时才自动匹配
            region_factor=1.0  # 可以根据location调整
        )
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail="未找到匹配的项目模板"
            )
        
        logger.info(f"估算完成: 总造价 {result.get('total_cost', 0):,.2f} 元，估算ID: {result.get('estimation_id')}")

        return EstimationResponse(
            estimation_id=result.get('estimation_id'),  # ✅ 新增：返回估算ID
            project_name=request.name,
            project_type=project_type or "未指定",  # 使用继承后的project_type
            area=request.area,
            location=request.location,
            total_cost=result.get('total_cost', 0),
            unit_cost=result.get('unit_cost', 0),
            confidence=result.get('confidence_score', 0.0),
            matched_template_id=result.get('template_id'),
            matched_template_name=result.get('template_name'),
            cost_breakdown={
                'primary_sections': result.get('primary_sections', {}),
                'secondary_sections': result.get('secondary_sections', {})
            },
            adjustment_factors={
                'time_adjustment_factor': result.get('time_adjustment_factor', 1.0),
                'years_difference': result.get('years_difference', 0),
                'similarity_score': result.get('similarity_score', 0.0)
            },
            estimation_date=datetime.fromisoformat(result.get('created_at', datetime.now().isoformat())) if result.get('created_at') else datetime.now(),
            notes=f"基于模板 {result.get('template_name', '')} 的估算，相似度: {(result.get('similarity_score') or 0):.2%}，已自动保存（ID: {result.get('estimation_id')}）",

            # ✅ 新增：建设时间信息
            reference_start_date=result.get('reference_start_date'),
            reference_completion_date=result.get('reference_completion_date'),
            new_start_date=result.get('new_start_date')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"估算失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"估算过程出错: {str(e)}"
        )


@router.get("/templates", response_model=List[TemplateMatch])
async def get_templates(
    project_type: Optional[str] = Query(None, description="项目类型筛选"),
    min_area: Optional[float] = Query(None, description="最小面积"),
    max_area: Optional[float] = Query(None, description="最大面积"),
    location: Optional[str] = Query(None, description="位置"),
    limit: int = Query(10, le=100, description="返回数量限制"),
    db: AsyncSession = Depends(get_db)
):
    """
    获取可用的项目模板列表
    
    可用于查看系统中有哪些模板可供匹配
    """
    try:
        # 计算平均面积用于匹配
        avg_area = (min_area + max_area) / 2 if min_area and max_area else None
        if not avg_area:
            # 如果没有提供面积，获取所有模板
            from app.models.project_template import ProjectTemplate
            from sqlalchemy import select
            result = await db.execute(
                select(ProjectTemplate).where(ProjectTemplate.is_enabled == True).limit(limit)
            )
            templates_list = result.scalars().all()
            return [
                TemplateMatch(
                    template_id=t.id,
                    template_name=t.name,
                    project_type=t.project_type if isinstance(t.project_type, str) else (t.project_type.value if t.project_type else None),
                    area=t.area,
                    location=None,  # ProjectTemplate模型没有location字段
                    unit_cost=t.unit_cost,
                    total_cost=t.total_cost,
                    similarity_score=0.0,
                    description=None
                )
                for t in templates_list
            ]
        
        # 使用模板匹配器
        matched = await template_matcher.match_templates(
            area=avg_area,
            project_type=project_type,
            top_n=limit,
            db=db
        )
        
        return [
            TemplateMatch(
                template_id=match['template'].id,
                template_name=match['template'].name,
                project_type=match['template'].project_type if isinstance(match['template'].project_type, str) else (match['template'].project_type.value if match['template'].project_type else None),
                area=match['template'].area,
                location=None,
                unit_cost=match['template'].unit_cost,
                total_cost=match['template'].total_cost,
                similarity_score=match['similarity_score'],
                description=None
            )
            for match in matched
        ]
        
    except Exception as e:
        logger.error(f"获取模板失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"获取模板列表失败: {str(e)}"
        )


@router.get("/templates/{template_id}")
async def get_template_detail(
    template_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取特定模板的详细信息
    """
    try:
        from app.models.project_template import ProjectTemplate
        from sqlalchemy import select

        result = await db.execute(
            select(ProjectTemplate).where(ProjectTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()

        if not template:
            raise HTTPException(
                status_code=404,
                detail=f"未找到ID为 {template_id} 的模板"
            )

        return {
            "id": template.id,
            "name": template.name,
            "project_type": template.project_type,
            "area": template.area,
            "unit_cost": template.unit_cost,
            "total_cost": template.total_cost,
            "floors": getattr(template, 'floors', None),
            "underground_floors": getattr(template, 'underground_floors', None),
            "aboveground_floors": getattr(template, 'aboveground_floors', None),
            "start_date": getattr(template, 'start_date', None),
            "completion_date": getattr(template, 'completion_date', None),
            "is_enabled": template.is_enabled,
            "created_at": template.created_at.isoformat() if template.created_at else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模板详情失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"获取模板详情失败: {str(e)}"
        )


@router.get("/estimates/{estimate_id}", response_model=EstimationResponse)
async def get_estimate_detail(
    estimate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取估算详情（包含所有分部分项明细）
    """
    try:
        # 查询估算记录
        result = await db.execute(
            select(CostEstimate).where(
                CostEstimate.id == estimate_id,
                CostEstimate.created_by == current_user.id
            )
        )
        estimate = result.scalar_one_or_none()

        if not estimate:
            raise HTTPException(
                status_code=404,
                detail=f"未找到ID为 {estimate_id} 的估算记录"
            )

        # 查询所有成本项明细
        items_result = await db.execute(
            select(CostItem).where(CostItem.estimate_id == estimate_id)
        )
        cost_items = items_result.scalars().all()

        # 构建分部分项结构
        primary_sections = {}
        secondary_sections = {}

        for item in cost_items:
            item_data = {
                'item_name': item.item_name,
                'unit_price': item.unit_price or 0.0,
                'total_price': item.total_price or 0.0
            }

            if item.category == "一级分部":
                primary_sections[item.item_code] = item_data
            elif item.category == "二级分部":
                secondary_sections[item.item_code] = item_data

        # 构建完整响应
        return EstimationResponse(
            project_name=estimate.name.replace(" - 成本估算", ""),
            project_type="OTHER",  # 从估算记录获取
            area=estimate.project.building_area if estimate.project else 0.0,
            location=None,
            total_cost=estimate.total_cost,
            unit_cost=estimate.cost_per_unit,
            confidence=estimate.confidence_score or 0.0,
            matched_template_id=estimate.template_id,
            matched_template_name=estimate.reference_template_name,
            cost_breakdown={
                'primary_sections': primary_sections,
                'secondary_sections': secondary_sections
            },
            adjustment_factors={
                'time_adjustment_factor': estimate.time_adjustment_factor or 1.0,
                'years_difference': estimate.years_difference or 0,
            },
            estimation_date=estimate.created_at or datetime.now(),
            notes=f"基于模板 {estimate.reference_template_name} 的估算"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取估算详情失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"获取估算详情失败: {str(e)}"
        )


@router.get("/estimates")
async def get_estimates_history(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取估算历史记录列表

    返回当前用户的所有估算记录（包括模板估算和AI估算）
    """
    try:
        from sqlalchemy import func, desc

        # 计算分页偏移
        skip = (page - 1) * size

        # 查询总数
        count_query = select(func.count(CostEstimate.id)).where(
            CostEstimate.created_by == current_user.id
        )
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # 查询估算记录
        query = select(CostEstimate).where(
            CostEstimate.created_by == current_user.id
        ).order_by(desc(CostEstimate.created_at)).offset(skip).limit(size)

        result = await db.execute(query)
        estimates = result.scalars().all()

        # 构建返回数据
        estimates_list = []
        for estimate in estimates:
            # 判断估算类型
            estimation_type = "AI估算" if "AI" in (estimate.validation_status or "") else "模板估算"

            estimates_list.append({
                "id": estimate.id,
                "name": estimate.name,
                "total_cost": estimate.total_cost,
                "cost_per_unit": estimate.cost_per_unit,
                "confidence_score": estimate.confidence_score or 0.0,
                "template_name": estimate.reference_template_name,
                "validation_status": estimate.validation_status,
                "estimation_type": estimation_type,
                "created_at": estimate.created_at.isoformat() if estimate.created_at else None,
                "updated_at": estimate.updated_at.isoformat() if estimate.updated_at else None
            })

        # 计算总页数
        pages = (total + size - 1) // size

        return {
            "estimates": estimates_list,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages
        }

    except Exception as e:
        logger.error(f"获取估算历史记录失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"获取估算历史记录失败: {str(e)}"
        )


@router.delete("/estimates/{estimate_id}")
async def delete_estimate(
    estimate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    删除估算记录

    删除指定的估算记录及其关联的成本项
    """
    try:
        # 查询估算记录
        result = await db.execute(
            select(CostEstimate).where(
                CostEstimate.id == estimate_id,
                CostEstimate.created_by == current_user.id
            )
        )
        estimate = result.scalar_one_or_none()

        if not estimate:
            raise HTTPException(
                status_code=404,
                detail="估算记录不存在或无权限删除"
            )

        # 删除关联的成本项
        await db.execute(
            select(CostItem).where(CostItem.estimate_id == estimate_id)
        )
        # SQLAlchemy会通过级联删除自动处理关联的成本项

        # 删除估算记录
        await db.delete(estimate)
        await db.commit()

        logger.info(f"成功删除估算记录ID: {estimate_id}, 用户: {current_user.username}")

        return {
            "success": True,
            "message": "估算记录已成功删除",
            "estimate_id": estimate_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除估算记录失败: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"删除估算记录失败: {str(e)}"
        )

