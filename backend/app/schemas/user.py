"""
用户数据Schema
"""
from typing import Optional, Union
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_serializer


class UserBase(BaseModel):
    """用户基础Schema"""
    email: EmailStr = Field(..., description="邮箱地址")
    full_name: Optional[str] = Field(None, description="全名")
    username: Optional[str] = Field(None, description="用户名")
    phone: Optional[str] = Field(None, description="手机号")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    is_active: bool = Field(True, description="是否激活")
    is_superuser: bool = Field(False, description="是否超级用户")
    is_verified: bool = Field(False, description="是否已验证")
    preferences: Optional[dict] = Field(None, description="用户偏好设置")
    default_llm_model: Optional[str] = Field(None, description="默认LLM模型")
    notes: Optional[str] = Field(None, description="备注")


class UserCreate(UserBase):
    """创建用户Schema"""
    password: str = Field(..., min_length=6, description="密码")
    username: str = Field(..., description="用户名")


class UserUpdate(BaseModel):
    """更新用户Schema"""
    email: Optional[EmailStr] = Field(None, description="邮箱地址")
    full_name: Optional[str] = Field(None, description="全名")
    username: Optional[str] = Field(None, description="用户名")
    phone: Optional[str] = Field(None, description="手机号")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    password: Optional[str] = Field(None, min_length=6, description="密码")
    is_active: Optional[bool] = Field(None, description="是否激活")
    is_superuser: Optional[bool] = Field(None, description="是否超级用户")
    is_verified: Optional[bool] = Field(None, description="是否已验证")
    preferences: Optional[dict] = Field(None, description="用户偏好设置")
    default_llm_model: Optional[str] = Field(None, description="默认LLM模型")
    notes: Optional[str] = Field(None, description="备注")


class UserInDBBase(UserBase):
    """数据库中的用户Schema"""
    id: Optional[int] = Field(None, description="用户ID")
    created_at: Optional[Union[str, datetime]] = Field(None, description="创建时间")
    updated_at: Optional[Union[str, datetime]] = Field(None, description="更新时间")
    last_login_at: Optional[Union[str, datetime]] = Field(None, description="最后登录时间")
    login_count: Optional[int] = Field(0, description="登录次数")
    failed_login_attempts: Optional[int] = Field(0, description="失败登录次数")
    locked_until: Optional[Union[str, datetime]] = Field(None, description="锁定到期时间")

    @field_serializer('created_at', 'updated_at', 'last_login_at', 'locked_until', when_used='json')
    def serialize_datetime(self, value: Optional[datetime], _info) -> Optional[str]:
        """序列化datetime为ISO格式字符串"""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value) if value else None

    class Config:
        from_attributes = True


class User(UserInDBBase):
    """用户响应Schema"""
    pass


class UserInDB(UserInDBBase):
    """数据库中的用户Schema（包含敏感信息）"""
    hashed_password: str


class LoginRequest(BaseModel):
    """登录请求Schema"""
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=1, description="密码")
    remember_me: Optional[bool] = Field(False, description="记住登录状态")


class PasswordChange(BaseModel):
    """修改密码请求Schema"""
    current_password: str = Field(..., min_length=1, description="当前密码")
    new_password: str = Field(..., min_length=6, description="新密码")


class PasswordRecoveryRequest(BaseModel):
    """密码重置请求Schema"""
    email: EmailStr = Field(..., description="邮箱地址")


class PasswordReset(BaseModel):
    """密码重置Schema"""
    token: str = Field(..., description="重置令牌")
    new_password: str = Field(..., min_length=6, description="新密码")


class EmailVerification(BaseModel):
    """邮箱验证Schema"""
    token: str = Field(..., description="验证令牌")


class Message(BaseModel):
    """通用消息响应Schema"""
    message: str = Field(..., description="消息内容")
    success: bool = Field(True, description="是否成功")


class UserProfileUpdate(BaseModel):
    """用户个人资料更新Schema"""
    full_name: Optional[str] = Field(None, description="姓名")
    email: Optional[EmailStr] = Field(None, description="邮箱")
    phone: Optional[str] = Field(None, description="手机号码")
    title: Optional[str] = Field(None, description="职位")
    department: Optional[str] = Field(None, description="部门")
    company: Optional[str] = Field(None, description="公司")
    location: Optional[str] = Field(None, description="所在地")
    bio: Optional[str] = Field(None, max_length=500, description="个人简介")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    timezone: Optional[str] = Field(None, description="时区")
    language: Optional[str] = Field(None, description="语言")
    theme: Optional[str] = Field(None, description="主题")


class UserPreferencesUpdate(BaseModel):
    """用户偏好设置更新Schema"""
    email_notifications: Optional[bool] = Field(None, description="邮件通知")
    push_notifications: Optional[bool] = Field(None, description="推送通知")
    weekly_report: Optional[bool] = Field(None, description="每周报告")
    auto_save: Optional[bool] = Field(None, description="自动保存")
    two_factor_auth: Optional[bool] = Field(None, description="双因素认证")
    theme: Optional[str] = Field(None, description="主题")
    language: Optional[str] = Field(None, description="语言")
    timezone: Optional[str] = Field(None, description="时区")


class UserProfileResponse(BaseModel):
    """用户个人资料响应Schema"""
    id: int
    username: str
    email: str
    phone: Optional[str] = None
    full_name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    company: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    created_at: Optional[Union[str, datetime]] = None
    last_login_at: Optional[Union[str, datetime]] = None
    login_count: int = 0
    preferences: Optional[dict] = None
    
    @field_serializer('created_at', 'last_login_at', when_used='json')
    def serialize_datetime(self, value: Optional[datetime], _info) -> Optional[str]:
        """序列化datetime为ISO格式字符串"""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value) if value else None

    class Config:
        from_attributes = True