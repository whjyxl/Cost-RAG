"""
集成测试 - 完整工作流程测试
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.user import User
from app.models.document import Document
from app.models.project import Project
from app.models.cost_estimate import CostEstimate


class TestUserRegistrationWorkflow:
    """用户注册工作流程测试"""

    @pytest.mark.integration
    async def test_complete_user_registration_flow(self, client: TestClient, db_session: AsyncSession):
        """测试完整的用户注册流程"""
        registration_data = {
            "username": "integration_user",
            "email": "integration@example.com",
            "password": "StrongPassword123!",
            "full_name": "集成测试用户"
        }

        # 1. 用户注册
        response = client.post("/api/v1/auth/register", json=registration_data)
        assert response.status_code == 201
        user_data = response.json()
        user_id = user_data["id"]

        # 2. 验证用户在数据库中
        user = await db_session.get(User, user_id)
        assert user is not None
        assert user.username == "integration_user"
        assert user.email == "integration@example.com"

        # 3. 用户登录
        login_data = {
            "username": "integration_user",
            "password": "StrongPassword123!"
        }
        response = client.post("/api/v1/auth/login", data=login_data)
        assert response.status_code == 200
        token_data = response.json()
        access_token = token_data["access_token"]

        # 4. 获取用户信息
        headers = {"Authorization": f"Bearer {access_token}"}
        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
        me_data = response.json()
        assert me_data["username"] == "integration_user"
        assert me_data["email"] == "integration@example.com"

        # 5. 修改密码
        password_change_data = {
            "current_password": "StrongPassword123!",
            "new_password": "NewStrongPassword456!"
        }
        response = client.put("/api/v1/auth/change-password",
                             headers=headers, json=password_change_data)
        assert response.status_code == 200

        # 6. 使用新密码登录
        new_login_data = {
            "username": "integration_user",
            "password": "NewStrongPassword456!"
        }
        response = client.post("/api/v1/auth/login", data=new_login_data)
        assert response.status_code == 200

        # 7. 登出
        response = client.post("/api/v1/auth/logout", headers=headers)
        assert response.status_code == 200


class TestDocumentProcessingWorkflow:
    """文档处理工作流程测试"""

    @pytest.mark.integration
    async def test_complete_document_workflow(self, client: TestClient, db_session: AsyncSession, mock_user):
        """测试完整的文档处理流程"""
        # 创建测试用户和项目
        project = Project(
            name="测试项目",
            description="集成测试项目",
            user_id=mock_user.id
        )
        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)

        # 1. 上传文档
        file_content = b"Test PDF content for integration testing"
        file_data = io.BytesIO(file_content)
        file_data.name = "integration_test.pdf"

        files = {"file": ("integration_test.pdf", file_data, "application/pdf")}
        data = {
            "title": "集成测试文档",
            "description": "用于集成测试的文档",
            "project_id": project.id
        }

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.services.document_service.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_service_instance.process_document_upload.return_value = {
                "id": 1,
                "title": "集成测试文档",
                "file_type": "pdf",
                "status": "processing",
                "user_id": mock_user.id,
                "project_id": project.id
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/documents/upload",
                                 files=files, data=data, headers=headers)
            assert response.status_code == 201
            upload_data = response.json()
            document_id = upload_data["id"]

        # 2. 检查处理状态
        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_service_instance.get_document_by_id.return_value = {
                "id": document_id,
                "title": "集成测试文档",
                "status": "completed",
                "processing_progress": 100,
                "chunks_count": 5
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/documents/{document_id}", headers=headers)
            assert response.status_code == 200
            doc_data = response.json()
            assert doc_data["status"] == "completed"

        # 3. 搜索文档内容
        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_service_instance.search_documents.return_value = {
                "query": "Test PDF",
                "results": [
                    {
                        "id": document_id,
                        "title": "集成测试文档",
                        "score": 0.95,
                        "content_snippet": "Test PDF content for integration testing"
                    }
                ],
                "total_found": 1
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/documents/search?q=Test%20PDF", headers=headers)
            assert response.status_code == 200
            search_data = response.json()
            assert len(search_data["results"]) == 1
            assert search_data["results"][0]["id"] == document_id

        # 4. 更新文档元数据
        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            update_data = {
                "title": "更新后的集成测试文档",
                "description": "已更新的描述",
                "tags": ["测试", "集成"]
            }

            mock_service_instance.update_document.return_value = {
                "id": document_id,
                **update_data
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.put(f"/api/v1/documents/{document_id}/metadata",
                                json=update_data, headers=headers)
            assert response.status_code == 200
            updated_data = response.json()
            assert updated_data["title"] == "更新后的集成测试文档"


class TestQAWorkflow:
    """智能问答工作流程测试"""

    @pytest.mark.integration
    async def test_complete_qa_workflow(self, client: TestClient, mock_user):
        """测试完整的智能问答流程"""
        # 1. 发送查询
        query_data = {
            "question": "混凝土的成本是多少？",
            "query_type": "cost_estimation",
            "max_results": 10
        }

        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_response = {
                "query_id": "qa_test_123",
                "question": query_data["question"],
                "query_type": "cost_estimation",
                "answer": {
                    "answer": "根据当前市场数据，C30混凝土的价格约为400-500元/立方米",
                    "confidence_score": 0.88,
                    "quality_score": 0.91,
                    "model_used": "glm-4"
                },
                "retrieval_result": {
                    "query": "混凝土 成本",
                    "documents": [
                        {
                            "id": 1,
                            "title": "建筑材料价格表",
                            "score": 0.92
                        }
                    ],
                    "cost_data": [
                        {
                            "item_name": "C30混凝土",
                            "price_range": {"min": 400, "max": 500}
                        }
                    ],
                    "total_retrieved": 8
                },
                "processing_time": 2.1
            }

            mock_service_instance.process_query.return_value = mock_response

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/qa/query", json=query_data, headers=headers)
            assert response.status_code == 200
            qa_response = response.json()
            assert qa_response["question"] == query_data["question"]
            assert qa_response["answer"]["confidence_score"] > 0.8

        # 2. 获取查询历史
        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_history = {
                "total_queries": 1,
                "queries": [
                    {
                        "query_id": "qa_test_123",
                        "question": query_data["question"],
                        "query_type": "cost_estimation",
                        "timestamp": "2024-01-01T10:00:00Z",
                        "answer_preview": "根据当前市场数据..."
                    }
                ],
                "page": 1,
                "page_size": 10
            }

            mock_service_instance.get_query_history.return_value = mock_history

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/qa/history", headers=headers)
            assert response.status_code == 200
            history_data = response.json()
            assert len(history_data["queries"]) == 1

        # 3. 获取查询建议
        with patch('app.api.v1.endpoints.qa.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.qa.QAService') as mock_qa_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_qa_service.return_value = mock_service_instance

            mock_suggestions = [
                {
                    "suggested_query": "钢筋价格分析",
                    "confidence": 0.82,
                    "reasoning": "基于成本估算查询模式"
                }
            ]

            mock_service_instance.get_query_suggestions.return_value = mock_suggestions

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/qa/suggestions?limit=5", headers=headers)
            assert response.status_code == 200
            suggestions = response.json()
            assert len(suggestions) == 1
            assert "钢筋价格分析" in suggestions[0]["suggested_query"]

        # 4. 批量查询处理
        batch_data = {
            "queries": [
                {
                    "question": "水泥价格是多少？",
                    "query_type": "cost_estimation"
                },
                {
                    "question": "施工安全标准是什么？",
                    "query_type": "technical"
                }
            ],
            "max_concurrent": 2
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
                        "question": "水泥价格是多少？",
                        "answer": {"answer": "水泥价格约为400-600元/吨"}
                    },
                    {
                        "query_id": "batch_2",
                        "question": "施工安全标准是什么？",
                        "answer": {"answer": "施工安全标准包括GB50870等"}
                    }
                ]
            }

            mock_service_instance.batch_process_queries.return_value = mock_batch_response

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/qa/batch-query", json=batch_data, headers=headers)
            assert response.status_code == 200
            batch_result = response.json()
            assert batch_result["successful_queries"] == 2


class TestCostEstimationWorkflow:
    """成本估算工作流程测试"""

    @pytest.mark.integration
    async def test_complete_cost_estimation_workflow(self, client: TestClient, db_session: AsyncSession, mock_user):
        """测试完整的成本估算流程"""
        # 创建测试项目
        project = Project(
            name="建筑工程项目",
            description="测试成本估算项目",
            user_id=mock_user.id
        )
        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)

        # 1. 创建成本估算项
        estimation_data = {
            "project_id": project.id,
            "item_name": "C30混凝土结构",
            "category": "材料",
            "unit": "m³",
            "estimated_quantity": 100.0,
            "estimated_cost": 45000.0,
            "currency": "CNY",
            "region": "北京",
            "time_period": "2024年Q1"
        }

        with patch('app.api.v1.endpoints.cost_estimates.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.cost_estimates.CostEstimationService') as mock_cost_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_cost_service.return_value = mock_service_instance

            mock_estimation = {
                "id": 1,
                **estimation_data,
                "status": "draft",
                "created_at": "2024-01-01T10:00:00Z"
            }

            mock_service_instance.create_cost_estimate.return_value = mock_estimation

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/cost-estimates", json=estimation_data, headers=headers)
            assert response.status_code == 201
            created_estimation = response.json()
            estimation_id = created_estimation["id"]

        # 2. 获取成本估算详情
        with patch('app.api.v1.endpoints.cost_estimates.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.cost_estimates.CostEstimationService') as mock_cost_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_cost_service.return_value = mock_service_instance

            mock_service_instance.get_cost_estimate_by_id.return_value = {
                **mock_estimation,
                "id": estimation_id,
                "analysis": {
                    "market_comparison": "当前价格低于市场平均水平5%",
                    "risk_factors": ["原材料价格波动"],
                    "recommendations": ["建议签订长期供应合同"]
                }
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/cost-estimates/{estimation_id}", headers=headers)
            assert response.status_code == 200
            estimation_detail = response.json()
            assert "analysis" in estimation_detail

        # 3. 更新成本估算
        update_data = {
            "estimated_quantity": 120.0,
            "estimated_cost": 54000.0,
            "status": "approved"
        }

        with patch('app.api.v1.endpoints.cost_estimates.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.cost_estimates.CostEstimationService') as mock_cost_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_cost_service.return_value = mock_service_instance

            mock_service_instance.update_cost_estimate.return_value = {
                **mock_estimation,
                **update_data
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.put(f"/api/v1/cost-estimates/{estimation_id}",
                                json=update_data, headers=headers)
            assert response.status_code == 200
            updated_estimation = response.json()
            assert updated_estimation["estimated_quantity"] == 120.0

        # 4. 获取项目成本汇总
        with patch('app.api.v1.endpoints.cost_estimates.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.cost_estimates.CostEstimationService') as mock_cost_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_cost_service.return_value = mock_service_instance

            mock_summary = {
                "project_id": project.id,
                "total_estimated_cost": 54000.0,
                "total_items": 1,
                "cost_by_category": {
                    "材料": 54000.0
                },
                "cost_by_status": {
                    "approved": 54000.0
                }
            }

            mock_service_instance.get_project_cost_summary.return_value = mock_summary

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/cost-estimates/project/{project.id}/summary", headers=headers)
            assert response.status_code == 200
            summary = response.json()
            assert summary["total_estimated_cost"] == 54000.0


class TestKnowledgeGraphWorkflow:
    """知识图谱工作流程测试"""

    @pytest.mark.integration
    async def test_complete_knowledge_graph_workflow(self, client: TestClient, mock_user):
        """测试完整的知识图谱流程"""
        # 1. 提取实体和关系
        extraction_data = {
            "text": "混凝土是建筑工程中常用的材料，主要由水泥、沙子和石子组成。",
            "document_id": 1,
            "extraction_mode": "automatic"
        }

        with patch('app.api.v1.endpoints.knowledge_graph.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.knowledge_graph.KnowledgeGraphService') as mock_kg_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_kg_service.return_value = mock_service_instance

            mock_extraction_result = {
                "entities": [
                    {
                        "name": "混凝土",
                        "type": "材料",
                        "confidence": 0.95,
                        "properties": {"category": "建筑材料"}
                    },
                    {
                        "name": "建筑工程",
                        "type": "工程类型",
                        "confidence": 0.92
                    }
                ],
                "relationships": [
                    {
                        "source": "混凝土",
                        "target": "建筑工程",
                        "relation": "应用于",
                        "confidence": 0.88
                    }
                ],
                "extraction_id": "ext_123"
            }

            mock_service_instance.extract_entities_and_relationships.return_value = mock_extraction_result

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/knowledge-graph/extract",
                                 json=extraction_data, headers=headers)
            assert response.status_code == 200
            extraction = response.json()
            assert len(extraction["entities"]) == 2
            assert len(extraction["relationships"]) == 1

        # 2. 搜索知识图谱
        with patch('app.api.v1.endpoints.knowledge_graph.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.knowledge_graph.KnowledgeGraphService') as mock_kg_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_kg_service.return_value = mock_service_instance

            mock_search_result = {
                "query": "混凝土",
                "nodes": [
                    {
                        "id": "node_1",
                        "name": "混凝土",
                        "type": "材料",
                        "properties": {"category": "建筑材料"}
                    }
                ],
                "relationships": [
                    {
                        "id": "rel_1",
                        "source": "node_1",
                        "target": "node_2",
                        "type": "包含"
                    }
                ],
                "total_found": 5
            }

            mock_service_instance.search_knowledge_graph.return_value = mock_search_result

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/knowledge-graph/search?q=混凝土", headers=headers)
            assert response.status_code == 200
            search_result = response.json()
            assert len(search_result["nodes"]) == 1

        # 3. 获取实体详细信息
        entity_name = "混凝土"

        with patch('app.api.v1.endpoints.knowledge_graph.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.knowledge_graph.KnowledgeGraphService') as mock_kg_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_kg_service.return_value = mock_service_instance

            mock_entity_detail = {
                "name": entity_name,
                "type": "材料",
                "properties": {
                    "category": "建筑材料",
                    "density": "2400kg/m³",
                    "strength_grade": "C30"
                },
                "relationships": [
                    {
                        "target": "水泥",
                        "relation": "包含",
                        "properties": {"proportion": "15%"}
                    }
                ],
                "related_documents": [1, 2]
            }

            mock_service_instance.get_entity_details.return_value = mock_entity_detail

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/knowledge-graph/entity/{entity_name}", headers=headers)
            assert response.status_code == 200
            entity_detail = response.json()
            assert entity_detail["name"] == entity_name
            assert len(entity_detail["relationships"]) == 1


# 需要导入io模块
import io