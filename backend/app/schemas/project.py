"""
项目相关的Pydantic Schema定义
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.project import ProjectType


class ProjectBase(BaseModel):
    """项目基础Schema"""
    name: str = Field(..., description="项目名称", max_length=200)
    description: Optional[str] = Field(None, description="项目描述")
    project_type: ProjectType = Field(..., description="项目类型")
    location: Optional[str] = Field(None, description="项目位置", max_length=500)
    address: Optional[str] = Field(None, description="项目地址", max_length=500)
    client_name: Optional[str] = Field(None, description="客户名称", max_length=200)
    
    # 项目规模
    total_area: Optional[float] = Field(None, description="总面积（平方米）")
    building_area: Optional[float] = Field(None, description="建筑面积（平方米）")
    plot_area: Optional[float] = Field(None, description="占地面积（平方米）")
    floor_count: Optional[int] = Field(None, description="楼层数")
    
    # 成本信息
    estimated_budget: Optional[float] = Field(None, description="预算成本")
    actual_cost: Optional[float] = Field(None, description="实际成本")
    unit_cost: Optional[float] = Field(None, description="单位成本")
    
    # 项目状态
    status: Optional[str] = Field("规划中", description="项目状态")
    start_date: Optional[datetime] = Field(None, description="开始日期")
    end_date: Optional[datetime] = Field(None, description="结束日期")
    
    # 技术参数
    structure_type: Optional[str] = Field(None, description="结构类型", max_length=100)
    quality_level: Optional[str] = Field(None, description="质量等级", max_length=50)
    design_standard: Optional[str] = Field(None, description="设计标准", max_length=100)
    
    # 项目团队
    project_manager: Optional[str] = Field(None, description="项目经理", max_length=100)
    design_team: Optional[str] = Field(None, description="设计团队", max_length=200)
    
    # 标签
    tags: Optional[List[str]] = Field(None, description="项目标签")
    
    class Config:
        from_attributes = True


class ProjectCreate(ProjectBase):
    """创建项目Schema"""
    pass


class ProjectUpdate(BaseModel):
    """更新项目Schema"""
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    project_type: Optional[ProjectType] = None
    location: Optional[str] = Field(None, max_length=500)
    address: Optional[str] = Field(None, max_length=500)
    client_name: Optional[str] = Field(None, max_length=200)
    total_area: Optional[float] = None
    building_area: Optional[float] = None
    plot_area: Optional[float] = None
    floor_count: Optional[int] = None
    estimated_budget: Optional[float] = None
    actual_cost: Optional[float] = None
    unit_cost: Optional[float] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    structure_type: Optional[str] = Field(None, max_length=100)
    quality_level: Optional[str] = Field(None, max_length=50)
    design_standard: Optional[str] = Field(None, max_length=100)
    project_manager: Optional[str] = Field(None, max_length=100)
    design_team: Optional[str] = Field(None, max_length=200)
    tags: Optional[List[str]] = None
    
    class Config:
        from_attributes = True


class Project(ProjectBase):
    """项目Schema（完整）"""
    id: int = Field(..., description="项目ID")
    owner_id: int = Field(..., description="项目所有者ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True


class ProjectInDB(Project):
    """数据库中的项目Schema"""
    pass









