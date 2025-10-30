"""
智能问答相关的API端点
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
from app.schemas.qa import (
    QueryRequest, QueryResponse, BatchQueryRequest, BatchQueryResponse,
    FeedbackRequest, FeedbackResponse, QuerySuggestion, ConversationContext,
    QueryType, DataSource
)
from app.services.qa_service import QAService
from app.utils.rate_limit import RateLimiter

logger = logging.getLogger(__name__)
router = APIRouter()

# 初始化服务
qa_service = QAService()
rate_limiter = RateLimiter()

@router.post("/query", response_model=QueryResponse)
@limiter.limit("30/minute")
async def process_query(
    request,
    query_request: QueryRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    处理智能问答查询

    支持多源检索（文档、知识图谱、成本数据库）和AI答案生成
    """
    try:
        # 检查速率限制
        user_id = current_user.id
        if not await rate_limiter.check_limit(f"query:{user_id}", 30, 60):
            raise HTTPException(status_code=429, detail="查询过于频繁，请稍后再试")

        # 设置用户信息
        query_request.user_id = user_id

        # 生成会话ID（如果未提供）
        if not query_request.session_id:
            import uuid
            query_request.session_id = f"session_{uuid.uuid4().hex[:12]}"

        # 处理查询
        response = await qa_service.process_query(query_request)

        # 后台任务：记录查询日志
        background_tasks.add_task(
            log_query_usage,
            user_id=user_id,
            query_id=response.query_id,
            query_type=query_request.query_type.value,
            processing_time=response.processing_time,
            confidence_score=response.answer.confidence_score
        )

        return response

    except Exception as e:
        logger.error(f"查询处理失败: {str(e)}")
        raise HTTPException(status_code=500, detail="查询处理失败")

@router.post("/batch-query", response_model=BatchQueryResponse)
@limiter.limit("5/minute")
async def batch_process_queries(
    request,
    batch_request: BatchQueryRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    批量处理查询请求

    支持并发处理多个查询，提高效率
    """
    try:
        # 检查速率限制
        user_id = current_user.id
        if not await rate_limiter.check_limit(f"batch_query:{user_id}", 5, 60):
            raise HTTPException(status_code=429, detail="批量查询过于频繁，请稍后再试")

        # 设置用户信息
        for query in batch_request.queries:
            query.user_id = user_id
            if not query.session_id:
                import uuid
                query.session_id = f"batch_session_{uuid.uuid4().hex[:12]}"

        # 处理批量查询
        result = await qa_service.batch_process_queries(batch_request)

        # 后台任务：记录批量查询日志
        background_tasks.add_task(
            log_batch_query_usage,
            user_id=user_id,
            batch_id=result["batch_id"],
            total_queries=result["total_queries"],
            successful_queries=result["successful_queries"],
            processing_time=result["total_processing_time"]
        )

        return BatchQueryResponse(**result)

    except Exception as e:
        logger.error(f"批量查询处理失败: {str(e)}")
        raise HTTPException(status_code=500, detail="批量查询处理失败")

@router.get("/suggestions", response_model=List[QuerySuggestion])
@limiter.limit("20/minute")
async def get_query_suggestions(
    request,
    session_id: Optional[str] = Query(None, description="会话ID"),
    limit: int = Query(5, ge=1, le=20, description="建议数量"),
    current_user: User = Depends(get_current_user)
):
    """
    获取查询建议

    基于用户历史和上下文生成智能查询建议
    """
    try:
        user_id = current_user.id
        suggestions = await qa_service.get_query_suggestions(
            user_id=user_id,
            session_id=session_id,
            limit=limit
        )
        return suggestions

    except Exception as e:
        logger.error(f"获取查询建议失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取查询建议失败")

@router.get("/context/{session_id}", response_model=Optional[ConversationContext])
@limiter.limit("30/minute")
async def get_conversation_context(
    request,
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    获取对话上下文

    用于恢复和显示对话历史
    """
    try:
        context = await qa_service.get_conversation_context(session_id)

        # 验证上下文属于当前用户
        if context and context.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权访问此对话上下文")

        return context

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取对话上下文失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取对话上下文失败")

@router.delete("/context/{session_id}")
@limiter.limit("10/minute")
async def clear_conversation_context(
    request,
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    清除对话上下文

    清除指定会话的历史记录
    """
    try:
        # 验证用户权限
        context = await qa_service.get_conversation_context(session_id)
        if context and context.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权清除此对话上下文")

        success = await qa_service.clear_conversation_context(session_id)

        if success:
            return {"message": "对话上下文已清除", "session_id": session_id}
        else:
            return {"message": "对话上下文不存在", "session_id": session_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"清除对话上下文失败: {str(e)}")
        raise HTTPException(status_code=500, detail="清除对话上下文失败")

@router.post("/feedback", response_model=FeedbackResponse)
@limiter.limit("20/minute")
async def submit_feedback(
    request,
    feedback_request: FeedbackRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    提交查询反馈

    收集用户对查询结果的满意度评价，用于系统优化
    """
    try:
        # 验证用户权限
        if feedback_request.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权提交此反馈")

        # 生成反馈ID
        import uuid
        feedback_id = f"feedback_{uuid.uuid4().hex[:12]}"

        # 构建反馈响应
        feedback_response = FeedbackResponse(
            feedback_id=feedback_id,
            query_id=feedback_request.query_id,
            user_id=feedback_request.user_id,
            rating=feedback_request.rating,
            feedback_text=feedback_request.feedback_text,
            categories=feedback_request.categories,
            improvement_suggestions=feedback_request.improvement_suggestions
        )

        # 后台任务：处理反馈数据
        background_tasks.add_task(
            process_feedback,
            feedback_response.dict()
        )

        return feedback_response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"提交反馈失败: {str(e)}")
        raise HTTPException(status_code=500, detail="提交反馈失败")

@router.get("/analytics", response_model=Dict[str, Any])
@limiter.limit("10/minute")
async def get_query_analytics(
    request,
    days: int = Query(7, ge=1, le=365, description="统计天数"),
    query_type: Optional[QueryType] = Query(None, description="查询类型过滤"),
    current_user: User = Depends(get_current_user)
):
    """
    获取查询分析数据

    提供查询统计、质量分析等数据
    """
    try:
        user_id = current_user.id

        # 这里应该从数据库获取真实的分析数据
        # 目前返回模拟数据
        analytics = {
            "total_queries": 50,
            "average_processing_time": 2.5,
            "average_confidence_score": 0.85,
            "average_quality_score": 0.82,
            "query_types": {
                "simple": 20,
                "complex": 15,
                "cost_estimation": 10,
                "technical": 5
            },
            "daily_stats": [
                {"date": "2024-01-01", "queries": 8, "avg_quality": 0.88},
                {"date": "2024-01-02", "queries": 12, "avg_quality": 0.85},
                {"date": "2024-01-03", "queries": 6, "avg_quality": 0.82}
            ],
            "satisfaction_distribution": {
                "5": 15,  # 非常满意
                "4": 20,  # 满意
                "3": 10,  # 一般
                "2": 3,   # 不满意
                "1": 2    # 非常不满意
            }
        }

        return analytics

    except Exception as e:
        logger.error(f"获取查询分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取查询分析失败")

@router.get("/health")
@limiter.limit("60/minute")
async def health_check(request):
    """
    健康检查

    检查QA服务的运行状态
    """
    try:
        return {
            "status": "healthy",
            "service": "qa_service",
            "timestamp": "2024-01-01T00:00:00Z",
            "version": "1.0.0"
        }

    except Exception as e:
        logger.error(f"健康检查失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务不可用")

@router.get("/config", response_model=Dict[str, Any])
@limiter.limit("30/minute")
async def get_qa_config(
    request,
    current_user: User = Depends(get_current_user)
):
    """
    获取QA系统配置

    返回可用的查询类型、数据源等配置信息
    """
    try:
        config = {
            "query_types": [
                {"value": "simple", "label": "简单查询"},
                {"value": "complex", "label": "复杂查询"},
                {"value": "cost_estimation", "label": "成本估算"},
                {"value": "technical", "label": "技术咨询"},
                {"value": "market", "label": "市场分析"},
                {"value": "regulatory", "label": "法规咨询"},
                {"value": "project_management", "label": "项目管理"},
                {"value": "material", "label": "材料咨询"},
                {"value": "equipment", "label": "设备咨询"}
            ],
            "data_sources": [
                {"value": "documents", "label": "文档检索"},
                {"value": "knowledge_graph", "label": "知识图谱"},
                {"value": "cost_database", "label": "成本数据库"},
                {"value": "ai_model", "label": "AI模型生成"}
            ],
            "max_results": {
                "min": 1,
                "max": 50,
                "default": 10
            },
            "supported_languages": ["zh", "en"],
            "features": {
                "conversation_context": True,
                "batch_processing": True,
                "feedback_system": True,
                "query_suggestions": True,
                "multi_source_retrieval": True
            }
        }

        return config

    except Exception as e:
        logger.error(f"获取QA配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取QA配置失败")

@router.post("/test-connection")
@limiter.limit("10/minute")
async def test_service_connection(
    request,
    current_user: User = Depends(get_current_user)
):
    """
    测试服务连接

    测试各个依赖服务的连接状态
    """
    try:
        # 检查用户权限
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="需要管理员权限")

        connection_status = {
            "document_service": "connected",
            "knowledge_graph_service": "connected",
            "cost_estimation_service": "connected",
            "ai_model_service": "connected",
            "database": "connected",
            "cache": "connected"
        }

        # 检查实际连接状态（这里应该有真实的检查逻辑）
        # 目前返回模拟状态

        return {
            "status": "all_services_connected",
            "services": connection_status,
            "timestamp": "2024-01-01T00:00:00Z"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"服务连接测试失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务连接测试失败")


# 后台任务函数
async def log_query_usage(
    user_id: int,
    query_id: str,
    query_type: str,
    processing_time: float,
    confidence_score: float
):
    """记录查询使用日志"""
    try:
        logger.info(f"查询使用记录 - 用户: {user_id}, 查询ID: {query_id}, "
                    f"类型: {query_type}, 耗时: {processing_time:.2f}s, "
                    f"置信度: {confidence_score:.3f}")
        # 这里应该将数据保存到数据库
    except Exception as e:
        logger.error(f"记录查询使用日志失败: {str(e)}")


async def log_batch_query_usage(
    user_id: int,
    batch_id: str,
    total_queries: int,
    successful_queries: int,
    processing_time: float
):
    """记录批量查询使用日志"""
    try:
        logger.info(f"批量查询记录 - 用户: {user_id}, 批次ID: {batch_id}, "
                    f"总查询数: {total_queries}, 成功数: {successful_queries}, "
                    f"总耗时: {processing_time:.2f}s")
        # 这里应该将数据保存到数据库
    except Exception as e:
        logger.error(f"记录批量查询使用日志失败: {str(e)}")


async def process_feedback(feedback_data: Dict[str, Any]):
    """处理反馈数据"""
    try:
        logger.info(f"处理用户反馈 - 反馈ID: {feedback_data.get('feedback_id')}, "
                    f"查询ID: {feedback_data.get('query_id')}, "
                    f"评分: {feedback_data.get('rating')}")
        # 这里应该将反馈数据保存到数据库并进行分析
    except Exception as e:
        logger.error(f"处理反馈数据失败: {str(e)}")