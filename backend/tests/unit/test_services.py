"""
服务层单元测试
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

from app.services.qa_service import QAService
from app.services.ai_model_service import AIModelService
from app.services.cost_tracking_service import CostTrackingService
from app.schemas.qa import (
    QueryRequest, QueryResponse, RetrievalResult,
    GeneratedAnswer, QueryType, DataSource
)
from app.schemas.ai_model import ChatResponse, AIProvider


class TestQAService:
    """QA服务测试"""

    @pytest.fixture
    def qa_service(self):
        """QA服务实例"""
        with patch('app.services.qa_service.DocumentService'), \
             patch('app.services.qa_service.KnowledgeGraphService'), \
             patch('app.services.qa_service.CostEstimationService'), \
             patch('app.services.qa_service.AIModelService'):
            return QAService()

    @pytest.mark.unit
    async def test_process_query_success(self, qa_service):
        """测试查询处理成功"""
        # 模拟依赖服务
        qa_service.document_service = Mock()
        qa_service.knowledge_graph_service = Mock()
        qa_service.cost_estimation_service = Mock()
        qa_service.ai_model_service = Mock()

        # 设置模拟返回值
        qa_service.document_service.search_documents = AsyncMock(
            return_value={
                "results": [
                    {
                        "id": 1,
                        "title": "测试文档",
                        "content": "测试内容",
                        "file_path": "/test/doc.pdf",
                        "file_type": "pdf",
                        "score": 0.9,
                        "chunks": ["内容块"],
                        "metadata": {}
                    }
                ]
            }
        )

        qa_service.ai_model_service.chat_completion = AsyncMock(
            return_value=ChatResponse(
                content="这是测试答案",
                model="glm-4",
                provider="zhipuai",
                usage={"input_tokens": 10, "output_tokens": 20},
                response_time=1.0
            )
        )

        # 创建查询请求
        request = QueryRequest(
            question="测试问题",
            query_type=QueryType.SIMPLE,
            user_id=1,
            session_id="test_session",
            max_results=10
        )

        # 处理查询
        response = await qa_service.process_query(request)

        # 验证响应
        assert response.question == "测试问题"
        assert response.query_type == QueryType.SIMPLE
        assert response.answer.answer == "这是测试答案"
        assert response.answer.model_used == "glm-4"
        assert response.processing_time > 0

    @pytest.mark.unit
    async def test_query_preprocessing(self, qa_service):
        """测试查询预处理"""
        original_question = "  测试问题  "
        request = QueryRequest(
            question=original_question,
            query_type=QueryType.SIMPLE,
            user_id=1
        )

        processed_request = await qa_service._preprocess_query(request)

        # 验证问题标准化
        assert processed_request.question == original_question.strip()

    @pytest.mark.unit
    async def test_query_type_inference(self, qa_service):
        """测试查询类型推断"""
        # 成本估算查询
        question = "这个项目的成本是多少？"
        inferred_type = await qa_service._infer_query_type(question)
        assert inferred_type == QueryType.COST_ESTIMATION

        # 技术咨询查询
        question = "使用什么技术标准？"
        inferred_type = await qa_service._infer_query_type(question)
        assert inferred_type == QueryType.TECHNICAL

        # 默认简单查询
        question = "一般性问题"
        inferred_type = await qa_service._infer_query_type(question)
        assert inferred_type == QueryType.COMPLEX

    @pytest.mark.unit
    async def test_context_building(self, qa_service):
        """测试上下文构建"""
        retrieval_result = RetrievalResult(
            query="测试查询",
            documents=[],
            knowledge=[],
            cost_data=[],
            processing_time=1.0,
            retrieval_method="test"
        )

        # 模拟检索结果
        retrieval_result.documents = [
            {
                "id": 1,
                "title": "文档1",
                "content": "内容1",
                "file_path": "/doc1.pdf",
                "file_type": "pdf",
                "score": 0.9,
                "chunks": ["块1"],
                "metadata": {}
            }
        ]

        context = qa_service._build_context_from_retrieval(retrieval_result)

        # 验证上下文构建
        assert "文档1" in context
        assert "内容1" in context

    @pytest.mark.unit
    def test_prompt_building(self, qa_service):
        """测试提示词构建"""
        query_request = QueryRequest(
            question="测试问题",
            query_type=QueryType.SIMPLE,
            user_id=1
        )
        context = "测试上下文"

        prompt = qa_service._build_generation_prompt(query_request, context)

        # 验证提示词包含必要元素
        assert "测试问题" in prompt
        assert "测试上下文" in prompt
        assert "请基于以下上下文信息回答用户问题" in prompt

    @pytest.mark.unit
    def test_confidence_score_calculation(self, qa_service):
        """测试置信度分数计算"""
        answer = "测试答案"
        retrieval_result = RetrievalResult(
            query="测试",
            total_retrieved=5,
            processing_time=1.0,
            retrieval_method="multi_source_fusion"
        )

        score = qa_service._calculate_confidence_score(answer, retrieval_result)

        # 验证分数范围
        assert 0.0 <= score <= 1.0
        assert score > 0.5  # 有检索结果应该提高置信度

    @pytest.mark.unit
    def test_quality_score_calculation(self, qa_service):
        """测试质量分数计算"""
        answer = "这是一个详细的测试答案，包含多个方面的信息"
        retrieval_result = RetrievalResult(
            query="测试",
            documents=[],
            knowledge=[],
            cost_data=[],
            total_retrieved=3,
            processing_time=1.0,
            retrieval_method="multi_source_fusion"
        )

        score = qa_service._calculate_quality_score(answer, retrieval_result)

        # 验证分数范围
        assert 0.0 <= score <= 1.0

    @pytest.mark.unit
    def test_answer_formatting(self, qa_service):
        """测试答案格式化"""
        unformatted = """
        这是
        一个
        格式不整齐的
        答案。
        """

        formatted = qa_service._format_answer(unformatted)

        # 验证格式化结果
        lines = formatted.split('\n')
        assert len(lines) == 4  # 应该有4行
        assert all(line.strip() for line in lines)  # 所有行都不为空
        assert lines[0] == "这是"

    @pytest.mark.unit
    def test_quality_level_determination(self, qa_service):
        """测试质量等级确定"""
        # 优秀质量
        level = qa_service._determine_quality_level(0.95)
        assert level == "优秀"

        # 良好质量
        level = qa_service._determine_quality_level(0.85)
        assert level == "良好"

        # 满意质量
        level = qa_service._determine_quality_level(0.75)
        assert level == "满意"

        # 需要改进
        level = qa_service._determine_quality_level(0.65)
        assert level == "需要改进"

        # 较差质量
        level = qa_service._determine_quality_level(0.55)
        assert level == "较差"

    @pytest.mark.unit
    async def test_conversation_context_update(self, qa_service):
        """测试对话上下文更新"""
        query_request = QueryRequest(
            question="测试问题",
            query_type=QueryType.SIMPLE,
            user_id=1,
            session_id="test_session"
        )

        response = QueryResponse(
            query_id="test_query",
            question=query_request.question,
            answer=GeneratedAnswer(
                answer="测试答案",
                confidence_score=0.8,
                quality_score=0.8,
                generation_time=1.0,
                model_used="glm-4"
            ),
            retrieval_result=RetrievalResult(
                query="测试查询",
                processing_time=1.0,
                retrieval_method="test"
            ),
            query_type=QueryType.SIMPLE,
            processing_time=2.0,
            user_id=1,
            session_id="test_session"
        )

        # 更新上下文
        await qa_service._update_conversation_context(query_request, response)

        # 验证上下文已更新
        assert "test_session" in qa_service.conversation_cache
        context = qa_service.conversation_cache["test_session"]
        assert len(context.conversation_history) == 1
        assert context.conversation_history[0]["question"] == "测试问题"

    @pytest.mark.unit
    async def test_batch_query_processing(self, qa_service):
        """测试批量查询处理"""
        from app.schemas.qa import BatchQueryRequest

        # 模拟依赖服务
        qa_service.process_query = AsyncMock(
            return_value=QueryResponse(
                query_id="batch_query_1",
                question="批量问题1",
                answer=GeneratedAnswer(
                    answer="批量答案1",
                    confidence_score=0.8,
                    quality_score=0.8,
                    generation_time=1.0,
                    model_used="glm-4"
                ),
                retrieval_result=RetrievalResult(
                    query="批量查询1",
                    processing_time=1.0,
                    retrieval_method="test"
                ),
                query_type=QueryType.SIMPLE,
                processing_time=2.0
            )
        )

        batch_request = BatchQueryRequest(
            queries=[
                QueryRequest(
                    question="批量问题1",
                    query_type=QueryType.SIMPLE,
                    user_id=1
                )
            ],
            max_concurrent=3,
            fail_fast=True
        )

        result = await qa_service.batch_process_queries(batch_request)

        # 验证批量处理结果
        assert result["total_queries"] == 1
        assert result["successful_queries"] == 1
        assert result["failed_queries"] == 0
        assert len(result["results"]) == 1

    @pytest.mark.unit
    async def test_query_suggestions(self, qa_service):
        """测试查询建议"""
        user_id = 1
        session_id = "test_session"

        # 添加对话上下文
        qa_service.conversation_cache[session_id] = Mock()

        suggestions = await qa_service.get_query_suggestions(
            user_id=user_id,
            session_id=session_id,
            limit=5
        )

        # 验证建议数量
        assert len(suggestions) == 5

        # 验证建议内容
        for suggestion in suggestions:
            assert suggestion.suggested_query
            assert suggestion.reasoning
            assert 0.0 <= suggestion.confidence <= 1.0

    @pytest.mark.unit
    async def test_context_clearing(self, qa_service):
        """测试上下文清除"""
        session_id = "test_session"

        # 添加上下文
        qa_service.conversation_cache[session_id] = Mock()

        # 清除上下文
        result = await qa_service.clear_conversation_context(session_id)

        # 验证清除结果
        assert result is True
        assert session_id not in qa_service.conversation_cache

        # 清除不存在的上下文
        result = await qa_service.clear_conversation_context("nonexistent_session")
        assert result is False

    @pytest.mark.unit
    async def test_context_retrieval(self, qa_service):
        """测试上下文检索"""
        session_id = "test_session"

        # 创建上下文
        from app.schemas.qa import ConversationContext
        context = ConversationContext(
            session_id=session_id,
            user_id=1,
            conversation_history=[
                {
                    "timestamp": datetime.utcnow(),
                    "question": "问题1",
                    "answer": "答案1"
                }
            ]
        )
        qa_service.conversation_cache[session_id] = context

        # 检索上下文
        retrieved_context = await qa_service.get_conversation_context(session_id)

        # 验证检索结果
        assert retrieved_context is not None
        assert retrieved_context.session_id == session_id
        assert retrieved_context.user_id == 1
        assert len(retrieved_context.conversation_history) == 1


class TestAIModelService:
    """AI模型服务测试"""

    @pytest.fixture
    def ai_model_service(self):
        """AI模型服务实例"""
        return AIModelService()

    @pytest.mark.unit
    def test_provider_configuration(self, ai_model_service):
        """测试提供商配置"""
        providers = ai_model_service.get_supported_providers()

        # 验证所有主要提供商都已配置
        assert "zhipuai" in providers
        assert "moonshot" in providers
        assert "dashscope" in providers
        assert "baidu" in providers
        assert "deepseek" in providers
        assert "yi" in providers
        assert "spark" in providers

    @pytest.mark.unit
    def test_model_availability(self, ai_model_service):
        """测试模型可用性"""
        # 测试智谱AI模型
        models = ai_model_service.get_available_models("zhipuai")
        assert len(models) > 0

        # 验证模型信息结构
        for model in models:
            assert hasattr(model, 'name')
            assert hasattr(model, 'type')
            assert hasattr(model, 'description')

    @pytest.mark.unit
    def test_error_handling(self, ai_model_service):
        """测试错误处理"""
        # 模拟无效提供商
        result = ai_model_service.get_available_models("invalid_provider")
        assert result == []


class TestCostTrackingService:
    """成本跟踪服务测试"""

    @pytest.fixture
    def cost_tracking_service(self):
        """成本跟踪服务实例"""
        return CostTrackingService()

    @pytest.mark.unit
    async def test_cost_calculation(self, cost_tracking_service):
        """测试成本计算"""
        from app.schemas.ai_model import AIProvider

        # 测试智谱AI GLM-4模型
        cost = await cost_tracking_service.calculate_cost(
            provider=AIProvider.ZHIPUAI,
            model="glm-4",
            input_tokens=1000,
            output_tokens=500
        )

        # 验证成本计算
        assert cost > 0

    @pytest.mark.unit
    def test_usage_recording(self, cost_tracking_service):
        """测试使用记录"""
        usage_data = {
            "input_tokens": 100,
            "output_tokens": 50,
            "total_tokens": 150
        }
        cost_data = 0.3

        result = cost_tracking_service.record_usage(
            user_id=1,
            provider="zhipuai",
            model="glm-4",
            usage_data=usage_data,
            cost_data=cost_data
        )

        # 验证记录结果
        assert result["user_id"] == 1
        assert result["provider"] == "zhipuai"
        assert result["model"] == "4"
        assert result["recorded"] is True

    @pytest.mark.unit
    async def test_cost_analysis(self, cost_tracking_service):
        """测试成本分析"""
        analysis = await cost_tracking_service.get_cost_analysis(
            user_id=1,
            days=30
        )

        # 验证分析结果结构
        assert hasattr(analysis, 'daily_cost')
        assert hasattr(analysis, 'monthly_cost')
        assert hasattr(analysis, 'yearly_cost')
        assert hasattr(analysis, 'cost_by_provider')
        assert hasattr(analysis, 'total_requests')

        # 验证数据类型
        assert isinstance(analysis.daily_cost, (int, float))
        assert isinstance(analysis.total_requests, int)

    @pytest.mark.unit
    async def test_optimization_suggestions(self, cost_tracking_service):
        """测试优化建议"""
        suggestions = await cost_tracking_service.get_cost_optimization_suggestions(
            user_id=1,
            days=30
        )

        # 验证建议数量和结构
        assert len(suggestions) > 0
        for suggestion in suggestions:
            assert "type" in suggestion
            assert "title" in suggestion
            assert "description" in suggestion
            assert "action_items" in suggestion