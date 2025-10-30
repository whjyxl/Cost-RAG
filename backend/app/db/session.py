"""
数据库会话管理
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator
import redis.asyncio as redis

from app.core.config import settings

# 异步数据库引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
)

# 异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# 基础模型类
Base = declarative_base()

# Redis连接
redis_client = redis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    获取异步数据库会话
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# 为了兼容性添加get_db别名
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    获取数据库会话 (别名函数)
    """
    async for session in get_async_session():
        yield session


async def get_redis() -> redis.Redis:
    """
    获取Redis客户端
    """
    return redis_client