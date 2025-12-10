"""
数据库会话管理
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator
import redis.asyncio as redis

from app.core.config import settings

# Async database engine
# SQLite does not support pool_size and max_overflow parameters
if settings.DATABASE_URL.startswith('sqlite'):
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        # Force SQLite to use DEFERRED isolation level and enable auto-flush
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        echo=settings.DEBUG,
    )

# Async session factory - WITH autoflush enabled
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,  # Enable autoflush to ensure changes are written
    autocommit=False,  # Ensure explicit commit is required
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
            await session.commit()  # 提交事务
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# 为了兼容性添加get_db别名
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session (alias function)
    Delegates directly to get_async_session to ensure proper session management
    """
    async with AsyncSessionLocal() as session:
        print(f"[SESSION DEBUG] Created new session: {id(session)}")
        try:
            yield session
            print(f"[SESSION DEBUG] About to commit session: {id(session)}")
            await session.commit()  # Commit transaction
            print(f"[SESSION DEBUG] Session committed successfully: {id(session)}")
        except Exception as e:
            print(f"[SESSION DEBUG] Exception occurred, rolling back: {e}")
            await session.rollback()
            raise
        finally:
            print(f"[SESSION DEBUG] Closing session: {id(session)}")
            await session.close()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    获取独立的数据库会话（用于后台任务）
    与get_db相同的实现，但提供独立的命名以明确用途
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()  # 提交事务
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_redis() -> redis.Redis:
    """
    获取Redis客户端
    """
    return redis_client