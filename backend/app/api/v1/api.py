
"""
API v1 路由配置 - 最小化版本，确保后端成功启动
"""
from fastapi import APIRouter

from app.api.v1 import auth, users
# 启用文档管理和智能问答模块
from app.api.v1.endpoints import documents, qa, users as user_endpoints
from app.api.v1.endpoints import ai_models, template_estimates, cost_estimates, knowledge_graph, templates, ai_estimates, knowledge_graph_batch_delete, nas_import, nas_config, domains, system_config, system_logs

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

# 用户个人资料路由
api_router.include_router(
    user_endpoints.router,
    prefix="/user",
    tags=["个人资料"]
)

# 文档管理路由
api_router.include_router(
    documents.router,
    prefix="/documents",
    tags=["文档管理"]
)

# AI模型配置路由
api_router.include_router(
    ai_models.router,
    prefix="/ai-models",
    tags=["国产大模型"]
)

# 智能问答路由
api_router.include_router(
    qa.router,
    prefix="/qa",
    tags=["智能问答"]
)

# 基于模板的成本估算路由
api_router.include_router(
    template_estimates.router,
    prefix="/template-estimates",
    tags=["成本估算"]
)

# 成本估算路由（完整版）
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

# 知识图谱批量操作路由
api_router.include_router(
    knowledge_graph_batch_delete.router,
    prefix="/knowledge-graph",
    tags=["知识图谱批量操作"]
)

# 模板管理路由
api_router.include_router(
    templates.router,
    prefix="/templates",
    tags=["模板管理"]
)

# AI智能估算路由
api_router.include_router(
    ai_estimates.router,
    prefix="/estimates",
    tags=["AI智能估算"]
)

# NAS数据导入路由
api_router.include_router(
    nas_import.router,
    prefix="/nas-import",
    tags=["NAS导入"]
)

# NAS配置管理路由
api_router.include_router(
    nas_config.router,
    prefix="/nas-config",
    tags=["NAS配置"]
)

# 知识领域管理路由
api_router.include_router(
    domains.router,
    prefix="/domains",
    tags=["知识领域"]
)

# 系统配置路由
api_router.include_router(
    system_config.router,
    prefix="/system-config",
    tags=["系统配置"]
)

# 系统日志路由
api_router.include_router(
    system_logs.router,
    prefix="/system",
    tags=["系统日志"]
)