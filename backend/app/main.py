"""
FastAPI应用主入口
"""
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from app.core.config import settings
from app.db.session import engine, Base
from app.api.v1.api import api_router
from app.core.logging import setup_logging
from app.core.exceptions import setup_exception_handlers

# 设置日志
setup_logging()

# 创建FastAPI应用实例
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Cost-RAG - 工程造价咨询智能RAG系统",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    contact={
        "name": "Cost-RAG Team",
        "email": "support@cost-rag.com",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)

# 设置CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 设置受信任主机中间件
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"] if settings.DEBUG else ["localhost", "127.0.0.1", "*.cost-rag.com"]
)

# 设置异常处理器
setup_exception_handlers(app)

# 包含API路由
app.include_router(api_router, prefix=settings.API_V1_STR)

# 静态文件服务（如果有）
try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except RuntimeError:
    pass  # 静态文件目录不存在时忽略


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期管理"""
    # 启动时执行
    print("Cost-RAG API is starting up...")
    print(f"Database URL: {settings.DATABASE_URL}")
    print(f"Redis URL: {settings.REDIS_URL}")
    print(f"Qdrant URL: {settings.QDRANT_URL}")
    print(f"Neo4j URL: {settings.NEO4J_URI}")

    yield

    # 关闭时执行
    print("Cost-RAG API is shutting down...")


# 设置生命周期
app.router.lifespan_context = lifespan


@app.get("/")
async def root():
    """根路径健康检查"""
    return {
        "message": "Welcome to Cost-RAG API",
        "version": settings.APP_VERSION,
        "status": "healthy",
        "docs": f"{settings.API_V1_STR}/docs",
        "openapi": f"{settings.API_V1_STR}/openapi.json"
    }


@app.get("/health")
async def health_check():
    """健康检查端点"""
    from datetime import datetime
    from datetime import timezone
    
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": settings.APP_VERSION,
        "environment": "development" if settings.DEBUG else "production"
    }


@app.get("/info")
async def app_info():
    """应用信息端点"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": "工程造价咨询智能RAG系统",
        "features": [
            "文档管理和向量化",
            "知识图谱构建",
            "成本估算分析",
            "智能问答系统",
            "多源数据融合"
        ],
        "supported_ai_models": [
            "智谱AI (GLM-4, GLM-3-turbo)",
            "月之暗面 (Kimi)",
            "阿里通义千问",
            "百度文心一言",
            "深度求索",
            "零一万物",
            "科大讯飞星火"
        ]
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
        workers=settings.WORKERS,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=settings.ACCESS_LOG,
    )
