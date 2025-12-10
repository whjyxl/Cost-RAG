"""
建筑工程专用的节点类型和关系类型定义

由于现有的EntityType和RelationType枚举不支持动态扩展，
这里通过properties字段的node_subtype和relation_subtype来实现类型扩展
"""
from typing import Dict, List
from enum import Enum


class ConstructionNodeSubtype:
    """建筑工程节点子类型（通过properties.node_subtype字段使用）"""
    
    # 工程结构类
    PROJECT_DIVISION = "project_division"  # 分部工程
    SUB_DIVISION = "sub_division"  # 分项工程
    WORK_PACKAGE = "work_package"  # 工作包
    
    # 设计体系类
    DESIGN_STANDARD = "design_standard"  # 设计标准
    DESIGN_SPECIFICATION = "design_specification"  # 设计规范
    DESIGN_SCHEME = "design_scheme"  # 设计方案
    DESIGN_PARAMETER = "design_parameter"  # 设计参数
    TECHNICAL_REQUIREMENT = "technical_requirement"  # 技术要求
    
    # 施工体系类
    CONSTRUCTION_PROCESS = "construction_process"  # 施工工艺
    CONSTRUCTION_STANDARD = "construction_standard"  # 施工规范
    QUALITY_STANDARD = "quality_standard"  # 质量标准
    CONSTRUCTION_METHOD = "construction_method"  # 施工方法
    INSPECTION_POINT = "inspection_point"  # 检验点
    
    # 成本体系类
    COST_ITEM = "cost_item"  # 成本项
    MATERIAL_SPECIFICATION = "material_specification"  # 材料规格
    LABOR_COST = "labor_cost"  # 人工成本
    EQUIPMENT_COST = "equipment_cost"  # 设备成本
    OPTIMIZATION_SUGGESTION = "optimization_suggestion"  # 优化建议
    
    # 材料体系类
    MATERIAL_CATEGORY = "material_category"  # 材料类别
    MATERIAL_BRAND = "material_brand"  # 材料品牌
    MATERIAL_MODEL = "material_model"  # 材料型号
    MATERIAL_PROPERTY = "material_property"  # 材料性能


class ConstructionRelationSubtype:
    """建筑工程关系子类型（通过properties.relation_subtype字段使用）"""
    
    # 层次关系
    HAS_DIVISION = "has_division"  # 包含分部工程
    HAS_SUB_DIVISION = "has_sub_division"  # 包含分项工程
    BELONGS_TO_DIVISION = "belongs_to_division"  # 属于分部工程
    
    # 设计关系
    FOLLOWS_STANDARD = "follows_standard"  # 遵循标准
    REFERS_TO_SPECIFICATION = "refers_to_specification"  # 参考规范
    HAS_DESIGN_PARAMETER = "has_design_parameter"  # 具有设计参数
    REQUIRES_TECHNICAL = "requires_technical"  # 需要技术要求
    
    # 施工关系
    USES_PROCESS = "uses_process"  # 使用工艺
    FOLLOWS_CONSTRUCTION_STANDARD = "follows_construction_standard"  # 遵循施工规范
    HAS_QUALITY_REQUIREMENT = "has_quality_requirement"  # 具有质量要求
    REQUIRES_INSPECTION = "requires_inspection"  # 需要检验
    
    # 成本关系
    HAS_COST_COMPONENT = "has_cost_component"  # 具有成本构成
    USES_MATERIAL = "uses_material"  # 使用材料
    HAS_LABOR_COST = "has_labor_cost"  # 具有人工成本
    HAS_OPTIMIZATION = "has_optimization"  # 具有优化方案
    
    # 材料关系
    MATERIAL_ALTERNATIVE = "material_alternative"  # 材料替代
    MATERIAL_COMPATIBLE = "material_compatible"  # 材料兼容
    MATERIAL_PERFORMANCE = "material_performance"  # 材料性能关系


# 节点子类型到基础类型的映射
NODE_SUBTYPE_TO_BASE_TYPE = {
    # 工程结构类 -> project
    ConstructionNodeSubtype.PROJECT_DIVISION: "project",
    ConstructionNodeSubtype.SUB_DIVISION: "project",
    ConstructionNodeSubtype.WORK_PACKAGE: "project",
    
    # 设计体系类 -> standard/regulation
    ConstructionNodeSubtype.DESIGN_STANDARD: "standard",
    ConstructionNodeSubtype.DESIGN_SPECIFICATION: "standard",
    ConstructionNodeSubtype.DESIGN_SCHEME: "document",
    ConstructionNodeSubtype.DESIGN_PARAMETER: "metric",
    ConstructionNodeSubtype.TECHNICAL_REQUIREMENT: "regulation",
    
    # 施工体系类 -> process/standard
    ConstructionNodeSubtype.CONSTRUCTION_PROCESS: "process",
    ConstructionNodeSubtype.CONSTRUCTION_STANDARD: "standard",
    ConstructionNodeSubtype.QUALITY_STANDARD: "standard",
    ConstructionNodeSubtype.CONSTRUCTION_METHOD: "process",
    ConstructionNodeSubtype.INSPECTION_POINT: "metric",
    
    # 成本体系类 -> cost
    ConstructionNodeSubtype.COST_ITEM: "cost",
    ConstructionNodeSubtype.MATERIAL_SPECIFICATION: "material",
    ConstructionNodeSubtype.LABOR_COST: "cost",
    ConstructionNodeSubtype.EQUIPMENT_COST: "cost",
    ConstructionNodeSubtype.OPTIMIZATION_SUGGESTION: "generic",
    
    # 材料体系类 -> material
    ConstructionNodeSubtype.MATERIAL_CATEGORY: "material",
    ConstructionNodeSubtype.MATERIAL_BRAND: "product",
    ConstructionNodeSubtype.MATERIAL_MODEL: "product",
    ConstructionNodeSubtype.MATERIAL_PROPERTY: "metric",
}


# 关系子类型到基础类型的映射
RELATION_SUBTYPE_TO_BASE_TYPE = {
    # 层次关系 -> contain/belong_to
    ConstructionRelationSubtype.HAS_DIVISION: "contain",
    ConstructionRelationSubtype.HAS_SUB_DIVISION: "contain",
    ConstructionRelationSubtype.BELONGS_TO_DIVISION: "belong_to",
    
    # 设计关系 -> related_to/require
    ConstructionRelationSubtype.FOLLOWS_STANDARD: "related_to",
    ConstructionRelationSubtype.REFERS_TO_SPECIFICATION: "related_to",
    ConstructionRelationSubtype.HAS_DESIGN_PARAMETER: "related_to",
    ConstructionRelationSubtype.REQUIRES_TECHNICAL: "require",
    
    # 施工关系 -> use/require
    ConstructionRelationSubtype.USES_PROCESS: "use",
    ConstructionRelationSubtype.FOLLOWS_CONSTRUCTION_STANDARD: "related_to",
    ConstructionRelationSubtype.HAS_QUALITY_REQUIREMENT: "require",
    ConstructionRelationSubtype.REQUIRES_INSPECTION: "require",
    
    # 成本关系 -> have_cost/use
    ConstructionRelationSubtype.HAS_COST_COMPONENT: "have_cost",
    ConstructionRelationSubtype.USES_MATERIAL: "use",
    ConstructionRelationSubtype.HAS_LABOR_COST: "have_cost",
    ConstructionRelationSubtype.HAS_OPTIMIZATION: "related_to",
    
    # 材料关系 -> related_to
    ConstructionRelationSubtype.MATERIAL_ALTERNATIVE: "related_to",
    ConstructionRelationSubtype.MATERIAL_COMPATIBLE: "related_to",
    ConstructionRelationSubtype.MATERIAL_PERFORMANCE: "related_to",
}


def get_node_base_type(subtype: str) -> str:
    """
    根据节点子类型获取基础类型
    
    Args:
        subtype: 节点子类型
    
    Returns:
        基础EntityType值
    """
    return NODE_SUBTYPE_TO_BASE_TYPE.get(subtype, "generic")


def get_relation_base_type(subtype: str) -> str:
    """
    根据关系子类型获取基础类型
    
    Args:
        subtype: 关系子类型
    
    Returns:
        基础RelationType值
    """
    return RELATION_SUBTYPE_TO_BASE_TYPE.get(subtype, "related_to")


# 节点子类型描述
NODE_SUBTYPE_DESCRIPTIONS = {
    # 工程结构类
    ConstructionNodeSubtype.PROJECT_DIVISION: "分部工程，如门窗工程、水电工程",
    ConstructionNodeSubtype.SUB_DIVISION: "分项工程，如铝合金窗、塑钢门",
    ConstructionNodeSubtype.WORK_PACKAGE: "工作包，具体的施工任务单元",
    
    # 设计体系类
    ConstructionNodeSubtype.DESIGN_STANDARD: "设计标准，国家或行业标准",
    ConstructionNodeSubtype.DESIGN_SPECIFICATION: "设计规范，具体的设计要求",
    ConstructionNodeSubtype.DESIGN_SCHEME: "设计方案，具体的设计文档",
    ConstructionNodeSubtype.DESIGN_PARAMETER: "设计参数，如尺寸、性能指标",
    ConstructionNodeSubtype.TECHNICAL_REQUIREMENT: "技术要求，性能和质量要求",
    
    # 施工体系类
    ConstructionNodeSubtype.CONSTRUCTION_PROCESS: "施工工艺，完整的施工流程",
    ConstructionNodeSubtype.CONSTRUCTION_STANDARD: "施工规范，施工标准要求",
    ConstructionNodeSubtype.QUALITY_STANDARD: "质量标准，质量验收标准",
    ConstructionNodeSubtype.CONSTRUCTION_METHOD: "施工方法，具体的施工技巧",
    ConstructionNodeSubtype.INSPECTION_POINT: "检验点，质量检查要点",
    
    # 成本体系类
    ConstructionNodeSubtype.COST_ITEM: "成本项，成本构成要素",
    ConstructionNodeSubtype.MATERIAL_SPECIFICATION: "材料规格，材料的详细规格",
    ConstructionNodeSubtype.LABOR_COST: "人工成本，人工费用",
    ConstructionNodeSubtype.EQUIPMENT_COST: "设备成本，设备费用",
    ConstructionNodeSubtype.OPTIMIZATION_SUGGESTION: "优化建议，成本或质量优化方案",
    
    # 材料体系类
    ConstructionNodeSubtype.MATERIAL_CATEGORY: "材料类别，如型材、玻璃",
    ConstructionNodeSubtype.MATERIAL_BRAND: "材料品牌，具体品牌",
    ConstructionNodeSubtype.MATERIAL_MODEL: "材料型号，具体型号规格",
    ConstructionNodeSubtype.MATERIAL_PROPERTY: "材料性能，性能参数",
}


# 关系子类型描述
RELATION_SUBTYPE_DESCRIPTIONS = {
    # 层次关系
    ConstructionRelationSubtype.HAS_DIVISION: "包含分部工程",
    ConstructionRelationSubtype.HAS_SUB_DIVISION: "包含分项工程",
    ConstructionRelationSubtype.BELONGS_TO_DIVISION: "属于某个分部工程",
    
    # 设计关系
    ConstructionRelationSubtype.FOLLOWS_STANDARD: "遵循某个设计标准",
    ConstructionRelationSubtype.REFERS_TO_SPECIFICATION: "参考某个规范",
    ConstructionRelationSubtype.HAS_DESIGN_PARAMETER: "具有某个设计参数",
    ConstructionRelationSubtype.REQUIRES_TECHNICAL: "需要满足技术要求",
    
    # 施工关系
    ConstructionRelationSubtype.USES_PROCESS: "使用某个施工工艺",
    ConstructionRelationSubtype.FOLLOWS_CONSTRUCTION_STANDARD: "遵循施工规范",
    ConstructionRelationSubtype.HAS_QUALITY_REQUIREMENT: "具有质量要求",
    ConstructionRelationSubtype.REQUIRES_INSPECTION: "需要进行检验",
    
    # 成本关系
    ConstructionRelationSubtype.HAS_COST_COMPONENT: "具有成本构成",
    ConstructionRelationSubtype.USES_MATERIAL: "使用某种材料",
    ConstructionRelationSubtype.HAS_LABOR_COST: "具有人工成本",
    ConstructionRelationSubtype.HAS_OPTIMIZATION: "具有优化方案",
    
    # 材料关系
    ConstructionRelationSubtype.MATERIAL_ALTERNATIVE: "材料替代关系",
    ConstructionRelationSubtype.MATERIAL_COMPATIBLE: "材料兼容关系",
    ConstructionRelationSubtype.MATERIAL_PERFORMANCE: "材料性能关系",
}
