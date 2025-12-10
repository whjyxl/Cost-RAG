"""
价格调整系数数据模型

存储价格调整系数配置，用于成本估算的时间调整
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, Enum
from sqlalchemy.sql import func
import enum

from app.db.session import Base


class FactorType(str, enum.Enum):
    """系数类型枚举"""
    LABOR = "labor"  # 人工费
    MATERIAL = "material"  # 材料费
    EQUIPMENT = "equipment"  # 机械费
    COMPOSITE = "composite"  # 综合系数


class PriceAdjustmentFactor(Base):
    """价格调整系数模型
    
    存储价格调整系数配置，用于根据时间差调整成本
    """
    __tablename__ = "price_adjustment_factors"

    id = Column(Integer, primary_key=True, index=True)
    
    # 系数基本信息
    factor_type = Column(Enum(FactorType), nullable=False, index=True, comment="系数类型")
    name = Column(String(200), nullable=False, comment="系数名称")
    description = Column(Text, nullable=True, comment="系数说明")
    
    # 年份和增长率
    year = Column(Integer, nullable=True, index=True, comment="适用年份")
    annual_growth_rate = Column(Float, nullable=False, default=0.0, comment="年增长率（小数，如0.05表示5%）")
    
    # 权重（用于综合系数）
    labor_weight = Column(Float, default=0.3, comment="人工费权重")
    material_weight = Column(Float, default=0.6, comment="材料费权重")
    equipment_weight = Column(Float, default=0.1, comment="机械费权重")
    
    # 地区和质量系数
    region_code = Column(String(50), nullable=True, index=True, comment="地区代码")
    region_name = Column(String(100), nullable=True, comment="地区名称")
    quality_level = Column(String(50), nullable=True, index=True, comment="质量等级")
    quality_multiplier = Column(Float, default=1.0, comment="质量等级系数")
    
    # 生效时间
    effective_from = Column(DateTime(timezone=True), nullable=True, comment="生效开始时间")
    effective_to = Column(DateTime(timezone=True), nullable=True, comment="生效结束时间")
    
    # 数据来源
    data_source = Column(String(200), nullable=True, comment="数据来源")
    source_url = Column(String(500), nullable=True, comment="数据来源URL")
    
    # 状态
    is_active = Column(Boolean, default=True, nullable=False, index=True, comment="是否启用")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<PriceAdjustmentFactor(id={self.id}, type='{self.factor_type}', rate={self.annual_growth_rate})>"

