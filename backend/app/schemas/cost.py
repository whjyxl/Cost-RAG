"""
成本估算相关的Pydantic模式定义
"""
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, validator


class EstimationMethod(str, Enum):
    """估算方法枚举"""
    EXPERT_JUDGMENT = "expert_judgment"  # 专家判断
    ANALOGOUS = "analogous"  # 类比估算
    PARAMETRIC = "parametric"  # 参数估算
    BOTTOM_UP = "bottom_up"  # 自下而上
    THREE_POINT = "three_point"  # 三点估算
    MACHINE_LEARNING = "machine_learning"  # 机器学习


class CostType(str, Enum):
    """成本类型枚举"""
    DIRECT = "direct"  # 直接成本
    INDIRECT = "indirect"  # 间接成本
    FIXED = "fixed"  # 固定成本
    VARIABLE = "variable"  # 可变成本
    OVERHEAD = "overhead"  # 管理费用


class ComplexityLevel(str, Enum):
    """复杂度等级枚举"""
    LOW = "low"  # 低
    MEDIUM = "medium"  # 中
    HIGH = "high"  # 高
    VERY_HIGH = "very_high"  # 非常高


class CostCategory(str, Enum):
    """成本分类枚举"""
    LABOR = "labor"  # 人力成本
    MATERIAL = "material"  # 材料成本
    EQUIPMENT = "equipment"  # 设备成本
    SOFTWARE = "software"  # 软件成本
    SUBCONTRACTOR = "subcontractor"  # 分包成本
    OVERHEAD = "overhead"  # 管理费用
    CONTINGENCY = "contingency"  # 应急费用
    PROFIT = "profit"  # 利润


class Currency(str, Enum):
    """货币枚举"""
    CNY = "CNY"  # 人民币
    USD = "USD"  # 美元
    EUR = "EUR"  # 欧元
    JPY = "JPY"  # 日元


# 成本项目相关模式
class CostItemBase(BaseModel):
    """成本项目基础模式"""
    category: CostCategory = Field(..., description="成本分类")
    name: str = Field(..., min_length=1, max_length=200, description="项目名称")
    description: Optional[str] = Field(None, max_length=1000, description="项目描述")
    quantity: float = Field(..., gt=0, description="数量")
    unit_price: float = Field(..., gt=0, description="单价")
    unit_of_measure: str = Field(..., min_length=1, max_length=50, description="计量单位")
    cost_type: CostType = Field(..., description="成本类型")
    is_optional: bool = Field(False, description="是否为可选项目")
    dependencies: Optional[List[str]] = Field(default_factory=list, description="依赖项目")

    @property
    def total_cost(self) -> float:
        """计算总成本"""
        return self.quantity * self.unit_price


class CostItemCreate(CostItemBase):
    """创建成本项目模式"""
    pass


class CostItemUpdate(BaseModel):
    """更新成本项目模式"""
    category: Optional[CostCategory] = Field(None, description="成本分类")
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="项目名称")
    description: Optional[str] = Field(None, max_length=1000, description="项目描述")
    quantity: Optional[float] = Field(None, gt=0, description="数量")
    unit_price: Optional[float] = Field(None, gt=0, description="单价")
    unit_of_measure: Optional[str] = Field(None, min_length=1, max_length=50, description="计量单位")
    cost_type: Optional[CostType] = Field(None, description="成本类型")
    is_optional: Optional[bool] = Field(None, description="是否为可选项目")
    dependencies: Optional[List[str]] = Field(None, description="依赖项目")


class CostItem(CostItemBase):
    """成本项目完整模式"""
    id: int = Field(..., description="成本项目ID")
    estimate_id: int = Field(..., description="估算ID")
    total_cost: float = Field(..., description="总成本")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# 成本估算相关模式
class CostEstimateBase(BaseModel):
    """成本估算基础模式"""
    title: str = Field(..., min_length=1, max_length=200, description="估算标题")
    description: Optional[str] = Field(None, max_length=2000, description="估算描述")
    estimated_budget: float = Field(..., gt=0, description="估算预算")
    currency: Currency = Field(Currency.CNY, description="货币类型")
    estimation_method: EstimationMethod = Field(..., description="估算方法")
    confidence_level: float = Field(0.8, ge=0.0, le=1.0, description="置信度")
    risk_factors: Optional[List[str]] = Field(default_factory=list, description="风险因素")
    assumptions: Optional[List[str]] = Field(default_factory=list, description="假设条件")
    constraints: Optional[List[str]] = Field(default_factory=list, description="约束条件")
    estimated_duration_days: Optional[int] = Field(None, gt=0, description="估算工期(天)")
    estimated_start_date: Optional[date] = Field(None, description="预计开始日期")
    estimated_end_date: Optional[date] = Field(None, description="预计结束日期")
    team_size: Optional[int] = Field(None, gt=0, description="团队规模")
    complexity_level: Optional[ComplexityLevel] = Field(None, description="复杂度等级")
    technology_stack: Optional[List[str]] = Field(default_factory=list, description="技术栈")


class CostEstimateCreate(CostEstimateBase):
    """创建成本估算模式"""
    project_id: int = Field(..., description="项目ID")
    cost_items: Optional[List[CostItemCreate]] = Field(default_factory=list, description="成本项目列表")

    @validator('estimated_end_date')
    def validate_dates(cls, v, values):
        """验证日期合理性"""
        if v and 'estimated_start_date' in values and values['estimated_start_date']:
            if v <= values['estimated_start_date']:
                raise ValueError('结束日期必须晚于开始日期')
        return v


class CostEstimateUpdate(BaseModel):
    """更新成本估算模式"""
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="估算标题")
    description: Optional[str] = Field(None, max_length=2000, description="估算描述")
    estimated_budget: Optional[float] = Field(None, gt=0, description="估算预算")
    currency: Optional[Currency] = Field(None, description="货币类型")
    estimation_method: Optional[EstimationMethod] = Field(None, description="估算方法")
    confidence_level: Optional[float] = Field(None, ge=0.0, le=1.0, description="置信度")
    risk_factors: Optional[List[str]] = Field(None, description="风险因素")
    assumptions: Optional[List[str]] = Field(None, description="假设条件")
    constraints: Optional[List[str]] = Field(None, description="约束条件")
    estimated_duration_days: Optional[int] = Field(None, gt=0, description="估算工期(天)")
    estimated_start_date: Optional[date] = Field(None, description="预计开始日期")
    estimated_end_date: Optional[date] = Field(None, description="预计结束日期")
    team_size: Optional[int] = Field(None, gt=0, description="团队规模")
    complexity_level: Optional[ComplexityLevel] = Field(None, description="复杂度等级")
    technology_stack: Optional[List[str]] = Field(None, description="技术栈")


class CostEstimate(CostEstimateBase):
    """成本估算完整模式"""
    id: int = Field(..., description="估算ID")
    project_id: int = Field(..., description="项目ID")
    created_by: int = Field(..., description="创建者ID")
    actual_cost: Optional[float] = Field(None, description="实际成本")
    cost_variance: Optional[float] = Field(None, description="成本偏差")
    cost_variance_percentage: Optional[float] = Field(None, description="成本偏差百分比")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class CostEstimateSummary(BaseModel):
    """成本估算摘要模式"""
    id: int
    title: str
    estimated_budget: float
    currency: str
    estimation_method: str
    confidence_level: float
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 分析和预测相关模式
class CostAnalysisRequest(BaseModel):
    """成本分析请求模式"""
    project_type: Optional[str] = Field(None, description="项目类型过滤")
    date_from: Optional[datetime] = Field(None, description="开始日期")
    date_to: Optional[datetime] = Field(None, description="结束日期")
    include_completed: bool = Field(True, description="是否包含已完成项目")
    include_cancelled: bool = Field(False, description="是否包含已取消项目")


class CostComparisonRequest(BaseModel):
    """成本比较请求模式"""
    estimate_ids: List[int] = Field(..., min_items=2, max_items=10, description="要比较的估算ID列表")
    comparison_metrics: Optional[List[str]] = Field(
        default=["budget", "confidence", "method", "categories"],
        description="比较指标"
    )


class CostPredictionRequest(BaseModel):
    """成本预测请求模式"""
    project_type: str = Field(..., description="项目类型")
    estimated_budget: float = Field(..., gt=0, description="估算预算")
    estimated_duration_days: Optional[int] = Field(None, gt=0, description="估算工期")
    complexity_level: Optional[ComplexityLevel] = Field(None, description="复杂度等级")
    team_size: Optional[int] = Field(None, gt=0, description="团队规模")
    technology_stack: Optional[List[str]] = Field(default_factory=list, description="技术栈")
    model_type: Optional[str] = Field("random_forest", description="预测模型类型")


class CostPredictionResult(BaseModel):
    """成本预测结果模式"""
    predicted_cost: float = Field(..., description="预测成本")
    prediction_interval: Dict[str, float] = Field(..., description="预测区间")
    confidence_level: str = Field(..., description="置信度等级")
    model_metrics: Dict[str, float] = Field(..., description="模型指标")
    feature_importance: Dict[str, float] = Field(..., description="特征重要性")
    training_data_size: int = Field(..., description="训练数据大小")
    model_type: str = Field(..., description="使用的模型类型")


class CostBenchmark(BaseModel):
    """成本基准模式"""
    project_type: str = Field(..., description="项目类型")
    data_points: int = Field(..., description="数据点数量")
    budget_benchmarks: Dict[str, float] = Field(..., description="预算基准")
    actual_cost_benchmarks: Dict[str, float] = Field(..., description="实际成本基准")
    variance_benchmarks: Dict[str, float] = Field(..., description="偏差基准")
    accuracy_rate: float = Field(..., description="准确率")
    complexity_analysis: Dict[str, Dict[str, float]] = Field(..., description="复杂度分析")


class CostReport(BaseModel):
    """成本报告模式"""
    project_info: Dict[str, Any] = Field(..., description="项目信息")
    cost_summary: Dict[str, Any] = Field(..., description="成本汇总")
    latest_estimate: Optional[Dict[str, Any]] = Field(None, description="最新估算")
    cost_breakdown: Dict[str, Any] = Field(..., description="成本分解")
    historical_comparison: Dict[str, Any] = Field(..., description="历史对比")
    recommendations: List[str] = Field(..., description="建议")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="生成时间")


# 响应模式
class CostEstimateList(BaseModel):
    """成本估算列表响应模式"""
    estimates: List[CostEstimateSummary]
    total: int
    page: int
    size: int
    pages: int


class CostAnalysisResult(BaseModel):
    """成本分析结果模式"""
    projects_analyzed: int = Field(..., description="分析的项目数量")
    total_estimated_budget: float = Field(..., description="总估算预算")
    total_actual_cost: float = Field(..., description="总实际成本")
    average_cost_variance: float = Field(..., description="平均成本偏差")
    average_cost_variance_percentage: float = Field(..., description="平均成本偏差百分比")
    cost_accuracy_rate: float = Field(..., description="成本准确率")
    projects_over_budget: int = Field(..., description="超出预算的项目数")
    projects_under_budget: int = Field(..., description="低于预算的项目数")
    by_project_type: Optional[Dict[str, Any]] = Field(None, description="按项目类型分析")
    monthly_trends: Optional[Dict[str, Any]] = Field(None, description="月度趋势")
    high_variance_projects: Dict[str, Any] = Field(..., description="高偏差项目分析")
    analysis_period: Dict[str, Any] = Field(..., description="分析周期")


class CostComparisonResult(BaseModel):
    """成本比较结果模式"""
    estimates: List[Dict[str, Any]] = Field(..., description="估算详情")
    summary: Dict[str, Any] = Field(..., description="汇总统计")
    category_comparison: Dict[str, List[Dict[str, Any]]] = Field(..., description="分类比较")
    recommendations: List[str] = Field(..., description="建议")


# 验证器
@validator('cost_items', pre=True)
def validate_cost_items(cls, v):
    """验证成本项目列表"""
    if v is None:
        return []
    if not isinstance(v, list):
        raise ValueError('成本项目必须是列表')
    return v


@validator('technology_stack', pre=True)
def validate_technology_stack(cls, v):
    """验证技术栈"""
    if v is None:
        return []
    if isinstance(v, str):
        return [tech.strip() for tech in v.split(',') if tech.strip()]
    return v


@validator('risk_factors', 'assumptions', 'constraints', pre=True)
def validate_string_lists(cls, v):
    """验证字符串列表"""
    if v is None:
        return []
    if isinstance(v, str):
        return [item.strip() for item in v.split(',') if item.strip()]
    return v