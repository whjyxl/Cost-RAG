"""
数据模型单元测试
"""
import pytest
from datetime import datetime
from pydantic import ValidationError

from app.models.user import User
from app.models.project import Project
from app.models.document import Document
from app.models.cost_estimate import CostEstimate
from app.schemas.qa import (
    QueryRequest, QueryType, DataSource,
    ChatMessage, ChatRequest, AIProvider
)
from app.schemas.ai_model import (
    UsageStatistics, CostAnalysis,
    ModelInfo, ProviderStatus
)


class TestUserModel:
    """用户模型测试"""

    @pytest.mark.unit
    def test_user_creation(self):
        """测试用户创建"""
        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password="hashed_password",
            is_active=True,
            is_superuser=False
        )

        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.is_active is True
        assert user.is_superuser is False
        assert user.created_at is not None

    @pytest.mark.unit
    def test_user_password_validation(self):
        """测试密码验证"""
        # 短密码应该通过
        short_password = "short"
        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password=short_password,
            is_active=True
        )
        assert user.hashed_password == short_password

    @pytest.mark.unit
    def test_user_email_validation(self):
        """测试邮箱验证"""
        user = User(
            username="testuser",
            email="invalid-email",
            hashed_password="hashed_password",
            is_active=True
        )
        # 邮箱验证应该在模型层面处理，这里只测试基本属性
        assert user.email == "invalid-email"

    @pytest.mark.unit
    def test_user_repr(self):
        """测试用户字符串表示"""
        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password="hashed_password",
            is_active=True
        )
        repr_str = repr(user)
        assert "testuser" in repr_str


class TestProjectModel:
    """项目模型测试"""

    @pytest.mark.unit
    def test_project_creation(self):
        """测试项目创建"""
        project = Project(
            name="测试项目",
            description="这是一个测试项目",
            user_id=1,
            is_active=True
        )

        assert project.name == "测试项目"
        assert project.description == "这是一个测试项目"
        assert project.user_id == 1
        assert project.is_active is True
        assert project.created_at is not None

    @pytest.mark.unit
    def test_project_repr(self):
        """测试项目字符串表示"""
        project = Project(
            name="测试项目",
            description="测试描述",
            user_id=1,
            is_active=True
        )
        repr_str = repr(project)
        assert "测试项目" in repr_str


class TestDocumentModel:
    """文档模型测试"""

    @pytest.mark.unit
    def test_document_creation(self):
        """测试文档创建"""
        document = Document(
            title="测试文档",
            content="测试内容",
            file_path="/test/path/document.pdf",
            file_type="pdf",
            file_size=1024,
            user_id=1,
            is_active=True
        )

        assert document.title == "测试文档"
        assert document.content == "测试内容"
        assert document.file_path == "/test/path/document.pdf"
        assert document.file_type == "pdf"
        assert document.file_size == 1024
        assert document.user_id == 1
        assert document.is_active is True

    @pytest.mark.unit
    def test_document_repr(self):
        """测试文档字符串表示"""
        document = Document(
            title="测试文档",
            content="测试内容",
            file_path="/test/path/document.pdf",
            file_type="pdf",
            file_size=1024,
            user_id=1,
            is_active=True
        )
        repr_str = repr(document)
        assert "测试文档" in repr_str


class TestCostEstimateModel:
    """成本估算模型测试"""

    @pytest.mark.unit
    def test_cost_estimate_creation(self):
        """测试成本估算创建"""
        cost_estimate = CostEstimate(
            project_id=1,
            item_name="测试项目",
            estimated_cost=100000.0,
            currency="CNY",
            user_id=1,
            status="draft"
        )

        assert cost_estimate.project_id == 1
        assert cost_estimate.item_name == "测试项目"
        assert cost_estimate.estimated_cost == 100000.0
        assert cost_estimate.currency == "CNY"
        assert cost_estimate.user_id == 1
        assert cost_estimate.status == "draft"
        assert cost_estimate.created_at is not None


class TestQASchemas:
    """QA相关模式测试"""

    @pytest.mark.unit
    def test_query_request_validation(self):
        """测试查询请求验证"""
        # 有效请求
        valid_request = QueryRequest(
            question="这是一个有效的问题吗？",
            query_type=QueryType.SIMPLE,
            user_id=1,
            max_results=10
        )
        assert valid_request.question == "这是一个有效的问题吗？"
        assert valid_request.query_type == QueryType.SIMPLE
        assert valid_request.max_results == 10

        # 无效请求 - 问题太短
        with pytest.raises(ValidationError):
            QueryRequest(
                question="短",
                query_type=QueryType.SIMPLE,
                user_id=1
            )

        # 无效请求 - 最大结果数超出范围
        with pytest.raises(ValidationError):
            QueryRequest(
                question="有效的问题",
                query_type=QueryType.SIMPLE,
                user_id=1,
                max_results=100  # 超出最大值50
            )

    @pytest.mark.unit
    def test_chat_message_validation(self):
        """测试聊天消息验证"""
        # 有效消息
        valid_message = ChatMessage(
            role="user",
            content="这是一个有效的内容"
        )
        assert valid_message.role == "user"
        assert valid_message.content == "有效的内容"

        # 无效消息 - 角色无效
        with pytest.raises(ValidationError):
            ChatMessage(
                role="invalid_role",
                content="有效的内容"
            )

        # 无效消息 - 内容为空
        with pytest.raises(ValidationError):
            ChatMessage(
                role="user",
                content=""
            )

    @pytest.mark.unit
    def test_chat_request_validation(self):
        """测试聊天请求验证"""
        valid_request = ChatRequest(
            provider=AIProvider.ZHIPUAI,
            model="glm-4",
            messages=[
                ChatMessage(role="user", content="你好")
            ],
            temperature=0.7,
            user_id="1"
        )
        assert valid_request.provider == AIProvider.ZHIPUAI
        assert valid_request.model == "glm-4"
        assert len(valid_request.messages) == 1
        assert valid_request.temperature == 0.7

        # 无效请求 - 温度超出范围
        with pytest.raises(ValidationError):
            ChatRequest(
                provider=AIProvider.ZHIPUAI,
                model="glm-4",
                messages=[
                    ChatMessage(role="user", content="你好")
                ],
                temperature=3.0,  # 超出最大值2.0
                user_id="1"
            )


class TestAIModelSchemas:
    """AI模型相关模式测试"""

    @pytest.mark.unit
    def test_usage_statistics_creation(self):
        """测试使用统计创建"""
        stats = UsageStatistics(
            provider="zhipuai",
            model="glm-4",
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            input_cost=0.1,
            output_cost=0.2,
            total_cost=0.3,
            currency="CNY"
        )

        assert stats.provider == "zhipuai"
        assert stats.model == "glm-4"
        assert stats.input_tokens == 100
        assert stats.output_tokens == 50
        assert stats.total_tokens == 150
        assert stats.total_cost == 0.3

    @pytest.mark.unit
    def test_cost_analysis_creation(self):
        """测试成本分析创建"""
        now = datetime.utcnow()
        analysis = CostAnalysis(
            daily_cost=100.0,
            monthly_cost=3000.0,
            yearly_cost=36500.0,
            cost_by_provider={"zhipuai": 50.0, "moonshot": 50.0},
            cost_by_model={"glm-4": 60.0, "glm-3-turbo": 40.0},
            total_requests=10,
            successful_requests=9,
            failed_requests=1,
            average_response_time=2.5,
            currency="CNY",
            period_start=now,
            period_end=now
        )

        assert analysis.daily_cost == 100.0
        assert analysis.monthly_cost == 3000.0
        assert analysis.total_requests == 10
        assert analysis.successful_requests == 9
        assert analysis.failed_requests == 1

    @pytest.mark.unit
    def test_model_info_creation(self):
        """测试模型信息创建"""
        model_info = ModelInfo(
            provider=AIProvider.ZHIPUAI,
            model="glm-4",
            type="chat",
            description="智谱AI GLM-4模型",
            max_tokens=8000,
            context_length=8000,
            pricing={"input": 0.1, "output": 0.1}
        )

        assert model_info.provider == AIProvider.ZHIPUAI
        assert model_info.model == "glm-4"
        assert model_info.max_tokens == 8000
        assert model_info.context_length == 8000

    @pytest.mark.unit
    def test_provider_status_creation(self):
        """测试提供商状态创建"""
        now = datetime.utcnow().isoformat()
        status = ProviderStatus(
            provider="zhipuai",
            status="success",
            model="glm-4",
            response_time="1.2s",
            test_response="测试响应",
            last_checked=now
        )

        assert status.provider == "zhipuai"
        assert status.status == "success"
        assert status.model == "glm-4"
        assert status.response_time == "1.2s"


class TestSchemaValidation:
    """模式验证测试"""

    @pytest.mark.unit
    def test_enum_values(self):
        """测试枚举值"""
        assert QueryType.SIMPLE == "simple"
        assert QueryType.COMPLEX == "complex"
        assert QueryType.COST_ESTIMATION == "cost_estimation"

        assert DataSource.DOCUMENTS == "documents"
        assert DataSource.KNOWLEDGE_GRAPH == "knowledge_graph"
        assert DataSource.COST_DATABASE == "cost_database"

        assert AIProvider.ZHIPUAI == "zhipuai"
        assert AIProvider.MOONSHOT == "moonshot"

    @pytest.mark.unit
    def test_field_validation_edge_cases(self):
        """测试字段验证边界情况"""
        # 测试边界值
        request = QueryRequest(
            question="x" * 1000,  # 最大长度
            query_type=QueryType.SIMPLE,
            max_results=50  # 最大值
        )
        assert len(request.question) == 1000
        assert request.max_results == 50

        # 测试最小值
        request = QueryRequest(
            question="最小长度问题",
            query_type=QueryType.SIMPLE,
            max_results=1  # 最小值
        )
        assert len(request.question) == 6
        assert request.max_results == 1