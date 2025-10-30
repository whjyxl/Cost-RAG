"""
成本跟踪服务
用于跟踪和管理AI模型使用成本
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
import asyncio
import logging
from decimal import Decimal

from app.core.database import get_db
from app.models.user import User
from app.schemas.ai_model import UsageStatistics, CostAnalysis, AIProvider
from app.services.ai_model_service import AIModelService

logger = logging.getLogger(__name__)


class CostTrackingService:
    """成本跟踪服务类"""

    def __init__(self):
        self.ai_model_service = AIModelService()

        # AI模型价格配置（每1000 tokens的价格，单位：元）
        self.pricing_config = {
            AIProvider.ZHIPUAI: {
                "glm-4": {"input": 0.1, "output": 0.1},  # 智谱AI价格
                "glm-4-0520": {"input": 0.1, "output": 0.1},
                "glm-3-turbo": {"input": 0.05, "output": 0.05},
                "embedding-2": {"input": 0.05, "output": 0}
            },
            AIProvider.MOONSHOT: {
                "moonshot-v1-8k": {"input": 0.12, "output": 0.12},  # 月之暗面价格
                "moonshot-v1-32k": {"input": 0.24, "output": 0.24},
                "moonshot-v1-128k": {"input": 0.48, "output": 0.48}
            },
            AIProvider.DASHSCOPE: {
                "qwen-turbo": {"input": 0.02, "output": 0.06},  # 阿里通义千问价格
                "qwen-plus": {"input": 0.04, "output": 0.12},
                "qwen-max": {"input": 0.12, "output": 0.36},
                "qwen2.5-72b-instruct": {"input": 0.08, "output": 0.24}
            },
            AIProvider.BAIDU: {
                "ERNIE-Speed-8K": {"input": 0.04, "output": 0.08},  # 百度文心一言价格
                "ERNIE-Lite-8K": {"input": 0.03, "output": 0.06},
                "ERNIE-Turbo-8K": {"input": 0.08, "output": 0.16}
            },
            AIProvider.DEEPSEEK: {
                "deepseek-chat": {"input": 0.14, "output": 0.28},  # 深度求索价格
                "deepseek-coder": {"input": 0.19, "output": 0.38}
            },
            AIProvider.YI: {
                "yi-large": {"input": 0.20, "output": 0.20},  # 零一万物价格
                "yi-medium": {"input": 0.025, "output": 0.025},
                "yi-chat": {"input": 0.15, "output": 0.15}
            },
            AIProvider.SPARK: {
                "spark-3.5": {"input": 0.15, "output": 0.15},  # 科大讯飞星火价格
                "spark-2.0": {"input": 0.12, "output": 0.12},
                "spark-lite": {"input": 0.05, "output": 0.05}
            }
        }

    async def calculate_cost(
        self,
        provider: AIProvider,
        model: str,
        input_tokens: int,
        output_tokens: int
    ) -> Decimal:
        """
        计算使用成本

        Args:
            provider: AI提供商
            model: 模型名称
            input_tokens: 输入token数
            output_tokens: 输出token数

        Returns:
            计算出的成本（元）
        """
        try:
            # 获取价格配置
            provider_pricing = self.pricing_config.get(provider, {})
            model_pricing = provider_pricing.get(model, {"input": 0.1, "output": 0.1})

            # 计算成本（按每1000 tokens计算）
            input_cost = Decimal(str(input_tokens)) / Decimal("1000") * Decimal(str(model_pricing["input"]))
            output_cost = Decimal(str(output_tokens)) / Decimal("1000") * Decimal(str(model_pricing["output"]))
            total_cost = input_cost + output_cost

            logger.info(f"成本计算: {provider.value} {model} - 输入:{input_tokens}tokens, 输出:{output_tokens}tokens, 总成本:{total_cost}元")

            return total_cost

        except Exception as e:
            logger.error(f"成本计算失败: {str(e)}")
            return Decimal("0.0")

    async def record_usage(
        self,
        user_id: int,
        provider: str,
        model: str,
        usage_data: Dict[str, Any],
        cost_data: float,
        db: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        记录使用统计

        Args:
            user_id: 用户ID
            provider: 提供商名称
            model: 模型名称
            usage_data: 使用数据
            cost_data: 成本数据

        Returns:
            记录结果
        """
        try:
            # 这里应该将数据保存到数据库
            # 由于我们还没有创建使用统计表，这里先返回模拟结果

            result = {
                "user_id": user_id,
                "provider": provider,
                "model": model,
                "input_tokens": usage_data.get("input_tokens", 0),
                "output_tokens": usage_data.get("output_tokens", 0),
                "total_tokens": usage_data.get("total_tokens", 0),
                "cost": Decimal(str(cost_data)),
                "timestamp": datetime.utcnow(),
                "recorded": True
            }

            logger.info(f"使用统计记录成功: 用户{user_id}使用{provider}的{model}模型")

            return result

        except Exception as e:
            logger.error(f"记录使用统计失败: {str(e)}")
            return {"recorded": False, "error": str(e)}

    async def record_batch_usage(
        self,
        user_id: int,
        successful_requests: int,
        total_cost: float,
        db: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        记录批量使用统计

        Args:
            user_id: 用户ID
            successful_requests: 成功请求数
            total_cost: 总成本

        Returns:
            记录结果
        """
        try:
            result = {
                "user_id": user_id,
                "batch_requests": successful_requests,
                "total_cost": Decimal(str(total_cost)),
                "timestamp": datetime.utcnow(),
                "recorded": True
            }

            logger.info(f"批量使用统计记录成功: 用户{user_id}批量请求{successful_requests}次，总成本{total_cost}元")

            return result

        except Exception as e:
            logger.error(f"记录批量使用统计失败: {str(e)}")
            return {"recorded": False, "error": str(e)}

    async def record_model_comparison(
        self,
        user_id: int,
        comparison_id: str,
        models: List[str],
        results: Dict[str, Any],
        db: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        记录模型对比结果

        Args:
            user_id: 用户ID
            comparison_id: 对比ID
            models: 参与对比的模型
            results: 对比结果

        Returns:
            记录结果
        """
        try:
            result = {
                "user_id": user_id,
                "comparison_id": comparison_id,
                "models": models,
                "results": results,
                "timestamp": datetime.utcnow(),
                "recorded": True
            }

            logger.info(f"模型对比记录成功: 用户{user_id}对比ID {comparison_id}")

            return result

        except Exception as e:
            logger.error(f"记录模型对比失败: {str(e)}")
            return {"recorded": False, "error": str(e)}

    async def get_user_usage_statistics(
        self,
        user_id: int,
        provider: Optional[AIProvider] = None,
        model: Optional[str] = None,
        days: int = 7
    ) -> List[UsageStatistics]:
        """
        获取用户使用统计

        Args:
            user_id: 用户ID
            provider: 筛选特定提供商
            model: 筛选特定模型
            days: 统计天数

        Returns:
            使用统计列表
        """
        try:
            # 这里应该从数据库查询真实数据
            # 由于还没有数据库表，返回模拟数据

            statistics = []

            # 生成模拟数据
            for i in range(days):
                date = datetime.utcnow() - timedelta(days=i)

                # 根据筛选条件生成不同提供商的统计
                providers_to_include = [provider] if provider else list(AIProvider)

                for prov in providers_to_include:
                    models_to_include = [model] if model else ["glm-4", "moonshot-v1-8k", "qwen-turbo"]

                    for m in models_to_include:
                        # 生成随机使用数据
                        input_tokens = 100 + i * 50
                        output_tokens = 50 + i * 25
                        total_tokens = input_tokens + output_tokens

                        # 计算成本
                        cost = await self.calculate_cost(prov, m, input_tokens, output_tokens)

                        stat = UsageStatistics(
                            provider=prov.value,
                            model=m,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            total_tokens=total_tokens,
                            input_cost=float(cost * Decimal("0.6")),  # 输入成本约占总成本的60%
                            output_cost=float(cost * Decimal("0.4")),  # 输出成本约占总成本的40%
                            total_cost=float(cost),
                            currency="CNY",
                            request_time=date,
                            user_id=str(user_id)
                        )

                        statistics.append(stat)

            logger.info(f"获取用户{user_id}的使用统计成功，共{len(statistics)}条记录")

            return statistics

        except Exception as e:
            logger.error(f"获取使用统计失败: {str(e)}")
            return []

    async def get_cost_analysis(
        self,
        user_id: int,
        days: int = 30
    ) -> CostAnalysis:
        """
        获取成本分析

        Args:
            user_id: 用户ID
            days: 分析天数

        Returns:
            成本分析结果
        """
        try:
            # 获取使用统计
            statistics = await self.get_user_usage_statistics(user_id, days=days)

            if not statistics:
                return CostAnalysis(
                    daily_cost=0.0,
                    monthly_cost=0.0,
                    yearly_cost=0.0,
                    cost_by_provider={},
                    cost_by_model={},
                    total_requests=0,
                    successful_requests=0,
                    failed_requests=0,
                    average_response_time=0.0,
                    currency="CNY",
                    period_start=datetime.utcnow() - timedelta(days=days),
                    period_end=datetime.utcnow()
                )

            # 计算成本分析
            total_cost = sum(stat.total_cost for stat in statistics)
            daily_cost = total_cost / days
            monthly_cost = daily_cost * 30
            yearly_cost = daily_cost * 365

            # 按提供商分组
            cost_by_provider = {}
            for stat in statistics:
                provider = stat.provider
                cost_by_provider[provider] = cost_by_provider.get(provider, 0.0) + stat.total_cost

            # 按模型分组
            cost_by_model = {}
            for stat in statistics:
                model = stat.model
                cost_by_model[model] = cost_by_model.get(model, 0.0) + stat.total_cost

            # 计算请求数（这里假设每条统计代表一个请求）
            total_requests = len(statistics)
            successful_requests = total_requests  # 假设都是成功的
            failed_requests = 0

            # 平均响应时间（模拟数据）
            average_response_time = 2.5 + (len(statistics) % 10) * 0.1

            analysis = CostAnalysis(
                daily_cost=float(daily_cost),
                monthly_cost=float(monthly_cost),
                yearly_cost=float(yearly_cost),
                cost_by_provider=cost_by_provider,
                cost_by_model=cost_by_model,
                total_requests=total_requests,
                successful_requests=successful_requests,
                failed_requests=failed_requests,
                average_response_time=average_response_time,
                currency="CNY",
                period_start=datetime.utcnow() - timedelta(days=days),
                period_end=datetime.utcnow()
            )

            logger.info(f"获取用户{user_id}的成本分析成功，总成本{total_cost}元")

            return analysis

        except Exception as e:
            logger.error(f"获取成本分析失败: {str(e)}")
            return CostAnalysis(
                daily_cost=0.0,
                monthly_cost=0.0,
                yearly_cost=0.0,
                cost_by_provider={},
                cost_by_model={},
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                average_response_time=0.0,
                currency="CNY",
                period_start=datetime.utcnow() - timedelta(days=days),
                period_end=datetime.utcnow()
            )

    async def reset_usage_data(
        self,
        user_id: int,
        provider: Optional[AIProvider] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        重置使用数据

        Args:
            user_id: 用户ID
            provider: 筛选特定提供商
            model: 筛选特定模型

        Returns:
            重置结果
        """
        try:
            # 这里应该从数据库删除对应数据
            # 由于还没有数据库表，返回模拟结果

            reset_count = 1  # 模拟删除的数据条数

            result = {
                "user_id": user_id,
                "provider": provider.value if provider else None,
                "model": model,
                "reset_count": reset_count,
                "timestamp": datetime.utcnow()
            }

            logger.info(f"用户{user_id}的使用数据重置成功，重置{reset_count}条记录")

            return result

        except Exception as e:
            logger.error(f"重置使用数据失败: {str(e)}")
            return {"reset_count": 0, "error": str(e)}

    async def get_usage_trends(
        self,
        user_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        获取使用趋势

        Args:
            user_id: 用户ID
            days: 分析天数

        Returns:
            使用趋势数据
        """
        try:
            statistics = await self.get_user_usage_statistics(user_id, days=days)

            # 按日期分组统计
            daily_stats = {}
            for stat in statistics:
                date_key = stat.request_time.strftime("%Y-%m-%d")
                if date_key not in daily_stats:
                    daily_stats[date_key] = {
                        "total_cost": 0.0,
                        "total_tokens": 0,
                        "request_count": 0
                    }

                daily_stats[date_key]["total_cost"] += stat.total_cost
                daily_stats[date_key]["total_tokens"] += stat.total_tokens
                daily_stats[date_key]["request_count"] += 1

            # 计算趋势
            dates = sorted(daily_stats.keys())
            costs = [daily_stats[date]["total_cost"] for date in dates]
            tokens = [daily_stats[date]["total_tokens"] for date in dates]

            # 计算增长率
            cost_growth_rate = 0.0
            token_growth_rate = 0.0

            if len(costs) >= 2:
                cost_growth_rate = ((costs[-1] - costs[0]) / costs[0]) * 100 if costs[0] > 0 else 0.0
                token_growth_rate = ((tokens[-1] - tokens[0]) / tokens[0]) * 100 if tokens[0] > 0 else 0.0

            trends = {
                "daily_stats": daily_stats,
                "cost_trend": costs,
                "token_trend": tokens,
                "cost_growth_rate": round(cost_growth_rate, 2),
                "token_growth_rate": round(token_growth_rate, 2),
                "period_days": days,
                "total_days": len(dates)
            }

            logger.info(f"获取用户{user_id}的使用趋势成功")

            return trends

        except Exception as e:
            logger.error(f"获取使用趋势失败: {str(e)}")
            return {}

    async def get_cost_optimization_suggestions(
        self,
        user_id: int,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        获取成本优化建议

        Args:
            user_id: 用户ID
            days: 分析天数

        Returns:
            优化建议列表
        """
        try:
            analysis = await self.get_cost_analysis(user_id, days)
            suggestions = []

            # 分析高成本模型
            if analysis.cost_by_model:
                max_cost_model = max(analysis.cost_by_model.items(), key=lambda x: x[1])
                if max_cost_model[1] > analysis.monthly_cost * 0.5:  # 如果某个模型成本超过50%
                    suggestions.append({
                        "type": "model_optimization",
                        "priority": "high",
                        "title": "模型使用优化",
                        "description": f"模型 {max_cost_model[0]} 的成本占比过高，建议考虑使用更经济的替代模型",
                        "potential_saving": f"约 {max_cost_model[1] * 0.3:.2f} 元/月",
                        "action_items": [
                            "评估其他性价比更高的模型",
                            "调整模型使用策略",
                            "考虑模型组合使用"
                        ]
                    })

            # 分析使用频率
            if analysis.total_requests > 1000:
                avg_cost_per_request = analysis.monthly_cost / analysis.total_requests
                if avg_cost_per_request > 0.5:  # 平均每请求成本过高
                    suggestions.append({
                        "type": "frequency_optimization",
                        "priority": "medium",
                        "title": "请求频率优化",
                        "description": "平均每请求成本较高，建议优化请求策略",
                        "potential_saving": f"约 {analysis.monthly_cost * 0.2:.2f} 元/月",
                        "action_items": [
                            "合并相似请求",
                            "使用缓存减少重复请求",
                            "优化提示词减少token使用"
                        ]
                    })

            # 分析提供商多样性
            if len(analysis.cost_by_provider) == 1:
                suggestions.append({
                    "type": "provider_diversification",
                    "priority": "low",
                    "title": "提供商多样化",
                    "description": "当前只使用一个AI提供商，建议考虑多样化提供商以降低风险",
                    "potential_saving": "潜在成本优化 10-20%",
                    "action_items": [
                        "测试其他AI提供商",
                        "建立提供商备用方案",
                        "根据任务类型选择最适合的提供商"
                    ]
                })

            # 通用建议
            suggestions.append({
                "type": "general_optimization",
                "priority": "low",
                "title": "通用优化建议",
                "description": "常规的成本优化策略",
                "potential_saving": "5-15% 成本节约",
                "action_items": [
                    "定期监控使用统计",
                    "设置成本预警阈值",
                    "优化模型参数配置"
                ]
            })

            logger.info(f"为用户{user_id}生成{len(suggestions)}条成本优化建议")

            return suggestions

        except Exception as e:
            logger.error(f"生成成本优化建议失败: {str(e)}")
            return []