"""
AI模型服务模块 - 集成7个主要国产AI厂商接口
"""
import asyncio
import json
import aiohttp
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum
import hashlib
import logging

from app.core.config import settings
from app.core.logging import logger


class AIProvider(str, Enum):
    """AI提供商枚举"""
    ZHIPUAI = "zhipuai"  # 智谱AI
    MOONSHOT = "moonshot"  # 月之暗面
    DASHSCOPE = "dashscope"  # 阿里通义千问
    BAIDU = "baidu"  # 百度文心一言
    DEEPSEEK = "deepseek"  # 深度求索
    YI = "yi"  # 零一万物
    SPARK = "spark"  # 科大讯飞星火


class AIModelType(str, Enum):
    """AI模型类型枚举"""
    CHAT = "chat"  # 对话模型
    COMPLETION = "completion"  # 文本生成
    EMBEDDING = "embedding"  # 向量化
    RERANK = "rerank"  # 重排序
    VISION = "vision"  # 视觉模型
    AUDIO = "audio"  # 音频模型


class AIModelService:
    """AI模型服务类"""

    def __init__(self):
        self.session = None
        self.timeout = aiohttp.ClientTimeout(total=60, connect=10)
        self.providers = {
            AIProvider.ZHIPUAI: {
                "base_url": "https://open.bigmodel.cn/api/paas/v4",
                "models": {
                    AIModelType.CHAT: ["glm-4", "glm-4-0520", "glm-3-turbo"],
                    AIModelType.EMBEDDING: ["embedding-2"],
                    AIModelType.COMPLETION: ["glm-4"]
                },
                "headers": {
                    "Authorization": f"Bearer {settings.ZHIPUAI_API_KEY}",
                    "Content-Type": "application/json"
                }
            },
            AIProvider.MOONSHOT: {
                "base_url": "https://api.moonshot.cn/v1",
                "models": {
                    AIModelType.CHAT: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
                    AIModelType.EMBEDDING: []
                },
                "headers": {
                    "Authorization": f"Bearer {settings.MOONSHOT_API_KEY}",
                    "Content-Type": "application/json"
                }
            },
            AIProvider.DASHSCOPE: {
                "base_url": "https://dashscope.aliyuncs.com/api/v1",
                "models": {
                    AIModelType.CHAT: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen2.5-72b-instruct", "qwen2.5-32b-chat"],
                    AIModelType.EMBEDDING: ["text-embedding-v1", "text-embedding-v2", "text-embedding-v3"],
                    AIModelType.COMPLETION: ["qwen-turbo", "qwen-plus", "qwen-max"]
                },
                "headers": {
                    "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
                    "Content-Type": "application/json"
                }
            },
            AIProvider.BAIDU: {
                "base_url": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1",
                "models": {
                    AIModelType.CHAT: ["ERNIE-Speed-8K", "ERNIE-Lite-8K", "ERNIE-Turbo-8K"],
                    AIModelType.EMBEDDING: ["bge-large-zh", "bge-small-zh"],
                    AIModelType.COMPLETION: ["ERNIE-Speed-8K", "ERNIE-Lite-8K"]
                },
                "headers": {
                    "Content-Type": "application/json"
                },
                "api_key": settings.BAIDU_API_KEY,
                "secret_key": settings.BAIDU_SECRET_KEY
            },
            AIProvider.DEEPSEEK: {
                "base_url": "https://api.deepseek.com",
                "models": {
                    AIModelType.CHAT: ["deepseek-chat", "deepseek-coder"],
                    AIModelType.EMBEDDING: [],
                    AIModelType.COMPLETION: ["deepseek-chat"]
                },
                "headers": {
                    "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json"
                }
            },
            AIProvider.YI: {
                "base_url": "https://api.lingyiwan.com/v1",
                "models": {
                    AIModelType.CHAT: ["yi-large", "yi-medium", "yi-chat"],
                    AIModelType.EMBEDDING: [],
                    AIModelType.COMPLETION: ["yi-large"]
                },
                "headers": {
                    "Authorization": f"Bearer {settings.YI_API_KEY}",
                    "Content-Type": "application/json"
                }
            },
            AIProvider.SPARK: {
                "base_url": "https://spark-api.xf-yun.com/v3.1",
                "models": {
                    AIModelType.CHAT: ["spark-3.5", "spark-2.0", "spark-lite"],
                    AIModelType.EMBEDDING: [],
                    AIModelType.COMPLETION: ["spark-3.5"]
                },
                "headers": {
                    "Authorization": f"{settings.SPARK_APP_ID}:{settings.SPARK_API_SECRET}",
                    "Content-Type": "application/json"
                }
            }
        }

    async def _get_session(self):
        """获取HTTP会话"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        return self.session

    async def _close_session(self):
        """关闭HTTP会话"""
        if self.session and not self.session.closed:
            await self.session.close()
            self.session = None

    async def chat_completion(
        self,
        provider: AIProvider,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        对话补全API调用

        Args:
            provider: AI提供商
            messages: 对话消息列表
            model: 模型名称
            temperature: 温度参数
            max_tokens: 最大令牌数
            stream: 是否流式返回
            **kwargs: 其他参数

        Returns:
            API响应结果
        """
        try:
            session = await self._get_session()
            provider_config = self.providers[provider]

            # 选择模型
            if not model:
                available_models = provider_config["models"].get(AIModelType.CHAT, [])
                model = available_models[0] if available_models else None

            if not model:
                raise ValueError(f"提供商 {provider.value} 没有可用的对话模型")

            # 构建请求数据
            if provider == AIProvider.ZHIPUAI:
                request_data = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": stream,
                    **kwargs
                }
            elif provider == AIProvider.MOONSHOT:
                request_data = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": stream,
                    **kwargs
                }
            elif provider == AIProvider.DASHSCOPE:
                request_data = {
                    "model": model,
                    "input": {
                        "messages": messages
                    },
                    "parameters": {
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "incremental_output": stream,
                        **kwargs
                    }
                }
            elif provider == AIProvider.BAIDU:
                request_data = {
                    "messages": messages,
                    "temperature": temperature,
                    "max_output_tokens": max_tokens,
                    "stream": stream,
                    **kwargs
                }
            elif provider == AIProvider.DEEPSEEK:
                request_data = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": stream,
                    **kwargs
                }
            elif provider == AIProvider.YI:
                request_data = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": stream,
                    **kwargs
                }
            elif provider == AIProvider.SPARK:
                request_data = {
                    "header": {
                        "app_id": settings.SPARK_APP_ID,
                        "uid": "user_123"
                    },
                    "parameter": {
                        "chat": {
                            "domain": "general",
                            "temperature": temperature,
                            "max_tokens": max_tokens,
                            "messages": messages
                        }
                    }
                }
            else:
                raise ValueError(f"不支持的提供商: {provider}")

            # 发送请求
            headers = provider_config["headers"].copy()
            if provider == AIProvider.BAIDU:
                # 百度需要特殊的认证方式
                auth_string = f"{provider_config['api_key']}:{provider_config['secret_key']}"
                auth_bytes = auth_string.encode('ascii')
                auth_b64 = hashlib.sha1(auth_bytes).hexdigest()
                headers['Authorization'] = auth_b64

            async with session.post(
                f"{provider_config['base_url']}/chat/completions",
                headers=headers,
                json=request_data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"AI API调用失败: {response.status} - {error_text}")
                    raise aiohttp.ClientResponseError(
                        request_info=response.request_info,
                        history=response.history,
                        status=response.status,
                        message=error_text
                    )

                result = await response.json()

                # 处理响应格式
                if provider == AIProvider.DASHSCOPE:
                    # 阿里通义千问返回格式
                    if "output" in result and "text" in result["output"]:
                        return {
                            "content": result["output"]["text"],
                            "usage": result.get("usage", {}),
                            "model": model,
                            "provider": provider.value
                        }
                elif provider == AIProvider.SPARK:
                    # 讯飞星火返回格式
                    if "payload" in result and "choices" in result["payload"]:
                        choice = result["payload"]["choices"][0]
                        return {
                            "content": choice["content"],
                            "usage": result["payload"].get("usage", {}),
                            "model": model,
                            "provider": provider.value
                        }
                else:
                    # 其他提供商的标准格式
                    return {
                        "content": result.get("choices", [{}])[0].get("message", {}).get("content", ""),
                        "usage": result.get("usage", {}),
                        "model": model,
                        "provider": provider.value
                    }

        except Exception as e:
            logger.error(f"对话补全API调用失败: {str(e)}")
            raise

    async def text_embedding(
        self,
        provider: AIProvider,
        text: str,
        model: Optional[str] = None,
        **kwargs
    ) -> List[float]:
        """
        文本向量化API调用

        Args:
            provider: AI提供商
            text: 输入文本
            model: 模型名称
            **kwargs: 其他参数

        Returns:
            向量数组
        """
        try:
            session = await self._get_session()
            provider_config = self.providers[provider]

            # 选择模型
            if not model:
                available_models = provider_config["models"].get(AIModelType.EMBEDDING, [])
                model = available_models[0] if available_models else None

            if not model:
                raise ValueError(f"提供商 {provider.value} 没有可用的嵌入模型")

            # 构建请求数据
            if provider == AIProvider.ZHIPUAI:
                request_data = {
                    "model": model,
                    "input": text,
                    "encoding_format": "float",
                    **kwargs
                }
            elif provider == AIProvider.DASHSCOPE:
                request_data = {
                    "model": model,
                    "input": {
                        "texts": [text]
                    },
                    "parameters": {
                        "text_type": "document"
                    }
                }
            elif provider == AIProvider.BAIDU:
                request_data = {
                    "input": [text],
                    "model": model
                }
            else:
                raise ValueError(f"提供商 {provider.value} 不支持文本向量化")

            # 发送请求
            headers = provider_config["headers"].copy()
            if provider == AIProvider.BAIDU:
                auth_string = f"{provider_config['api_key']}:{provider_config['secret_key']}"
                auth_bytes = auth_string.encode('ascii')
                auth_b64 = hashlib.sha1(auth_bytes).hexdigest()
                headers['Authorization'] = auth_b64

            async with session.post(
                f"{provider_config['base_url']}/embeddings",
                headers=headers,
                json=request_data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"向量化API调用失败: {response.status} - {error_text}")
                    raise aiohttp.ClientResponseError(
                        request_info=response.request_info,
                        history=response.history,
                        status=response.status,
                        message=error_text
                    )

                result = await response.json()

                # 处理响应格式
                if provider == AIProvider.ZHIPUAI:
                    return result.get("data", [])
                elif provider == AIProvider.DASHSCOPE:
                    return result.get("outputs", [])[0]["embeddings"]
                elif provider == AIProvider.BAIDU:
                    return result.get("data", [])[0]["embedding"]
                else:
                    return result.get("data", [])

        except Exception as e:
            logger.error(f"文本向量化API调用失败: {str(e)}")
            raise

    async def get_available_models(
        self,
        provider: AIProvider
    ) -> Dict[str, List[str]]:
        """
        获取可用模型列表

        Args:
            provider: AI提供商

        Returns:
            模型类型到模型列表的映射
        """
        try:
            provider_config = self.providers[provider]
            return provider_config["models"]

        except Exception as e:
            logger.error(f"获取模型列表失败: {str(e)}")
            return {}

    async def test_connection(
        self,
        provider: AIProvider
    ) -> Dict[str, Any]:
        """
        测试AI提供商连接

        Args:
            provider: AI提供商

        Returns:
            测试结果
        """
        try:
            # 简单的测试对话
            test_messages = [
                {"role": "user", "content": "你好，请回复'连接成功'"}
            ]

            result = await self.chat_completion(
                provider=provider,
                messages=test_messages,
                max_tokens=10
            )

            return {
                "provider": provider.value,
                "status": "success",
                "model": result.get("model"),
                "response_time": datetime.utcnow().isoformat(),
                "test_response": result.get("content", "")
            }

        except Exception as e:
            return {
                "provider": provider.value,
                "status": "failed",
                "error": str(e),
                "response_time": datetime.utcnow().isoformat()
            }

    async def batch_chat_completion(
        self,
        requests: List[Dict[str, Any]],
        max_concurrent: int = 5
    ) -> List[Dict[str, Any]]:
        """
        批量对话补全

        Args:
            requests: 请求列表
            max_concurrent: 最大并发数

        Returns:
            响应列表
        """
        try:
            semaphore = asyncio.Semaphore(max_concurrent)
            session = await self._get_session()

            async def process_request(request_data):
                async with semaphore:
                    return await self.chat_completion(**request_data)

            tasks = [process_request(req) for req in requests]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # 处理异常
            final_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    final_results.append({
                        "error": str(result),
                        "request_index": i
                    })
                else:
                    final_results.append(result)

            return final_results

        except Exception as e:
            logger.error(f"批量对话补全失败: {str(e)}")
            raise

    async def get_provider_status(self) -> Dict[str, Any]:
        """获取所有提供商状态"""
        try:
            status_results = {}

            for provider in AIProvider:
                try:
                    result = await self.test_connection(provider)
                    status_results[provider.value] = result
                except Exception as e:
                    status_results[provider.value] = {
                        "provider": provider.value,
                        "status": "failed",
                        "error": str(e)
                    }

            return {
                "providers": status_results,
                "total_providers": len(AIProvider),
                "successful_providers": sum(1 for r in status_results.values() if r.get("status") == "success"),
                "checked_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"获取提供商状态失败: {str(e)}")
            return {}

    async def calculate_usage_cost(
        self,
        provider: AIProvider,
        usage: Dict[str, Any],
        model: str
    ) -> Dict[str, float]:
        """
        计算使用成本

        Args:
            provider: AI提供商
            usage: 使用统计
            model: 模型名称

        Returns:
            成本明细
        """
        try:
            # 成本配置（每千token价格，单位：元）
            cost_config = {
                AIProvider.ZHIPUAI: {
                    "glm-4": {"input": 0.1, "output": 0.3},
                    "glm-4-0520": {"input": 0.15, "output": 0.6},
                    "glm-3-turbo": {"input": 0.005, "output": 0.005}
                },
                AIProvider.MOONSHOT: {
                    "moonshot-v1-8k": {"input": 0.012, "output": 0.06},
                    "moonshot-v1-32k": {"input": 0.024, "output": 0.12},
                    "moonshot-v1-128k": {"input": 0.06, "output": 0.3}
                },
                AIProvider.DASHSCOPE: {
                    "qwen-turbo": {"input": 0.002, "output": 0.006},
                    "qwen-plus": {"input": 0.004, "output": 0.012},
                    "qwen-max": {"input": 0.02, "output": 0.06}
                },
                AIProvider.BAIDU: {
                    "ERNIE-Speed-8K": {"input": 0.004, "output": 0.012},
                    "ERNIE-Lite-8K": {"input": 0.003, "output": 0.009},
                    "ERNIE-Turbo-8K": {"input": 0.008, "output": 0.024}
                },
                AIProvider.DEEPSEEK: {
                    "deepseek-chat": {"input": 0.014, "output": 0.028},
                    "deepseek-coder": {"input": 0.014, "0.028"}
                },
                AIProvider.YI: {
                    "yi-large": {"input": 0.025, "output": 0.025},
                    "yi-medium": {"input": 0.0025, "output": 0.0025}
                },
                AIProvider.SPARK: {
                    "spark-3.5": {"input": 0.00021, "output": 0.00021},
                    "spark-2.0": {"input": 0.000168, "output": 0.000168},
                    "spark-lite": {"input": 00021, "output": 00021}
                }
            }

            if provider not in cost_config or model not in cost_config[provider]:
                return {
                    "input_cost": 0.0,
                    "output_cost": 0.0,
                    "total_cost": 0.0,
                    "currency": "CNY"
                }

            model_cost = cost_config[provider][model]
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)

            input_cost = (input_tokens / 1000) * model_cost["input"]
            output_cost = (output_tokens / 1000) * model_cost["output"]

            return {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "input_cost": round(input_cost, 4),
                "output_cost": round(output_cost, 4),
                "total_cost": round(input_cost + output_cost, 4),
                "currency": "CNY",
                "model": model,
                "provider": provider.value
            }

        except Exception as e:
            logger.error(f"成本计算失败: {str(e)}")
            return {
                "input_cost": 0.0,
                "output_cost": 0.0,
                "total_cost": 0.0,
                "currency": "CNY",
                "error": str(e)
            }

    async def __aenter__(self):
        """异步上下文管理器入口"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        await self._close_session()


# 全局AI模型服务实例
ai_model_service = AIModelService()