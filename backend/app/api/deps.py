"""
API依赖项配置
"""
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.core.security import verify_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    获取当前认证用户

    Args:
        token: JWT访问令牌
        db: 数据库会话

    Returns:
        当前用户对象

    Raises:
        HTTPException: 认证失败时抛出401错误
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 验证令牌
        payload = verify_token(token)
        if payload is None:
            raise credentials_exception

        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        
        # 将字符串ID转换为整数
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    # 从数据库获取用户
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户账户已被禁用"
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    获取当前活跃用户

    Args:
        current_user: 当前用户

    Returns:
        活跃用户对象

    Raises:
        HTTPException: 用户不活跃时抛出400错误
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户账户已被禁用"
        )
    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    获取当前超级用户

    Args:
        current_user: 当前用户

    Returns:
        超级用户对象

    Raises:
        HTTPException: 非超级用户时抛出403错误
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )
    return current_user


async def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    获取可选的当前用户（用于可选认证的端点）

    Args:
        token: JWT访问令牌（可选）
        db: 数据库会话

    Returns:
        用户对象或None
    """
    if not token:
        return None

    try:
        payload = verify_token(token)
        if payload is None:
            return None

        user_id: int = payload.get("sub")
        if user_id is None:
            return None

        # 从数据库获取用户
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None or not user.is_active:
            return None

        return user

    except (JWTError, Exception):
        return None


class PaginationParams:
    """分页参数"""

    def __init__(
        self,
        page: int = 1,
        size: int = 20,
        max_size: int = 100
    ):
        if page < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="页码必须大于0"
            )

        if size < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="每页数量必须大于0"
            )

        if size > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"每页数量不能超过{max_size}"
            )

        self.page = page
        self.size = size
        self.skip = (page - 1) * size

    @property
    def limit(self) -> int:
        return self.size

    @property
    def offset(self) -> int:
        return self.skip


def get_pagination_params(
    page: int = 1,
    size: int = 20
) -> PaginationParams:
    """
    获取分页参数依赖项

    Args:
        page: 页码，默认1
        size: 每页数量，默认20

    Returns:
        分页参数对象
    """
    return PaginationParams(page=page, size=size)


class RateLimiter:
    """简单的内存速率限制器（备用方案）"""

    def __init__(self):
        self.requests = {}

    def is_allowed(
        self,
        key: str,
        limit: int,
        window: int
    ) -> bool:
        """
        检查是否允许请求

        Args:
            key: 限制键（通常是用户ID或IP）
            limit: 限制数量
            window: 时间窗口（秒）

        Returns:
            是否允许请求
        """
        import time

        now = time.time()
        if key not in self.requests:
            self.requests[key] = []

        # 清理过期请求
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if now - req_time < window
        ]

        # 检查是否超过限制
        if len(self.requests[key]) >= limit:
            return False

        # 记录新请求
        self.requests[key].append(now)
        return True


class RedisRateLimiter:
    """基于Redis的分布式速率限制器"""

    def __init__(self, redis_client):
        self.redis = redis_client

    async def is_allowed(
        self,
        key: str,
        limit: int,
        window: int
    ) -> bool:
        """
        使用Redis滑动窗口算法检查是否允许请求

        Args:
            key: 限制键（通常是用户ID或IP）
            limit: 限制数量
            window: 时间窗口（秒）

        Returns:
            是否允许请求
        """
        import time

        try:
            now = time.time()
            redis_key = f"rate_limit:{key}"
            
            # 使用Redis的sorted set实现滑动窗口
            # 移除过期记录
            await self.redis.zremrangebyscore(
                redis_key, 0, now - window
            )
            
            # 获取当前窗口内的请求数
            count = await self.redis.zcard(redis_key)
            
            if count >= limit:
                return False
            
            # 添加当前请求
            await self.redis.zadd(redis_key, {str(now): now})
            # 设置过期时间（窗口大小 + 1秒缓冲）
            await self.redis.expire(redis_key, window + 1)
            
            return True
        except Exception:
            # Redis连接失败时，降级到内存限制器
            return False


# 全局速率限制器实例
# 优先使用Redis，如果Redis不可用则使用内存版本
memory_rate_limiter = RateLimiter()


async def get_redis_rate_limiter():
    """获取Redis速率限制器实例"""
    try:
        from app.db.session import get_redis
        redis_client = await get_redis()
        return RedisRateLimiter(redis_client)
    except Exception:
        return None


async def rate_limit(
    requests_per_minute: int = 60,
    current_user: User = Depends(get_current_user)
):
    """
    速率限制依赖项（支持Redis分布式限流）

    Args:
        requests_per_minute: 每分钟请求数限制
        current_user: 当前用户

    Raises:
        HTTPException: 超过速率限制时抛出429错误
    """
    key = f"user:{current_user.id}"
    window = 60  # 60秒窗口
    
    # 优先使用Redis分布式限流
    redis_rate_limiter = await get_redis_rate_limiter()
    
    if redis_rate_limiter:
        # 使用Redis限流
        is_allowed = await redis_rate_limiter.is_allowed(key, requests_per_minute, window)
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="请求过于频繁，请稍后再试"
            )
    else:
        # 降级到内存限流（单进程部署或Redis不可用时）
        if not memory_rate_limiter.is_allowed(key, requests_per_minute, window):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="请求过于频繁，请稍后再试"
            )


async def verify_file_size(
    max_size_mb: int = 100
):
    """
    文件大小验证依赖项工厂

    Args:
        max_size_mb: 最大文件大小（MB）

    Returns:
        验证函数
    """
    def _verify_file_size(file_size: int):
        if file_size > max_size_mb * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"文件大小不能超过{max_size_mb}MB"
            )
        return True

    return _verify_file_size


async def verify_file_type(
    allowed_types: list = None
):
    """
    文件类型验证依赖项工厂

    Args:
        allowed_types: 允许的文件类型列表

    Returns:
        验证函数
    """
    if allowed_types is None:
        allowed_types = ['.pdf', '.docx', '.doc', '.txt', '.md', '.html', '.htm',
                        '.xlsx', '.xls', '.csv', '.pptx', '.ppt', '.jpg', '.jpeg',
                        '.png', '.gif', '.bmp', '.tiff']

    def _verify_file_type(filename: str):
        import os
        file_ext = os.path.splitext(filename)[1].lower()

        if file_ext not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件类型: {file_ext}。支持的类型: {', '.join(allowed_types)}"
            )
        return True

    return _verify_file_type


async def get_db_session():
    """
    获取数据库会话依赖项的别名

    Returns:
        数据库会话
    """
    return get_db()


# 权限检查装饰器
def require_permissions(permissions: list):
    """
    权限检查依赖项工厂

    Args:
        permissions: 需要的权限列表

    Returns:
        权限检查函数
    """
    async def _check_permissions(
        current_user: User = Depends(get_current_user)
    ) -> User:
        # 超级用户拥有所有权限
        if current_user.is_superuser:
            return current_user

        # 这里可以实现更复杂的权限检查逻辑
        # 例如基于角色的权限检查（RBAC）
        user_permissions = getattr(current_user, 'permissions', [])

        for permission in permissions:
            if permission not in user_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"需要权限: {permission}"
                )

        return current_user

    return _check_permissions


# 项目成员权限检查
async def require_project_member(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    检查用户是否为项目成员

    Args:
        project_id: 项目ID
        current_user: 当前用户
        db: 数据库会话

    Returns:
        用户对象

    Raises:
        HTTPException: 非项目成员时抛出403错误
    """
    from sqlalchemy import select
    from app.models.project import Project
    
    # 超级用户拥有所有权限
    if current_user.is_superuser:
        return current_user
    
    # 查询项目是否存在
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 检查用户是否是项目所有者
    if project.owner_id == current_user.id:
        return current_user
    
    # TODO: 未来可以扩展为项目成员表查询
    # 例如：查询ProjectMember表，检查用户是否在成员列表中
    # from app.models.project import ProjectMember
    # member_result = await db.execute(
    #     select(ProjectMember).where(
    #         ProjectMember.project_id == project_id,
    #         ProjectMember.user_id == current_user.id,
    #         ProjectMember.is_active == True
    #     )
    # )
    # if member_result.scalar_one_or_none():
    #     return current_user
    
    # 非项目成员，拒绝访问
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="您不是此项目的成员，无权访问"
    )


# 文档访问权限检查
async def require_document_access(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    检查用户是否有文档访问权限

    Args:
        document_id: 文档ID
        current_user: 当前用户
        db: 数据库会话

    Returns:
        用户对象

    Raises:
        HTTPException: 无访问权限时抛出403错误
    """
    from sqlalchemy import select
    from app.models.document import Document

    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    # 检查权限：文档所有者或公开文档
    if document.user_id != current_user.id and not document.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限访问此文档"
        )

    return current_user