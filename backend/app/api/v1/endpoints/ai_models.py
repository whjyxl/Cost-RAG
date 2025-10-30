"""
AI模型相关的API端点
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import limiter
from slowapi.util import get_remote_address
import logging

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.ai_model import (
    AIProvider, AIModelType,
    ChatRequest, ChatResponse, BatchChatRequest, BatchChatResponse,
    EmbeddingRequest, EmbeddingResponse,
    ModelInfo, ModelComparison, StreamingChunk,
    ProviderStatus, SystemStatus, UsageStatistics,
    CostAnalysis, AIModelConfig
)
from app.services.ai_model_service import AIModelService
from app.services.cost_tracking_service import CostTrackingService
from app.core.config import get_settings
from app.utils.rate_limit import RateLimiter

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()

# 初始化服务
ai_model_service = AIModelService()
cost_tracking_service = CostTrackingService()
rate_limiter = RateLimiter()

@router.get("/providers", response_model=Dict[str, Any])
@limiter.limit("60/minute")
async def get_providers(
    request,
    current_user: User = Depends(get_current_user)
):
    """获取所有可用的AI提供商信息"""
    try:
        providers = ai_model_service.get_supported_providers()
        return {
            "providers": providers,
            "configured_count": len([p for p in providers.values() if p.get("configured")]),
            "total_count": len(providers)
        }
    except Exception as e:
        logger.error(f"获取提供商信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取提供商信息失败")

@router.get("/models", response_model=List[ModelInfo])
@limiter.limit("100/minute")
async def get_models(
    request,
    provider: Optional[AIProvider] = Query(None, description="筛选特定提供商"),
    model_type: Optional[AIModelType] = Query(None, description="筛选模型类型"),
    current_user: User = Depends(get_current_user)
):
    """获取所有可用的AI模型信息"""
    try:
        models = await ai_model_service.get_available_models(provider, model_type)
        return models
    except Exception as e:
        logger.error(f"获取模型信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取模型信息失败")

@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_completion(
    request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """AI对话完成接口"""
    try:
        # 检查速率限制
        user_id = current_user.id
        if not await rate_limiter.check_limit(f"chat:{user_id}", 20, 60):
            raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")

        # 设置用户信息
        chat_request.user_id = str(user_id)
        if not chat_request.session_id:
            chat_request.session_id = f"session_{user_id}_{hash(str(chat_request.messages))}"

        # 调用AI模型服务
        response = await ai_model_service.chat_completion(chat_request)

        # 后台任务：记录使用统计和成本
        background_tasks.add_task(
            cost_tracking_service.record_usage,
            user_id=user_id,
            provider=response.provider,
            model=response.model,
            usage_data=response.usage,
            cost_data=response.usage.get("cost", 0)
        )

        return response

    except Exception as e:
        logger.error(f"对话完成失败: {str(e)}")
        raise HTTPException(status_code=500, detail="对话完成失败")

@router.post("/chat/batch", response_model=BatchChatResponse)
@limiter.limit("5/minute")
async def batch_chat_completion(
    request,
    batch_request: BatchChatRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量对话完成接口"""
    try:
        # 检查速率限制
        user_id = current_user.id
        if not await rate_limiter.check_limit(f"batch_chat:{user_id}", 5, 60):
            raise HTTPException(status_code=429, detail="批量请求过于频繁，请稍后再试")

        # 设置用户信息
        for req in batch_request.requests:
            req.user_id = str(user_id)
            if not req.session_id:
                req.session_id = f"batch_{user_id}_{hash(str(req.messages))}"

        # 执行批量处理
        response = await ai_model_service.batch_chat_completion(batch_request)

        # 后台任务：记录批量使用统计
        if response.successful_requests > 0:
            total_cost = response.total_cost
            background_tasks.add_task(
                cost_tracking_service.record_batch_usage,
                user_id=user_id,
                successful_requests=response.successful_requests,
                total_cost=total_cost
            )

        return response

    except Exception as e:
        logger.error(f"批量对话完成失败: {str(e)}")
        raise HTTPException(status_code=500, detail="批量对话完成失败")

@router.post("/embeddings", response_model=EmbeddingResponse)
@limiter.limit("60/minute")
async def create_embeddings(
    request,
    embedding_request: EmbeddingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """文本向量化接口"""
    try:
        # 检查速率限制
        user_id = current_user.id
        if not await rate_limiter.check_limit(f"embeddings:{user_id}", 60, 60):
            raise HTTPException(status_code=429, detail="向量化请求过于频繁，请稍后再试")

        # 设置用户信息
        embedding_request.user_id = str(user_id)

        # 调用向量化服务
        response = await ai_model_service.create_embeddings(embedding_request)

        # 后台任务：记录使用统计
        background_tasks.add_task(
            cost_tracking_service.record_usage,
            user_id=user_id,
            provider=response.provider,
            model=response.model,
            usage_data=response.usage,
            cost_data=response.usage.get("cost", 0)
        )

        return response

    except Exception as e:
        logger.error(f"文本向量化失败: {str(e)}")
        raise HTTPException(status_code=500, detail="文本向量化失败")

@router.get("/status", response_model=SystemStatus)
@limiter.limit("30/minute")
async def get_system_status(
    request,
    current_user: User = Depends(get_current_user)
):
    """获取AI模型系统状态"""
    try:
        status = await ai_model_service.get_system_status()
        return status
    except Exception as e:
        logger.error(f"获取系统状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取系统状态失败")

@router.post("/test/{provider}", response_model=ProviderStatus)
@limiter.limit("10/minute")
async def test_provider(
    request,
    provider: AIProvider,
    model: Optional[str] = Query(None, description="测试模型，默认使用推荐模型"),
    current_user: User = Depends(get_current_user)
):
    """测试特定AI提供商的连通性"""
    try:
        # 检查用户权限
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="需要管理员权限")

        status = await ai_model_service.test_provider(provider, model)
        return status
    except Exception as e:
        logger.error(f"测试提供商失败: {str(e)}")
        raise HTTPException(status_code=500, detail="测试提供商失败")

@router.get("/usage/statistics", response_model=List[UsageStatistics])
@limiter.limit("20/minute")
async def get_usage_statistics(
    request,
    provider: Optional[AIProvider] = Query(None, description="筛选特定提供商"),
    model: Optional[str] = Query(None, description="筛选特定模型"),
    days: int = Query(7, ge=1, le=365, description="统计天数"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取使用统计"""
    try:
        user_id = current_user.id
        statistics = await cost_tracking_service.get_user_usage_statistics(
            user_id=user_id,
            provider=provider,
            model=model,
            days=days
        )
        return statistics
    except Exception as e:
        logger.error(f"获取使用统计失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取使用统计失败")

@router.get("/cost/analysis", response_model=CostAnalysis)
@limiter.limit("10/minute")
async def get_cost_analysis(
    request,
    days: int = Query(30, ge=1, le=365, description="分析天数"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取成本分析"""
    try:
        user_id = current_user.id
        analysis = await cost_tracking_service.get_cost_analysis(
            user_id=user_id,
            days=days
        )
        return analysis
    except Exception as e:
        logger.error(f"获取成本分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取成本分析失败")

@router.post("/models/compare", response_model=ModelComparison)
@limiter.limit("5/minute")
async def compare_models(
    request,
    comparison_request: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """模型对比评估"""
    try:
        # 检查用户权限
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="需要管理员权限")

        # 提取对比参数
        models = comparison_request.get("models", [])
        test_cases = comparison_request.get("test_cases", [])
        metrics = comparison_request.get("metrics", ["accuracy", "speed", "cost"])

        if len(models) < 2:
            raise HTTPException(status_code=400, detail="至少需要2个模型进行对比")

        if len(test_cases) == 0:
            raise HTTPException(status_code=400, detail="至少需要1个测试用例")

        # 执行模型对比
        comparison = await ai_model_service.compare_models(
            models=models,
            test_cases=test_cases,
            metrics=metrics
        )

        # 后台任务：记录对比结果
        background_tasks.add_task(
            cost_tracking_service.record_model_comparison,
            user_id=current_user.id,
            comparison_id=comparison.comparison_id,
            models=models,
            results=comparison.results
        )

        return comparison

    except Exception as e:
        logger.error(f"模型对比失败: {str(e)}")
        raise HTTPException(status_code=500, detail="模型对比失败")

@router.get("/config", response_model=AIModelConfig)
@limiter.limit="30/minute")
async def get_model_config(
    request,
    current_user: User = Depends(get_current_user)
):
    """获取AI模型配置"""
    try:
        config = await ai_model_service.get_model_config()
        return config
    except Exception as e:
        logger.error(f"获取模型配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取模型配置失败")

@router.put("/config", response_model=Dict[str, Any])
@limiter.limit("10/minute")
async def update_model_config(
    request,
    config_update: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新AI模型配置"""
    try:
        # 检查用户权限
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="需要管理员权限")

        # 更新配置
        result = await ai_model_service.update_model_config(config_update)

        return {
            "message": "配置更新成功",
            "updated_fields": result.get("updated_fields", []),
            "timestamp": result.get("timestamp")
        }

    except Exception as e:
        logger.error(f"更新模型配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="更新模型配置失败")

@router.get("/models/{model_name}/info", response_model=ModelInfo)
@limiter.limit("60/minute")
async def get_model_info(
    request,
    model_name: str,
    provider: Optional[AIProvider] = Query(None, description="筛选特定提供商"),
    current_user: User = Depends(get_current_user)
):
    """获取特定模型的详细信息"""
    try:
        model_info = await ai_model_service.get_model_info(model_name, provider)
        if not model_info:
            raise HTTPException(status_code=404, detail="模型不存在")
        return model_info
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模型信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取模型信息失败")

@router.delete("/usage/reset")
@limiter.limit("5/minute")
async def reset_usage_data(
    request,
    provider: Optional[AIProvider] = Query(None, description="重置特定提供商的数据"),
    model: Optional[str] = Query(None, description="重置特定模型的数据"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """重置使用数据（仅限超级管理员）"""
    try:
        # 检查超级管理员权限
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="需要超级管理员权限")

        # 重置数据
        result = await cost_tracking_service.reset_usage_data(
            user_id=current_user.id,
            provider=provider,
            model=model
        )

        return {
            "message": "使用数据重置成功",
            "reset_count": result.get("reset_count", 0),
            "timestamp": result.get("timestamp")
        }

    except Exception as e:
        logger.error(f"重置使用数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail="重置使用数据失败")