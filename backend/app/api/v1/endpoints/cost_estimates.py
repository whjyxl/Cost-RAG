"""
成本估算API端点
"""
import time
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, get_pagination_params
from app.models.user import User
from app.models.project import ProjectType
from app.schemas.cost import (
    CostEstimate, CostEstimateCreate, CostEstimateUpdate, CostEstimateList,
    CostAnalysisRequest, CostAnalysisResult, CostComparisonRequest, CostComparisonResult,
    CostPredictionRequest, CostPredictionResult, CostBenchmark, CostReport
)
from app.services.cost_estimation_service import cost_estimation_service
from app.core.logging import logger

router = APIRouter()


@router.post("/", response_model=CostEstimate)
async def create_cost_estimate(
    estimate_data: CostEstimateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    创建成本估算

    支持多种估算方法：专家判断、类比估算、参数估算、自下而上、三点估算、机器学习
    """
    try:
        estimate = await cost_estimation_service.create_cost_estimate(
            estimate_data=estimate_data,
            user_id=current_user.id,
            db=db
        )
        return estimate

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"创建成本估算API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="创建成本估算失败")


@router.get("/", response_model=CostEstimateList)
async def get_cost_estimates(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    project_id: Optional[int] = Query(None, description="项目ID过滤"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取成本估算列表"""
    try:
        skip = (page - 1) * size
        estimates, total = await cost_estimation_service.get_cost_estimates(
            user_id=current_user.id,
            project_id=project_id,
            skip=skip,
            limit=size,
            db=db
        )

        # 转换为摘要格式
        estimate_summaries = []
        for estimate in estimates:
            estimate_summaries.append({
                "id": estimate.id,
                "title": estimate.title,
                "estimated_budget": estimate.estimated_budget,
                "currency": estimate.currency.value,
                "estimation_method": estimate.estimation_method.value,
                "confidence_level": estimate.confidence_level,
                "status": "active",  # 简化处理
                "created_at": estimate.created_at,
                "updated_at": estimate.updated_at
            })

        pages = (total + size - 1) // size

        return CostEstimateList(
            estimates=estimate_summaries,
            total=total,
            page=page,
            size=size,
            pages=pages
        )

    except Exception as e:
        logger.error(f"获取成本估算列表API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取成本估算列表失败")


@router.get("/{estimate_id}", response_model=CostEstimate)
async def get_cost_estimate(
    estimate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取成本估算详情"""
    try:
        estimate = await cost_estimation_service.get_cost_estimate(
            estimate_id=estimate_id,
            user_id=current_user.id,
            db=db
        )

        if not estimate:
            raise HTTPException(status_code=404, detail="成本估算不存在")

        return estimate

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取成本估算详情API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取成本估算详情失败")


@router.put("/{estimate_id}", response_model=CostEstimate)
async def update_cost_estimate(
    estimate_id: int,
    estimate_update: CostEstimateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新成本估算"""
    try:
        estimate = await cost_estimation_service.update_cost_estimate(
            estimate_id=estimate_id,
            estimate_update=estimate_update,
            user_id=current_user.id,
            db=db
        )

        if not estimate:
            raise HTTPException(status_code=404, detail="成本估算不存在")

        return estimate

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新成本估算API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="更新成本估算失败")


@router.post("/analyze", response_model=CostAnalysisResult)
async def analyze_cost_performance(
    analysis_request: CostAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """分析成本绩效"""
    try:
        start_time = time.time()
        analysis_result = await cost_estimation_service.analyze_cost_performance(
            analysis_request=analysis_request,
            user_id=current_user.id,
            db=db
        )
        analysis_time = time.time() - start_time

        logger.info(f"成本绩效分析完成，耗时: {analysis_time:.2f}秒")
        return analysis_result

    except Exception as e:
        logger.error(f"成本绩效分析API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="成本绩效分析失败")


@router.post("/compare", response_model=CostComparisonResult)
async def compare_cost_estimates(
    comparison_request: CostComparisonRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """比较成本估算"""
    try:
        start_time = time.time()
        comparison_result = await cost_estimation_service.compare_cost_estimates(
            comparison_request=comparison_request,
            user_id=current_user.id,
            db=db
        )
        comparison_time = time.time() - start_time

        logger.info(f"成本估算比较完成，耗时: {comparison_time:.2f}秒")
        return comparison_result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"成本估算比较API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="成本估算比较失败")


@router.post("/predict", response_model=CostPredictionResult)
async def predict_cost(
    prediction_request: CostPredictionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """基于历史数据预测成本"""
    try:
        start_time = time.time()
        prediction_result = await cost_estimation_service.predict_cost(
            prediction_request=prediction_request,
            user_id=current_user.id,
            db=db
        )
        prediction_time = time.time() - start_time

        logger.info(f"成本预测完成，耗时: {prediction_time:.2f}秒")
        return prediction_result

    except Exception as e:
        logger.error(f"成本预测API错误: {str(e)}")
        if "历史数据不足" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail="成本预测失败")


@router.get("/benchmarks/{project_type}", response_model=CostBenchmark)
async def get_cost_benchmarks(
    project_type: ProjectType,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取成本基准数据"""
    try:
        benchmarks = await cost_estimation_service.get_cost_benchmarks(
            project_type=project_type,
            user_id=current_user.id,
            db=db
        )
        return benchmarks

    except Exception as e:
        logger.error(f"获取成本基准API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取成本基准失败")


@router.get("/reports/{project_id}", response_model=CostReport)
async def generate_cost_report(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """生成成本报告"""
    try:
        report = await cost_estimation_service.generate_cost_report(
            project_id=project_id,
            user_id=current_user.id,
            db=db
        )
        return report

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"生成成本报告API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="生成成本报告失败")


@router.get("/estimation-methods")
async def get_estimation_methods():
    """获取支持的估算方法列表"""
    try:
        from app.schemas.cost import EstimationMethod

        methods = [
            {
                "value": method.value,
                "label": method.value.replace("_", " ").title(),
                "description": get_method_description(method)
            }
            for method in EstimationMethod
        ]

        return {
            "methods": methods,
            "default": EstimationMethod.PARAMETRIC.value
        }

    except Exception as e:
        logger.error(f"获取估算方法API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取估算方法失败")


@router.get("/cost-categories")
async def get_cost_categories():
    """获取成本分类列表"""
    try:
        from app.schemas.cost import CostCategory

        categories = [
            {
                "value": category.value,
                "label": category.value.replace("_", " ").title(),
                "description": get_category_description(category)
            }
            for category in CostCategory
        ]

        return {
            "categories": categories
        }

    except Exception as e:
        logger.error(f"获取成本分类API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取成本分类失败")


@router.get("/complexity-levels")
async def get_complexity_levels():
    """获取复杂度等级列表"""
    try:
        from app.schemas.cost import ComplexityLevel

        levels = [
            {
                "value": level.value,
                "label": level.value.replace("_", " ").title(),
                "description": get_complexity_description(level)
            }
            for level in ComplexityLevel
        ]

        return {
            "levels": levels
        }

    except Exception as e:
        logger.error(f"获取复杂度等级API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取复杂度等级失败")


@router.get("/currencies")
async def get_currencies():
    """获取支持的货币列表"""
    try:
        from app.schemas.cost import Currency

        currencies = [
            {
                "value": currency.value,
                "label": currency.value,
                "symbol": get_currency_symbol(currency)
            }
            for currency in Currency
        ]

        return {
            "currencies": currencies,
            "default": Currency.CNY.value
        }

    except Exception as e:
        logger.error(f"获取货币列表API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取货币列表失败")


@router.get("/statistics/overview")
async def get_cost_statistics_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取成本统计概览"""
    try:
        # 获取用户的成本估算统计
        from sqlalchemy import select, func
        from app.models.cost import CostEstimate

        # 基础统计
        total_estimates_query = select(func.count(CostEstimate.id)).where(
            CostEstimate.created_by == current_user.id
        )
        total_estimates_result = await db.execute(total_estimates_query)
        total_estimates = total_estimates_result.scalar() or 0

        # 总估算预算
        total_budget_query = select(func.sum(CostEstimate.estimated_budget)).where(
            CostEstimate.created_by == current_user.id
        )
        total_budget_result = await db.execute(total_budget_query)
        total_budget = total_budget_result.scalar() or 0

        # 按方法统计
        method_query = select(
            CostEstimate.estimation_method,
            func.count().label('count'),
            func.sum(CostEstimate.estimated_budget).label('total_budget')
        ).where(
            CostEstimate.created_by == current_user.id
        ).group_by(CostEstimate.estimation_method)

        method_result = await db.execute(method_query)
        by_method = [
            {
                "method": row.estimation_method.value,
                "count": row.count,
                "total_budget": float(row.total_budget or 0)
            }
            for row in method_result
        ]

        # 近期趋势（最近30天）
        from datetime import timedelta
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)

        recent_query = select(
            func.date(CostEstimate.created_at).label('date'),
            func.count().label('count'),
            func.sum(CostEstimate.estimated_budget).label('budget')
        ).where(
            and_(
                CostEstimate.created_by == current_user.id,
                CostEstimate.created_at >= thirty_days_ago
            )
        ).group_by(func.date(CostEstimate.created_at)).order_by('date')

        recent_result = await db.execute(recent_query)
        recent_trends = [
            {
                "date": str(row.date),
                "count": row.count,
                "budget": float(row.budget or 0)
            }
            for row in recent_result
        ]

        statistics = {
            "total_estimates": total_estimates,
            "total_budget": float(total_budget),
            "average_budget": float(total_budget / total_estimates) if total_estimates > 0 else 0,
            "by_method": by_method,
            "recent_trends": recent_trends,
            "updated_at": datetime.utcnow()
        }

        return statistics

    except Exception as e:
        logger.error(f"获取成本统计概览API错误: {str(e)}")
        raise HTTPException(status_code=500, detail="获取成本统计概览失败")


# 辅助函数
def get_method_description(method):
    """获取估算方法描述"""
    descriptions = {
        "expert_judgment": "基于专家经验和判断的估算方法",
        "analogous": "基于类似历史项目进行类比估算",
        "parametric": "基于参数模型进行统计分析估算",
        "bottom_up": "自下而上逐项详细估算",
        "three_point": "乐观、悲观、最可能三点估算",
        "machine_learning": "基于机器学习算法的智能预测"
    }
    return descriptions.get(method.value, "未知方法")


def get_category_description(category):
    """获取成本分类描述"""
    descriptions = {
        "labor": "人力资源相关成本",
        "material": "原材料和物资成本",
        "equipment": "设备和工具成本",
        "software": "软件许可和服务成本",
        "subcontractor": "外包和分包成本",
        "overhead": "管理费用和间接成本",
        "contingency": "应急和风险准备金",
        "profit": "项目利润和收益"
    }
    return descriptions.get(category.value, "未知分类")


def get_complexity_description(level):
    """获取复杂度等级描述"""
    descriptions = {
        "low": "低复杂度，技术难度低，风险可控",
        "medium": "中等复杂度，需要一定的技术能力",
        "high": "高复杂度，技术挑战较大，需要专业团队",
        "very_high": "极高复杂度，涉及创新技术，风险较高"
    }
    return descriptions.get(level.value, "未知复杂度")


def get_currency_symbol(currency):
    """获取货币符号"""
    symbols = {
        "CNY": "¥",
        "USD": "$",
        "EUR": "€",
        "JPY": "¥"
    }
    return symbols.get(currency.value, currency.value)