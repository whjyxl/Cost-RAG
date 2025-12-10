"""
知识领域数据模型 - 支持知识图谱的领域分类管理
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Index, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.session import Base


class KnowledgeDomain(Base):
    """知识领域模型 - 定义预定义的知识分类领域"""

    __tablename__ = "knowledge_domains"

    id = Column(Integer, primary_key=True, index=True)

    # 领域标识
    domain_code = Column(String(50), unique=True, nullable=False, index=True)  # 领域代码，如 'standard_specification'
    domain_name = Column(String(200), nullable=False)  # 领域名称，如 '清单标准规范'

    # 描述信息
    description = Column(Text, nullable=True)  # 领域描述
    keywords = Column(Text, nullable=True)  # 关键词列表（逗号分隔），用于问题领域识别

    # 可视化配置
    color = Column(String(20), nullable=True)  # 可视化颜色（十六进制色值）
    icon = Column(String(50), nullable=True)  # 图标名称
    display_order = Column(Integer, default=0)  # 显示顺序

    # 权重配置（用于检索评分）
    default_weight = Column(Float, default=1.0)  # 默认权重，范围 0.5-2.0

    # 状态管理
    is_active = Column(Boolean, default=True)  # 是否启用
    is_system = Column(Boolean, default=True)  # 是否为系统预定义（不可删除）

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    node_mappings = relationship(
        "NodeDomainMapping",
        back_populates="domain",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<KnowledgeDomain(id={self.id}, code='{self.domain_code}', name='{self.domain_name}')>"

    @property
    def node_count(self) -> int:
        """获取该领域的节点数量"""
        return len(self.node_mappings) if self.node_mappings else 0


class NodeDomainMapping(Base):
    """节点-领域映射模型 - 多对多关系，支持一个节点属于多个领域"""

    __tablename__ = "node_domain_mappings"

    id = Column(Integer, primary_key=True, index=True)

    # 外键关系
    node_id = Column(Integer, ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    domain_id = Column(Integer, ForeignKey("knowledge_domains.id", ondelete="CASCADE"), nullable=False, index=True)

    # 归属属性
    is_primary = Column(Boolean, default=False)  # 是否为主领域
    confidence = Column(Float, default=1.0)  # 归属置信度，范围 0-1
    mapping_method = Column(String(50), default="rule")  # 映射方法：rule（规则）、ai（AI推断）、manual（人工标注）

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    node = relationship("KnowledgeNode", backref="domain_mappings")
    domain = relationship("KnowledgeDomain", back_populates="node_mappings")

    # 复合唯一约束（一个节点在一个领域中只能有一条映射记录）
    __table_args__ = (
        UniqueConstraint('node_id', 'domain_id', name='uq_node_domain'),
        Index('idx_node_domain_node', 'node_id'),
        Index('idx_node_domain_domain', 'domain_id'),
        Index('idx_node_domain_primary', 'is_primary'),
    )

    def __repr__(self):
        return f"<NodeDomainMapping(node_id={self.node_id}, domain_id={self.domain_id}, is_primary={self.is_primary})>"


# 预定义领域数据（用于数据库初始化）
PREDEFINED_DOMAINS = [
    {
        "domain_code": "standard_specification",
        "domain_name": "清单标准规范",
        "description": "国家标准、行业规范、清单规则、验收标准等",
        "keywords": "标准,规范,清单,GB,验收,要求,规定,条文",
        "color": "#1890ff",  # 蓝色
        "icon": "book",
        "display_order": 1,
        "default_weight": 1.2,
    },
    {
        "domain_code": "calculation_rule",
        "domain_name": "计算规则",
        "description": "工程量计算规则、定额、计价公式、计算方法",
        "keywords": "计算,定额,公式,工程量,计价,计量,单价,合价",
        "color": "#52c41a",  # 绿色
        "icon": "calculator",
        "display_order": 2,
        "default_weight": 1.3,
    },
    {
        "domain_code": "construction_technology",
        "domain_name": "施工工艺",
        "description": "施工流程、工艺要求、施工方法、技术标准",
        "keywords": "施工,工艺,浇筑,振捣,养护,抹灰,砌筑,焊接,绑扎,流程,方法",
        "color": "#fa8c16",  # 橙色
        "icon": "tool",
        "display_order": 3,
        "default_weight": 1.1,
    },
    {
        "domain_code": "material_equipment",
        "domain_name": "材料设备",
        "description": "材料特性、设备参数、规格型号、技术指标",
        "keywords": "材料,设备,混凝土,钢筋,水泥,砂浆,砖,机械,泵车,塔吊,电梯,规格,型号",
        "color": "#722ed1",  # 紫色
        "icon": "build",
        "display_order": 4,
        "default_weight": 1.0,
    },
    {
        "domain_code": "cost_data",
        "domain_name": "成本数据",
        "description": "价格信息、成本数据、市场行情、费用标准",
        "keywords": "价格,成本,费用,预算,造价,报价,单价,总价,人工费,材料费,机械费,市场,行情",
        "color": "#eb2f96",  # 粉红色
        "icon": "dollar",
        "display_order": 5,
        "default_weight": 1.4,
    },
    {
        "domain_code": "project_management",
        "domain_name": "项目管理",
        "description": "项目组织、进度管理、资源配置、风险控制",
        "keywords": "项目,管理,进度,计划,组织,资源,风险,控制,监理",
        "color": "#13c2c2",  # 青色
        "icon": "project",
        "display_order": 6,
        "default_weight": 0.9,
    },
    {
        "domain_code": "quality_safety",
        "domain_name": "质量安全",
        "description": "质量验收、安全规范、文明施工、安全防护",
        "keywords": "质量,安全,验收,防护,文明施工,检查,检验,合格,达标",
        "color": "#f5222d",  # 红色
        "icon": "safety",
        "display_order": 7,
        "default_weight": 1.0,
    },
]
