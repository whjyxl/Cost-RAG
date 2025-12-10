"""
系统配置模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.session import Base


class SystemConfig(Base):
    """系统配置模型"""
    
    __tablename__ = "system_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True, comment="配置键")
    config_value = Column(Text, comment="配置值")
    config_type = Column(String(50), default="string", comment="配置类型: string, json, int, bool")
    description = Column(String(500), comment="配置描述")
    category = Column(String(50), comment="配置分类: embedding, system, ai_model等")
    is_active = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
