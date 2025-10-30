"""
AI模型相关的Pydantic模式定义
"""
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from enum import Enum
from pydantic import BaseModel, Field, validator

from app.services.ai_model_service import AIProvider, AIModelType


class ChatMessage(BaseModel):
    """对话消息模式"""
    role: str = Field(..., description="消息角色：user, assistant, system")
    content: str = Field(..., min_length=1, max_length=32000, description="消息内容")
    name: Optional[str] = Field(None, description="消息发送者名称")
    timestamp: Optional[datetime] = Field(None, description="消息时间戳")

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    """对话请求模式"""
    provider: AIProvider = Field(..., description="AI提供商")
    model: Optional[str] = Field(None, description="模型名称")
    messages: List[ChatMessage] = Field(..., min_items=1, max_items=50, description="对话消息列表")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="温度参数，控制随机性")
    max_tokens: Optional[int] = Field(None, ge=1, le=8000, description="最大生成令牌数")
    stream: bool = Field(False, description="是否流式返回")
    system_prompt: Optional[str] = Field(None, description="系统提示词")
    top_p: Optional[float] = Field(1.0, ge=0.0, le=1.0, description="核采样参数")
    frequency_penalty: Optional[float] = Field(0.0, ge=-2.0, le=2.0, description="频率惩罚参数")
    presence_penalty: Optional[float] = Field(0.0, ge=-2.0, le=2.0, description="存在惩罚参数")
    stop: Optional[List[str]] = Field(None, description="停止词列表")
    user_id: Optional[str] = Field(None, description="用户ID")
    session_id: Optional[str] = Field(None, description="会话ID")

    @validator('messages')
    def validate_messages(cls, v):
        """验证消息列表"""
        if not v:
            raise ValueError("消息列表不能为空")
        return v

    @validator('system_prompt')
    def validate_system_prompt(cls, v, values):
        """验证系统提示词"""
        if v and values.get('messages') and values['messages'][0].role == 'system':
            raise ValueError("系统提示词和消息中不能同时包含系统消息")
        return v


class ChatResponse(BaseModel):
    """对话响应模式"""
    content: str = Field(..., description="生成的内容")
    model: str = Field(..., description="使用的模型")
    provider: str = Field(..., description="AI提供商")
    usage: Dict[str, Any] = Field(default_factory=dict, description="使用统计")
    finish_reason: Optional[str] = Field(None, description="完成原因")
    response_time: Optional[float] = Field(None, description="响应时间（秒）")
    request_id: Optional[str] = Field(None, description="请求ID")
    user_id: Optional[str] = Field(None, description="用户ID")
    session_id: Optional[str] = Field(None, description="会话ID")

    class Config:
        from_attributes = True


class EmbeddingRequest(BaseModel):
    """向量化请求模式"""
    provider: AIProvider = Field(..., description="AI提供商")
    model: Optional[str] = Field(None, description="模型名称")
    text: str = Field(..., min_length=1, max_length=8000, description="要向量化的文本")
    encoding_format: Optional[str] = Field("float", description="编码格式")
    user_id: Optional[str] = Field(None, description="用户ID")

    class Config:
        from_attributes = True


class EmbeddingResponse(BaseModel):
    """向量化响应模式"""
    embedding: List[float] = Field(..., description="向量数组")
    model: str = Field(..., description="使用的模型")
    provider: str = Field(..., description="AI提供商")
    usage: Dict[str, Any] = Field(default_factory=dict, description="使用统计")
    dimensions: int = Field(..., description="向量维度")
    processing_time: Optional[float] = Field(None, description="处理时间（秒）")
    user_id: Optional[str] = Field(None, description="用户ID")

    class Config:
        from_attributes = True


class BatchChatRequest(BaseModel):
    """批量对话请求模式"""
    requests: List[ChatRequest] = Field(..., min_items=1, max_items=10, description="批量请求列表")
    max_concurrent: int = Field(3, ge=1, le=10, description="最大并发数")
    fail_fast: bool = Field(True, description="是否快速失败")

    @validator('requests')
    def validate_requests(cls, v):
        """验证批量请求"""
        if not v:
            raise ValueError("请求列表不能为空")
        return v


class BatchChatResponse(BaseModel):
    """批量对话响应模式"""
    results: List[Union[ChatResponse, Dict[str, Any]]] = Field(..., description="响应结果列表")
    total_requests: int = Field(..., description="总请求数")
    successful_requests: int = Field(..., description="成功请求数")
    failed_requests: int = Field(..., description="失败请求数")
    total_cost: float = Field(0.0, description="总成本（元）")
    processing_time: float = Field(..., description="总处理时间（秒）")
    errors: List[str] = Field(default_factory=list, description="错误信息列表")

    class Config:
        from_attributes = True


class ModelInfo(BaseModel):
    """模型信息模式"""
    provider: AIProvider = Field(..., description="AI提供商")
    model: str = Field(..., description="模型名称")
    type: AIModelType = Field(..., description="模型类型")
    description: Optional[str] = Field(None, description="模型描述")
    max_tokens: Optional[int] = Field(None, description="最大令牌数")
    context_length: Optional[int] = Field(None, description="上下文长度")
    pricing: Optional[Dict[str, float]] = Field(None, description="价格信息")
    capabilities: List[str] = Field(default_factory=list, description="能力列表")

    class Config:
        from_attributes = True


class ProviderStatus(BaseModel):
    """提供商状态模式"""
    provider: str = Field(..., description="提供商名称")
    status: str = Field(..., description="状态：success, failed, error")
    model: Optional[str] = Field(None, description="测试模型")
    response_time: Optional[str] = Field(None, description="响应时间")
    test_response: Optional[str] = Field(None, description="测试响应")
    error: Optional[str] = Field(None, description="错误信息")
    last_checked: str = Field(..., description="最后检查时间")


class SystemStatus(BaseModel):
    """系统状态模式"""
    providers: Dict[str, ProviderStatus] = Field(..., description="提供商状态")
    total_providers: int = Field(..., description="总提供商数量")
    successful_providers: int = Field(..., description="成功提供商数量")
    failed_providers: int = Field(..., description="失败提供商数量")
    checked_at: str = Field(..., description="检查时间")
    api_keys_configured: Dict[str, bool] = Field(..., description="API密钥配置状态")


class UsageStatistics(BaseModel):
    """使用统计模式"""
    provider: str = Field(..., description="AI提供商")
    model: str = Field(..., description="模型名称")
    input_tokens: int = Field(..., description="输入令牌数")
    output_tokens: int = Field(..., description="输出令牌数")
    total_tokens: int = Field(..., description="总令牌数")
    input_cost: float = Field(..., description="输入成本")
    output_cost: float = Field(..., description="输出成本")
    total_cost: float = Field(..., description="总成本")
    currency: str = Field("CNY", description="货币单位")
    request_time: Optional[datetime] = Field(None, description="请求时间")
    user_id: Optional[str] = Field(None, description="用户ID")
    session_id: Optional[str] = Field(None, description="会话ID")

    class Config:
        from_attributes = True


class CostAnalysis(BaseModel):
    """成本分析模式"""
    daily_cost: float = Field(..., description="每日成本")
    monthly_cost: float = Field(..., description="每月成本")
    yearly_cost: float = Field(..., description="年度成本")
    cost_by_provider: Dict[str, float] = Field(..., description="按提供商分组的成本")
    cost_by_model: Dict[str, float] = Field(..., description="按模型分组的成本")
    total_requests: int = Field(..., description="总请求数")
    successful_requests: int = Field(..., description="成功请求数")
    failed_requests: int = Field(..., description="失败请求数")
    average_response_time: float = Field(..., description="平均响应时间")
    currency: str = Field("CNY", description="货币单位")
    period_start: datetime = Field(..., description="统计开始时间")
    period_end: datetime = Field(..., description="统计结束时间")

    class Config:
        from_attributes = True


class ModelComparison(BaseModel):
    """模型对比模式"""
    comparison_id: str = Field(..., description="对比ID")
    models: List[ModelInfo] = Field(..., description="参与对比的模型")
    test_cases: List[Dict[str, Any]] = Field(..., description="测试用例")
    results: Dict[str, Dict[str, Any]] = Field(..., description="对比结果")
    metrics: List[str] = Field(..., description="评估指标")
    winner: Optional[str] = Field(None, description="最佳模型")
    confidence_level: float = Field(0.95, description="置信度")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class StreamingChunk(BaseModel):
    """流式响应数据块"""
    content: str = Field(..., description="内容片段")
    finish_reason: Optional[str] = Field(None, description="完成原因")
    is_last: bool = Field(False, description="是否为最后一块")
    request_id: Optional[str] = Field(None, description="请求ID")

    class Config:
        from_attributes = True


class ModelCapabilities(BaseModel):
    """模型能力描述"""
    text_generation: bool = Field(True, description="文本生成")
    conversation: bool = Field(True, description="对话能力")
    instruction_following: bool = Field(True, description="指令遵循")
    reasoning: bool = Field(False, description="推理能力")
    code_generation: bool = Field(False, description="代码生成")
    multilingual: bool = Field(True, description="多语言支持")
    long_context: bool = Field(False, description="长上下文支持")
    streaming: bool = Field(True, description="流式输出")
    function_calling: bool = Field(False, description="函数调用")
    tool_use: bool = Field(False, description="工具使用")


class ModelLimitations(BaseModel):
    """模型限制说明"""
    max_tokens: Optional[int] = Field(None, description="最大令牌数")
    max_input_length: Optional[int] = Field(None, description="最大输入长度")
    rate_limit: Optional[str] = Field(None, description="速率限制")
    content_policy: Optional[str] = Field(None, description="内容政策")
    temperature_range: tuple = Field((0.0, 2.0), description="温度范围")
    top_p_range: tuple = Field((0.0, 1.0), description="核采样范围")


class ModelConfiguration(BaseModel):
    """模型配置模式"""
    provider: AIProvider = Field(..., description="AI提供商")
    model: str = Field(..., description="模型名称")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="温度参数")
    max_tokens: int = Field(1000, ge=1, le=8000, description="最大令牌数")
    top_p: float = Field(1.0, ge=0.0, le=1.0, description="核采样参数")
    frequency_penalty: float = Field(0.0, ge=-2.0, le=2.0, description="频率惩罚")
    presence_penalty: float = Field(0.0, ge=-2.0, le=2.0, description="存在惩罚")
    stop_sequences: List[str] = Field(default_factory=list, description="停止序列")
    system_prompt: Optional[str] = Field(None, description="系统提示词")
    user_prompt_template: Optional[str] = Field(None, description="用户提示词模板")
    retry_config: Dict[str, Any] = Field(default_factory=dict, description="重试配置")
    cost_limits: Dict[str, float] = Field(default_factory=dict, description="成本限制")
    enabled: bool = Field(True, description="是否启用")

    class Config:
        from_attributes = True


class AIModelConfig(BaseModel):
    """AI模型配置模式"""
    default_provider: AIProvider = Field(AIProvider.ZHIPUAI, description="默认提供商")
    default_chat_model: str = Field("glm-4", description="默认对话模型")
    default_embedding_model: str = Field("embedding-2", description="默认嵌入模型")
    providers: Dict[AIProvider, ModelConfiguration] = Field(..., description="提供商配置")
    fallback_providers: List[AIProvider] = Field(default_factory=lambda: [AIProvider.MOONSHOT, AIProvider.DASHSCOPE], description="备用提供商")
    cost_tracking: bool = Field(True, description="是否启用成本跟踪")
    usage_limits: Dict[str, Any] = Field(default_factory=dict, description="使用限制")
    cache_settings: Dict[str, Any] = Field(default_factory=dict, description="缓存设置")

    class Config:
        from_attributes = True


# 验证器
@validator('messages', pre=True)
def validate_chat_messages(cls, v):
    """验证对话消息"""
    if not isinstance(v, list):
        raise ValueError("消息必须是列表")
    for msg in v:
        if not isinstance(msg, dict):
            raise ValueError("消息必须是字典格式")
        if 'role' not in msg or 'content' not in msg:
            raise ValueError("消息必须包含role和content字段")
    return v


@validator('temperature')
def validate_temperature(cls, v):
    """验证温度参数"""
    if not 0.0 <= v <= 2.0:
        raise ValueError("温度参数必须在0.0-2.0之间")
    return v


@validator('max_tokens')
def validate_max_tokens(cls, v):
    """验证最大令牌数"""
    if v is not None and (v < 1 or v > 8000):
        raise ValueError("最大令牌数必须在1-8000之间")
    return v


@validator('top_p')
def validate_top_p(cls, v):
    """验证核采样参数"""
    if not 0.0 <= v <= 1.0:
        raise ValueError("核采样参数必须在0.0-1.0之间")
    return v


@validator('frequency_penalty', 'presence_penalty')
def validate_penalty(cls, v):
    """验证惩罚参数"""
    if not -2.0 <= v <= 2.0:
        raise ValueError("惩罚参数必须在-2.0-2.0之间")
    return v


def get_model_description(provider: AIProvider, model: str) -> str:
    """获取模型描述"""
    descriptions = {
        AIProvider.ZHIPUAI: {
            "glm-4": "智谱AI GLM-4，通用大语言模型，支持中英文对话",
            "glm-4-0520": "智谱AI GLM-4-0520，优化版本，提升推理性能",
            "glm-3-turbo": "智谱AI GLM-3-turbo，轻量级对话模型"
        },
        AIProvider.MOONSHOT: {
            "moonshot-v1-8k": "月之暗面 Kimi，8K上下文窗口，适合长文本",
            "moonshot-v1-32k": "月之暗面 Kimi，32K上下文窗口，支持超长文本",
            "moonshot-v1-128k": "月之暗面 Kimi，128K上下文窗口，超长文档处理"
        },
        AIProvider.DASHSCOPE: {
            "qwen-turbo": "阿里通义千问 Turbo，快速响应模型",
            "qwen-plus": "阿里通义千问 Plus，平衡性能与能力",
            "qwen-max": "阿里通义千问 Max，最强大的对话模型",
            "qwen2.5-72b-instruct": "通义千问2.5，72B参数，指令遵循专家"
        },
        AIProvider.BAIDU: {
            "ERNIE-Speed-8K": "百度文心一言 Speed，快速响应",
            "ERNIE-Lite-8K": "百度文心一言 Lite，轻量级模型",
            "ERNIE-Turbo-8K": "百度文心一言 Turbo，高性能版本"
        },
        AIProvider.DEEPSEEK: {
            "deepseek-chat": "深度求索 Chat，通用对话模型",
            "deepseek-coder": "深度求索 Coder，代码生成专用模型"
        },
        AIProvider.YI: {
            "yi-large": "零一万物 Yi-Large，大容量模型",
            "yi-medium": "零一万物 Yi-Medium，平衡性能与成本",
            "yi-chat": "零一万物 Yi-Chat，对话专用模型"
        },
        AIProvider.SPARK: {
            "spark-3.5": "科大讯飞星火3.5，最新版本",
            "spark-2.0": "科大讯飞星火2.0，稳定版本",
            "spark-lite": "科大讯飞星火Lite，轻量级版本"
        }
    }

    return descriptions.get(provider, {}).get(model, f"{provider.value} {model}")


def get_model_capabilities(model_type: AIModelType) -> ModelCapabilities:
    """获取模型能力"""
    capabilities = {
        AIModelType.CHAT: ModelCapabilities(
            text_generation=True,
            conversation=True,
            instruction_following=True,
            reasoning=False,
            code_generation=False,
            multilingual=True,
            long_context=False,
            streaming=True,
            function_calling=False,
            tool_use=False
        ),
        AIModelType.COMPLETION: ModelCapabilities(
            text_generation=True,
            conversation=False,
            instruction_following=True,
            reasoning=False,
            code_generation=False,
            multilingual=True,
            long_context=False,
            streaming=True,
            function_calling=False,
            tool_use=False
        ),
        AIModelType.EMBEDDING: ModelCapabilities(
            text_generation=False,
            conversation=False,
            instruction_following=False,
            reasoning=False,
            code_generation=False,
            multilingual=True,
            long_context=False,
            streaming=False,
            function_calling=False,
            tool_use=False
        ),
        AIModelType.RERANK: ModelCapabilities(
            text_generation=False,
            conversation=False,
            instruction_following=False,
            reasoning=False,
            code_generation=False,
            multilingual=True,
            long_context=False,
            streaming=False,
            function_calling=False,
            tool_use=False
        ),
        AIModelType.VISION: ModelCapabilities(
            text_generation=False,
            conversation=False,
            instruction_following=False,
            reasoning=False,
            code_generation=False,
            multilingual=True,
            long_context=False,
            streaming=False,
            function_calling=False,
            tool_use=False
        ),
        AIModelType.AUDIO: ModelCapabilities(
            text_generation=False,
            conversation=False,
            instruction_following=False,
            reasoning=False,
            code_generation=False,
            multilingual=True,
            long_context=False,
            streaming=False,
            function_calling=False,
            tool_use=False
        )
    }

    return capabilities.get(model_type, ModelCapabilities())


def get_model_limitations(model_name: str) -> ModelLimitations:
    """获取模型限制"""
    limitations = {
        "glm-4": ModelLimitations(
            max_tokens=8192,
            max_input_length=8192,
            rate_limit="60 requests/minute",
            content_policy="standard",
            temperature_range=(0.0, 2.0),
            top_p_range=(0.0, 1.0)
        ),
        "glm-4-0520": ModelLimitations(
            max_tokens=8192,
            max_input_length=8192,
            rate_limit="120 requests/minute",
            content_policy="standard",
            temperature_range=(0.0, 2.0),
            top_p_range=(0.0, 1.0)
        ),
        "moonshot-v1-8k": ModelLimitations(
            max_tokens=8000,
            max_input_length=8000,
            rate_limit="60 requests/minute",
            content_policy="standard",
            temperature_range=(0.0, 2.0),
            top_p_range=(0.0, 1.0)
        ),
        "qwen-turbo": ModelLimitations(
            max_tokens=6000,
            max_input_length=6000,
            rate_limit="100 requests/minute",
            content_policy="standard",
            temperature_range=(0.0, 2.0),
            top_p_range=(0.0, 1.0)
        )
    }

    return limitations.get(model_name, ModelLimitations())