"""
数据模型测试
"""
import pytest
import asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.project import Project, CostEstimate, CostItem
from app.models.document import Document, DocumentChunk
from app.models.knowledge import KnowledgeNode, KnowledgeRelation
from app.models.query import QueryHistory, QueryResult


@pytest.mark.asyncio
async def test_user_model():
    """测试用户模型"""
    user = User(
        username="testuser",
        email="test@example.com",
        full_name="测试用户",
        is_active=True,
        is_superuser=False
    )

    assert user.username == "testuser"
    assert user.email == "test@example.com"
    assert user.is_active is True
    assert user.is_superuser is False
    assert user.created_at is not None


@pytest.mark.asyncio
async def test_project_model():
    """测试项目模型"""
    project = Project(
        name="测试项目",
        description="这是一个测试项目",
        project_type="办公楼",
        location="北京市",
        total_area=10000.0,
        estimated_budget=5000000.0
    )

    assert project.name == "测试项目"
    assert project.project_type == "办公楼"
    assert project.total_area == 10000.0
    assert project.estimated_budget == 5000000.0


@pytest.mark.asyncio
async def test_cost_estimate_model():
    """测试成本估算模型"""
    estimate = CostEstimate(
        name="测试估算",
        project_id=1,
        total_cost=1000000.0,
        created_by=1
    )

    assert estimate.name == "测试估算"
    assert estimate.project_id == 1
    assert estimate.total_cost == 1000000.0
    assert estimate.status == "draft"


@pytest.mark.asyncio
async def test_cost_item_model():
    """测试成本项模型"""
    item = CostItem(
        estimate_id=1,
        category="主体结构",
        subcategory="混凝土工程",
        item_name="C30混凝土",
        unit="m³",
        quantity=1000.0,
        unit_price=450.0,
        total_price=450000.0
    )

    assert item.estimate_id == 1
    assert item.category == "主体结构"
    assert item.quantity == 1000.0
    assert item.unit_price == 450.0
    assert item.total_price == 450000.0


@pytest.mark.asyncio
async def test_document_model():
    """测试文档模型"""
    doc = Document(
        title="测试文档",
        file_name="test.pdf",
        file_path="/uploads/test.pdf",
        file_size=1024000,
        mime_type="application/pdf",
        uploaded_by=1
    )

    assert doc.title == "测试文档"
    assert doc.file_name == "test.pdf"
    assert doc.file_size == 1024000
    assert doc.mime_type == "application/pdf"
    assert doc.status == "processing"


@pytest.mark.asyncio
async def test_document_chunk_model():
    """测试文档分块模型"""
    chunk = DocumentChunk(
        document_id=1,
        chunk_index=1,
        content="这是文档的第一个分块内容",
        embedding_vector=[0.1] * 384
    )

    assert chunk.document_id == 1
    assert chunk.chunk_index == 1
    assert chunk.content == "这是文档的第一个分块内容"
    assert len(chunk.embedding_vector) == 384


@pytest.mark.asyncio
async def test_knowledge_node_model():
    """测试知识节点模型"""
    node = KnowledgeNode(
        name="混凝土",
        node_type="材料",
        properties={"强度等级": "C30", "用途": "主体结构"},
        embedding_vector=[0.1] * 384
    )

    assert node.name == "混凝土"
    assert node.node_type == "材料"
    assert node.properties["强度等级"] == "C30"
    assert len(node.embedding_vector) == 384


@pytest.mark.asyncio
async def test_knowledge_relation_model():
    """测试知识关系模型"""
    relation = KnowledgeRelation(
        source_node_id=1,
        target_node_id=2,
        relation_type="包含",
        properties={"权重": 0.8}
    )

    assert relation.source_node_id == 1
    assert relation.target_node_id == 2
    assert relation.relation_type == "包含"
    assert relation.properties["权重"] == 0.8


@pytest.mark.asyncio
async def test_query_history_model():
    """测试查询历史模型"""
    query = QueryHistory(
        user_id=1,
        query_text="混凝土的成本是多少？",
        query_type="qa",
        response_time=1.5
    )

    assert query.user_id == 1
    assert query.query_text == "混凝土的成本是多少？"
    assert query.query_type == "qa"
    assert query.response_time == 1.5


@pytest.mark.asyncio
async def test_query_result_model():
    """测试查询结果模型"""
    result = QueryResult(
        query_id=1,
        source_type="document",
        source_id=1,
        content="根据文档，混凝土的成本约为450元/立方米",
        confidence=0.85
    )

    assert result.query_id == 1
    assert result.source_type == "document"
    assert result.source_id == 1
    assert result.confidence == 0.85


@pytest.mark.integration
@pytest.mark.asyncio
async def test_model_relationships():
    """测试模型关系"""
    # 测试项目与估算的关系
    project = Project(name="测试项目")
    estimate = CostEstimate(name="测试估算", project=project)

    assert estimate.project == project
    assert project.estimates == [estimate]

    # 测试估算与成本项的关系
    item = CostItem(
        item_name="测试项",
        quantity=100.0,
        unit_price=10.0,
        estimate=estimate
    )

    assert item.estimate == estimate
    assert estimate.items == [item]

    # 测试文档与分块的关系
    doc = Document(title="测试文档")
    chunk = DocumentChunk(content="测试内容", document=doc)

    assert chunk.document == doc
    assert doc.chunks == [chunk]