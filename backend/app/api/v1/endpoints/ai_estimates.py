"""
AI智能成本估算API端点
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.estimation import (
    AIEstimationRequest,
    AIEstimationResponse,
    AIEstimationSaveRequest,
    AIEstimationSaveResponse
)
from app.services.cost_estimation_ai_service import CostEstimationAIService
from app.services.cost_estimation.estimation_service import estimation_service

logger = logging.getLogger(__name__)
router = APIRouter()

# 初始化AI估算服务
ai_estimation_service = CostEstimationAIService()


@router.post("/ai-estimate", response_model=AIEstimationResponse)
async def ai_estimate_cost(
    request: AIEstimationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    使用AI模型进行建筑成本智能估算

    ## 功能说明
    - 使用配置的AI大模型（智谱AI、月之暗面、通义千问等）进行成本估算
    - 支持手动选择AI提供商和模型
    - 基于项目特征生成详细的成本分解
    - 返回估算结果、置信度和依据说明

    ## 请求参数
    - **project_name**: 项目名称
    - **project_type**: 项目类型 (residential/commercial/industrial/public/mixed)
    - **building_type**: 建筑类型 (可选)
    - **structure_type**: 结构类型 (可选)
    - **area**: 建筑面积 (㎡)
    - **location**: 项目位置
    - **floors**: 层数 (可选)
    - **unit_cost**: 预估单位造价 (元/㎡, 可选 - 留空由AI完全估算)
    - **quality_level**: 质量等级 (basic/standard/premium)
    - **construction_year**: 建设年份 (可选)
    - **construction_period**: 建设周期-月 (可选)
    - **construction_standard**: 建设标准 (可选)
    - **design_standard**: 设计标准 (可选)
    - **ai_provider**: AI提供商 (zhipuai/moonshot/dashscope/baidu/deepseek/yi/spark)
    - **ai_model**: AI模型名称 (可选, 默认使用提供商的默认模型)
    - **temperature**: 温度参数 (0.0-2.0, 默认0.7)

    ## 响应内容
    - **estimated_unit_cost**: 估算单位造价 (元/㎡)
    - **estimated_total_cost**: 估算总造价 (元)
    - **confidence**: AI置信度 (0-1)
    - **breakdown**: 成本构成明细 (土建/装饰/安装/其他)
    - **rationale**: 估算依据说明
    - **model_used**: 使用的AI模型
    - **ai_provider**: AI提供商

    ## 示例
    ```json
    {
      "project_name": "阳光花园住宅项目",
      "project_type": "residential",
      "building_type": "高层住宅",
      "structure_type": "框架结构",
      "area": 50000,
      "location": "北京市朝阳区",
      "floors": 18,
      "unit_cost": 2500,
      "quality_level": "standard",
      "ai_provider": "zhipuai",
      "temperature": 0.7
    }
    ```
    """
    try:
        logger.info(f"用户{current_user.username}请求AI估算: {request.project_name}, provider={request.ai_provider}")

        # 调用AI估算服务
        result = await ai_estimation_service.estimate_with_ai(request)

        # 后台任务：记录估算日志（可选）
        background_tasks.add_task(
            log_ai_estimation,
            user_id=current_user.id,
            project_name=request.project_name,
            ai_provider=request.ai_provider,
            estimated_cost=result.estimated_total_cost
        )

        logger.info(f"AI估算完成: {request.project_name}, 总造价={result.estimated_total_cost}元")
        return result

    except ValueError as e:
        # AI提供商配置错误
        logger.error(f"AI估算参数错误: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        # 其他错误
        logger.error(f"AI估算失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"AI估算失败: {str(e)}"
        )


def log_ai_estimation(
    user_id: int,
    project_name: str,
    ai_provider: str,
    estimated_cost: float
):
    """
    记录AI估算日志（后台任务）

    Args:
        user_id: 用户ID
        project_name: 项目名称
        ai_provider: AI提供商
        estimated_cost: 估算总造价
    """
    try:
        logger.info(
            f"AI估算记录 - 用户:{user_id}, 项目:{project_name}, "
            f"提供商:{ai_provider}, 造价:{estimated_cost}元"
        )
        # TODO: 可以添加数据库日志记录逻辑
    except Exception as e:
        logger.error(f"记录AI估算日志失败: {str(e)}")


@router.post("/ai-estimate/save", response_model=AIEstimationSaveResponse)
async def save_ai_estimate(
    request: AIEstimationSaveRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    保存AI估算结果到数据库

    ## 功能说明
    - 将AI估算结果持久化到数据库
    - 保存成本构成明细（4大类）
    - 记录估算依据和AI模型信息
    - 后续可在历史记录中查询

    ## 请求参数
    - **project_name**: 项目名称
    - **project_type**: 项目类型
    - **area**: 建筑面积
    - **location**: 项目位置
    - **estimated_unit_cost**: 估算单位造价
    - **estimated_total_cost**: 估算总造价
    - **confidence**: AI置信度
    - **breakdown**: 成本构成明细（4大类）
    - **rationale**: 估算依据说明
    - **model_used**: 使用的AI模型
    - **ai_provider**: AI提供商
    - **quality_level**: 质量等级（可选）
    - **construction_year**: 建设年份（可选）

    ## 返回结果
    - **estimation_id**: 保存的估算ID
    - **message**: 提示信息
    - **created_at**: 创建时间
    """
    try:
        logger.info(f"收到AI估算保存请求: {request.project_name}")

        # 调用estimation_service保存AI估算
        estimate = await estimation_service.save_ai_estimation(
            project_name=request.project_name,
            project_type=request.project_type,
            area=request.area,
            location=request.location,
            estimated_unit_cost=request.estimated_unit_cost,
            estimated_total_cost=request.estimated_total_cost,
            confidence=request.confidence,
            breakdown=[item.dict() for item in request.breakdown],
            rationale=request.rationale,
            model_used=request.model_used,
            ai_provider=request.ai_provider,
            user_id=current_user.id,
            db=db,
            quality_level=request.quality_level,
            construction_year=request.construction_year,
            cost_breakdown=request.cost_breakdown  # ✅ 新增：传递14级成本明细
        )

        logger.info(f"AI估算保存成功，ID: {estimate.id}")

        return AIEstimationSaveResponse(
            estimation_id=estimate.id,
            message=f"AI估算结果已成功保存",
            created_at=estimate.created_at
        )

    except Exception as e:
        logger.error(f"保存AI估算失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"保存AI估算失败: {str(e)}"
        )
