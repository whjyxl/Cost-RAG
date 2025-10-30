"""
用户数据模型
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.session import Base


class User(Base):
    """用户模型"""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(500), nullable=True)

    # 用户角色和权限
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)

    # 用户偏好设置
    preferences = Column(JSON, nullable=True)
    default_llm_model = Column(String(100), nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # 登录信息
    login_count = Column(Integer, default=0)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # 备注
    notes = Column(Text, nullable=True)

    # 关系
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    estimates = relationship("CostEstimate", back_populates="created_by_user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="uploaded_by_user", cascade="all, delete-orphan")
    query_histories = relationship("QueryHistory", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"

    @property
    def is_locked(self) -> bool:
        """检查用户是否被锁定"""
        if self.locked_until is None:
            return False
        from datetime import datetime, timezone
        return datetime.now(timezone.utc) < self.locked_until

    def get_display_name(self) -> str:
        """获取显示名称"""
        return self.full_name or self.username

    def get_preference(self, key: str, default=None):
        """获取用户偏好设置"""
        if not self.preferences:
            return default
        return self.preferences.get(key, default)

    def set_preference(self, key: str, value):
        """设置用户偏好"""
        if not self.preferences:
            self.preferences = {}
        self.preferences[key] = value