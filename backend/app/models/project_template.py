"""
项目模板数据模型

存储从Excel解析出的项目成本模板数据
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.session import Base


class ProjectTemplate(Base):
    """项目模板模型"""
    
    __tablename__ = "project_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 基本信息
    name = Column(String(200), nullable=False, index=True, comment="项目名称")
    project_type = Column(String(50), nullable=True, comment="项目类型")
    area = Column(Float, nullable=False, comment="建筑面积（平方米）")
    floors = Column(String(100), nullable=True, comment="层数信息")
    underground_floors = Column(Integer, nullable=True, comment="地下层数")
    aboveground_floors = Column(Integer, nullable=True, comment="地上层数")
    
    # 时间信息
    start_date = Column(String(100), nullable=True, comment="开工时间（字符串格式）")
    completion_date = Column(String(100), nullable=True, comment="竣工时间（字符串格式）")
    start_date_parsed = Column(DateTime(timezone=True), nullable=True, comment="解析后的开工时间")
    completion_date_parsed = Column(DateTime(timezone=True), nullable=True, comment="解析后的竣工时间")
    
    # 成本信息
    total_cost = Column(Float, nullable=True, comment="总造价（元）")
    unit_cost = Column(Float, nullable=True, comment="单方造价（元/m²）")
    
    # 来源信息
    source_file = Column(String(500), nullable=True, comment="源文件路径")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="创建者ID")
    
    # 状态
    is_enabled = Column(Boolean, default=True, nullable=False, index=True, comment="是否启用")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关系
    cost_items = relationship("ProjectTemplateCostItem", back_populates="template", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<ProjectTemplate(id={self.id}, name='{self.name}', area={self.area})>"


class ProjectTemplateCostItem(Base):
    """项目模板成本项模型"""
    
    __tablename__ = "project_template_cost_items"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("project_templates.id"), nullable=False, index=True)
    
    # 成本项信息
    item_code = Column(String(50), nullable=False, index=True, comment="成本项代码（如1.0, 1.1等）")
    item_name = Column(String(200), nullable=False, comment="成本项名称")
    item_type = Column(String(50), nullable=False, comment="成本项类型（primary, secondary, detail）")
    
    # 价格信息
    total_price = Column(Float, nullable=True, comment="总价（元）")
    unit_price = Column(Float, nullable=True, comment="单方造价（元/m²）")
    notes = Column(Text, nullable=True, comment="备注")
    
    # 层级关系
    is_primary_section = Column(Boolean, default=False, nullable=False, index=True, comment="是否是一级分部")
    is_secondary_section = Column(Boolean, default=False, nullable=False, index=True, comment="是否是二级分部")
    primary_section_code = Column(String(50), nullable=True, index=True, comment="所属一级分部代码")
    
    # 原始数据位置
    row_number = Column(Integer, nullable=True, comment="在Excel中的行号")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关系
    template = relationship("ProjectTemplate", back_populates="cost_items")
    
    def __repr__(self):
        return f"<ProjectTemplateCostItem(id={self.id}, code='{self.item_code}', name='{self.item_name}')>"



