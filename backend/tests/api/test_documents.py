"""
文档管理API端点测试
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, mock_open
import io

from app.main import app


class TestDocumentsAPI:
    """文档管理API测试"""

    @pytest.mark.api
    async def test_upload_document_success(self, client: TestClient, mock_user):
        """测试文档上传成功"""
        # 模拟PDF文件内容
        file_content = b"fake PDF content for testing"
        file_data = io.BytesIO(file_content)
        file_data.name = "test_document.pdf"

        files = {"file": ("test_document.pdf", file_data, "application/pdf")}
        data = {
            "title": "测试文档",
            "description": "这是一个测试文档",
            "project_id": 1
        }

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_service_instance.process_document_upload.return_value = {
                "id": 1,
                "title": "测试文档",
                "description": "这是一个测试文档",
                "file_path": "/uploads/test_document.pdf",
                "file_type": "pdf",
                "file_size": len(file_content),
                "status": "processing",
                "user_id": 1,
                "project_id": 1
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/documents/upload",
                                 files=files, data=data, headers=headers)

            assert response.status_code == 201
            result = response.json()
            assert result["title"] == "测试文档"
            assert result["file_type"] == "pdf"
            assert result["status"] == "processing"

    @pytest.mark.api
    async def test_upload_document_unauthorized(self, client: TestClient):
        """测试未授权文档上传"""
        file_content = b"fake PDF content"
        file_data = io.BytesIO(file_content)
        file_data.name = "test.pdf"

        files = {"file": ("test.pdf", file_data, "application/pdf")}
        data = {"title": "测试文档"}

        response = client.post("/api/v1/documents/upload", files=files, data=data)
        assert response.status_code == 401

    @pytest.mark.api
    async def test_upload_document_invalid_file_type(self, client: TestClient, mock_user):
        """测试上传无效文件类型"""
        file_content = b"fake executable content"
        file_data = io.BytesIO(file_content)
        file_data.name = "malware.exe"

        files = {"file": ("malware.exe", file_data, "application/octet-stream")}
        data = {"title": "测试文档"}

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user:
            mock_get_user.return_value = mock_user

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/documents/upload",
                                 files=files, data=data, headers=headers)

            assert response.status_code == 400
            assert "file type not supported" in response.json()["detail"].lower()

    @pytest.mark.api
    async def test_get_documents_list(self, client: TestClient, mock_user):
        """测试获取文档列表"""
        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_service_instance.get_user_documents.return_value = {
                "documents": [
                    {
                        "id": 1,
                        "title": "文档1",
                        "file_type": "pdf",
                        "file_size": 1024,
                        "status": "completed",
                        "created_at": "2024-01-01T10:00:00Z"
                    },
                    {
                        "id": 2,
                        "title": "文档2",
                        "file_type": "docx",
                        "file_size": 2048,
                        "status": "processing",
                        "created_at": "2024-01-01T11:00:00Z"
                    }
                ],
                "total": 2,
                "page": 1,
                "page_size": 10,
                "total_pages": 1
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/documents?page=1&size=10", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data["documents"]) == 2
            assert data["total"] == 2
            assert "pagination" in data

    @pytest.mark.api
    async def test_get_document_by_id(self, client: TestClient, mock_user):
        """测试根据ID获取文档"""
        document_id = 1

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_document = {
                "id": document_id,
                "title": "测试文档",
                "file_type": "pdf",
                "file_size": 1024,
                "status": "completed",
                "content_preview": "这是文档内容预览...",
                "processing_progress": 100,
                "chunks_count": 15,
                "created_at": "2024-01-01T10:00:00Z",
                "updated_at": "2024-01-01T10:05:00Z"
            }

            mock_service_instance.get_document_by_id.return_value = mock_document

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/documents/{document_id}", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == document_id
            assert data["title"] == "测试文档"
            assert data["status"] == "completed"

    @pytest.mark.api
    async def test_get_document_not_found(self, client: TestClient, mock_user):
        """测试获取不存在的文档"""
        document_id = 999

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_service_instance.get_document_by_id.return_value = None

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/documents/{document_id}", headers=headers)

            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()

    @pytest.mark.api
    async def test_update_document_metadata(self, client: TestClient, mock_user):
        """测试更新文档元数据"""
        document_id = 1
        update_data = {
            "title": "更新后的标题",
            "description": "更新后的描述",
            "tags": ["标签1", "标签2"]
        }

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_updated_document = {
                "id": document_id,
                "title": "更新后的标题",
                "description": "更新后的描述",
                "tags": ["标签1", "标签2"],
                "updated_at": "2024-01-01T12:00:00Z"
            }

            mock_service_instance.update_document.return_value = mock_updated_document

            headers = {"Authorization": "Bearer fake_token"}
            response = client.put(f"/api/v1/documents/{document_id}/metadata",
                                json=update_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["title"] == "更新后的标题"
            assert data["description"] == "更新后的描述"

    @pytest.mark.api
    async def test_delete_document(self, client: TestClient, mock_user):
        """测试删除文档"""
        document_id = 1

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_service_instance.delete_document.return_value = True

            headers = {"Authorization": "Bearer fake_token"}
            response = client.delete(f"/api/v1/documents/{document_id}", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "deleted" in data["message"].lower()

    @pytest.mark.api
    async def test_search_documents(self, client: TestClient, mock_user):
        """测试搜索文档"""
        search_query = "混凝土 建筑材料"
        filters = {
            "file_types": ["pdf", "docx"],
            "date_from": "2024-01-01",
            "date_to": "2024-12-31"
        }

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_search_results = {
                "query": search_query,
                "results": [
                    {
                        "id": 1,
                        "title": "混凝土材料手册",
                        "file_type": "pdf",
                        "score": 0.95,
                        "content_snippet": "混凝土是建筑工程中常用的材料...",
                        "highlighted_chunks": ["<mark>混凝土</mark>材料特性"]
                    }
                ],
                "total_found": 1,
                "search_time": 0.15,
                "filters_applied": filters
            }

            mock_service_instance.search_documents.return_value = mock_search_results

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/documents/search?q={search_query}&file_types=pdf,docx",
                                headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data["results"]) == 1
            assert data["total_found"] == 1
            assert data["query"] == search_query

    @pytest.mark.api
    async def test_extract_document_content(self, client: TestClient, mock_user):
        """测试提取文档内容"""
        document_id = 1

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_content = {
                "document_id": document_id,
                "full_text": "这是文档的完整文本内容...",
                "chunks": [
                    {
                        "id": 1,
                        "content": "这是第一个文本块",
                        "page_number": 1,
                        "position": {"start": 0, "end": 50}
                    },
                    {
                        "id": 2,
                        "content": "这是第二个文本块",
                        "page_number": 1,
                        "position": {"start": 51, "end": 100}
                    }
                ],
                "total_chunks": 2,
                "extraction_time": 0.5
            }

            mock_service_instance.extract_document_content.return_value = mock_content

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/documents/{document_id}/content", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert len(data["chunks"]) == 2
            assert "full_text" in data

    @pytest.mark.api
    async def test_get_document_analytics(self, client: TestClient, mock_user):
        """测试获取文档分析数据"""
        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_analytics = {
                "total_documents": 50,
                "total_size": "125.5MB",
                "file_types": {
                    "pdf": 30,
                    "docx": 15,
                    "txt": 5
                },
                "processing_status": {
                    "completed": 45,
                    "processing": 3,
                    "failed": 2
                },
                "upload_timeline": [
                    {
                        "date": "2024-01-01",
                        "uploads": 5
                    }
                ],
                "storage_usage": {
                    "used": "125.5MB",
                    "available": "874.5MB",
                    "percentage": 12.55
                }
            }

            mock_service_instance.get_document_analytics.return_value = mock_analytics

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get("/api/v1/documents/analytics", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["total_documents"] == 50
            assert "file_types" in data
            assert "processing_status" in data
            assert "storage_usage" in data

    @pytest.mark.api
    async def test_batch_process_documents(self, client: TestClient, mock_user):
        """测试批量处理文档"""
        document_ids = [1, 2, 3]
        operation = "reprocess"

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            mock_batch_result = {
                "operation": operation,
                "total_documents": len(document_ids),
                "successful": 2,
                "failed": 1,
                "results": [
                    {"document_id": 1, "status": "success"},
                    {"document_id": 2, "status": "success"},
                    {"document_id": 3, "status": "failed", "error": "Processing error"}
                ],
                "processing_time": 5.2
            }

            mock_service_instance.batch_process_documents.return_value = mock_batch_result

            headers = {"Authorization": "Bearer fake_token"}
            request_data = {"document_ids": document_ids, "operation": operation}
            response = client.post("/api/v1/documents/batch-process",
                                 json=request_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["total_documents"] == 3
            assert data["successful"] == 2
            assert data["failed"] == 1

    @pytest.mark.api
    async def test_download_document(self, client: TestClient, mock_user):
        """测试下载文档"""
        document_id = 1

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            # 模拟文件下载
            file_content = b"file content for download"
            mock_service_instance.get_document_file.return_value = {
                "content": file_content,
                "filename": "test_document.pdf",
                "content_type": "application/pdf"
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.get(f"/api/v1/documents/{document_id}/download", headers=headers)

            assert response.status_code == 200
            assert response.content == file_content
            assert "attachment" in response.headers["content-disposition"]

    @pytest.mark.api
    async def test_document_tags_management(self, client: TestClient, mock_user):
        """测试文档标签管理"""
        document_id = 1

        with patch('app.api.v1.endpoints.documents.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.documents.DocumentService') as mock_doc_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_doc_service.return_value = mock_service_instance

            # 添加标签
            tags_data = {"tags": ["建筑材料", "混凝土", "成本分析"]}
            mock_service_instance.update_document_tags.return_value = {
                "document_id": document_id,
                "tags": tags_data["tags"]
            }

            headers = {"Authorization": "Bearer fake_token"}
            response = client.put(f"/api/v1/documents/{document_id}/tags",
                                json=tags_data, headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert set(data["tags"]) == set(tags_data["tags"])

            # 获取标签
            mock_service_instance.get_document_tags.return_value = {
                "document_id": document_id,
                "tags": tags_data["tags"],
                "suggested_tags": ["工程造价", "材料科学"]
            }

            response = client.get(f"/api/v1/documents/{document_id}/tags", headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert len(data["tags"]) == 3
            assert len(data["suggested_tags"]) == 2