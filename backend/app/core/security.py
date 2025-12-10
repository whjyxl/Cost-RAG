"""
安全模块 - 认证、授权、密码处理
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Union, Any

from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """获取密码哈希

    注意: bcrypt有72字节的密码长度限制
    """
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long")

    # 确保密码在UTF-8编码后不超过72字节
    password_bytes = password.encode('utf-8')[:72]
    password_truncated = password_bytes.decode('utf-8', errors='ignore')
    return pwd_context.hash(password_truncated)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict):
    """创建刷新令牌"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """验证令牌"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


# decode_token是verify_token的别名，为了代码可读性
decode_token = verify_token


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """通过邮箱获取用户"""
    result = await db.execute(
        select(User).where(User.email == email)
    )
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    """通过用户名获取用户"""
    result = await db.execute(
        select(User).where(User.username == username)
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    """通过ID获取用户"""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    return result.scalar_one_or_none()


async def authenticate_user(
    first: Union[AsyncSession, str],
    second: Optional[str] = None,
    password: Optional[str] = None,
    db: Optional[AsyncSession] = None,
) -> Optional[User]:
    """认证用户

    兼容历史签名，允许 authenticate_user(email, password) 的调用方式。
    """

    if isinstance(first, AsyncSession):
        session: Optional[AsyncSession] = first
        email = second
        plain_password = password
    else:
        session = db
        email = first  # type: ignore[assignment]
        plain_password = second

    if email is None or plain_password is None:
        raise TypeError("authenticate_user requires email and password")

    user = await get_user_by_email(session, email)  # type: ignore[arg-type]
    if not user:
        return None

    if not verify_password(plain_password, user.hashed_password):
        return None

    if not user.is_active:
        return None

    # 检查用户是否被锁定
    if user.is_locked:
        return None

    if session is not None:
        # 更新登录信息
        user.last_login_at = datetime.now(timezone.utc)
        user.login_count += 1
        user.failed_login_attempts = 0
        user.locked_until = None
        await session.commit()

    return user


async def update_user_login_info(db: AsyncSession, user: User, success: bool):
    """更新用户登录信息"""
    if success:
        user.last_login_at = datetime.now(timezone.utc)
        user.login_count += 1
        user.failed_login_attempts = 0
        user.locked_until = None
    else:
        user.failed_login_attempts += 1

        # 如果失败次数过多，锁定账户
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)

    await db.commit()


async def get_user_by_token(token: str, db: Optional[AsyncSession] = None) -> Optional[User]:
    """根据访问令牌获取用户信息"""
    if not token:
        return None

    payload = verify_token(token)
    if payload is None:
        return None

    email = payload.get("sub")
    if not email or db is None:
        return None

    return await get_user_by_email(db, email)


async def get_current_user(token: str, db: Optional[AsyncSession] = None) -> Optional[User]:
    """获取当前用户"""
    return await get_user_by_token(token, db)


async def get_current_active_user(token: str, db: Optional[AsyncSession] = None) -> Optional[User]:
    """获取当前活跃用户"""
    user = await get_current_user(token, db)
    if not user or not user.is_active:
        return None
    return user


def get_current_user_optional(token: str = None) -> Optional[dict]:
    """获取当前用户（可选）"""
    if not token:
        return None

    payload = verify_token(token)
    if payload is None:
        return None

    return payload


def check_user_permissions(user: User, required_permissions: list[str]) -> bool:
    """检查用户权限"""
    if user.is_superuser:
        return True

    # 这里可以扩展更复杂的权限检查逻辑
    # 例如基于角色、权限表等
    return False


# 从sqlalchemy导入select
from sqlalchemy import select