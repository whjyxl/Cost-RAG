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

import redis.asyncio as redis
from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_async_session
from app.models.system_setting import SystemSetting
from app.crud import system_setting as crud_system_setting


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
        self.redis_client = None
        self.config_cache_key = "ai_model_config"
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

    async def _get_redis_client(self):
        """获取Redis客户端"""
        if self.redis_client is None:
            try:
                self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            except Exception as e:
                logger.error(f"Redis连接失败: {str(e)}")
                self.redis_client = None
        return self.redis_client

    async def _close_redis_client(self):
        """关闭Redis连接"""
        if self.redis_client:
            await self.redis_client.close()
            self.redis_client = None

    async def _get_provider_api_config(self, provider: AIProvider) -> Dict[str, Any]:
        """
        从数据库动态获取提供商API配置

        Args:
            provider: AI提供商

        Returns:
            API配置字典
        """
        try:
            # 从Redis缓存获取配置
            redis_client = await self._get_redis_client()
            cache_key = f"ai_config_{provider.value}"

            if redis_client:
                try:
                    cached_config = await redis_client.get(cache_key)
                    if cached_config:
                        return json.loads(cached_config)
                except Exception as e:
                    logger.warning(f"从Redis读取{provider.value}配置失败: {str(e)}")

            # 从数据库获取配置
            async with get_async_session() as db:
                provider_key = provider.value

                # 获取API密钥
                api_key_setting = await crud_system_setting.get_by_key(db, f"{provider_key}_api_key")
                api_key = api_key_setting.value if api_key_setting else None

                # 获取启用状态
                enabled_setting = await crud_system_setting.get_by_key(db, f"{provider_key}_enabled")
                enabled = enabled_setting.value if enabled_setting else True

                # 特殊配置处理
                special_config = {}
                if provider == AIProvider.BAIDU:
                    # 百度需要额外的secret_key
                    secret_key_setting = await crud_system_setting.get_by_key(db, f"{provider_key}_secret_key")
                    if secret_key_setting:
                        special_config['secret_key'] = secret_key_setting.value

                elif provider == AIProvider.SPARK:
                    # 讯飞需要app_id和api_secret
                    app_id_setting = await crud_system_setting.get_by_key(db, f"{provider_key}_app_id")
                    api_secret_setting = await crud_system_setting.get_by_key(db, f"{provider_key}_api_secret")
                    if app_id_setting:
                        special_config['app_id'] = app_id_setting.value
                    if api_secret_setting:
                        special_config['api_secret'] = api_secret_setting.value

                config = {
                    'api_key': api_key,
                    'enabled': enabled,
                    **special_config
                }

                # 保存到Redis缓存
                if redis_client and api_key:
                    try:
                        await redis_client.set(
                            cache_key,
                            json.dumps(config, ensure_ascii=False),
                            ex=300  # 5分钟缓存
                        )
                    except Exception as e:
                        logger.warning(f"保存{provider.value}配置到Redis失败: {str(e)}")

                logger.info(f"从数据库获取{provider.value}配置: {'已配置' if api_key else '未配置'}")
                return config

        except Exception as e:
            logger.error(f"获取{provider.value}API配置失败: {str(e)}")
            return {'api_key': None, 'enabled': False}

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

            # 动态获取API配置
            api_config = await self._get_provider_api_config(provider)
            if not api_config or not api_config.get('api_key'):
                raise ValueError(f"提供商 {provider.value} 未配置API密钥")

            # 获取模型配置
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
                        "app_id": api_config.get('app_id'),
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

            # 发送请求 - 使用动态获取的API配置
            if provider == AIProvider.BAIDU:
                # 百度需要特殊的认证方式
                auth_string = f"{api_config.get('api_key')}:{api_config.get('secret_key')}"
                auth_bytes = auth_string.encode('ascii')
                auth_b64 = hashlib.sha1(auth_bytes).hexdigest()
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": auth_b64
                }
            elif provider == AIProvider.SPARK:
                # 讯飞星火使用认证信息
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"{api_config.get('app_id')}:{api_config.get('api_secret')}"
                }
            else:
                # 其他提供商使用标准Bearer Token
                api_key = api_config.get('api_key')
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                }
                # 调试日志：显示API密钥（脱敏）
                if provider == AIProvider.MOONSHOT:
                    masked_key = api_key[:8] + "***" if api_key and len(api_key) > 8 else "INVALID"
                    logger.info(f"月之暗面API调用 - 密钥: {masked_key}, URL: {provider_config['base_url']}/chat/completions")

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
                    "deepseek-coder": {"input": 0.014, "output": 0.028}
                },
                AIProvider.YI: {
                    "yi-large": {"input": 0.025, "output": 0.025},
                    "yi-medium": {"input": 0.0025, "output": 0.0025}
                },
                AIProvider.SPARK: {
                    "spark-3.5": {"input": 0.00021, "output": 0.00021},
                    "spark-2.0": {"input": 0.000168, "output": 0.000168},
                    "spark-lite": {"input": 0.00021, "output": 0.00021}
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

    async def get_model_config(self) -> Dict[str, Any]:
        """
        获取当前AI模型配置

        Returns:
            AI模型配置字典
        """
        try:
            redis_client = await self._get_redis_client()

            # 尝试从Redis获取配置
            if redis_client:
                try:
                    cached_config = await redis_client.get(self.config_cache_key)
                    if cached_config:
                        config_data = json.loads(cached_config)
                        return {
                            "status": "success",
                            "config": config_data,
                            "source": "redis",
                            "timestamp": datetime.utcnow().isoformat()
                        }
                except Exception as e:
                    logger.warning(f"从Redis读取配置失败: {str(e)}")

            # 从数据库获取配置
            try:
                async with get_async_session() as db:
                    system_settings = await SystemSetting.get_all(db)
                    db_config = {}

                    # 处理API密钥配置
                    api_keys = {}
                    for setting in system_settings:
                        if setting.key.endswith('_api_key'):
                            provider_name = setting.key.replace('_api_key', '')
                            if provider_name in ['zhipuai', 'moonshot', 'dashscope', 'baidu', 'deepseek', 'yi', 'spark']:
                                api_keys[provider_name] = setting.value

                    # 构建配置字典
                    for provider_name, provider_id in [
                        ('zhipuai', AIProvider.ZHIPUAI),
                        ('moonshot', AIProvider.MOONSHOT),
                        ('dashscope', AIProvider.DASHSCOPE),
                        ('baidu', AIProvider.BAIDU),
                        ('deepseek', AIProvider.DEEPSEEK),
                        ('yi', AIProvider.YI),
                        ('spark', AIProvider.SPARK)
                    ]:
                        api_key = api_keys.get(provider_name)

                        if provider_id == AIProvider.ZHIPUAI:
                            db_config['zhipuai'] = {
                                "api_key": api_key,
                                "enabled": bool(api_key),
                                "default_model": "glm-4",
                                "available_models": ["glm-4", "glm-4-0520", "glm-3-turbo"]
                            }
                        elif provider_id == AIProvider.MOONSHOT:
                            db_config['moonshot'] = {
                                "api_key": api_key,
                                "enabled": bool(api_key),
                                "default_model": "moonshot-v1-8k",
                                "available_models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]
                            }
                        elif provider_id == AIProvider.DASHSCOPE:
                            db_config['dashscope'] = {
                                "api_key": api_key,
                                "enabled": bool(api_key),
                                "default_model": "qwen-turbo",
                                "available_models": ["qwen-turbo", "qwen-plus", "qwen-max"]
                            }
                        elif provider_id == AIProvider.BAIDU:
                            db_config['baidu'] = {
                                "api_key": api_key,
                                "enabled": bool(api_key),
                                "default_model": "ERNIE-Speed-8K",
                                "available_models": ["ERNIE-Speed-8K", "ERNIE-Lite-8K", "ERNIE-4.0"]
                            }
                        elif provider_id == AIProvider.DEEPSEEK:
                            db_config['deepseek'] = {
                                "api_key": api_key,
                                "enabled": bool(api_key),
                                "default_model": "deepseek-chat",
                                "available_models": ["deepseek-chat", "deepseek-coder"]
                            }
                        elif provider_id == AIProvider.YI:
                            db_config['yi'] = {
                                "api_key": api_key,
                                "enabled": bool(api_key),
                                "default_model": "yi-34b-chat-0205",
                                "available_models": ["yi-34b-chat-0205", "yi-34b-chat-200k"]
                            }
                        elif provider_id == AIProvider.SPARK:
                            db_config['spark'] = {
                                "app_id": None,  # 需要从配置中获取
                                "api_secret": None,  # 需要从配置中获取
                                "enabled": False,
                                "default_model": "spark-3.5",
                                "available_models": ["spark-3.5", "spark-2.0", "spark-lite"]
                            }

                    logger.info(f"从数据库读取到AI配置，包含 {len(db_config)} 个提供商")

                    return {
                        "status": "success",
                        "config": db_config,
                        "source": "database",
                        "timestamp": datetime.utcnow().isoformat()
                    }

            except Exception as e:
                logger.error(f"从数据库读取配置失败: {str(e)}")

            # 从环境变量获取默认配置作为后备
            config = {
                "zhipuai": {
                    "api_key": settings.ZHIPUAI_API_KEY,
                    "enabled": bool(settings.ZHIPUAI_API_KEY),
                    "default_model": "glm-4",
                    "available_models": ["glm-4", "glm-4-0520", "glm-3-turbo"]
                },
                "moonshot": {
                    "api_key": settings.MOONSHOT_API_KEY,
                    "enabled": bool(settings.MOONSHOT_API_KEY),
                    "default_model": "moonshot-v1-8k",
                    "available_models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]
                },
                "dashscope": {
                    "api_key": settings.DASHSCOPE_API_KEY,
                    "enabled": bool(settings.DASHSCOPE_API_KEY),
                    "default_model": "qwen-turbo",
                    "available_models": ["qwen-turbo", "qwen-plus", "qwen-max"]
                },
                "baidu": {
                    "api_key": settings.BAIDU_API_KEY,
                    "secret_key": settings.BAIDU_SECRET_KEY,
                    "enabled": bool(settings.BAIDU_API_KEY and settings.BAIDU_SECRET_KEY),
                    "default_model": "ERNIE-Speed-8K",
                    "available_models": ["ERNIE-Speed-8K", "ERNIE-Lite-8K", "ERNIE-Turbo-8K"]
                },
                "deepseek": {
                    "api_key": settings.DEEPSEEK_API_KEY,
                    "enabled": bool(settings.DEEPSEEK_API_KEY),
                    "default_model": "deepseek-chat",
                    "available_models": ["deepseek-chat", "deepseek-coder"]
                },
                "yi": {
                    "api_key": settings.YI_API_KEY,
                    "enabled": bool(settings.YI_API_KEY),
                    "default_model": "yi-large",
                    "available_models": ["yi-large", "yi-medium", "yi-chat"]
                },
                "spark": {
                    "app_id": settings.SPARK_APP_ID,
                    "api_secret": settings.SPARK_API_SECRET,
                    "enabled": bool(settings.SPARK_APP_ID and settings.SPARK_API_SECRET),
                    "default_model": "spark-3.5",
                    "available_models": ["spark-3.5", "spark-2.0", "spark-lite"]
                }
            }

            return {
                "status": "success",
                "config": config,
                "source": "environment",
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"获取AI模型配置失败: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    async def update_model_config(self, config_update: Dict[str, Any]) -> Dict[str, Any]:
        """
        更新AI模型配置

        Args:
            config_update: 配置更新数据

        Returns:
            更新结果
        """
        try:
            redis_client = await self._get_redis_client()
            updated_fields = []

            # 获取当前配置
            current_config_result = await self.get_model_config()
            current_config = current_config_result.get("config", {})

            # 更新配置
            for provider, config in config_update.items():
                if provider in current_config:
                    # 更新指定提供商的配置
                    for key, value in config.items():
                        if value is not None:  # 更新非空值，允许空字符串清空配置
                            current_config[provider][key] = value
                            updated_fields.append(f"{provider}.{key}")

            # 保存到Redis并清除相关缓存
            if redis_client and updated_fields:
                try:
                    # 清除所有相关的提供商缓存
                    await self._clear_provider_cache(config_update.keys(), redis_client)

                    # 保存到Redis主缓存
                    await redis_client.set(
                        self.config_cache_key,
                        json.dumps(current_config, ensure_ascii=False),
                        ex=settings.REDIS_CACHE_TTL
                    )
                    logger.info(f"AI模型配置已保存到Redis: {', '.join(updated_fields)}")

                    # 更新运行时配置（支持所有提供商）
                    await self._update_runtime_config(current_config, updated_fields)

                    return {
                        "status": "success",
                        "message": "配置更新成功",
                        "updated_fields": updated_fields,
                        "storage": "redis",
                        "timestamp": datetime.utcnow().isoformat()
                    }

                except Exception as e:
                    logger.error(f"保存配置到Redis失败: {str(e)}")
                    return {
                        "status": "error",
                        "message": "配置保存失败",
                        "error": str(e),
                        "timestamp": datetime.utcnow().isoformat()
                    }
            else:
                return {
                    "status": "warning",
                    "message": "没有需要更新的配置",
                    "updated_fields": [],
                    "timestamp": datetime.utcnow().isoformat()
                }

        except Exception as e:
            logger.error(f"更新AI模型配置失败: {str(e)}")
            return {
                "status": "error",
                "message": "配置更新失败",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    async def _clear_provider_cache(self, providers: List[str], redis_client):
        """
        清除指定提供商的缓存

        Args:
            providers: 提供商列表
            redis_client: Redis客户端
        """
        try:
            # 清除各提供商的单独缓存
            for provider in providers:
                cache_key = f"ai_config_{provider}"
                await redis_client.delete(cache_key)
                logger.info(f"已清除{provider}提供商的缓存")

            # 同时清除主配置缓存，确保下次读取时从数据库获取最新数据
            await redis_client.delete(self.config_cache_key)
            logger.info("已清除主配置缓存")

        except Exception as e:
            logger.warning(f"清除缓存时出现错误: {str(e)}")

    async def _update_runtime_config(self, current_config: Dict[str, Any], updated_fields: List[str]):
        """
        更新运行时配置

        Args:
            current_config: 当前配置
            updated_fields: 已更新的字段列表
        """
        try:
            # 更新智谱AI配置
            if any("zhipuai.api_key" in field for field in updated_fields):
                new_api_key = current_config.get("zhipuai", {}).get("api_key")
                if new_api_key and AIProvider.ZHIPUAI in self.providers:
                    self.providers[AIProvider.ZHIPUAI]["headers"]["Authorization"] = f"Bearer {new_api_key}"
                    logger.info("智谱AI配置已更新到运行时")

            # 更新月之暗面配置
            if any("moonshot.api_key" in field for field in updated_fields):
                new_api_key = current_config.get("moonshot", {}).get("api_key")
                if new_api_key and AIProvider.MOONSHOT in self.providers:
                    self.providers[AIProvider.MOONSHOT]["headers"]["Authorization"] = f"Bearer {new_api_key}"
                    logger.info("月之暗面配置已更新到运行时")

            # 更新阿里通义千问配置
            if any("dashscope.api_key" in field for field in updated_fields):
                new_api_key = current_config.get("dashscope", {}).get("api_key")
                if new_api_key and AIProvider.DASHSCOPE in self.providers:
                    self.providers[AIProvider.DASHSCOPE]["headers"]["Authorization"] = f"Bearer {new_api_key}"
                    logger.info("阿里通义千问配置已更新到运行时")

            # 更新百度文心配置
            if any("baidu.api_key" in field for field in updated_fields):
                new_api_key = current_config.get("baidu", {}).get("api_key")
                new_secret_key = current_config.get("baidu", {}).get("secret_key")
                if new_api_key and new_secret_key and AIProvider.BAIDU in self.providers:
                    self.providers[AIProvider.BAIDU]["api_key"] = new_api_key
                    self.providers[AIProvider.BAIDU]["secret_key"] = new_secret_key
                    logger.info("百度文心配置已更新到运行时")

            # 更新深度求索配置
            if any("deepseek.api_key" in field for field in updated_fields):
                new_api_key = current_config.get("deepseek", {}).get("api_key")
                if new_api_key and AIProvider.DEEPSEEK in self.providers:
                    self.providers[AIProvider.DEEPSEEK]["headers"]["Authorization"] = f"Bearer {new_api_key}"
                    logger.info("深度求索配置已更新到运行时")

            # 更新零一万物配置
            if any("yi.api_key" in field for field in updated_fields):
                new_api_key = current_config.get("yi", {}).get("api_key")
                if new_api_key and AIProvider.YI in self.providers:
                    self.providers[AIProvider.YI]["headers"]["Authorization"] = f"Bearer {new_api_key}"
                    logger.info("零一万物配置已更新到运行时")

            # 更新科大讯飞星火配置
            if any("spark" in field for field in updated_fields):
                new_app_id = current_config.get("spark", {}).get("app_id")
                new_api_secret = current_config.get("spark", {}).get("api_secret")
                if new_app_id and new_api_secret and AIProvider.SPARK in self.providers:
                    self.providers[AIProvider.SPARK]["headers"]["Authorization"] = f"{new_app_id}:{new_api_secret}"
                    logger.info("科大讯飞星火配置已更新到运行时")

        except Exception as e:
            logger.error(f"更新运行时配置失败: {str(e)}")

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        await self._close_session()
        await self._close_redis_client()


# 全局AI模型服务实例
ai_model_service = AIModelService()