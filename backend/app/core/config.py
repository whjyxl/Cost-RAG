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
        """
        组装或验证数据库连接URL
        
        如果提供了完整的DATABASE_URL，直接使用
        否则从分项配置组装，并验证所有必需字段是否存在
        """
        if isinstance(v, str) and v.strip():
            # 允许 SQLite URL（用于测试环境）
            if v.startswith(('sqlite://', 'sqlite+aiosqlite://')):
                return v
            # 验证连接字符串格式
            if not v.startswith(('postgresql://', 'postgresql+asyncpg://')):
                raise ValueError(
                    "DATABASE_URL必须以postgresql://或postgresql+asyncpg://开头"
                )
            return v
        
        # 从分项配置组装
        required_fields = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB']
        missing_fields = [field for field in required_fields if not values.get(field)]
        
        if missing_fields:
            raise ValueError(
                f"数据库配置不完整。缺少以下字段: {', '.join(missing_fields)}。"
                f"请提供完整的DATABASE_URL或所有分项配置。"
            )
        
        user = values.get('POSTGRES_USER')
        password = values.get('POSTGRES_PASSWORD')
        host = values.get('POSTGRES_HOST')
        port = values.get('POSTGRES_PORT')
        db = values.get('POSTGRES_DB')
        
        return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"

    # Redis配置
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_CACHE_TTL: int = 3600  # 1小时
    REDIS_SESSION_TTL: int = 86400  # 24小时

    # JWT配置
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # 2小时，减少频繁登录
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # CORS配置（开发环境）
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3004",
        "http://127.0.0.1:3000",
        "http://192.168.1.2:3000",  # 本地开发环境
        "http://ec2-18-190-28-18.us-east-2.compute.amazonaws.com:3000"  # 生产环境
    ]
    ENVIRONMENT: str = "development"  # development, production

    # AI模型API密钥配置
    ZHIPUAI_API_KEY: str = ""  # 智谱AI
    MOONSHOT_API_KEY: str = ""  # 月之暗面
    DASHSCOPE_API_KEY: str = ""  # 阿里通义千问
    BAIDU_API_KEY: str = ""  # 百度文心一言
    BAIDU_SECRET_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""  # 深度求索
    YI_API_KEY: str = ""  # 零一万物
    SPARK_APP_ID: str = ""  # 科大讯飞星火
    SPARK_API_SECRET: str = ""

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # 文件存储配置
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB（已调整）
    ALLOWED_EXTENSIONS: set[str] = {".pdf", ".docx", ".doc", ".txt", ".xlsx", ".xls", ".pptx", ".ppt"}

    @validator("UPLOAD_DIR", pre=True)
    def assemble_upload_dir(cls, v: Optional[str]) -> str:
        """
        确保上传目录是绝对路径，并创建目录
        """
        if not v:
            v = "uploads"

        # 如果是相对路径，转换为绝对路径
        if not os.path.isabs(v):
            from pathlib import Path
            # 相对于项目根目录
            project_root = Path(__file__).parent.parent.parent
            v = str(project_root / v)

        # 创建目录（如果不存在）
        os.makedirs(v, exist_ok=True)

        # 检查权限
        if not os.access(v, os.W_OK):
            raise ValueError(f"上传目录不可写: {v}")

        return v

    # 向量数据库配置
    # Qdrant向量数据库配置
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_MODE: str = "docker"  # docker或memory
    QDRANT_API_KEY: Optional[str] = None

    # 知识图谱配置
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str

    # 国产AI模型配置
    # 智谱AI
    ZHIPUAI_API_KEY: Optional[str] = ""
    ZHIPUAI_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4"

    # 月之暗面
    MOONSHOT_API_KEY: Optional[str] = ""
    MOONSHOT_BASE_URL: str = "https://api.moonshot.cn/v1"

    # 阿里通义千问
    DASHSCOPE_API_KEY: Optional[str] = None
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/api/v1"

    # 百度文心一言
    QIANFAN_ACCESS_KEY: Optional[str] = None
    QIANFAN_SECRET_KEY: Optional[str] = None
    QIANFAN_BASE_URL: str = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop"

    # 百度文心一言 (兼容配置)
    BAIDU_API_KEY: Optional[str] = None
    BAIDU_SECRET_KEY: Optional[str] = None

    # 深度求索
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"

    # 零一万物
    LINGYI_API_KEY: Optional[str] = None
    YI_API_KEY: Optional[str] = None  # 兼容配置
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
    RAG_SIMILARITY_THRESHOLD: float = 0.5  # 降低阈值以提高召回率
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

    # NAS配置（可选）
    NAS_HOST: Optional[str] = None
    NAS_PORT: Optional[str] = None
    NAS_SHARE_NAME: Optional[str] = None
    NAS_USERNAME: Optional[str] = None
    NAS_PASSWORD: Optional[str] = None
    NAS_MOUNT_POINT: Optional[str] = None
    NAS_MOUNT_POINT_WIN: Optional[str] = None
    NAS_AUTO_IMPORT: Optional[str] = None
    NAS_WATCH_INTERVAL: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


# 全局配置实例
settings = get_settings()