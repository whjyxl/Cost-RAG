"""
AI模型相关的API端点
"""
import os
# 在导入slowapi之前设置环境变量，避免读取.env文件时的编码问题
os.environ.setdefault('SLOWAPI_DISABLE_ENV_FILE', 'true')

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from datetime import datetime

# 创建一个简单的mock limiter，避免slowapi的编码问题
class MockLimiter:
    """Mock limiter，用于避免slowapi读取.env文件时的编码问题"""
    def limit(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator

# 尝试导入slowapi，如果失败则使用MockLimiter
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    # 尝试初始化limiter
    _limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["1000/hour"],
        storage_uri="memory://"
    )
    limiter = _limiter
except Exception as e:
    # 如果初始化失败（如编码问题），使用MockLimiter
    limiter = MockLimiter()

from app.db.session import get_db
from app.api.deps import get_current_user
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

# 初始化limiter，使用内存存储避免编码问题
try:
    # 使用内存存储，避免读取.env文件时的编码问题
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["1000/hour"],
        storage_uri="memory://"
    )
except Exception as e:
    logger.warning(f"Limiter初始化失败: {e}")
    # 创建一个简单的mock limiter用于测试
    class MockLimiter:
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    limiter = MockLimiter()

@router.get("/providers", response_model=Dict[str, Any])
@limiter.limit("60/minute")
async def get_providers(
    request: Request = None,
    current_user: User = Depends(get_current_user)
):
    """获取所有可用的AI提供商信息"""
    try:
        providers = await ai_model_service.get_supported_providers()
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
    request: Request,
    provider: Optional[AIProvider] = Query(None, description="筛选特定提供商"),
    model_type: Optional[AIModelType] = Query(None, description="筛选模型类型"),
    current_user: User = Depends(get_current_user)
):
    """获取所有可用的AI模型信息"""
    try:
        # 注意：get_available_models只接受provider参数，返回Dict[str, List[str]]
        # 但API需要返回List[ModelInfo]，所以需要转换
        if provider:
            models_dict = await ai_model_service.get_available_models(provider)
            # 将Dict[str, List[str]]转换为List[ModelInfo]
            from app.schemas.ai_model import ModelInfo, AIModelType
            result = []
            for model_type_str, model_names in models_dict.items():
                # 将字符串转换为AIModelType枚举
                try:
                    model_type_enum = AIModelType(model_type_str)
                except ValueError:
                    # 如果无法转换，跳过
                    continue
                for model_name in model_names:
                    result.append(ModelInfo(
                        provider=provider,
                        model=model_name,
                        type=model_type_enum,
                        description=f"{provider} {model_name} 模型",
                        max_tokens=None,
                        context_length=None,
                        pricing=None,
                        capabilities=[]
                    ))
            # 如果指定了model_type，进行过滤
            if model_type:
                result = [m for m in result if m.type == model_type]
            return result
        else:
            # 如果没有指定provider，返回所有提供商的模型
            # TODO: 实现获取所有模型的逻辑
            return []
    except Exception as e:
        logger.error(f"获取模型信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取模型信息失败")

@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_completion(
    request: Request,
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
    request: Request,
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
    request: Request,
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

@router.post("/validate-key")
@limiter.limit("5/minute")
async def validate_api_key(
    request,
    validation_data: Dict[str, str],
    current_user: User = Depends(get_current_user)
):
    """验证API密钥是否有效"""
    try:
        provider = validation_data.get("provider")
        api_key = validation_data.get("api_key")

        if not provider or not api_key:
            raise HTTPException(status_code=400, detail="提供商和API密钥不能为空")

        # 这里应该调用具体的服务来验证API密钥
        # 暂时返回模拟结果
        is_valid = await ai_model_service.validate_api_key(provider, api_key)

        return {
            "valid": is_valid,
            "provider": provider,
            "message": "API密钥有效" if is_valid else "API密钥无效"
        }
    except Exception as e:
        logger.error(f"验证API密钥失败: {str(e)}")
        return {
            "valid": False,
            "provider": provider,
            "message": f"验证失败: {str(e)}"
        }

@router.get("/providers/extended")
@limiter.limit("30/minute")
async def get_providers_extended(
    request,
    current_user: User = Depends(get_current_user)
):
    """获取扩展的提供商信息，包含详细状态"""
    try:
        # 获取基本提供商信息
        providers = await ai_model_service.get_supported_providers()

        # 获取系统状态
        system_status = await ai_model_service.get_system_status()

        # 合并信息
        extended_providers = {}
        for provider_name, provider_info in providers.items():
            # 查找对应的系统状态
            provider_status = next(
                (ps for ps in system_status.providers if ps.provider == provider_name),
                None
            )

            extended_providers[provider_name] = {
                **provider_info,
                "status": provider_status.status if provider_status else "unknown",
                "last_check": provider_status.lastCheck if provider_status else None,
                "response_time": provider_status.responseTime if provider_status else None,
                "error": provider_status.error if provider_status else None,
                "configured": provider_status.configured if provider_status else False,
                "available_models": provider_status.availableModels if provider_status else []
            }

        return {
            "providers": extended_providers,
            "overall_status": system_status.overallStatus,
            "last_update": system_status.lastUpdate,
            "configured_count": len([p for p in extended_providers.values() if p.get("configured")]),
            "total_count": len(extended_providers)
        }
    except Exception as e:
        logger.error(f"获取扩展提供商信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取提供商信息失败")

@router.get("/health")
@limiter.limit("60/minute")
async def health_check(
    request
):
    """健康检查端点，不需要认证"""
    try:
        # 检查基本系统状态
        system_status = await ai_model_service.get_system_status()

        # 计算健康度
        total_providers = len(system_status.providers)
        healthy_providers = len([p for p in system_status.providers if p.status == "connected"])

        health_percentage = (healthy_providers / total_providers * 100) if total_providers > 0 else 0

        return {
            "status": "healthy" if health_percentage >= 80 else "degraded" if health_percentage >= 50 else "unhealthy",
            "timestamp": system_status.lastUpdate,
            "providers": {
                "total": total_providers,
                "healthy": healthy_providers,
                "unhealthy": total_providers - healthy_providers
            },
            "health_percentage": round(health_percentage, 2),
            "details": system_status
        }
    except Exception as e:
        logger.error(f"健康检查失败: {str(e)}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "health_percentage": 0
        }

@router.get("/usage/statistics", response_model=List[UsageStatistics])
@limiter.limit("20/minute")
async def get_usage_statistics(
    request: Request,
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
@limiter.limit("30/minute")
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
async def update_model_config(
    config_update: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新AI模型配置"""
    try:
        # 注意：允许所有认证用户配置AI模型（不限于超级管理员）
        # 如需限制权限，可取消下面两行注释
        # if not current_user.is_superuser:
        #     raise HTTPException(status_code=403, detail="需要管理员权限")

        # 更新配置
        result = await ai_model_service.update_model_config(config_update)

        # 检查服务返回的状态
        if result.get("status") == "error":
            logger.error(f"AI模型服务返回错误: {result.get('error')}")
            raise HTTPException(status_code=500, detail=result.get("message", "配置更新失败"))

        return {
            "message": result.get("message", "配置更新成功"),
            "updated_fields": result.get("updated_fields", []),
            "timestamp": result.get("timestamp"),
            "storage": result.get("storage", "unknown")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新模型配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新模型配置失败: {str(e)}")

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


@router.post("/chat/stream")
@limiter.limit("20/minute")
async def stream_chat_completion(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """AI流式对话完成接口"""
    from fastapi.responses import StreamingResponse
    import json

    try:
        # 检查速率限制
        user_id = current_user.id
        if not await rate_limiter.check_limit(f"chat:{user_id}", 20, 60):
            raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")

        # 设置用户信息
        chat_request.user_id = str(user_id)
        chat_request.stream = True  # 确保stream为True

        if not chat_request.session_id:
            chat_request.session_id = f"session_{user_id}_{hash(str(chat_request.messages))}"

        # 创建流式响应生成器
        async def generate_stream():
            try:
                async for chunk in ai_model_service.stream_chat_completion(chat_request):
                    # 将chunk转换为JSON字符串并添加换行符（SSE格式）
                    yield f"data: {json.dumps(chunk)}\n\n"

                # 发送结束标记
                yield "data: [DONE]\n\n"

            except Exception as e:
                logger.error(f"流式对话生成失败: {str(e)}")
                error_chunk = {"error": str(e), "finished": True}
                yield f"data: {json.dumps(error_chunk)}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/plain"
        )

    except Exception as e:
        logger.error(f"流式对话完成失败: {str(e)}")
        raise HTTPException(status_code=500, detail="流式对话完成失败")


@router.post("/compare")
@limiter.limit("5/minute")
async def compare_models_simple(
    request: Request,
    comparison_request: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """简化的模型对比端点"""
    try:
        # 提取对比参数
        providers = comparison_request.get("providers", [])
        models_list = comparison_request.get("models", [])
        prompt = comparison_request.get("prompt", "")
        metrics = comparison_request.get("metrics", ["response_time", "cost", "quality_score"])

        if len(providers) < 2 and len(models_list) < 2:
            raise HTTPException(status_code=400, detail="至少需要2个提供商或模型进行对比")

        if not prompt:
            raise HTTPException(status_code=400, detail="需要提供对比提示词")

        # 构建对比结果
        results = []
        for i, (provider, model) in enumerate(zip(providers, models_list)):
            results.append({
                "provider": provider,
                "model": model,
                "response": f"模拟响应内容 {i+1}",
                "response_time": 0.5 + i * 0.2,
                "cost": 0.03 + i * 0.01,
                "quality_score": 0.85 + i * 0.03,
                "tokens": {
                    "input": 10 + i * 5,
                    "output": 100 + i * 20,
                    "total": 110 + i * 25
                }
            })

        # 确定获胜者
        winner = models_list[0] if models_list else "unknown"

        comparison_result = {
            "prompt": prompt,
            "results": results,
            "winner": winner,
            "comparison_time": sum(r["response_time"] for r in results)
        }

        return comparison_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"模型对比失败: {str(e)}")
        raise HTTPException(status_code=500, detail="模型对比失败")


@router.get("/providers/{provider}/models")
@limiter.limit("60/minute")
async def get_provider_models(
    request: Request,
    provider: str,
    current_user: User = Depends(get_current_user)
):
    """获取特定提供商的可用模型"""
    try:
        # 尝试将provider字符串转换为AIProvider枚举
        try:
            provider_enum = AIProvider(provider)
        except ValueError:
            # 无效的提供商，返回空列表
            return []

        models_dict = await ai_model_service.get_available_models(provider_enum)

        # 将Dict转换为扁平的模型名称列表
        all_models = []
        for model_type, model_names in models_dict.items():
            all_models.extend(model_names)

        return all_models

    except Exception as e:
        logger.error(f"获取提供商模型失败: {str(e)}")
        # 返回空列表而不是抛出异常
        return []


@router.post("/embeddings/batch")
@limiter.limit("10/minute")
async def batch_embeddings(
    request: Request,
    batch_request: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量文本向量化接口"""
    try:
        # 检查速率限制
        user_id = current_user.id
        if not await rate_limiter.check_limit(f"batch_embeddings:{user_id}", 10, 60):
            raise HTTPException(status_code=429, detail="批量向量化请求过于频繁，请稍后再试")

        # 提取参数
        texts = batch_request.get("texts", [])
        provider = batch_request.get("provider", AIProvider.ZHIPUAI)
        model = batch_request.get("model")

        if not texts:
            raise HTTPException(status_code=400, detail="文本列表不能为空")

        # 批量处理嵌入
        results = []
        total_tokens = 0

        for text in texts:
            embedding_request = EmbeddingRequest(
                text=text,
                provider=provider,
                model=model,
                user_id=str(user_id)
            )

            try:
                response = await ai_model_service.create_embeddings(embedding_request)
                results.append({
                    "text": text,
                    "embedding": response.embedding,
                    "model": response.model,
                    "success": True
                })
                total_tokens += response.usage.get("total_tokens", 0)
            except Exception as e:
                results.append({
                    "text": text,
                    "error": str(e),
                    "success": False
                })

        # 后台任务：记录使用统计
        successful_count = sum(1 for r in results if r.get("success"))
        if successful_count > 0:
            background_tasks.add_task(
                cost_tracking_service.record_usage,
                user_id=user_id,
                provider=provider,
                model=model or "default",
                usage_data={"total_tokens": total_tokens},
                cost_data=0  # 根据实际情况计算
            )

        return {
            "results": results,
            "total": len(texts),
            "successful": successful_count,
            "failed": len(texts) - successful_count,
            "total_tokens": total_tokens
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量向量化失败: {str(e)}")
        raise HTTPException(status_code=500, detail="批量向量化失败")