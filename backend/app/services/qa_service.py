"""
智能问答服务
实现多源查询检索和答案融合
"""
import asyncio
import time
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import logging
import json

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

    async def process_query(self, query_request: QueryRequest) -> QueryResponse:
        """
        处理查询请求

        Args:
            query_request: 查询请求

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
            retrieval_result = await self._multi_source_retrieval(processed_query)

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

    async def batch_process_queries(self, batch_request) -> Dict[str, Any]:
        """
        批量处理查询

        Args:
            batch_request: 批量查询请求

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
                    response = await self.process_query(query_request)
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

    async def _multi_source_retrieval(self, query_request: QueryRequest) -> RetrievalResult:
        """
        多源检索

        Args:
            query_request: 查询请求

        Returns:
            检索结果
        """
        start_time = time.time()
        retrieval_tasks = []

        # 根据查询类型和数据源配置决定检索策略
        if DataSource.DOCUMENTS in query_request.include_sources:
            retrieval_tasks.append(self._retrieve_documents(query_request))

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

        return RetrievalResult(
            query=query_request.question,
            documents=documents,
            knowledge=knowledge,
            cost_data=cost_data,
            total_retrieved=total_retrieved,
            processing_time=processing_time,
            retrieval_method="multi_source_fusion"
        )

    async def _retrieve_documents(self, query_request: QueryRequest) -> List[RetrievedDocument]:
        """
        检索文档

        Args:
            query_request: 查询请求

        Returns:
            检索到的文档列表
        """
        try:
            # 调用文档服务进行检索
            search_results = await self.document_service.search_documents(
                query=query_request.question,
                max_results=query_request.max_results,
                filters=query_request.filters
            )

            documents = []
            for result in search_results.get("results", []):
                doc = RetrievedDocument(
                    document_id=result.get("id", 0),
                    title=result.get("title", ""),
                    content=result.get("content", ""),
                    file_path=result.get("file_path", ""),
                    file_type=result.get("file_type", ""),
                    relevance_score=result.get("score", 0.0),
                    chunks=result.get("chunks", []),
                    metadata=result.get("metadata", {})
                )
                documents.append(doc)

            return documents

        except Exception as e:
            logger.error(f"文档检索失败: {str(e)}")
            return []

    async def _retrieve_knowledge(self, query_request: QueryRequest) -> List[RetrievedKnowledge]:
        """
        检索知识图谱

        Args:
            query_request: 查询请求

        Returns:
            检索到的知识列表
        """
        try:
            # 调用知识图谱服务进行检索
            graph_results = await self.knowledge_graph_service.search_knowledge(
                query=query_request.question,
                max_results=query_request.max_results,
                filters=query_request.filters
            )

            knowledge_items = []
            for result in graph_results.get("results", []):
                knowledge = RetrievedKnowledge(
                    node_id=result.get("node_id", 0),
                    node_name=result.get("name", ""),
                    node_type=result.get("type", ""),
                    properties=result.get("properties", {}),
                    relationships=result.get("relationships", []),
                    relevance_score=result.get("score", 0.0),
                    explanation=result.get("explanation", "")
                )
                knowledge_items.append(knowledge)

            return knowledge_items

        except Exception as e:
            logger.error(f"知识图谱检索失败: {str(e)}")
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
                    cost_id=result.get("id"),
                    item_name=result.get("item_name", ""),
                    category=result.get("category", ""),
                    unit=result.get("unit", ""),
                    price_range=result.get("price_range", {}),
                    region=result.get("region"),
                    time_period=result.get("time_period", ""),
                    relevance_score=result.get("score", 0.0),
                    source=result.get("source", "")
                )
                cost_items.append(cost_data)

            return cost_items

        except Exception as e:
            logger.error(f"成本数据检索失败: {str(e)}")
            return []

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

        # 3. 调用AI模型生成答案
        try:
            ai_response = await self.ai_model_service.chat_completion({
                "provider": AIProvider.ZHIPUAI,  # 可以根据查询类型选择不同的提供商
                "model": "glm-4",
                "messages": [
                    {"role": "system", "content": "你是一个专业的工程成本咨询专家，请基于提供的上下文信息回答用户问题。"},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 2000
            })

            answer_content = ai_response.content
            confidence_score = self._calculate_confidence_score(answer_content, retrieval_result)
            quality_score = self._calculate_quality_score(answer_content, retrieval_result)

            # 4. 构建引用信息
            sources = self._build_sources_info(retrieval_result)
            references = self._build_references(retrieval_result)

            generation_time = time.time() - start_time

            return GeneratedAnswer(
                answer=answer_content,
                confidence_score=confidence_score,
                quality_score=quality_score,
                sources=sources,
                references=references,
                generation_time=generation_time,
                model_used=ai_response.model,
                token_usage=ai_response.usage
            )

        except Exception as e:
            logger.error(f"答案生成失败: {str(e)}")
            # 返回基础答案
            return GeneratedAnswer(
                answer="抱歉，无法生成答案，请稍后重试。",
                confidence_score=0.0,
                quality_score=0.0,
                generation_time=time.time() - start_time,
                model_used="fallback"
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

        # 添加成本数据
        for cost in retrieval_result.cost_data[:3]:
            context_parts.append(f"成本数据[{cost.item_name}]: {cost.price_range}")

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