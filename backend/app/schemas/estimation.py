"""
成本估算API相关的Schema
"""
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.models.project import ProjectType


class EstimationRequest(BaseModel):
    """成本估算请求Schema"""
    name: str = Field(..., description="项目名称")
    project_type: Optional[str] = Field(None, description="项目类型: residential/commercial/office/industrial/public/mixed等（可选，如指定模板ID则自动继承）")
    area: float = Field(..., gt=0, description="建筑面积（平方米）")
    location: Optional[str] = Field(None, description="项目位置")
    start_date: Optional[str] = Field(None, description="计划开工日期 (YYYY-MM-DD)")
    template_id: Optional[int] = Field(None, description="参考模板ID")


class TemplateMatch(BaseModel):
    """模板匹配结果Schema"""
    template_id: int = Field(..., description="模板ID")
    template_name: str = Field(..., description="模板名称")
    project_type: Optional[str] = Field(None, description="项目类型")
    area: Optional[float] = Field(None, description="建筑面积")
    location: Optional[str] = Field(None, description="位置")
    unit_cost: Optional[float] = Field(None, description="单位造价")
    total_cost: Optional[float] = Field(None, description="总造价")
    similarity_score: float = Field(0.0, description="相似度分数")
    description: Optional[str] = Field(None, description="描述")


class EstimationResponse(BaseModel):
    """成本估算响应Schema"""
    estimation_id: Optional[int] = Field(None, description="估算记录ID（已保存到数据库）")
    project_name: str = Field(..., description="项目名称")
    project_type: str = Field(..., description="项目类型")
    area: float = Field(..., description="建筑面积")
    location: Optional[str] = Field(None, description="项目位置")
    total_cost: float = Field(..., description="总造价（元）")
    unit_cost: float = Field(..., description="单位造价（元/㎡）")
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="置信度")
    matched_template_id: Optional[int] = Field(None, description="匹配的模板ID")
    matched_template_name: Optional[str] = Field(None, description="匹配的模板名称")
    cost_breakdown: Dict[str, Any] = Field(default_factory=dict, description="成本分解")
    adjustment_factors: Dict[str, Any] = Field(default_factory=dict, description="调整因素")
    estimation_date: Optional[datetime] = Field(None, description="估算日期")
    notes: Optional[str] = Field(None, description="备注")

    # ✅ 新增：建设时间相关字段
    reference_start_date: Optional[str] = Field(None, description="参考模板开工时间")
    reference_completion_date: Optional[str] = Field(None, description="参考模板竣工时间")
    new_start_date: Optional[str] = Field(None, description="新项目开工时间")

    class Config:
        from_attributes = True


class AIEstimationRequest(BaseModel):
    """AI智能估算请求Schema"""
    project_name: str = Field(..., description="项目名称")
    project_type: str = Field(..., description="项目类型: residential/commercial/office/industrial/public/mixed/educational/medical/infrastructure/other")
    building_type: Optional[str] = Field(None, description="建筑类型")
    structure_type: Optional[str] = Field(None, description="结构类型")
    area: float = Field(..., gt=0, description="建筑面积（平方米）")
    location: str = Field(..., description="项目位置")
    floors: Optional[int] = Field(None, description="层数")
    unit_cost: Optional[float] = Field(None, gt=0, description="预估单位造价（元/㎡，可选，留空由AI完全估算）")
    quality_level: str = Field(..., description="质量等级: basic/standard/premium")
    construction_year: Optional[int] = Field(None, description="建设年份")
    construction_period: Optional[int] = Field(None, description="建设周期（月）")
    construction_standard: Optional[str] = Field(None, description="建设标准")
    design_standard: Optional[str] = Field(None, description="设计标准")

    # AI模型配置
    ai_provider: str = Field("zhipuai", description="AI提供商: zhipuai/moonshot/dashscope/baidu/deepseek/yi/spark")
    ai_model: Optional[str] = Field(None, description="AI模型名称(可选,默认使用提供商的默认模型)")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="温度参数")


class CostBreakdownItem(BaseModel):
    """成本构成项Schema"""
    category: str = Field(..., description="成本类别")
    unit_cost: float = Field(..., description="单位造价（元/㎡）")
    percentage: float = Field(..., ge=0.0, le=100.0, description="占比（%）")
    description: Optional[str] = Field(None, description="说明")


class AIEstimationResponse(BaseModel):
    """AI智能估算响应Schema"""
    project_name: str = Field(..., description="项目名称")
    project_type: str = Field(..., description="项目类型")
    area: float = Field(..., description="建筑面积（平方米）")
    location: str = Field(..., description="项目位置")

    # 估算结果
    estimated_unit_cost: float = Field(..., description="估算单位造价（元/㎡）")
    estimated_total_cost: float = Field(..., description="估算总造价（元）")
    confidence: float = Field(..., ge=0.0, le=1.0, description="AI置信度")

    # 成本构成（兼容旧版4大类和新版14级结构）
    breakdown: List[CostBreakdownItem] = Field(..., description="成本构成明细（4大类，保持向后兼容）")

    # ✅ 新增：14级成本明细结构（与模板估算保持一致）
    cost_breakdown: Optional[Dict[str, Any]] = Field(
        None,
        description="14级成本构成明细。结构: {primary_sections: {1.0: {item_name, unit_price, total_price}, ...}, secondary_sections: {2.1: {...}, ...}}"
    )

    # 估算依据
    rationale: str = Field(..., description="估算依据说明")
    model_used: str = Field(..., description="使用的AI模型")
    ai_provider: str = Field(..., description="AI提供商")

    # 时间戳
    estimation_date: datetime = Field(default_factory=datetime.now, description="估算时间")

    class Config:
        from_attributes = True


class EstimationSummary(BaseModel):
    """估算记录摘要Schema"""
    estimation_id: int = Field(..., description="估算ID")
    project_name: str = Field(..., description="项目名称")
    area: float = Field(..., description="建筑面积")
    total_cost: float = Field(..., description="总造价")
    unit_cost: float = Field(..., description="单位造价")
    template_name: str = Field(..., description="使用的模板名称")
    created_at: datetime = Field(..., description="创建时间")
    confidence_score: float = Field(0.0, description="置信度")

    class Config:
        from_attributes = True


class AIEstimationSaveRequest(BaseModel):
    """AI估算保存请求Schema"""
    project_name: str = Field(..., description="项目名称")
    project_type: str = Field(..., description="项目类型: residential/commercial/office/industrial/public/mixed等")
    area: float = Field(..., gt=0, description="建筑面积（平方米）")
    location: str = Field(..., description="项目位置")

    # AI估算结果
    estimated_unit_cost: float = Field(..., description="估算单位造价（元/㎡）")
    estimated_total_cost: float = Field(..., description="估算总造价（元）")
    confidence: float = Field(..., ge=0.0, le=1.0, description="AI置信度")

    # 成本构成（4大类，保持兼容）
    breakdown: List[CostBreakdownItem] = Field(..., description="成本构成明细")

    # ✅ 新增：14级成本明细（可选）
    cost_breakdown: Optional[Dict[str, Any]] = Field(None, description="14级成本构成明细")

    # 估算依据
    rationale: str = Field(..., description="估算依据说明")
    model_used: str = Field(..., description="使用的AI模型")
    ai_provider: str = Field(..., description="AI提供商")

    # 可选字段
    quality_level: Optional[str] = Field(None, description="质量等级")
    construction_year: Optional[int] = Field(None, description="建设年份")


class AIEstimationSaveResponse(BaseModel):
    """AI估算保存响应Schema"""
    estimation_id: int = Field(..., description="保存的估算ID")
    message: str = Field(..., description="提示信息")
    created_at: datetime = Field(..., description="创建时间")

