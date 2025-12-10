"""
项目模板相关Schema
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.project import ProjectType


class ProjectTemplateBase(BaseModel):
    """项目模板基础Schema"""
    name: str = Field(..., description="项目名称")
    project_type: Optional[ProjectType] = Field(None, description="项目类型")
    area: float = Field(..., ge=0, description="建筑面积（平方米）")
    floors: Optional[str] = Field(None, description="层数信息")
    underground_floors: Optional[int] = Field(None, description="地下层数")
    aboveground_floors: Optional[int] = Field(None, description="地上层数")
    start_date: Optional[str] = Field(None, description="开工时间")
    completion_date: Optional[str] = Field(None, description="竣工时间")
    total_cost: Optional[float] = Field(None, description="总造价（元）")
    unit_cost: Optional[float] = Field(None, description="单方造价（元/m²）")


class ProjectTemplateCostItemBase(BaseModel):
    """模板成本项基础Schema"""
    item_code: str = Field(..., description="成本项代码")
    item_name: str = Field(..., description="成本项名称")
    item_type: str = Field(..., description="成本项类型")
    total_price: Optional[float] = Field(None, description="总价（元）")
    unit_price: Optional[float] = Field(None, description="单方造价（元/m²）")
    notes: Optional[str] = Field(None, description="备注")
    is_primary_section: bool = Field(False, description="是否是一级分部")
    is_secondary_section: bool = Field(False, description="是否是二级分部")
    primary_section_code: Optional[str] = Field(None, description="所属一级分部代码")


class ProjectTemplateCostItem(ProjectTemplateCostItemBase):
    """模板成本项Schema"""
    id: int
    template_id: int
    row_number: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectTemplate(ProjectTemplateBase):
    """项目模板Schema"""
    id: int
    source_file: Optional[str] = None
    is_enabled: bool = True
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    cost_items: List[ProjectTemplateCostItem] = []

    class Config:
        from_attributes = True


class ProjectTemplateCreate(ProjectTemplateBase):
    """创建项目模板Schema"""
    pass


class ProjectTemplateUpdate(BaseModel):
    """更新项目模板Schema"""
    name: Optional[str] = None
    project_type: Optional[ProjectType] = None
    is_enabled: Optional[bool] = None


class ProjectTemplateList(BaseModel):
    """项目模板列表Schema"""
    templates: List[ProjectTemplate]
    total: int
    page: int
    size: int
    pages: int


class SaveParsedDataRequest(BaseModel):
    """保存解析数据请求Schema"""
    source_file: str = Field(..., description="源文件路径")
    user_id: Optional[int] = Field(None, description="用户ID")


class SaveParsedDataResponse(BaseModel):
    """保存解析数据响应Schema"""
    template_ids: List[int] = Field(..., description="创建的模板ID列表")
    message: str = Field(..., description="保存结果消息")

