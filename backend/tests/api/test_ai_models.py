"""
AI模型API端点测试
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from app.main import app
from app.schemas.ai_model import AIProvider


class TestAIModelsAPI:
    """AI模型API测试"""

    @pytest.mark.api
    async def test_get_supported_providers(self, client: TestClient, mock_user):
        """测试获取支持的AI提供商"""
        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            mock_providers = ["zhipuai", "moonshot", "dashscope", "baidu", "deepseek", "yi", "spark"]

            mock_service_instance.get_supported_providers.return_value = mock_providers

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/ai-models/providers", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 7
            assert "zhipuai" in data
            assert "moonshot" in data

    @pytest.mark.api
    async def test_get_provider_models(self, client: TestClient, mock_user):
        """测试获取提供商模型列表"""
        provider = "zhipuai"

        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            mock_models = [
                {
                    "name": "glm-4",
                    "type": "chat",
                    "description": "智谱AI GLM-4大语言模型",
                    "max_tokens": 8000,
                    "context_length": 8000,
                    "pricing": {"input": 0.1, "output": 0.1}
                },
                {
                    "name": "glm-3-turbo",
                    "type": "chat",
                    "description": "智谱AI GLM-3 Turbo模型",
                    "max_tokens": 4000,
                    "context_length": 4000,
                    "pricing": {"input": 0.05, "output": 0.05}
                }
            ]

            mock_service_instance.get_available_models.return_value = mock_models

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/ai-models/providers/{provider}/models", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["name"] == "glm-4"

    @pytest.mark.api
    async def test_chat_completion(self, client: TestClient, mock_user):
        """测试聊天完成"""
        chat_data = {
            "provider": AIProvider.ZHIPUAI,
            "model": "glm-4",
            "messages": [
                {"role": "user", "content": "你好，请介绍一下建筑材料"}
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }

        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            mock_response = {
                "content": "您好！建筑材料是建筑工程中使用的各种材料的总称...",
                "model": "glm-4",
                "provider": "zhipuai",
                "usage": {
                    "input_tokens": 15,
                    "output_tokens": 150,
                    "total_tokens": 165
                },
                "response_time": 1.2,
                "request_id": "chat_req_123"
            }

            mock_service_instance.chat_completion.return_value = mock_response

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/ai-models/chat", json=chat_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert "content" in data
            assert data["model"] == "glm-4"
            assert data["provider"] == "zhipuai"
            assert data["usage"]["total_tokens"] == 165

    @pytest.mark.api
    async def test_create_embeddings(self, client: TestClient, mock_user):
        """测试创建向量嵌入"""
        embedding_data = {
            "provider": AIProvider.ZHIPUAI,
            "model": "embedding-2",
            "text": "这是一段用于向量化的测试文本"
        }

        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            mock_response = {
                "embedding": [0.1] * 384,  # 384维向量
                "model": "embedding-2",
                "provider": "zhipuai",
                "usage": {
                    "input_tokens": 8,
                    "total_tokens": 8
                },
                "dimensions": 384,
                "processing_time": 0.5
            }

            mock_service_instance.create_embeddings.return_value = mock_response

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/ai-models/embeddings", json=embedding_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data["embedding"]) == 384
            assert data["dimensions"] == 384
            assert data["model"] == "embedding-2"

    @pytest.mark.api
    async def test_batch_embeddings(self, client: TestClient, mock_user):
        """测试批量向量嵌入"""
        batch_data = {
            "provider": AIProvider.ZHIPUAI,
            "model": "embedding-2",
            "texts": [
                "第一段测试文本",
                "第二段测试文本",
                "第三段测试文本"
            ]
        }

        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            mock_response = {
                "embeddings": [
                    [0.1] * 384,  # 第一个向量
                    [0.2] * 384,  # 第二个向量
                    [0.3] * 384   # 第三个向量
                ],
                "model": "embedding-2",
                "provider": "zhipuai",
                "usage": {
                    "input_tokens": 24,
                    "total_tokens": 24
                },
                "dimensions": 384,
                "total_processed": 3,
                "processing_time": 1.2
            }

            mock_service_instance.create_batch_embeddings.return_value = mock_response

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/ai-models/embeddings/batch", json=batch_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data["embeddings"]) == 3
            assert data["total_processed"] == 3

    @pytest.mark.api
    async def test_provider_status_check(self, client: TestClient, mock_user):
        """测试提供商状态检查"""
        provider = "zhipuai"

        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            mock_status = {
                "provider": provider,
                "status": "success",
                "model": "glm-4",
                "response_time": "1.2s",
                "test_response": "服务正常",
                "last_checked": "2024-01-01T10:00:00Z",
                "success_rate": 0.98
            }

            mock_service_instance.check_provider_status.return_value = mock_status

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/ai-models/providers/{provider}/status", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["provider"] == provider
            assert data["status"] == "success"
            assert float(data["success_rate"]) > 0.9

    @pytest.mark.api
    async def test_get_usage_statistics(self, client: TestClient, mock_user):
        """测试获取使用统计"""
        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            mock_stats = {
                "total_requests": 1000,
                "total_tokens": 50000,
                "total_cost": 125.50,
                "currency": "CNY",
                "by_provider": {
                    "zhipuai": {"requests": 600, "tokens": 30000, "cost": 75.30},
                    "moonshot": {"requests": 400, "tokens": 20000, "cost": 50.20}
                },
                "by_model": {
                    "glm-4": {"requests": 500, "tokens": 25000, "cost": 62.65},
                    "glm-3-turbo": {"requests": 100, "tokens": 5000, "cost": 12.65}
                },
                "daily_usage": [
                    {
                        "date": "2024-01-01",
                        "requests": 100,
                        "tokens": 5000,
                        "cost": 12.55
                    }
                ],
                "period": "30 days"
            }

            mock_service_instance.get_usage_statistics.return_value = mock_stats

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/ai-models/usage?days=30", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["total_requests"] == 1000
            assert "by_provider" in data
            assert "daily_usage" in data

    @pytest.mark.api
    async def test_stream_chat(self, client: TestClient, mock_user):
        """测试流式聊天"""
        chat_data = {
            "provider": AIProvider.ZHIPUAI,
            "model": "glm-4",
            "messages": [
                {"role": "user", "content": "请详细解释混凝土的组成"}
            ],
            "stream": True,
            "temperature": 0.7
        }

        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            # 模拟流式响应
            async def mock_stream():
                chunks = [
                    "混凝土是",
                    "建筑工程中",
                    "最常用的",
                    "建筑材料之一"
                ]
                for chunk in chunks:
                    yield {
                        "content": chunk,
                        "finished": False,
                        "request_id": "stream_123"
                    }
                yield {
                    "content": "",
                    "finished": True,
                    "request_id": "stream_123",
                    "usage": {"input_tokens": 12, "output_tokens": 15, "total_tokens": 27}
                }

            mock_service_instance.stream_chat_completion.return_value = mock_stream()

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/ai-models/chat/stream", json=chat_data, headers=headers)

            assert response.status_code == 200
            # 流式响应应该返回正确的content-type
            assert "text/plain" in response.headers.get("content-type", "")

    @pytest.mark.api
    async def test_model_comparison(self, client: TestClient, mock_user):
        """测试模型对比"""
        comparison_data = {
            "providers": [AIProvider.ZHIPUAI, AIProvider.MOONSHOT],
            "models": ["glm-4", "moonshot-v1-8k"],
            "prompt": "请解释什么是人工智能",
            "metrics": ["response_time", "cost", "quality_score"]
        }

        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            mock_comparison = {
                "prompt": comparison_data["prompt"],
                "results": [
                    {
                        "provider": "zhipuai",
                        "model": "glm-4",
                        "response": "人工智能是指由人制造出来的机器所表现出来的智能...",
                        "response_time": 1.2,
                        "cost": 0.05,
                        "quality_score": 0.85,
                        "tokens": {"input": 15, "output": 120, "total": 135}
                    },
                    {
                        "provider": "moonshot",
                        "model": "moonshot-v1-8k",
                        "response": "人工智能（AI）是计算机科学的一个分支...",
                        "response_time": 0.9,
                        "cost": 0.04,
                        "quality_score": 0.88,
                        "tokens": {"input": 15, "output": 125, "total": 140}
                    }
                ],
                "winner": "moonshot-v1-8k",
                "comparison_time": 2.5
            }

            mock_service_instance.compare_models.return_value = mock_comparison

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/ai-models/compare", json=comparison_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data["results"]) == 2
            assert "winner" in data

    @pytest.mark.api
    async def test_invalid_provider(self, client: TestClient, mock_user):
        """测试无效提供商"""
        provider = "invalid_provider"

        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            mock_service_instance.get_available_models.return_value = []

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/ai-models/providers/{provider}/models", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 0

    @pytest.mark.api
    async def test_rate_limiting(self, client: TestClient, mock_user):
        """测试频率限制"""
        chat_data = {
            "provider": AIProvider.ZHIPUAI,
            "model": "glm-4",
            "messages": [{"role": "user", "content": "测试"}]
        }

        with patch('app.api.v1.endpoints.ai_models.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.ai_models.AIModelService') as mock_ai_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_ai_service.return_value = mock_service_instance

            # 模拟频率限制异常
            from fastapi import HTTPException
            mock_service_instance.chat_completion.side_effect = HTTPException(
                status_code=429,
                detail="Rate limit exceeded for provider zhipuai"
            )

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/ai-models/chat", json=chat_data, headers=headers)

            assert response.status_code == 429
            assert "rate limit" in response.json()["detail"].lower()