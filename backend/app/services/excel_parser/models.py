"""
Excel多项目对比解析器 - 数据模型

这个模块定义了Excel解析器使用的所有数据结构。
使用Pydantic进行数据验证，确保类型安全和数据完整性。

Author: Cost-RAG Team
Created: 2025-11-06
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, validator, root_validator


class ItemType(str, Enum):
    """数据项类型枚举"""
    PROJECT_NAME = "project_name"
    AREA = "area"
    FLOORS = "floors"
    DATES = "dates"
    COST_SECTION = "cost_section"
    COST_ITEM = "cost_item"


class ProjectBasicInfo(BaseModel):
    """项目基本信息"""
    name: str = Field(..., description="项目名称")
    area: float = Field(0.0, ge=0, description="建筑面积（平方米）")
    floors: Optional[str] = Field(None, description="层数信息")
    start_date: Optional[str] = Field(None, description="开工时间")
    completion_date: Optional[str] = Field(None, description="竣工时间")
    
    @validator("area")
    def validate_area(cls, v):
        """验证面积必须为正数"""
        if v < 0:
            raise ValueError("建筑面积不能为负数")
        if v > 1000000:
            raise ValueError(f"建筑面积过大，请检查数据: {v}")
        return v
    
    @validator("name")
    def validate_name(cls, v):
        """验证项目名称"""
        if not v or not v.strip():
            raise ValueError("项目名称不能为空")
        return v.strip()


class CostItemValue(BaseModel):
    """成本项目数值"""
    value: Optional[float] = Field(None, description="数值")
    unit: Optional[str] = Field(None, description="单位")
    notes: Optional[str] = Field(None, description="备注说明")
    
    @validator("value")
    def validate_value(cls, v):
        """验证数值合理性"""
        if v is not None:
            if v < 0:
                raise ValueError("成本数值不能为负数")
            if v > 1e10:
                raise ValueError(f"数值异常大，请检查: {v}")
        return v
    
    def is_empty(self) -> bool:
        """判断是否为空值"""
        return self.value is None or self.value == 0


class CostItem(BaseModel):
    """成本项目"""
    row_number: int = Field(..., description="Excel行号")
    item_type: ItemType = Field(..., description="数据项类型")
    item_code: str = Field(..., description="分部分项代码")
    item_name: str = Field(..., description="分部分项名称")
    project_values: Dict[str, CostItemValue] = Field(
        default_factory=dict,
        description="各项目的数值"
    )
    
    @validator("item_code")
    def validate_item_code(cls, v):
        """验证项目代码格式"""
        if not v or not v.strip():
            raise ValueError("项目代码不能为空")
        return v.strip()
    
    def get_primary_section_code(self) -> Optional[str]:
        """获取一级分部代码"""
        if "." in self.item_code:
            primary = self.item_code.split(".")[0]
            return f"{primary}.0"
        return None
    
    def is_primary_section(self) -> bool:
        """判断是否为一级分部"""
        if self.item_code.endswith(".0"):
            try:
                section_num = int(self.item_code.split(".")[0])
                return 1 <= section_num <= 14
            except ValueError:
                return False
        return False
    
    def is_secondary_section(self) -> bool:
        """判断是否为二级分部"""
        if "." in self.item_code and not self.item_code.endswith(".0"):
            parts = self.item_code.split(".")
            if len(parts) == 2:
                try:
                    int(parts[0])
                    int(parts[1])
                    return True
                except ValueError:
                    return False
        return False


class ProjectCostData(BaseModel):
    """单个项目的完整成本数据"""
    basic_info: ProjectBasicInfo = Field(..., description="项目基本信息")
    cost_items: List[CostItem] = Field(default_factory=list, description="成本项目列表")
    total_cost: Optional[float] = Field(None, description="项目总造价")
    unit_cost: Optional[float] = Field(None, description="单方造价")
    
    def calculate_total_from_sections(self) -> float:
        """从1-13级分部求和计算总造价"""
        total = 0.0
        for item in self.cost_items:
            if item.is_primary_section():
                section_num = int(item.item_code.split(".")[0])
                if 1 <= section_num <= 13:
                    value = item.project_values.get(
                        self.basic_info.name, CostItemValue()
                    ).value
                    if value:
                        total += value
        return total
    
    def validate_mathematical_relationships(self, tolerance: float = 0.01) -> Dict[str, any]:
        """验证数学关系的正确性"""
        results = {
            "is_valid": True,
            "errors": [],
            "warnings": []
        }
        
        project_name = self.basic_info.name
        
        # 收集各级分部数据
        primary_sections = {}
        secondary_by_primary = {}
        
        for item in self.cost_items:
            value_data = item.project_values.get(project_name)
            if not value_data or value_data.is_empty():
                continue
                
            value = value_data.value
            
            if item.is_primary_section():
                section_num = int(item.item_code.split(".")[0])
                primary_sections[section_num] = value
            elif item.is_secondary_section():
                primary_code = int(item.item_code.split(".")[0])
                if primary_code not in secondary_by_primary:
                    secondary_by_primary[primary_code] = []
                secondary_by_primary[primary_code].append(value)
        
        # 验证1: 二级分部求和 = 一级分部
        for primary_code, secondary_values in secondary_by_primary.items():
            secondary_sum = sum(secondary_values)
            primary_value = primary_sections.get(primary_code)
            
            if primary_value:
                diff = abs(secondary_sum - primary_value)
                if diff > primary_value * tolerance:
                    results["errors"].append(
                        f"一级分部{primary_code}.0验证失败: "
                        f"二级分部求和={secondary_sum:.2f}, "
                        f"一级分部值={primary_value:.2f}, "
                        f"差异={diff:.2f}"
                    )
                    results["is_valid"] = False
        
        # 验证2: 一级分部求和(1-13) = 总造价(第14项)
        sum_1_to_13 = sum(
            primary_sections.get(i, 0) for i in range(1, 14)
        )
        section_14 = primary_sections.get(14)
        
        if section_14:
            diff = abs(sum_1_to_13 - section_14)
            if diff > section_14 * tolerance:
                results["errors"].append(
                    f"项目总造价验证失败: "
                    f"1-13级求和={sum_1_to_13:.2f}, "
                    f"第14项={section_14:.2f}, "
                    f"差异={diff:.2f}"
                )
                results["is_valid"] = False
            
            self.total_cost = section_14
        
        # 计算单方造价
        if self.total_cost and self.basic_info.area > 0:
            self.unit_cost = self.total_cost / self.basic_info.area
        
        return results


class ProjectComparisonData(BaseModel):
    """多项目对比数据"""
    projects: List[ProjectCostData] = Field(
        default_factory=list,
        description="项目列表"
    )
    source_file: Optional[str] = Field(None, description="源文件路径")
    parsed_at: datetime = Field(
        default_factory=datetime.now,
        description="解析时间"
    )
    
    def get_project_by_name(self, name: str) -> Optional[ProjectCostData]:
        """根据项目名称获取项目数据"""
        for project in self.projects:
            if project.basic_info.name == name:
                return project
        return None
    
    def validate_all_projects(self, tolerance: float = 0.01) -> Dict[str, any]:
        """验证所有项目的数学关系"""
        overall_results = {
            "is_valid": True,
            "project_results": {},
            "summary": {
                "total_projects": len(self.projects),
                "valid_projects": 0,
                "invalid_projects": 0
            }
        }
        
        for project in self.projects:
            project_name = project.basic_info.name
            result = project.validate_mathematical_relationships(tolerance)
            
            overall_results["project_results"][project_name] = result
            
            if result["is_valid"]:
                overall_results["summary"]["valid_projects"] += 1
            else:
                overall_results["summary"]["invalid_projects"] += 1
                overall_results["is_valid"] = False
        
        return overall_results
    
    class Config:
        """Pydantic配置"""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ParserConfig(BaseModel):
    """解析器配置"""
    validate_math_relationships: bool = Field(
        True,
        description="是否验证数学关系"
    )
    tolerance: float = Field(
        0.01,
        ge=0,
        le=1,
        description="数值验证容差"
    )
    skip_empty_projects: bool = Field(
        True,
        description="是否跳过空项目"
    )
    max_projects: int = Field(
        10,
        ge=1,
        le=50,
        description="最大支持项目数量"
    )
    
    @validator("tolerance")
    def validate_tolerance(cls, v):
        """验证容差范围"""
        if not 0 <= v <= 1:
            raise ValueError("容差必须在0-1之间")
        return v


__all__ = [
    "ItemType",
    "ProjectBasicInfo",
    "CostItemValue",
    "CostItem",
    "ProjectCostData",
    "ProjectComparisonData",
    "ParserConfig",
]
