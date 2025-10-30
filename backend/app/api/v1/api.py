"""
API v1 路由配置
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, documents, cost_estimates, knowledge_graph, ai_models, qa

api_router = APIRouter()

# 认证相关路由
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["认证"]
)

# 用户管理路由
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["用户管理"]
)

# 文档管理路由
api_router.include_router(
    documents.router,
    prefix="/documents",
    tags=["文档管理"]
)

# 成本估算路由
api_router.include_router(
    cost_estimates.router,
    prefix="/cost-estimates",
    tags=["成本估算"]
)

# 知识图谱路由
api_router.include_router(
    knowledge_graph.router,
    prefix="/knowledge-graph",
    tags=["知识图谱"]
)

# AI模型路由
api_router.include_router(
    ai_models.router,
    prefix="/ai-models",
    tags=["AI模型"]
)

# 智能问答路由
api_router.include_router(
    qa.router,
    prefix="/qa",
    tags=["智能问答"]
)