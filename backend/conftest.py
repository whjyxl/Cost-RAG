"""
pytest配置文件
定义全局测试夹具和配置
"""
import asyncio
import pytest
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import get_db
from app.models.base import Base
from app.core.config import get_settings


# 测试数据库配置
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# 创建测试引擎
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={
        "check_same_thread": False,
    },
    poolclass=StaticPool,
    echo=False,
)

# 创建测试会话
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    class_=AsyncSession,
)


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_db_setup():
    """设置测试数据库"""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(test_db_setup) -> AsyncGenerator[AsyncSession, None]:
    """创建测试数据库会话"""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def override_get_db(db_session):
    """覆盖数据库依赖"""
    async def _override_get_db():
        yield db_session

    return _override_get_db


@pytest.fixture
def mock_user():
    """模拟用户数据"""
    from app.models.user import User

    return User(
        id=1,
        username="testuser",
        email="test@example.com",
        hashed_password="hashed_password",
        is_active=True,
        is_superuser=False
    )


@pytest.fixture
def mock_superuser():
    """模拟超级用户数据"""
    from app.models.user import User

    return User(
        id=2,
        username="admin",
        email="admin@example.com",
        hashed_password="hashed_password",
        is_active=True,
        is_superuser=True
    )


@pytest.fixture
async def mock_document():
    """模拟文档数据"""
    from app.models.document import Document

    return Document(
        id=1,
        title="测试文档",
        content="这是一个测试文档的内容",
        file_path="/test/path/document.pdf",
        file_type="pdf",
        file_size=1024,
        user_id=1,
        is_active=True
    )


@pytest.fixture
async def mock_project():
    """模拟项目数据"""
    from app.models.project import Project

    return Project(
        id=1,
        name="测试项目",
        description="这是一个测试项目",
        user_id=1,
        is_active=True
    )


@pytest.fixture
def sample_query_request():
    """示例查询请求"""
    from app.schemas.qa import QueryRequest, QueryType, DataSource

    return QueryRequest(
        question="建筑材料的成本是多少？",
        query_type=QueryType.COST_ESTIMATION,
        user_id=1,
        session_id="test_session_123",
        max_results=10,
        include_sources=[DataSource.DOCUMENTS, DataSource.COST_DATABASE]
    )


@pytest.fixture
def sample_chat_request():
    """示例聊天请求"""
    from app.schemas.ai_model import ChatRequest, AIProvider, ChatMessage

    return ChatRequest(
        provider=AIProvider.ZHIPUAI,
        model="glm-4",
        messages=[
            ChatMessage(role="user", content="你好，请介绍一下建筑工程")
        ],
        temperature=0.7,
        user_id="1"
    )


@pytest.fixture
def sample_embedding_request():
    """示例向量化请求"""
    from app.schemas.ai_model import EmbeddingRequest, AIProvider

    return EmbeddingRequest(
        provider=AIProvider.ZHIPUAI,
        text="这是一个测试文本",
        user_id="1"
    )


# Mock工具类
class MockAIModelService:
    """模拟AI模型服务"""

    async def chat_completion(self, request):
        """模拟聊天完成"""
        from app.schemas.ai_model import ChatResponse

        return ChatResponse(
            content="这是一个模拟的回答",
            model="glm-4",
            provider="zhipuai",
            usage={"input_tokens": 10, "output_tokens": 20, "total_tokens": 30},
            response_time=1.0,
            request_id="mock_request_123"
        )

    async def create_embeddings(self, request):
        """模拟向量化"""
        from app.schemas.ai_model import EmbeddingResponse

        return EmbeddingResponse(
            embedding=[0.1] * 384,  # 384维向量
            model="embedding-2",
            provider="zhipuai",
            usage={"input_tokens": 5, "total_tokens": 5},
            dimensions=384,
            processing_time=0.5
        )


class MockDocumentService:
    """模拟文档服务"""

    async def search_documents(self, query, max_results, filters):
        """模拟文档搜索"""
        return {
            "results": [
                {
                    "id": 1,
                    "title": "测试文档1",
                    "content": "这是测试文档1的内容",
                    "file_path": "/test/doc1.pdf",
                    "file_type": "pdf",
                    "score": 0.9,
                    "chunks": ["内容块1", "内容块2"],
                    "metadata": {"author": "测试作者"}
                }
            ]
        }


class MockKnowledgeGraphService:
    """模拟知识图谱服务"""

    async def search_knowledge(self, query, max_results, filters):
        """模拟知识搜索"""
        return {
            "results": [
                {
                    "node_id": 1,
                    "name": "混凝土",
                    "type": "material",
                    "properties": {"density": "2400kg/m³"},
                    "relationships": [{"type": "belongs_to", "target": "建筑材料"}],
                    "score": 0.85,
                    "explanation": "混凝土是常用的建筑材料"
                }
            ]
        }


class MockCostEstimationService:
    """模拟成本估算服务"""

    async def search_cost_data(self, query, max_results, filters):
        """模拟成本数据搜索"""
        return {
            "results": [
                {
                    "id": 1,
                    "item_name": "C30混凝土",
                    "category": "材料",
                    "unit": "m³",
                    "price_range": {"min": 350, "max": 450},
                    "region": "北京",
                    "time_period": "2024年",
                    "score": 0.88,
                    "source": "市场调研"
                }
            ]
        }


@pytest.fixture
def mock_ai_model_service():
    """模拟AI模型服务夹具"""
    return MockAIModelService()


@pytest.fixture
def mock_document_service():
    """模拟文档服务夹具"""
    return MockDocumentService()


@pytest.fixture
def mock_knowledge_graph_service():
    """模拟知识图谱服务夹具"""
    return MockKnowledgeGraphService()


@pytest.fixture
def mock_cost_estimation_service():
    """模拟成本估算服务夹具"""
    return MockCostEstimationService()


# 测试客户端
@pytest.fixture
async def client(override_get_db):
    """创建测试客户端"""
    from fastapi.testclient import TestClient
    from app.main import app

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
async def async_client(override_get_db):
    """创建异步测试客户端"""
    from httpx import AsyncClient
    from app.main import app

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


# 测试数据工厂
class TestDataFactory:
    """测试数据工厂"""

    @staticmethod
    def create_user(**kwargs):
        """创建用户"""
        from app.models.user import User

        defaults = {
            "id": 1,
            "username": "testuser",
            "email": "test@example.com",
            "hashed_password": "hashed_password",
            "is_active": True,
            "is_superuser": False
        }
        defaults.update(kwargs)
        return User(**defaults)

    @staticmethod
    def create_document(**kwargs):
        """创建文档"""
        from app.models.document import Document

        defaults = {
            "id": 1,
            "title": "测试文档",
            "content": "测试内容",
            "file_path": "/test/document.pdf",
            "file_type": "pdf",
            "file_size": 1024,
            "user_id": 1,
            "is_active": True
        }
        defaults.update(kwargs)
        return Document(**defaults)

    @staticmethod
    def create_project(**kwargs):
        """创建项目"""
        from app.models.project import Project

        defaults = {
            "id": 1,
            "name": "测试项目",
            "description": "测试项目描述",
            "user_id": 1,
            "is_active": True
        }
        defaults.update(kwargs)
        return Project(**defaults)


@pytest.fixture
def test_data_factory():
    """测试数据工厂夹具"""
    return TestDataFactory()


# 测试工具函数
async def create_test_user(db_session: AsyncSession, **kwargs):
    """创建测试用户"""
    user = TestDataFactory.create_user(**kwargs)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def create_test_document(db_session: AsyncSession, **kwargs):
    """创建测试文档"""
    document = TestDataFactory.create_document(**kwargs)
    db_session.add(document)
    await db_session.commit()
    await db_session.refresh(document)
    return document


async def create_test_project(db_session: AsyncSession, **kwargs):
    """创建测试项目"""
    project = TestDataFactory.create_project(**kwargs)
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


# 测试标记
pytest_plugins = [
    "pytest_asyncio",
]

# pytest配置
def pytest_configure(config):
    """配置pytest"""
    config.addinivalue_line(
        "markers", "unit: 单元测试"
    )
    config.addinivalue_line(
        "markers", "integration: 集成测试"
    )
    config.addinivalue_line(
        "markers", "api: API测试"
    )
    config.addinivalue_line(
        "markers", "slow: 慢速测试"
    )


# 测试环境变量
@pytest.fixture(autouse=True)
def set_test_env(monkeypatch):
    """设置测试环境变量"""
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    monkeypatch.setenv("NEO4J_PASSWORD", "test-password")
    monkeypatch.setenv("ZHIPUAI_API_KEY", "test-api-key")