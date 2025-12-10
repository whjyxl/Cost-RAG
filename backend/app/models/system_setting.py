"""
系统设置模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.db.session import Base


class SystemSetting(Base):
    """系统设置模型"""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False, comment="设置键")
    value = Column(Text, nullable=True, comment="设置值")
    description = Column(Text, nullable=True, comment="设置描述")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")

    def __repr__(self):
        return f"<SystemSetting(key='{self.key}')>"