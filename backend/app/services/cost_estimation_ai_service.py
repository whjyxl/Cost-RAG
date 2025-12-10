"""
AI智能成本估算服务
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.services.ai_model_service import AIModelService, AIProvider
from app.schemas.estimation import (
    AIEstimationRequest,
    AIEstimationResponse,
    CostBreakdownItem
)

logger = logging.getLogger(__name__)


class CostEstimationAIService:
    """AI智能成本估算服务类"""

    def __init__(self):
        self.ai_service = AIModelService()

        # 质量等级系数映射
        self.quality_multipliers = {
            "basic": 0.85,      # 基础: 85%
            "standard": 1.0,    # 标准: 100%
            "premium": 1.25     # 高端: 125%
        }

        # 项目类型基准单价（元/㎡）- 仅供参考
        self.base_unit_costs = {
            "residential": 2500,   # 住宅
            "commercial": 3500,    # 商业
            "industrial": 2200,    # 工业
            "public": 3000,        # 公共建筑
            "mixed": 3200          # 混合
        }

    def _build_estimation_prompt(self, request: AIEstimationRequest) -> str:
        """
        构建AI估算提示词（包含14级成本结构要求）

        Args:
            request: AI估算请求

        Returns:
            提示词字符串
        """
        prompt = f"""你是一名专业的工程造价咨询专家，请根据以下项目信息进行建筑成本智能估算。

## 项目基本信息
- 项目名称: {request.project_name}
- 项目类型: {request.project_type}
- 建筑类型: {request.building_type or '未指定'}
- 结构类型: {request.structure_type or '未指定'}
- 建筑面积: {request.area} 平方米
- 项目位置: {request.location}
- 层数: {request.floors or '未指定'}
- 质量等级: {request.quality_level}
- 参考单位造价: {f'{request.unit_cost} 元/㎡' if request.unit_cost else '未提供，请完全由AI估算'}

## 额外信息
- 建设年份: {request.construction_year or '未指定'}
- 建设周期: {request.construction_period or '未指定'} 月
- 建设标准: {request.construction_standard or '未指定'}
- 设计标准: {request.design_standard or '未指定'}

## 估算要求
请你基于以上项目信息，结合你的专业知识和历史数据经验，提供详细的成本估算。

### 1. 基础估算结果
- **estimated_unit_cost** (元/㎡): 项目总单位造价
- **estimated_total_cost** (元): 项目总造价 = 单位造价 × 建筑面积
- **confidence** (0-1): 估算置信度

### 2. 简化版成本分解（4大类，用于向后兼容）
请提供以下4大类的成本构成：
- 土建工程（约40%）
- 装饰工程（约25%）
- 安装工程（约20%）
- 其他费用（约15%）

### 3. 14级成本分部结构（重要！）
请按照建筑工程造价的标准分部分项结构，提供1-14级的详细成本构成。

**一级分部（1.0-14.0）**：
1.0 土石方工程
2.0 桩基工程
3.0 砌筑工程
4.0 混凝土及钢筋混凝土工程
5.0 金属结构工程
6.0 木结构工程
7.0 门窗工程
8.0 屋面及防水工程
9.0 保温、隔热、防腐工程
10.0 楼地面工程
11.0 墙、柱面工程
12.0 天棚工程
13.0 油漆、涂料、裱糊工程
14.0 项目总造价（前13项之和）

**二级分部示例**（主要一级分部需细分）：
- 2.1 灌注桩
- 2.2 预制桩
- 4.1 现浇混凝土基础
- 4.2 现浇混凝土柱
- 4.3 现浇混凝土梁
- 4.4 现浇混凝土墙
- 4.5 现浇混凝土板
- 4.6 现浇混凝土楼梯

对于每个分部，请提供：
- item_name: 项目名称
- unit_price: 单位造价（元/㎡）
- total_price: 合价（元） = unit_price × {request.area}

## 返回JSON格式
```json
{{
    "estimated_unit_cost": 浮点数,
    "estimated_total_cost": 浮点数,
    "confidence": 0-1之间的浮点数,
    "breakdown": [
        {{"category": "土建工程", "unit_cost": 浮点数, "percentage": 浮点数, "description": "说明"}},
        {{"category": "装饰工程", "unit_cost": 浮点数, "percentage": 浮点数, "description": "说明"}},
        {{"category": "安装工程", "unit_cost": 浮点数, "percentage": 浮点数, "description": "说明"}},
        {{"category": "其他费用", "unit_cost": 浮点数, "percentage": 浮点数, "description": "说明"}}
    ],
    "primary_sections": {{
        "1.0": {{"item_name": "土石方工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "2.0": {{"item_name": "桩基工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "3.0": {{"item_name": "砌筑工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "4.0": {{"item_name": "混凝土及钢筋混凝土工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "5.0": {{"item_name": "金属结构工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "6.0": {{"item_name": "木结构工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "7.0": {{"item_name": "门窗工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "8.0": {{"item_name": "屋面及防水工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "9.0": {{"item_name": "保温、隔热、防腐工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "10.0": {{"item_name": "楼地面工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "11.0": {{"item_name": "墙、柱面工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "12.0": {{"item_name": "天棚工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "13.0": {{"item_name": "油漆、涂料、裱糊工程", "unit_price": 浮点数, "total_price": 浮点数}},
        "14.0": {{"item_name": "项目总造价", "unit_price": 浮点数, "total_price": 浮点数}}
    }},
    "secondary_sections": {{
        "2.1": {{"item_name": "灌注桩", "unit_price": 浮点数, "total_price": 浮点数}},
        "2.2": {{"item_name": "预制桩", "unit_price": 浮点数, "total_price": 浮点数}},
        "4.1": {{"item_name": "现浇混凝土基础", "unit_price": 浮点数, "total_price": 浮点数}},
        "4.2": {{"item_name": "现浇混凝土柱", "unit_price": 浮点数, "total_price": 浮点数}},
        "4.3": {{"item_name": "现浇混凝土梁", "unit_price": 浮点数, "total_price": 浮点数}},
        "4.4": {{"item_name": "现浇混凝土墙", "unit_price": 浮点数, "total_price": 浮点数}},
        "4.5": {{"item_name": "现浇混凝土板", "unit_price": 浮点数, "total_price": 浮点数}},
        "4.6": {{"item_name": "现浇混凝土楼梯", "unit_price": 浮点数, "total_price": 浮点数}}
    }},
    "rationale": "估算依据说明"
}}
```

**重要约束**：
1. 第14项（项目总造价）必须等于前13项之和
2. 二级分部的合计应等于其所属一级分部
3. 所有单位造价合计应等于 estimated_unit_cost
4. 如果无法详细分解，至少提供一级分部（1.0-14.0）
"""
        return prompt

    def _parse_ai_response(self, ai_response: str) -> Dict[str, Any]:
        """
        解析AI响应，提取JSON数据

        Args:
            ai_response: AI原始响应文本

        Returns:
            解析后的字典
        """
        try:
            # 尝试直接解析JSON
            data = json.loads(ai_response)
            return data
        except json.JSONDecodeError:
            # 如果直接解析失败，尝试提取JSON代码块
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', ai_response, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group(1))
                    return data
                except json.JSONDecodeError:
                    pass

            # 尝试提取花括号之间的内容
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group(0))
                    return data
                except json.JSONDecodeError:
                    pass

            raise ValueError("无法从AI响应中解析JSON数据")

    def _validate_and_adjust_result(
        self,
        raw_data: Dict[str, Any],
        request: AIEstimationRequest
    ) -> Dict[str, Any]:
        """
        验证和调整AI返回的结果

        Args:
            raw_data: AI原始返回数据
            request: 原始请求

        Returns:
            验证后的数据
        """
        # 确保必需字段存在
        if "estimated_unit_cost" not in raw_data:
            # 如果用户提供了unit_cost，使用它；否则使用基准单价
            if request.unit_cost:
                raw_data["estimated_unit_cost"] = request.unit_cost
            else:
                # 使用基准单价 × 质量系数
                base_cost = self.base_unit_costs.get(request.project_type.lower(), 2500)
                quality_factor = self.quality_multipliers.get(request.quality_level.lower(), 1.0)
                raw_data["estimated_unit_cost"] = base_cost * quality_factor

        if "estimated_total_cost" not in raw_data:
            raw_data["estimated_total_cost"] = raw_data["estimated_unit_cost"] * request.area

        if "confidence" not in raw_data:
            raw_data["confidence"] = 0.75  # 默认置信度

        # 限制置信度范围
        raw_data["confidence"] = max(0.0, min(1.0, raw_data["confidence"]))

        # 验证breakdown
        if "breakdown" not in raw_data or not isinstance(raw_data["breakdown"], list):
            # 如果AI没有返回breakdown，生成默认值
            unit_cost = raw_data["estimated_unit_cost"]
            raw_data["breakdown"] = [
                {
                    "category": "土建工程",
                    "unit_cost": unit_cost * 0.4,
                    "percentage": 40.0,
                    "description": "基础、主体结构等土建工程"
                },
                {
                    "category": "装饰工程",
                    "unit_cost": unit_cost * 0.25,
                    "percentage": 25.0,
                    "description": "内外装修、吊顶、墙面等装饰工程"
                },
                {
                    "category": "安装工程",
                    "unit_cost": unit_cost * 0.2,
                    "percentage": 20.0,
                    "description": "水电暖通、消防等安装工程"
                },
                {
                    "category": "其他费用",
                    "unit_cost": unit_cost * 0.15,
                    "percentage": 15.0,
                    "description": "措施费、规费、税金等其他费用"
                }
            ]

        # 验证breakdown中的每一项
        for item in raw_data["breakdown"]:
            if "category" not in item:
                item["category"] = "未分类"
            if "unit_cost" not in item:
                item["unit_cost"] = 0.0
            if "percentage" not in item:
                item["percentage"] = 0.0
            if "description" not in item:
                item["description"] = ""

        # 确保rationale存在
        if "rationale" not in raw_data:
            raw_data["rationale"] = "基于AI模型分析项目特征和历史数据进行估算"

        return raw_data

    def _generate_default_14_level_breakdown(
        self,
        estimated_unit_cost: float,
        area: float
    ) -> Dict[str, Any]:
        """
        生成默认的14级成本结构（当AI无法生成时作为备选）

        Args:
            estimated_unit_cost: 估算单位造价
            area: 建筑面积

        Returns:
            14级成本结构字典
        """
        # 默认分配比例（基于行业经验）
        distribution = {
            "1.0": ("土石方工程", 0.05),
            "2.0": ("桩基工程", 0.08),
            "3.0": ("砌筑工程", 0.06),
            "4.0": ("混凝土及钢筋混凝土工程", 0.30),
            "5.0": ("金属结构工程", 0.05),
            "6.0": ("木结构工程", 0.02),
            "7.0": ("门窗工程", 0.08),
            "8.0": ("屋面及防水工程", 0.04),
            "9.0": ("保温、隔热、防腐工程", 0.03),
            "10.0": ("楼地面工程", 0.06),
            "11.0": ("墙、柱面工程", 0.10),
            "12.0": ("天棚工程", 0.05),
            "13.0": ("油漆、涂料、裱糊工程", 0.08),
        }

        primary_sections = {}
        total_primary_unit_price = 0.0

        # 生成1-13级一级分部
        for code, (name, ratio) in distribution.items():
            unit_price = estimated_unit_cost * ratio
            total_price = unit_price * area
            primary_sections[code] = {
                "item_name": name,
                "unit_price": round(unit_price, 2),
                "total_price": round(total_price, 2)
            }
            total_primary_unit_price += unit_price

        # 第14项：项目总造价（前13项之和）
        primary_sections["14.0"] = {
            "item_name": "项目总造价",
            "unit_price": round(total_primary_unit_price, 2),
            "total_price": round(total_primary_unit_price * area, 2)
        }

        # 生成部分二级分部（主要项目细分）
        secondary_sections = {}

        # 2.0 桩基工程细分
        if "2.0" in primary_sections:
            pile_unit = primary_sections["2.0"]["unit_price"]
            secondary_sections["2.1"] = {
                "item_name": "灌注桩",
                "unit_price": round(pile_unit * 0.6, 2),
                "total_price": round(pile_unit * 0.6 * area, 2)
            }
            secondary_sections["2.2"] = {
                "item_name": "预制桩",
                "unit_price": round(pile_unit * 0.4, 2),
                "total_price": round(pile_unit * 0.4 * area, 2)
            }

        # 4.0 混凝土工程细分
        if "4.0" in primary_sections:
            concrete_unit = primary_sections["4.0"]["unit_price"]
            secondary_sections["4.1"] = {
                "item_name": "现浇混凝土基础",
                "unit_price": round(concrete_unit * 0.15, 2),
                "total_price": round(concrete_unit * 0.15 * area, 2)
            }
            secondary_sections["4.2"] = {
                "item_name": "现浇混凝土柱",
                "unit_price": round(concrete_unit * 0.20, 2),
                "total_price": round(concrete_unit * 0.20 * area, 2)
            }
            secondary_sections["4.3"] = {
                "item_name": "现浇混凝土梁",
                "unit_price": round(concrete_unit * 0.20, 2),
                "total_price": round(concrete_unit * 0.20 * area, 2)
            }
            secondary_sections["4.4"] = {
                "item_name": "现浇混凝土墙",
                "unit_price": round(concrete_unit * 0.20, 2),
                "total_price": round(concrete_unit * 0.20 * area, 2)
            }
            secondary_sections["4.5"] = {
                "item_name": "现浇混凝土板",
                "unit_price": round(concrete_unit * 0.20, 2),
                "total_price": round(concrete_unit * 0.20 * area, 2)
            }
            secondary_sections["4.6"] = {
                "item_name": "现浇混凝土楼梯",
                "unit_price": round(concrete_unit * 0.05, 2),
                "total_price": round(concrete_unit * 0.05 * area, 2)
            }

        return {
            "primary_sections": primary_sections,
            "secondary_sections": secondary_sections
        }

    async def estimate_with_ai(self, request: AIEstimationRequest) -> AIEstimationResponse:
        """
        使用AI模型进行成本估算

        Args:
            request: AI估算请求

        Returns:
            AI估算响应
        """
        try:
            # 构建提示词
            prompt = self._build_estimation_prompt(request)

            # 准备消息
            messages = [
                {
                    "role": "system",
                    "content": "你是一名资深的工程造价咨询专家，擅长建筑成本估算和分析。请严格按照要求以JSON格式返回估算结果。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]

            # 选择AI提供商
            try:
                provider = AIProvider(request.ai_provider.lower())
            except ValueError:
                provider = AIProvider.ZHIPUAI  # 默认使用智谱AI
                logger.warning(f"无效的AI提供商: {request.ai_provider}，使用默认值: {provider.value}")

            # 调用AI模型
            logger.info(f"调用AI模型进行成本估算: provider={provider.value}, model={request.ai_model}")
            ai_response = await self.ai_service.chat_completion(
                provider=provider,
                messages=messages,
                model=request.ai_model,
                temperature=request.temperature,
                max_tokens=2000
            )

            # 提取AI响应内容
            # AIModelService 返回统一格式: {"content": "...", "usage": {}, "model": "...", "provider": "..."}
            if "content" in ai_response:
                content = ai_response["content"]
            elif "choices" in ai_response and len(ai_response["choices"]) > 0:
                # 兼容旧格式（如果直接返回OpenAI格式）
                content = ai_response["choices"][0]["message"]["content"]
            else:
                raise ValueError(f"AI响应格式错误: {ai_response}")

            logger.info(f"AI原始响应: {content[:200]}...")

            # 解析AI响应
            parsed_data = self._parse_ai_response(content)

            # 验证和调整结果
            validated_data = self._validate_and_adjust_result(parsed_data, request)

            # 处理14级成本结构
            cost_breakdown = None
            if "primary_sections" in validated_data and "secondary_sections" in validated_data:
                # AI成功生成14级结构
                cost_breakdown = {
                    "primary_sections": validated_data["primary_sections"],
                    "secondary_sections": validated_data["secondary_sections"]
                }
                logger.info("使用AI生成的14级成本结构")
            else:
                # AI未生成14级结构，使用默认值
                default_breakdown = self._generate_default_14_level_breakdown(
                    validated_data["estimated_unit_cost"],
                    request.area
                )
                cost_breakdown = default_breakdown
                logger.info("使用默认14级成本结构（AI未提供）")

            # 构建响应
            response = AIEstimationResponse(
                project_name=request.project_name,
                project_type=request.project_type,
                area=request.area,
                location=request.location,
                estimated_unit_cost=validated_data["estimated_unit_cost"],
                estimated_total_cost=validated_data["estimated_total_cost"],
                confidence=validated_data["confidence"],
                breakdown=[
                    CostBreakdownItem(**item) for item in validated_data["breakdown"]
                ],
                cost_breakdown=cost_breakdown,  # ✅ 新增：14级成本明细
                rationale=validated_data["rationale"],
                model_used=request.ai_model or f"{provider.value}_default",
                ai_provider=provider.value,
                estimation_date=datetime.now()
            )

            logger.info(f"AI估算完成: unit_cost={response.estimated_unit_cost}, confidence={response.confidence}, has_14_level={cost_breakdown is not None}")
            return response

        except Exception as e:
            logger.error(f"AI估算失败: {str(e)}")
            raise Exception(f"AI估算失败: {str(e)}")

    async def close(self):
        """关闭服务，清理资源"""
        await self.ai_service._close_session()
        await self.ai_service._close_redis_client()
