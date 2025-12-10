"""
智能问答服务
实现多源查询检索和答案融合
"""
import asyncio
import time
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, TYPE_CHECKING
import logging
import json

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.qa import (
    QueryRequest, QueryResponse, RetrievalResult, AnswerGenerationRequest,
    GeneratedAnswer, RetrievedDocument, RetrievedKnowledge, RetrievedCostData,
    QueryType, DataSource, ConversationContext, QuerySuggestion,
    QualityMetrics, AnswerQuality
)
from app.services.document_service import DocumentService
from app.services.knowledge_graph_service import KnowledgeGraphService
from app.services.cost_estimation_service import CostEstimationService
from app.services.ai_model_service import AIModelService, AIProvider
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class QAService:
    """智能问答服务类"""

    def __init__(self):
        self.document_service = DocumentService()
        self.knowledge_graph_service = KnowledgeGraphService()
        self.cost_estimation_service = CostEstimationService()
        self.ai_model_service = AIModelService()

        # 对话上下文缓存
        self.conversation_cache: Dict[str, ConversationContext] = {}

        # 查询类型处理策略
        self.query_strategies = {
            QueryType.SIMPLE: self._handle_simple_query,
            QueryType.COMPLEX: self._handle_complex_query,
            QueryType.COST_ESTIMATION: self._handle_cost_estimation_query,
            QueryType.TECHNICAL: self._handle_technical_query,
            QueryType.MARKET: self._handle_market_query,
            QueryType.REGULATORY: self._handle_regulatory_query,
            QueryType.PROJECT_MANAGEMENT: self._handle_project_management_query,
            QueryType.MATERIAL: self._handle_material_query,
            QueryType.EQUIPMENT: self._handle_equipment_query
        }

    async def process_query(self, query_request: QueryRequest, db: Optional['AsyncSession'] = None) -> QueryResponse:
        """
        处理查询请求

        Args:
            query_request: 查询请求
            db: 数据库会话（可选）

        Returns:
            查询响应
        """
        start_time = time.time()
        query_id = f"query_{uuid.uuid4().hex[:12]}"

        try:
            logger.info(f"开始处理查询: {query_id}, 问题: {query_request.question[:50]}...")

            # 1. 查询预处理
            processed_query = await self._preprocess_query(query_request)

            # 2. 多源检索
            retrieval_result = await self._multi_source_retrieval(processed_query, db)

            # 3. 答案生成
            answer = await self._generate_answer(processed_query, retrieval_result)

            # 4. 后处理和优化
            optimized_answer = await self._postprocess_answer(answer, retrieval_result)

            # 5. 构建响应
            processing_time = time.time() - start_time
            response = QueryResponse(
                query_id=query_id,
                question=query_request.question,
                answer=optimized_answer,
                retrieval_result=retrieval_result,
                query_type=query_request.query_type,
                processing_time=processing_time,
                user_id=query_request.user_id,
                session_id=query_request.session_id
            )

            # 6. 更新对话上下文
            if query_request.session_id:
                await self._update_conversation_context(query_request, response)

            logger.info(f"查询处理完成: {query_id}, 耗时: {processing_time:.2f}秒")
            return response

        except Exception as e:
            logger.error(f"查询处理失败: {query_id}, 错误: {str(e)}")
            # 返回错误响应
            return QueryResponse(
                query_id=query_id,
                question=query_request.question,
                answer=GeneratedAnswer(
                    answer="抱歉，处理您的问题时遇到了错误，请稍后重试。",
                    confidence_score=0.0,
                    quality_score=0.0,
                    generation_time=time.time() - start_time,
                    model_used="error_handler"
                ),
                retrieval_result=RetrievalResult(
                    query=query_request.question,
                    processing_time=0.0,
                    retrieval_method="error"
                ),
                query_type=query_request.query_type,
                processing_time=time.time() - start_time,
                user_id=query_request.user_id,
                session_id=query_request.session_id
            )

    async def batch_process_queries(self, batch_request, db: Optional['AsyncSession'] = None) -> Dict[str, Any]:
        """
        批量处理查询

        Args:
            batch_request: 批量查询请求
            db: 数据库会话（可选）

        Returns:
            批量查询响应
        """
        batch_id = f"batch_{uuid.uuid4().hex[:12]}"
        start_time = time.time()

        results = []
        successful_queries = 0
        failed_queries = 0
        errors = []

        # 控制并发数量
        semaphore = asyncio.Semaphore(batch_request.max_concurrent)

        async def process_single_query(query_request):
            async with semaphore:
                try:
                    response = await self.process_query(query_request, db)
                    return response
                except Exception as e:
                    error_msg = f"查询失败: {str(e)}"
                    errors.append(error_msg)
                    return {"error": error_msg, "query": query_request.question}

        # 并发执行查询
        tasks = [process_single_query(query) for query in batch_request.queries]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理结果
        for result in raw_results:
            if isinstance(result, Exception):
                failed_queries += 1
                errors.append(f"查询异常: {str(result)}")
            elif isinstance(result, dict) and "error" in result:
                failed_queries += 1
            else:
                successful_queries += 1
            results.append(result)

        processing_time = time.time() - start_time

        return {
            "batch_id": batch_id,
            "results": results,
            "total_queries": len(batch_request.queries),
            "successful_queries": successful_queries,
            "failed_queries": failed_queries,
            "total_processing_time": processing_time,
            "errors": errors,
            "timestamp": datetime.utcnow()
        }

    async def _preprocess_query(self, query_request: QueryRequest) -> QueryRequest:
        """
        查询预处理

        Args:
            query_request: 原始查询请求

        Returns:
            处理后的查询请求
        """
        # 1. 问题标准化
        normalized_question = self._normalize_question(query_request.question)

        # 2. 查询类型推断（如果未指定）
        if query_request.query_type == QueryType.SIMPLE:
            inferred_type = await self._infer_query_type(normalized_question)
            query_request.query_type = inferred_type

        # 3. 添加上下文信息
        if query_request.session_id and query_request.session_id in self.conversation_cache:
            context = self.conversation_cache[query_request.session_id]
            # 基于对话历史增强查询
            enhanced_query = await self._enhance_query_with_context(
                normalized_question, context
            )
            query_request.question = enhanced_query

        return query_request

    async def _multi_source_retrieval(self, query_request: QueryRequest, db: Optional['AsyncSession'] = None) -> RetrievalResult:
        """
        多源检索

        Args:
            query_request: 查询请求
            db: 数据库会话（可选）

        Returns:
            检索结果
        """
        start_time = time.time()
        retrieval_tasks = []

        # 根据查询类型和数据源配置决定检索策略
        if DataSource.DOCUMENTS in query_request.include_sources:
            retrieval_tasks.append(self._retrieve_documents(query_request, db))

        if DataSource.KNOWLEDGE_GRAPH in query_request.include_sources:
            retrieval_tasks.append(self._retrieve_knowledge(query_request))

        if DataSource.COST_DATABASE in query_request.include_sources:
            retrieval_tasks.append(self._retrieve_cost_data(query_request))

        # 并发执行检索
        retrieval_results = await asyncio.gather(*retrieval_tasks, return_exceptions=True)

        # 整合结果
        documents = []
        knowledge = []
        cost_data = []
        total_retrieved = 0

        for result in retrieval_results:
            if isinstance(result, Exception):
                logger.error(f"检索任务失败: {str(result)}")
                continue

            if isinstance(result, list):
                if result and isinstance(result[0], RetrievedDocument):
                    documents.extend(result)
                elif result and isinstance(result[0], RetrievedKnowledge):
                    knowledge.extend(result)
                elif result and isinstance(result[0], RetrievedCostData):
                    cost_data.extend(result)
                total_retrieved += len(result)

        processing_time = time.time() - start_time

        # 详细日志记录多源检索结果
        logger.info(
            f"多源检索完成: 查询='{query_request.question[:50]}...', "
            f"总结果={total_retrieved} (文档={len(documents)}, 知识图谱={len(knowledge)}, 成本数据={len(cost_data)}), "
            f"耗时={processing_time:.2f}s"
        )

        return RetrievalResult(
            query=query_request.question,
            documents=documents,
            knowledge=knowledge,
            cost_data=cost_data,
            total_retrieved=total_retrieved,
            processing_time=processing_time,
            retrieval_method="multi_source_fusion"
        )

    async def _retrieve_documents(self, query_request: QueryRequest, db: Optional['AsyncSession'] = None) -> List[RetrievedDocument]:
        """
        检索文档

        Args:
            query_request: 查询请求
            db: 数据库会话（可选）

        Returns:
            检索到的文档列表
        """
        try:
            # 如果没有数据库会话或用户ID，返回空列表
            if not db or not query_request.user_id:
                logger.warning("文档检索需要数据库会话和用户ID")
                return []

            # 使用向量搜索
            from app.schemas.document import VectorSearchRequest

            # 构建向量搜索请求
            vector_search_request = VectorSearchRequest(
                query=query_request.question,
                limit=query_request.max_results or 10,
                score_threshold=settings.SIMILARITY_THRESHOLD or 0.7,
                filters=query_request.filters or {}
            )

            # 调用文档服务的向量搜索方法
            vector_results = await self.document_service.vector_search(
                search_request=vector_search_request,
                user_id=query_request.user_id,
                db=db
            )

            # 转换结果格式
            documents = []
            for result in vector_results:
                doc = RetrievedDocument(
                    document_id=result.get('document_id', 0),
                    title=result.get('metadata', {}).get('title', ''),
                    content=result.get('content', ''),
                    file_path='',  # 向量搜索结果中可能没有文件路径
                    file_type=result.get('metadata', {}).get('file_type', ''),
                    relevance_score=result.get('relevance_score', 0.0),
                    chunks=[{
                        'chunk_index': result.get('chunk_index', 0),
                        'content': result.get('content', '')
                    }],
                    metadata=result.get('metadata', {})
                )
                documents.append(doc)

            if documents:
                logger.info(f"向量检索成功: 查询='{query_request.question[:50]}...', 结果={len(documents)}个文档块")
            else:
                logger.warning(f"向量检索无结果: 查询='{query_request.question[:50]}...', 过滤器={query_request.filters}")
            return documents

        except Exception as e:
            logger.error(f"文档向量检索失败: {str(e)}", exc_info=True)
            # 返回空列表,让多源检索继续进行
            return []

    async def _retrieve_knowledge(self, query_request: QueryRequest) -> List[RetrievedKnowledge]:
        """
        检索知识图谱（增强版 - 支持领域识别和智能权重评分）

        实现4种优化策略：
        1. 问题领域识别：自动判断问题所属领域
        2. 领域内深度检索：在识别的领域内扩展到2-3跳关系
        3. 跨域关联推理：发现领域间的关联
        4. 领域权重评分：不同领域给予不同权重

        Args:
            query_request: 查询请求

        Returns:
            检索到的知识列表（按领域权重重新评分）
        """
        try:
            from app.services.domain_service import DomainService
            from app.db.session import async_session_maker

            # 使用独立的数据库会话（避免嵌套事务问题）
            async with async_session_maker() as db:
                domain_service = DomainService(db)

                # ===== 策略1: 问题领域识别 =====
                inferred_domains = await domain_service.infer_question_domains(
                    query_request.question,
                    top_k=3  # 识别top 3个相关领域
                )

                if inferred_domains:
                    logger.info(
                        f"问题领域识别结果: {[(d['domain_name'], f\"{d['weight']:.2f}\") for d in inferred_domains]}"
                    )

                # 准备过滤条件
                filters = query_request.filters if query_request.filters else {}

                # 如果识别到领域，添加领域过滤
                if inferred_domains:
                    # 提取领域代码
                    domain_codes = [d['domain_code'] for d in inferred_domains]
                    filters['domain_codes'] = domain_codes

                # 根据查询类型智能调整过滤条件（向后兼容）
                if query_request.query_type == QueryType.MATERIAL:
                    filters['node_type'] = ['material', 'equipment']
                elif query_request.query_type == QueryType.COST_ESTIMATION:
                    filters['node_type'] = ['cost', 'material', 'project']
                elif query_request.query_type == QueryType.TECHNICAL:
                    filters['node_type'] = ['technology', 'process', 'standard']

                # ===== 策略2 & 3: 领域内深度检索 + 跨域关联推理 =====
                # 调用知识图谱服务进行检索（1跳关系）
                graph_results = await self.knowledge_graph_service.search_knowledge(
                    query=query_request.question,
                    max_results=query_request.max_results or 10,
                    filters=filters,
                    expand_relations=True  # 启用关系扩展（1跳查询）
                )

                knowledge_items = []
                for result in graph_results.get("results", []):
                    # 提取节点的领域信息
                    node_domains = result.get("domains", [])

                    # ===== 策略4: 领域权重评分 =====
                    # 基础相关性分数
                    base_score = result.get("score", 0.0)

                    # 计算领域加权分数
                    domain_boost = 1.0  # 默认不加权
                    matched_domain_name = None
                    if inferred_domains and node_domains:
                        # 如果节点的领域与问题领域匹配，进行加权
                        node_domain_codes = {d['domain_code'] for d in node_domains}
                        for inferred_domain in inferred_domains:
                            if inferred_domain['domain_code'] in node_domain_codes:
                                # 使用领域权重进行加权
                                domain_weight = inferred_domain['default_weight']
                                domain_boost = max(domain_boost, domain_weight)
                                matched_domain_name = inferred_domain['domain_name']
                                logger.debug(
                                    f"节点 '{result.get('name')}' 匹配领域 "
                                    f"'{matched_domain_name}'，权重加成 {domain_weight:.2f}"
                                )
                                break  # 只使用最高权重

                    # 计算最终分数
                    final_score = base_score * domain_boost

                    knowledge = RetrievedKnowledge(
                        node_id=result.get("node_id", 0),
                        node_name=result.get("name", ""),
                        node_type=result.get("type", ""),
                        properties=result.get("properties", {}),
                        relationships=result.get("relationships", []),
                        relevance_score=final_score,  # 使用加权后的分数
                        explanation=result.get("explanation", "")
                    )
                    knowledge_items.append(knowledge)

                # 按最终分数重新排序
                knowledge_items.sort(key=lambda x: x.relevance_score, reverse=True)

                if knowledge_items:
                    logger.info(
                        f"知识图谱检索成功: 查询='{query_request.question}', "
                        f"结果={len(knowledge_items)}个节点, "
                        f"领域={[d['domain_name'] for d in inferred_domains[:2]] if inferred_domains else '未识别'}"
                    )
                else:
                    logger.warning(f"知识图谱检索无结果: 查询='{query_request.question}', 过滤器={filters}")

                return knowledge_items

        except Exception as e:
            logger.error(f"知识图谱检索失败: {str(e)}", exc_info=True)
            # 返回空列表,让多源检索继续进行
            return []

    async def _retrieve_cost_data(self, query_request: QueryRequest) -> List[RetrievedCostData]:
        """
        检索成本数据

        Args:
            query_request: 查询请求

        Returns:
            检索到的成本数据列表
        """
        try:
            # 调用成本估算服务进行检索
            cost_results = await self.cost_estimation_service.search_cost_data(
                query=query_request.question,
                max_results=query_request.max_results,
                filters=query_request.filters
            )

            cost_items = []
            for result in cost_results.get("results", []):
                cost_data = RetrievedCostData(
                    id=result.get("id"),
                    project_id=result.get("project_id"),
                    project_name=result.get("project_name", "未命名项目"),
                    project_type=result.get("project_type"),
                    location=result.get("location"),
                    building_area=result.get("building_area"),
                    unit_price=result.get("unit_price"),
                    total_cost=result.get("total_cost"),
                    floors=result.get("floors"),
                    structure_type=result.get("structure_type"),
                    completion_date=result.get("completion_date"),
                    status=result.get("status"),
                    relevance_score=result.get("relevance_score", 0.0),
                    match_reason=result.get("match_reason"),
                    notes=result.get("notes"),
                    cost_items=result.get("cost_items")  # 添加成本明细数据
                )
                cost_items.append(cost_data)

            return cost_items

        except Exception as e:
            logger.error(f"成本数据检索失败: {str(e)}")
            return []

    def _validate_api_key(self, provider: AIProvider, api_key: str) -> tuple[bool, str]:
        """
        验证API key的格式

        Args:
            provider: AI提供商
            api_key: API密钥

        Returns:
            (是否有效, 错误信息)
        """
        if not api_key or not isinstance(api_key, str):
            return False, "API key为空或格式错误"

        # 移除首尾空白
        api_key = api_key.strip()

        # 检查最小长度
        if len(api_key) < 10:
            return False, f"API key长度过短({len(api_key)}字符)，可能无效"

        # 根据不同提供商验证格式
        if provider == AIProvider.MOONSHOT:
            if not api_key.startswith('sk-'):
                return False, "月之暗面API key应以'sk-'开头"
            if len(api_key) < 20:
                return False, f"月之暗面API key长度过短({len(api_key)}字符)"

        elif provider == AIProvider.ZHIPUAI:
            # 智谱AI的API key通常包含点号分隔的部分
            if '.' not in api_key:
                logger.warning("智谱AI的API key格式可能不正确（缺少.分隔符）")

        elif provider == AIProvider.DASHSCOPE:
            if not api_key.startswith('sk-'):
                logger.warning("阿里千问API key通常以'sk-'开头")

        # 检查是否包含明显的占位符
        placeholder_keywords = ['your', 'api', 'key', 'here', 'xxx', 'test', 'example', '请输入', '填写']
        api_key_lower = api_key.lower()
        for keyword in placeholder_keywords:
            if keyword in api_key_lower:
                return False, f"API key看起来像是占位符（包含'{keyword}'）"

        return True, ""

    async def _get_available_ai_provider(self) -> Optional[AIProvider]:
        """
        获取可用的AI提供商

        按优先级顺序检查可用的AI模型配置，并验证API key格式

        Returns:
            可用的AI提供商，如果没有可用的则返回None
        """
        # 按优先级顺序检查提供商 - 月之暗面API密钥有效，设为最高优先级
        provider_priority = [
            AIProvider.MOONSHOT,     # 月之暗面 - API密钥有效，优先级最高
            AIProvider.ZHIPUAI,      # 智谱AI
            AIProvider.DASHSCOPE,    # 阿里千问
            AIProvider.DEEPSEEK,     # 深度求索
            AIProvider.YI,           # 零一万物
            AIProvider.BAIDU,        # 百度文心一言
            AIProvider.SPARK         # 科大讯飞星火
        ]

        for provider in provider_priority:
            try:
                # 获取配置
                config = await self.ai_model_service._get_provider_api_config(provider)
                api_key = config.get('api_key')
                enabled = config.get('enabled', True)

                # 基本检查
                if not api_key:
                    logger.debug(f"{provider.value}: API key未配置")
                    continue

                if not enabled:
                    logger.debug(f"{provider.value}: 已禁用")
                    continue

                # 格式验证
                is_valid, error_msg = self._validate_api_key(provider, api_key)
                if not is_valid:
                    logger.warning(f"{provider.value}: API key验证失败 - {error_msg}")
                    continue

                # 验证通过
                logger.info(f"✅ 找到可用的AI提供商: {provider.value}")
                logger.debug(f"   API key: {api_key[:6]}...{api_key[-4:] if len(api_key) > 10 else '***'}")
                return provider

            except Exception as e:
                logger.warning(f"检查{provider.value}配置时出错: {str(e)}")
                continue

        logger.warning("⚠️  没有找到可用的AI提供商配置")
        logger.info("提示：请在【系统设置】中配置至少一个AI模型的API密钥")
        return None

    async def _generate_answer(
        self,
        query_request: QueryRequest,
        retrieval_result: RetrievalResult
    ) -> GeneratedAnswer:
        """
        生成答案

        Args:
            query_request: 查询请求
            retrieval_result: 检索结果

        Returns:
            生成的答案
        """
        start_time = time.time()

        # 1. 构建上下文
        context = self._build_context_from_retrieval(retrieval_result)

        # 2. 构建提示词
        prompt = self._build_generation_prompt(query_request, context)

        # 3. 选择可用的AI模型
        try:
            logger.info("=== DEBUG: 开始选择AI提供商 ===")
            # 动态选择可用的AI提供商
            available_provider = await self._get_available_ai_provider()
            logger.info(f"=== DEBUG: 选择的提供商: {available_provider} ===")

            if not available_provider:
                raise ValueError("没有可用的AI模型配置")

            logger.info(f"使用AI提供商: {available_provider.value}")
            logger.info("=== DEBUG: 准备调用AI服务 ===")

            ai_response = await self.ai_model_service.chat_completion(
                provider=available_provider,
                messages=[
                    {"role": "system", "content": "你是一个专业的工程成本咨询专家，请基于提供的上下文信息回答用户问题。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )

            logger.info(f"=== DEBUG: AI响应类型: {type(ai_response)} ===")
            logger.info(f"=== DEBUG: AI响应是否为字典: {isinstance(ai_response, dict)} ===")
            if isinstance(ai_response, dict):
                logger.info(f"=== DEBUG: AI响应的键: {list(ai_response.keys())} ===")
                logger.info(f"=== DEBUG: content字段存在: {'content' in ai_response} ===")
                logger.info(f"=== DEBUG: content内容长度: {len(ai_response.get('content', ''))} ===")

            # 从统一格式的响应中提取内容（ai_response是字典，不是对象）
            answer_content = ai_response.get('content', '')
            logger.info(f"=== DEBUG: 提取的答案内容长度: {len(answer_content)} ===")

            confidence_score = self._calculate_confidence_score(answer_content, retrieval_result)
            quality_score = self._calculate_quality_score(answer_content, retrieval_result)

            # 4. 构建引用信息
            sources = self._build_sources_info(retrieval_result)
            references = self._build_references(retrieval_result)

            generation_time = time.time() - start_time

            logger.info("=== DEBUG: 成功生成答案，准备返回 ===")
            return GeneratedAnswer(
                answer=answer_content,
                confidence_score=confidence_score,
                quality_score=quality_score,
                sources=sources,
                references=references,
                generation_time=generation_time,
                model_used=ai_response.get('model', 'unknown'),
                token_usage=ai_response.get('usage', {})
            )

        except ValueError as e:
            # API配置错误
            error_msg = str(e)
            logger.error(f"=== API配置错误 ===")
            logger.error(f"错误信息: {error_msg}")

            # 提供明确的错误提示
            if "没有可用的AI模型配置" in error_msg:
                user_message = "系统尚未配置AI模型。请在【系统设置】中配置至少一个AI模型的API密钥。"
            elif "未配置API密钥" in error_msg:
                user_message = f"AI模型配置错误：{error_msg}。请检查系统设置中的API密钥配置。"
            else:
                user_message = f"配置错误：{error_msg}"

            return GeneratedAnswer(
                answer=user_message,
                confidence_score=0.0,
                quality_score=0.0,
                generation_time=time.time() - start_time,
                model_used="error",
                metadata={"error_type": "config_error", "error_detail": error_msg}
            )

        except Exception as e:
            # 其他异常（包括HTTP错误、网络错误等）
            import traceback
            import aiohttp

            error_msg = str(e)
            error_type = type(e).__name__

            logger.error(f"=== 答案生成异常 ===")
            logger.error(f"异常类型: {error_type}")
            logger.error(f"异常信息: {error_msg}")
            logger.error(f"完整堆栈:\n{traceback.format_exc()}")

            # 根据异常类型提供具体的错误信息
            if isinstance(e, aiohttp.ClientResponseError):
                # HTTP错误
                status = e.status
                if status == 401:
                    user_message = "API密钥无效或已过期，请在【系统设置】中检查并更新API密钥。"
                    error_category = "auth_error"
                elif status == 429:
                    user_message = "API调用频率超限，请稍后重试。如果问题持续，请检查API配额。"
                    error_category = "rate_limit_error"
                elif status >= 500:
                    user_message = "AI服务暂时不可用，请稍后重试。"
                    error_category = "service_error"
                else:
                    user_message = f"AI服务返回错误(HTTP {status})，请稍后重试。"
                    error_category = "http_error"

                return GeneratedAnswer(
                    answer=user_message,
                    confidence_score=0.0,
                    quality_score=0.0,
                    generation_time=time.time() - start_time,
                    model_used="error",
                    metadata={"error_type": error_category, "http_status": status, "error_detail": error_msg}
                )

            elif isinstance(e, (aiohttp.ClientError, aiohttp.ServerTimeoutError)):
                # 网络错误
                user_message = "网络连接失败，请检查网络连接或稍后重试。"
                return GeneratedAnswer(
                    answer=user_message,
                    confidence_score=0.0,
                    quality_score=0.0,
                    generation_time=time.time() - start_time,
                    model_used="error",
                    metadata={"error_type": "network_error", "error_detail": error_msg}
                )

            elif "timeout" in error_msg.lower():
                # 超时错误
                user_message = "请求超时，请稍后重试。"
                return GeneratedAnswer(
                    answer=user_message,
                    confidence_score=0.0,
                    quality_score=0.0,
                    generation_time=time.time() - start_time,
                    model_used="error",
                    metadata={"error_type": "timeout_error", "error_detail": error_msg}
                )
            else:
                # 未知错误
                user_message = f"系统错误：{error_msg}。请稍后重试或联系管理员。"
                return GeneratedAnswer(
                    answer=user_message,
                    confidence_score=0.0,
                    quality_score=0.0,
                    generation_time=time.time() - start_time,
                    model_used="error",
                    metadata={"error_type": "unknown_error", "error_class": error_type, "error_detail": error_msg}
                )

    async def _postprocess_answer(
        self,
        answer: GeneratedAnswer,
        retrieval_result: RetrievalResult
    ) -> GeneratedAnswer:
        """
        答案后处理

        Args:
            answer: 生成的答案
            retrieval_result: 检索结果

        Returns:
            优化后的答案
        """
        # 1. 格式化答案
        formatted_answer = self._format_answer(answer.answer)

        # 2. 添加质量标签
        quality_level = self._determine_quality_level(answer.quality_score)

        # 3. 添加元数据
        metadata = {
            "quality_level": quality_level,
            "source_count": len(retrieval_result.documents) + len(retrieval_result.knowledge),
            "retrieval_method": retrieval_result.retrieval_method,
            "has_cost_data": len(retrieval_result.cost_data) > 0
        }

        # 更新答案
        answer.answer = formatted_answer
        answer.metadata.update(metadata)

        return answer

    def _normalize_question(self, question: str) -> str:
        """标准化问题"""
        # 去除多余空格
        question = " ".join(question.split())

        # 转换为小写并保留标点
        return question.strip()

    async def _infer_query_type(self, question: str) -> QueryType:
        """推断查询类型"""
        question_lower = question.lower()

        # 成本估算关键词
        cost_keywords = ["成本", "价格", "费用", "预算", "造价", "报价", "投资"]
        # 技术咨询关键词
        tech_keywords = ["技术", "工艺", "标准", "规范", "方法", "方案"]
        # 市场分析关键词
        market_keywords = ["市场", "趋势", "行情", "供需", "价格走势"]
        # 法规咨询关键词
        regulatory_keywords = ["法规", "标准", "规范", "政策", "规定"]
        # 项目管理关键词
        pm_keywords = ["项目", "管理", "进度", "计划", "风险", "质量"]
        # 材料咨询关键词
        material_keywords = ["材料", "原料", "建材", "耗材"]
        # 设备咨询关键词
        equipment_keywords = ["设备", "机械", "工具", "仪器"]

        if any(keyword in question_lower for keyword in cost_keywords):
            return QueryType.COST_ESTIMATION
        elif any(keyword in question_lower for keyword in tech_keywords):
            return QueryType.TECHNICAL
        elif any(keyword in question_lower for keyword in market_keywords):
            return QueryType.MARKET
        elif any(keyword in question_lower for keyword in regulatory_keywords):
            return QueryType.REGULATORY
        elif any(keyword in question_lower for keyword in pm_keywords):
            return QueryType.PROJECT_MANAGEMENT
        elif any(keyword in question_lower for keyword in material_keywords):
            return QueryType.MATERIAL
        elif any(keyword in question_lower for keyword in equipment_keywords):
            return QueryType.EQUIPMENT
        else:
            return QueryType.COMPLEX

    def _build_context_from_retrieval(self, retrieval_result: RetrievalResult) -> str:
        """从检索结果构建上下文"""
        context_parts = []

        # 添加文档内容
        for doc in retrieval_result.documents[:3]:  # 取前3个最相关的文档
            context_parts.append(f"文档[{doc.title}]: {doc.content[:500]}...")

        # 添加知识图谱信息
        for knowledge in retrieval_result.knowledge[:3]:
            context_parts.append(f"知识[{knowledge.node_name}]: {knowledge.properties}")

        # 添加成本数据（项目成本）
        for cost in retrieval_result.cost_data[:3]:
            cost_info = f"项目: {cost.project_name}"
            if cost.building_area:
                cost_info += f", 面积: {cost.building_area}㎡"
            if cost.unit_price:
                cost_info += f", 单价: ¥{cost.unit_price}/㎡"
            if cost.total_cost:
                cost_info += f", 总造价: ¥{cost.total_cost}"
            context_parts.append(f"历史成本数据[{cost_info}]")

        return "\n\n".join(context_parts)

    def _build_generation_prompt(self, query_request: QueryRequest, context: str) -> str:
        """构建生成提示词"""
        prompt = f"""
请基于以下上下文信息回答用户问题：

上下文信息：
{context}

用户问题：{query_request.question}

请提供：
1. 准确、详细的答案
2. 相关的数据和事实支持
3. 实用的建议或结论

回答要求：
- 专业且准确
- 条理清晰
- 信息完整
- 语言简洁明了
"""
        return prompt

    def _calculate_confidence_score(self, answer: str, retrieval_result: RetrievalResult) -> float:
        """计算置信度分数"""
        # 基于检索结果质量和答案内容计算置信度
        base_score = 0.5

        # 检索结果数量影响
        total_sources = retrieval_result.total_retrieved
        if total_sources > 0:
            base_score += min(0.2, total_sources * 0.05)

        # 答案长度影响
        if len(answer) > 100:
            base_score += 0.1

        # 检索方法影响
        if retrieval_result.retrieval_method == "multi_source_fusion":
            base_score += 0.1

        return min(1.0, base_score)

    def _calculate_quality_score(self, answer: str, retrieval_result: RetrievalResult) -> float:
        """计算质量分数"""
        # 简化的质量评分算法
        score = 0.5

        # 基于答案长度
        if 100 <= len(answer) <= 2000:
            score += 0.2

        # 基于检索结果质量
        avg_relevance = 0.0
        total_items = 0

        for doc in retrieval_result.documents:
            avg_relevance += doc.relevance_score
            total_items += 1

        for knowledge in retrieval_result.knowledge:
            avg_relevance += knowledge.relevance_score
            total_items += 1

        if total_items > 0:
            avg_relevance /= total_items
            score += avg_relevance * 0.3

        return min(1.0, score)

    def _build_sources_info(self, retrieval_result: RetrievalResult) -> List[Dict[str, Any]]:
        """构建来源信息"""
        sources = []

        # 文档来源
        for doc in retrieval_result.documents[:5]:
            sources.append({
                "type": "document",
                "id": doc.document_id,
                "title": doc.title,
                "relevance": doc.relevance_score
            })

        # 知识图谱来源
        for knowledge in retrieval_result.knowledge[:5]:
            sources.append({
                "type": "knowledge",
                "id": knowledge.node_id,
                "name": knowledge.node_name,
                "relevance": knowledge.relevance_score
            })

        return sources

    def _build_references(self, retrieval_result: RetrievalResult) -> List[Dict[str, Any]]:
        """构建参考文献"""
        references = []

        # 文档引用
        for doc in retrieval_result.documents:
            references.append({
                "type": "document",
                "title": doc.title,
                "file_path": doc.file_path,
                "relevance": doc.relevance_score
            })

        return references

    def _format_answer(self, answer: str) -> str:
        """格式化答案"""
        # 基本的格式化处理
        lines = answer.split('\n')
        formatted_lines = []

        for line in lines:
            line = line.strip()
            if line:
                formatted_lines.append(line)

        return '\n'.join(formatted_lines)

    def _determine_quality_level(self, quality_score: float) -> str:
        """确定质量等级"""
        if quality_score >= 0.9:
            return "优秀"
        elif quality_score >= 0.8:
            return "良好"
        elif quality_score >= 0.7:
            return "满意"
        elif quality_score >= 0.6:
            return "需要改进"
        else:
            return "较差"

    async def _update_conversation_context(
        self,
        query_request: QueryRequest,
        response: QueryResponse
    ):
        """更新对话上下文"""
        if not query_request.session_id or not query_request.user_id:
            return

        session_id = query_request.session_id

        # 获取或创建对话上下文
        if session_id not in self.conversation_cache:
            self.conversation_cache[session_id] = ConversationContext(
                session_id=session_id,
                user_id=query_request.user_id
            )

        context = self.conversation_cache[session_id]

        # 添加对话记录
        context.conversation_history.append({
            "timestamp": datetime.utcnow(),
            "question": query_request.question,
            "answer": response.answer.answer,
            "query_type": query_request.query_type.value,
            "satisfaction": response.satisfaction_score
        })

        # 保持历史记录在合理范围内
        if len(context.conversation_history) > 20:
            context.conversation_history = context.conversation_history[-20:]

        # 更新最后更新时间
        context.last_updated = datetime.utcnow()

    async def _enhance_query_with_context(
        self,
        question: str,
        context: ConversationContext
    ) -> str:
        """基于上下文增强查询"""
        if not context.conversation_history:
            return question

        # 获取最近的对话
        recent_history = context.conversation_history[-3:]

        # 构建上下文信息
        context_info = []
        for item in recent_history:
            context_info.append(f"Q: {item['question']}")
            context_info.append(f"A: {item['answer'][:100]}...")

        # 简单的查询增强
        enhanced_question = f"""
上下文：
{chr(10).join(context_info)}

当前问题：{question}
"""
        return enhanced_question

    # 查询类型处理器
    async def _handle_simple_query(self, query_request: QueryRequest) -> QueryResponse:
        """处理简单查询"""
        return await self.process_query(query_request)

    async def _handle_complex_query(self, query_request: QueryRequest) -> QueryResponse:
        """处理复杂查询"""
        # 增加检索数量
        query_request.max_results = min(query_request.max_results * 1.5, 50)
        return await self.process_query(query_request)

    async def _handle_cost_estimation_query(self, query_request: QueryRequest) -> QueryResponse:
        """处理成本估算查询"""
        # 优先检索成本数据
        if DataSource.COST_DATABASE not in query_request.include_sources:
            query_request.include_sources.append(DataSource.COST_DATABASE)
        return await self.process_query(query_request)

    async def _handle_technical_query(self, query_request: QueryRequest) -> QueryResponse:
        """处理技术咨询查询"""
        # 优先检索知识图谱
        if DataSource.KNOWLEDGE_GRAPH not in query_request.include_sources:
            query_request.include_sources.insert(0, DataSource.KNOWLEDGE_GRAPH)
        return await self.process_query(query_request)

    async def _handle_market_query(self, query_request: QueryRequest) -> QueryResponse:
        """处理市场分析查询"""
        return await self.process_query(query_request)

    async def _handle_regulatory_query(self, query_request: QueryRequest) -> QueryResponse:
        """处理法规咨询查询"""
        return await self.process_query(query_request)

    async def _handle_project_management_query(self, query_request: QueryRequest) -> QueryResponse:
        """处理项目管理查询"""
        return await self.process_query(query_request)

    async def _handle_material_query(self, query_request: QueryRequest) -> QueryResponse:
        """处理材料咨询查询"""
        # 优先检索成本数据和文档
        if DataSource.COST_DATABASE not in query_request.include_sources:
            query_request.include_sources.append(DataSource.COST_DATABASE)
        return await self.process_query(query_request)

    async def _handle_equipment_query(self, query_request: QueryRequest) -> QueryResponse:
        """处理设备咨询查询"""
        # 优先检索成本数据和文档
        if DataSource.COST_DATABASE not in query_request.include_sources:
            query_request.include_sources.append(DataSource.COST_DATABASE)
        return await self.process_query(query_request)

    async def get_query_suggestions(
        self,
        user_id: int,
        session_id: Optional[str] = None,
        limit: int = 5
    ) -> List[QuerySuggestion]:
        """
        获取查询建议

        Args:
            user_id: 用户ID
            session_id: 会话ID
            limit: 建议数量限制

        Returns:
            查询建议列表
        """
        suggestions = []

        # 基于对话历史生成建议
        if session_id and session_id in self.conversation_cache:
            context = self.conversation_cache[session_id]

            # 简单的建议生成逻辑
            common_queries = [
                "当前材料的市场价格如何？",
                "这个项目的预算估算方法是什么？",
                "相关的技术标准有哪些？",
                "施工工艺流程是怎样的？",
                "质量验收标准是什么？"
            ]

            for i, query in enumerate(common_queries[:limit]):
                suggestion = QuerySuggestion(
                    suggestion_id=f"suggestion_{i}",
                    suggested_query=query,
                    reasoning="基于常见工程咨询问题推荐",
                    confidence=0.8 - i * 0.1,
                    category="general",
                    context_relevance=0.7
                )
                suggestions.append(suggestion)

        return suggestions

    async def clear_conversation_context(self, session_id: str) -> bool:
        """
        清除对话上下文

        Args:
            session_id: 会话ID

        Returns:
            是否清除成功
        """
        if session_id in self.conversation_cache:
            del self.conversation_cache[session_id]
            return True
        return False

    async def get_conversation_context(self, session_id: str) -> Optional[ConversationContext]:
        """
        获取对话上下文

        Args:
            session_id: 会话ID

        Returns:
            对话上下文或None
        """
        return self.conversation_cache.get(session_id)