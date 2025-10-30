"""
应用配置管理模块
"""
from functools import lru_cache
from typing import List, Optional, Any
from pydantic import validator
from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    """应用配置类"""

    # 应用基础配置
    APP_NAME: str = "Cost-RAG API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1

    # 数据库配置
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    @validator("DATABASE_URL", pre=True)
    def assemble_db_connection(cls, v: Optional[str], values: dict[str, Any]) -> str:
        if isinstance(v, str):
            return v
        return f"postgresql+asyncpg://{values.get('POSTGRES_USER')}:{values.get('POSTGRES_PASSWORD')}@{values.get('POSTGRES_HOST')}:{values.get('POSTGRES_PORT')}/{values.get('POSTGRES_DB')}"

    # Redis配置
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_CACHE_TTL: int = 3600  # 1小时
    REDIS_SESSION_TTL: int = 86400  # 24小时

    # JWT配置
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # CORS配置
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3004"]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # 文件存储配置
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS: set[str] = {".pdf", ".docx", ".doc", ".txt", ".xlsx", ".xls", ".pptx", ".ppt"}

    # 向量数据库配置
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None

    # 知识图谱配置
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str

    # 国产AI模型配置
    # 智谱AI
    ZHIPUAI_API_KEY: Optional[str] = None
    ZHIPUAI_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4"

    # 月之暗面
    MOONSHOT_API_KEY: Optional[str] = None
    MOONSHOT_BASE_URL: str = "https://api.moonshot.cn/v1"

    # 阿里通义千问
    DASHSCOPE_API_KEY: Optional[str] = None
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/api/v1"

    # 百度文心一言
    QIANFAN_ACCESS_KEY: Optional[str] = None
    QIANFAN_SECRET_KEY: Optional[str] = None
    QIANFAN_BASE_URL: str = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop"

    # 深度求索
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"

    # 零一万物
    LINGYI_API_KEY: Optional[str] = None
    LINGYI_BASE_URL: str = "https://api.lingyiwanwu.com/v1"

    # 科大讯飞星火
    SPARK_APP_ID: Optional[str] = None
    SPARK_API_SECRET: Optional[str] = None
    SPARK_API_KEY: Optional[str] = None
    SPARK_BASE_URL: str = "wss://spark-api.xf-yun.com/v3.1/chat"

    # OpenAI配置（备用）
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # Anthropic配置（备用）
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_BASE_URL: str = "https://api.anthropic.com"

    # 文档处理配置
    DOCUMENT_CHUNK_SIZE: int = 1000
    DOCUMENT_CHUNK_OVERLAP: int = 200
    DOCUMENT_MAX_LENGTH: int = 4000

    # 嵌入模型配置
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    EMBEDDING_DIMENSION: int = 384

    # RAG配置
    RAG_TOP_K: int = 5
    RAG_SIMILARITY_THRESHOLD: float = 0.7
    RAG_MAX_CONTEXT_LENGTH: int = 4000

    # 缓存配置
    CACHE_ENABLED: bool = True
    CACHE_TTL: int = 3600  # 1小时

    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}"
    LOG_FILE: str = "logs/app.log"

    # 任务队列配置
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # 监控配置
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090

    # 速率限制配置
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_USE_REDIS: bool = True
    RATE_LIMIT_DEFAULT_WINDOW: int = 60
    RATE_LIMIT_DEFAULT_LIMIT: int = 100
    RATE_LIMIT_CLEANUP_INTERVAL: int = 3600

    # 开发配置
    RELOAD: bool = False
    ACCESS_LOG: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


# 全局配置实例
settings = get_settings()