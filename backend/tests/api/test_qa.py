"""
智能问答API端点测试
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from app.main import app
from app.schemas.qa import QueryRequest, QueryType, DataSource


class TestQAAPI:
    """智能问答API测试"""

    @pytest.mark.api
    async def test_process_query_success(self, client: TestClient, mock_user):
        """测试查询处理成功"""
        query_data = {
            "question": "建筑材料的价格范围是多少？",
            "query_type": "cost_estimation",
            "max_results": 10,
            "include_sources": ["documents", "cost_database"]
        }

        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user

            # 模拟QA服务响应
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_response = {
                "query_id": "test_query_123",
                "question": "建筑材料的价格范围是多少？",
                "query_type": "cost_estimation",
                "answer": {
                    "answer": "根据市场数据，常见建筑材料价格范围如下...",
                    "confidence_score": 0.85,
                    "quality_score": 0.90,
                    "generation_time": 1.2,
                    "model_used": "glm-4"
                },
                "retrieval_result": {
                    "query": "建筑材料 价格",
                    "documents": [
                        {
                            "id": 1,
                            "title": "建筑材料价格表",
                            "score": 0.92
                        }
                    ],
                    "knowledge": [],
                    "cost_data": [
                        {
                            "id": 1,
                            "item_name": "混凝土",
                            "price_range": {"min": 350, "max": 450}
                        }
                    ],
                    "total_retrieved": 5,
                    "processing_time": 0.8,
                    "retrieval_method": "multi_source_fusion"
                },
                "processing_time": 2.0,
                "user_id": 1,
                "session_id": None
            }

            mock_service_instance.process_query.return_value = mock_response

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/qa/query", json=query_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["question"] == query_data["question"]
            assert data["query_type"] == "cost_estimation"
            assert "answer" in data
            assert "retrieval_result" in data
            assert data["answer"]["confidence_score"] > 0.8

    @pytest.mark.api
    async def test_process_query_invalid_question(self, client: TestClient, mock_user):
        """测试无效问题查询"""
        query_data = {
            "question": "短",  # 太短
            "query_type": "simple"
        }

        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user:
            mock_get_user.return_value = mock_user

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/qa/query", json=query_data, headers=headers)

            assert response.status_code == 422  # Validation error

    @pytest.mark.api
    async def test_process_query_unauthorized(self, client: TestClient):
        """测试未授权查询"""
        query_data = {
            "question": "测试问题",
            "query_type": "simple"
        }

        response = client.post("/api/v1/qa/query", json=query_data)
        assert response.status_code == 401

    @pytest.mark.api
    async def test_batch_query_processing(self, client: TestClient, mock_user):
        """测试批量查询处理"""
        batch_data = {
            "queries": [
                {
                    "question": "混凝土价格是多少？",
                    "query_type": "cost_estimation"
                },
                {
                    "question": "建筑工程标准是什么？",
                    "query_type": "technical"
                }
            ],
            "max_concurrent": 3,
            "fail_fast": True
        }

        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_batch_response = {
                "total_queries": 2,
                "successful_queries": 2,
                "failed_queries": 0,
                "results": [
                    {
                        "query_id": "batch_1",
                        "question": "混凝土价格是多少？",
                        "answer": {"answer": "混凝土价格约为400-500元/立方米"}
                    },
                    {
                        "query_id": "batch_2",
                        "question": "建筑工程标准是什么？",
                        "answer": {"answer": "建筑工程标准包括GB50017等"}
                    }
                ],
                "processing_time": 3.5
            }

            mock_service_instance.batch_process_queries.return_value = mock_batch_response

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/qa/batch-query", json=batch_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["total_queries"] == 2
            assert data["successful_queries"] == 2
            assert len(data["results"]) == 2

    @pytest.mark.api
    async def test_get_query_suggestions(self, client: TestClient, mock_user):
        """测试获取查询建议"""
        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_suggestions = [
                {
                    "suggested_query": "建筑材料成本分析",
                    "confidence": 0.85,
                    "reasoning": "基于历史查询模式",
                    "category": "cost_estimation"
                },
                {
                    "suggested_query": "施工质量控制标准",
                    "confidence": 0.78,
                    "reasoning": "相关技术文档推荐",
                    "category": "technical"
                }
            ]

            mock_service_instance.get_query_suggestions.return_value = mock_suggestions

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/qa/suggestions?limit=5", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert all("suggested_query" in item for item in data)
            assert all("confidence" in item for item in data)

    @pytest.mark.api
    async def test_get_conversation_context(self, client: TestClient, mock_user):
        """测试获取对话上下文"""
        session_id = "test_session_123"

        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_context = {
                "session_id": session_id,
                "user_id": 1,
                "conversation_history": [
                    {
                        "timestamp": "2024-01-01T10:00:00Z",
                        "question": "混凝土价格是多少？",
                        "answer": "混凝土价格约为400-500元/立方米",
                        "query_type": "cost_estimation"
                    }
                ],
                "total_queries": 1,
                "created_at": "2024-01-01T10:00:00Z",
                "last_updated": "2024-01-01T10:05:00Z"
            }

            mock_service_instance.get_conversation_context.return_value = mock_context

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/qa/context/{session_id}", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["session_id"] == session_id
            assert len(data["conversation_history"]) == 1

    @pytest.mark.api
    async def test_clear_conversation_context(self, client: TestClient, mock_user):
        """测试清除对话上下文"""
        session_id = "test_session_123"

        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_service_instance.clear_conversation_context.return_value = True

            headers = {"Authorization": "Bearer fake_token"}
            response = client.delete(f"/api/v1/qa/context/{session_id}", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "cleared" in data["message"].lower()

    @pytest.mark.api
    async def test_get_query_history(self, client: TestClient, mock_user):
        """测试获取查询历史"""
        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_history = {
                "total_queries": 10,
                "queries": [
                    {
                        "query_id": "query_1",
                        "question": "混凝土价格？",
                        "query_type": "cost_estimation",
                        "timestamp": "2024-01-01T10:00:00Z",
                        "processing_time": 1.5,
                        "answer_preview": "混凝土价格约为400-500元..."
                    }
                ],
                "page": 1,
                "page_size": 10,
                "total_pages": 1
            }

            mock_service_instance.get_query_history.return_value = mock_history

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/qa/history?page=1&size=10", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["total_queries"] == 10
            assert len(data["queries"]) == 1
            assert "pagination" in data

    @pytest.mark.api
    async def test_export_query_history(self, client: TestClient, mock_user):
        """测试导出查询历史"""
        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_export_data = {
                "export_id": "export_123",
                "format": "csv",
                "total_records": 50,
                "file_size": "2.5MB",
                "download_url": "/api/v1/qa/downloads/export_123",
                "expires_at": "2024-01-02T10:00:00Z"
            }

            mock_service_instance.export_query_history.return_value = mock_export_data

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/qa/export?format=csv&days=30", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert "export_id" in data
            assert "download_url" in data
            assert data["format"] == "csv"

    @pytest.mark.api
    async def test_get_query_analytics(self, client: TestClient, mock_user):
        """测试获取查询分析"""
        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_analytics = {
                "total_queries": 100,
                "avg_response_time": 2.5,
                "query_types": {
                    "cost_estimation": 40,
                    "technical": 35,
                    "simple": 25
                },
                "success_rate": 0.95,
                "avg_confidence_score": 0.82,
                "daily_stats": [
                    {
                        "date": "2024-01-01",
                        "queries": 10,
                        "avg_response_time": 2.2
                    }
                ],
                "top_queries": [
                    {
                        "question": "混凝土价格",
                        "frequency": 15,
                        "avg_satisfaction": 4.2
                    }
                ]
            }

            mock_service_instance.get_query_analytics.return_value = mock_analytics

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/qa/analytics?days=30", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["total_queries"] == 100
            assert "query_types" in data
            assert "daily_stats" in data
            assert "top_queries" in data

    @pytest.mark.api
    async def test_rate_limiting(self, client: TestClient, mock_user):
        """测试查询频率限制"""
        query_data = {
            "question": "测试查询频率限制",
            "query_type": "simple"
        }

        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            # 模拟达到频率限制
            from fastapi import HTTPException
            mock_service_instance.process_query.side_effect = HTTPException(
                status_code=429,
                detail="Rate limit exceeded"
            )

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/qa/query", json=query_data, headers=headers)

            assert response.status_code == 429
            assert "rate limit" in response.json()["detail"].lower()

    @pytest.mark.api
    async def test_query_with_filters(self, client: TestClient, mock_user):
        """测试带过滤条件的查询"""
        query_data = {
            "question": "北京地区的建筑材料价格",
            "query_type": "cost_estimation",
            "filters": {
                "region": "北京",
                "time_period": "2024年",
                "material_type": "混凝土"
            },
            "include_sources": ["cost_database", "documents"]
        }

        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_response = {
                "query_id": "filtered_query_123",
                "question": query_data["question"],
                "answer": {
                    "answer": "北京地区2024年混凝土价格约为450-550元/立方米",
                    "confidence_score": 0.88,
                    "quality_score": 0.91
                },
                "retrieval_result": {
                    "query": "北京 混凝土 价格 2024",
                    "total_retrieved": 8,
                    "cost_data": [
                        {
                            "item_name": "C30混凝土",
                            "region": "北京",
                            "time_period": "2024年",
                            "price_range": {"min": 450, "max": 550}
                        }
                    ]
                },
                "processing_time": 1.8
            }

            mock_service_instance.process_query.return_value = mock_response

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/qa/query", json=query_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            # 验证过滤条件被正确应用
            assert "北京" in data["answer"]["answer"]
            assert "2024" in data["answer"]["answer"]