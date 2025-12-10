"""
Schema模块初始化文件
"""
from typing import Optional

from pydantic import BaseModel, Field


class Token(BaseModel):
    """Token响应Schema"""
    access_token: str = Field(..., description="访问令牌")
    token_type: str = Field("bearer", description="令牌类型")
    expires_in: int = Field(..., description="令牌过期时间（秒）")
    refresh_token: Optional[str] = Field(None, description="刷新令牌")
    user: Optional[dict] = Field(None, description="用户信息")


class TokenRefresh(BaseModel):
    """Token刷新请求Schema"""
    refresh_token: str = Field(..., description="刷新令牌")


# 导入用户相关的schemas
from app.schemas.user import (
    User, UserCreate, UserUpdate, UserInDB, LoginRequest,
    PasswordChange, PasswordRecoveryRequest, PasswordReset,
    EmailVerification, Message
)

# 导入项目相关的schemas
from app.schemas.project import (
    Project, ProjectCreate, ProjectUpdate
)

__all__ = [
    # Token schemas
    "Token",
    "TokenRefresh",

    # User schemas
    "User",
    "UserCreate",
    "UserUpdate",
    "UserInDB",
    "LoginRequest",
    "PasswordChange",
    "PasswordRecoveryRequest",
    "PasswordReset",
    "EmailVerification",
    "Message",

    # Project schemas
    "Project",
    "ProjectCreate",
    "ProjectUpdate",
]