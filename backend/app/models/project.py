"""
项目和成本估算数据模型
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Boolean, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
import enum

from app.db.session import Base


class ProjectType(str, enum.Enum):
    """项目类型枚举"""
    RESIDENTIAL = "住宅"
    COMMERCIAL = "商业"
    OFFICE = "办公楼"
    INDUSTRIAL = "工业"
    EDUCATIONAL = "教育"
    MEDICAL = "医疗"
    INFRASTRUCTURE = "基础设施"
    OTHER = "其他"


class Project(Base):
    """项目模型"""

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # 项目基本信息
    project_type = Column(Enum(ProjectType), nullable=False)
    location = Column(String(500), nullable=True)
    address = Column(String(500), nullable=True)
    client_name = Column(String(200), nullable=True)

    # 项目规模
    total_area = Column(Float, nullable=True)  # 总面积（平方米）
    building_area = Column(Float, nullable=True)  # 建筑面积
    plot_area = Column(Float, nullable=True)  # 占地面积
    floor_count = Column(Integer, nullable=True)  # 楼层数

    # 成本信息
    estimated_budget = Column(Float, nullable=True)  # 预算成本
    actual_cost = Column(Float, nullable=True)  # 实际成本
    unit_cost = Column(Float, nullable=True)  # 单位成本

    # 项目状态
    status = Column(String(50), default="规划中")  # 规划中、设计中、施工中、竣工
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)

    # 技术参数
    structure_type = Column(String(100), nullable=True)  # 结构类型
    quality_level = Column(String(50), nullable=True)  # 质量等级
    design_standard = Column(String(100), nullable=True)  # 设计标准

    # 地理信息
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # 项目团队
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_manager = Column(String(100), nullable=True)
    design_team = Column(String(200), nullable=True)

    # 元数据
    tags = Column(ARRAY(String), nullable=True)  # 项目标签
    metadata = Column(JSON, nullable=True)  # 其他元数据

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    owner = relationship("User", back_populates="projects")
    estimates = relationship("CostEstimate", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', type='{self.project_type}')>"


class CostEstimate(Base):
    """成本估算模型"""

    __tablename__ = "cost_estimates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # 关联项目
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 估算信息
    estimate_date = Column(DateTime(timezone=True), server_default=func.now())
    version = Column(String(20), default="1.0")
    status = Column(String(50), default="draft")  # draft, submitted, approved, rejected

    # 成本汇总
    total_cost = Column(Float, nullable=False, default=0.0)
    direct_cost = Column(Float, default=0.0)  # 直接成本
    indirect_cost = Column(Float, default=0.0)  # 间接成本
    contingency_cost = Column(Float, default=0.0)  # 预备费
    profit_margin = Column(Float, default=0.0)  # 利润率
    tax_rate = Column(Float, default=0.0)  # 税率

    # 成本分析
    cost_per_unit = Column(Float, nullable=True)  # 单位成本
    cost_breakdown = Column(JSON, nullable=True)  # 成本分解

    # 估算参数
    exchange_rate = Column(Float, default=1.0)  # 汇率
    inflation_rate = Column(Float, default=0.0)  # 通胀率
    region_factor = Column(Float, default=1.0)  # 地区系数

    # 审批信息
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_notes = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    project = relationship("Project", back_populates="estimates")
    created_by_user = relationship("User", foreign_keys=[created_by], back_populates="estimates")
    approver = relationship("User", foreign_keys=[approved_by])
    items = relationship("CostItem", back_populates="estimate", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CostEstimate(id={self.id}, name='{self.name}', total_cost={self.total_cost})>"


class CostItem(Base):
    """成本项模型"""

    __tablename__ = "cost_items"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, ForeignKey("cost_estimates.id"), nullable=False)

    # 分类信息
    category = Column(String(100), nullable=False, index=True)  # 大类：主体结构、装饰装修、机电等
    subcategory = Column(String(100), nullable=True)  # 小类：混凝土工程、钢筋工程等
    item_code = Column(String(50), nullable=True)  # 项目编码

    # 项目信息
    item_name = Column(String(200), nullable=False)
    specification = Column(String(500), nullable=True)  # 规格说明
    unit = Column(String(20), nullable=False)  # 单位：m³、㎡、t等

    # 数量和价格
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    # 成本构成
    material_cost = Column(Float, default=0.0)  # 材料费
    labor_cost = Column(Float, default=0.0)  # 人工费
    equipment_cost = Column(Float, default=0.0)  # 设备费
    overhead_cost = Column(Float, default=0.0)  # 管理费

    # 质量信息
    quality_grade = Column(String(50), nullable=True)  # 质量等级
    brand = Column(String(100), nullable=True)  # 品牌
    supplier = Column(String(200), nullable=True)  # 供应商

    # 技术参数
    technical_params = Column(JSON, nullable=True)  # 技术参数
    construction_method = Column(String(200), nullable=True)  # 施工方法

    # 风险分析
    risk_level = Column(String(20), default="low")  # low, medium, high
    risk_factors = Column(JSON, nullable=True)  # 风险因素
    contingency_rate = Column(Float, default=0.0)  # 预备费率

    # 来源信息
    data_source = Column(String(100), nullable=True)  # 数据来源
    reference_project = Column(String(200), nullable=True)  # 参考项目
    market_price_date = Column(DateTime(timezone=True), nullable=True)  # 市场价格日期

    # 备注
    notes = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    estimate = relationship("CostEstimate", back_populates="items")

    def __repr__(self):
        return f"<CostItem(id={self.id}, name='{self.item_name}', total_price={self.total_price})>"

    def calculate_total_price(self):
        """计算总价"""
        self.total_price = self.quantity * self.unit_price

    def get_cost_breakdown(self):
        """获取成本分解"""
        breakdown = {
            "material_cost": self.material_cost,
            "labor_cost": self.labor_cost,
            "equipment_cost": self.equipment_cost,
            "overhead_cost": self.overhead_cost,
            "total": self.total_price
        }
        return breakdown