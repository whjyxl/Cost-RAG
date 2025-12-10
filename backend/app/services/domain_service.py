"""
知识领域服务 - 负责知识图谱的领域分类管理
核心功能：
1. 基于规则的自动分类
2. 领域识别和映射
3. 问题领域推断
4. 领域权重计算
"""
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from sqlalchemy import select, and_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.domain import KnowledgeDomain, NodeDomainMapping
from app.models.knowledge import KnowledgeNode

logger = logging.getLogger(__name__)


# node_type 到 domain_code 的映射规则
NODE_TYPE_TO_DOMAIN_MAPPING = {
    # 标准规范类
    'standard': ['standard_specification'],
    'regulation': ['standard_specification'],
    'specification': ['standard_specification'],
    'code': ['standard_specification'],
    'norm': ['standard_specification'],

    # 计算规则类
    'calculation': ['calculation_rule'],
    'formula': ['calculation_rule'],
    'quota': ['calculation_rule', 'cost_data'],  # 定额既是计算规则，也涉及成本数据
    'pricing': ['calculation_rule', 'cost_data'],

    # 施工工艺类
    'technology': ['construction_technology'],
    'process': ['construction_technology'],
    'procedure': ['construction_technology'],
    'method': ['construction_technology'],

    # 材料设备类
    'material': ['material_equipment', 'cost_data'],  # 材料涉及设备和成本
    'equipment': ['material_equipment', 'cost_data'],
    'machinery': ['material_equipment'],
    'tool': ['material_equipment'],

    # 成本数据类
    'cost': ['cost_data'],
    'price': ['cost_data'],
    'budget': ['cost_data'],
    'expense': ['cost_data'],

    # 项目管理类
    'project': ['project_management'],
    'management': ['project_management'],
    'organization': ['project_management'],
    'plan': ['project_management'],
    'schedule': ['project_management'],

    # 质量安全类
    'quality': ['quality_safety'],
    'safety': ['quality_safety'],
    'inspection': ['quality_safety'],
    'acceptance': ['quality_safety'],
}


class DomainService:
    """知识领域服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._domain_cache: Dict[str, KnowledgeDomain] = {}  # 领域缓存

    async def _load_domain_cache(self):
        """加载领域缓存"""
        if not self._domain_cache:
            result = await self.db.execute(
                select(KnowledgeDomain).where(KnowledgeDomain.is_active == True)
            )
            domains = result.scalars().all()
            self._domain_cache = {domain.domain_code: domain for domain in domains}
            logger.info(f"加载领域缓存: {len(self._domain_cache)} 个领域")

    async def get_all_domains(self, include_inactive: bool = False) -> List[KnowledgeDomain]:
        """获取所有领域"""
        query = select(KnowledgeDomain).order_by(KnowledgeDomain.display_order)

        if not include_inactive:
            query = query.where(KnowledgeDomain.is_active == True)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_domain_by_code(self, domain_code: str) -> Optional[KnowledgeDomain]:
        """根据代码获取领域"""
        await self._load_domain_cache()
        return self._domain_cache.get(domain_code)

    async def get_domain_by_id(self, domain_id: int) -> Optional[KnowledgeDomain]:
        """根据ID获取领域"""
        result = await self.db.execute(
            select(KnowledgeDomain).where(KnowledgeDomain.id == domain_id)
        )
        return result.scalar_one_or_none()

    async def classify_node_by_rules(
        self,
        node: KnowledgeNode
    ) -> List[Tuple[str, float, bool]]:
        """
        基于规则的节点分类

        Args:
            node: 知识节点

        Returns:
            List of (domain_code, confidence, is_primary) tuples
        """
        await self._load_domain_cache()

        node_type = node.node_type.lower() if node.node_type else ""
        node_name = node.name.lower() if node.name else ""

        classified_domains: List[Tuple[str, float, bool]] = []

        # 1. 基于 node_type 的直接映射
        if node_type in NODE_TYPE_TO_DOMAIN_MAPPING:
            domain_codes = NODE_TYPE_TO_DOMAIN_MAPPING[node_type]

            # 第一个领域为主领域，其他为次领域
            for idx, domain_code in enumerate(domain_codes):
                is_primary = (idx == 0)
                confidence = 0.9 if is_primary else 0.7
                classified_domains.append((domain_code, confidence, is_primary))

        # 2. 基于节点名称的关键词匹配（增强分类）
        keyword_matches = self._match_by_keywords(node_name)
        for domain_code, match_confidence in keyword_matches:
            # 如果已经通过 node_type 分类，跳过
            if any(d[0] == domain_code for d in classified_domains):
                continue
            classified_domains.append((domain_code, match_confidence, False))

        # 3. 如果没有匹配到任何领域，使用默认分类
        if not classified_domains:
            # 根据节点内容推断
            default_domains = self._infer_default_domain(node)
            classified_domains.extend(default_domains)

        return classified_domains

    def _match_by_keywords(self, text: str) -> List[Tuple[str, float]]:
        """基于关键词匹配领域"""
        matches = []

        for domain_code, domain in self._domain_cache.items():
            if not domain.keywords:
                continue

            keywords = [kw.strip() for kw in domain.keywords.split(',')]
            matched_keywords = [kw for kw in keywords if kw in text]

            if matched_keywords:
                # 根据匹配关键词数量计算置信度
                confidence = min(0.6 + len(matched_keywords) * 0.1, 0.9)
                matches.append((domain_code, confidence))

        # 按置信度降序排序
        matches.sort(key=lambda x: x[1], reverse=True)
        return matches[:2]  # 最多返回2个匹配

    def _infer_default_domain(self, node: KnowledgeNode) -> List[Tuple[str, float, bool]]:
        """推断默认领域（当无法通过规则分类时）"""
        # 基于节点的其他属性推断
        node_name = node.name.lower() if node.name else ""
        description = node.description.lower() if node.description else ""
        combined_text = f"{node_name} {description}"

        # 简单的启发式规则
        if any(keyword in combined_text for keyword in ['标准', '规范', 'gb', 'jgj']):
            return [('standard_specification', 0.6, True)]
        elif any(keyword in combined_text for keyword in ['价格', '成本', '费用', '单价']):
            return [('cost_data', 0.6, True)]
        elif any(keyword in combined_text for keyword in ['施工', '工艺', '浇筑', '养护']):
            return [('construction_technology', 0.6, True)]
        elif any(keyword in combined_text for keyword in ['混凝土', '钢筋', '材料']):
            return [('material_equipment', 0.6, True)]
        else:
            # 默认分类为项目管理域（通用类别）
            return [('project_management', 0.5, True)]

    async def assign_domains_to_node(
        self,
        node_id: int,
        domain_assignments: List[Tuple[str, float, bool]],
        method: str = "rule"
    ) -> int:
        """
        为节点分配领域

        Args:
            node_id: 节点ID
            domain_assignments: [(domain_code, confidence, is_primary), ...]
            method: 映射方法（rule/ai/manual）

        Returns:
            分配的领域数量
        """
        await self._load_domain_cache()

        # 1. 删除该节点的现有映射
        await self.db.execute(
            delete(NodeDomainMapping).where(NodeDomainMapping.node_id == node_id)
        )

        # 2. 创建新的映射
        assigned_count = 0
        for domain_code, confidence, is_primary in domain_assignments:
            domain = self._domain_cache.get(domain_code)
            if not domain:
                logger.warning(f"领域代码 '{domain_code}' 不存在，跳过")
                continue

            mapping = NodeDomainMapping(
                node_id=node_id,
                domain_id=domain.id,
                is_primary=is_primary,
                confidence=confidence,
                mapping_method=method
            )
            self.db.add(mapping)
            assigned_count += 1

        await self.db.commit()
        logger.info(f"为节点 {node_id} 分配了 {assigned_count} 个领域")
        return assigned_count

    async def get_node_domains(self, node_id: int) -> List[Dict[str, Any]]:
        """获取节点的所有领域"""
        result = await self.db.execute(
            select(NodeDomainMapping)
            .options(selectinload(NodeDomainMapping.domain))
            .where(NodeDomainMapping.node_id == node_id)
            .order_by(NodeDomainMapping.is_primary.desc(), NodeDomainMapping.confidence.desc())
        )
        mappings = result.scalars().all()

        return [
            {
                "domain_id": mapping.domain_id,
                "domain_code": mapping.domain.domain_code,
                "domain_name": mapping.domain.domain_name,
                "is_primary": mapping.is_primary,
                "confidence": mapping.confidence,
                "mapping_method": mapping.mapping_method,
            }
            for mapping in mappings
        ]

    async def get_nodes_by_domain(
        self,
        domain_code: str,
        limit: int = 100,
        primary_only: bool = False
    ) -> List[KnowledgeNode]:
        """获取领域下的所有节点"""
        domain = await self.get_domain_by_code(domain_code)
        if not domain:
            return []

        query = (
            select(KnowledgeNode)
            .join(NodeDomainMapping)
            .where(NodeDomainMapping.domain_id == domain.id)
        )

        if primary_only:
            query = query.where(NodeDomainMapping.is_primary == True)

        query = query.limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def infer_question_domains(
        self,
        question: str,
        top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        推断问题所属的领域

        Args:
            question: 用户问题
            top_k: 返回top K个领域

        Returns:
            List of {"domain_code": str, "domain_name": str, "weight": float, "matched_keywords": List[str]}
        """
        await self._load_domain_cache()

        question_lower = question.lower()
        domain_scores = []

        for domain_code, domain in self._domain_cache.items():
            if not domain.keywords:
                continue

            # 计算关键词匹配度
            keywords = [kw.strip() for kw in domain.keywords.split(',')]
            matched_keywords = [kw for kw in keywords if kw in question_lower]

            if matched_keywords:
                # 基础分数 = 匹配关键词数量 / 总关键词数量
                base_score = len(matched_keywords) / len(keywords)

                # 乘以领域默认权重
                final_score = base_score * domain.default_weight

                domain_scores.append({
                    "domain_code": domain_code,
                    "domain_name": domain.domain_name,
                    "weight": final_score,
                    "matched_keywords": matched_keywords,
                    "default_weight": domain.default_weight,
                })

        # 按分数降序排序
        domain_scores.sort(key=lambda x: x["weight"], reverse=True)

        return domain_scores[:top_k]

    async def batch_assign_domains(
        self,
        node_ids: Optional[List[int]] = None,
        method: str = "rule"
    ) -> Dict[str, int]:
        """
        批量为节点分配领域（用于数据迁移）

        Args:
            node_ids: 节点ID列表，None表示所有节点
            method: 映射方法

        Returns:
            {"total_nodes": int, "assigned_nodes": int, "total_mappings": int}
        """
        # 1. 获取待分类的节点
        if node_ids:
            result = await self.db.execute(
                select(KnowledgeNode).where(KnowledgeNode.id.in_(node_ids))
            )
        else:
            result = await self.db.execute(select(KnowledgeNode))

        nodes = result.scalars().all()

        total_nodes = len(nodes)
        assigned_nodes = 0
        total_mappings = 0

        logger.info(f"开始批量分配领域，共 {total_nodes} 个节点")

        # 2. 逐个分类并分配
        for idx, node in enumerate(nodes, 1):
            try:
                # 分类
                domain_assignments = await self.classify_node_by_rules(node)

                if domain_assignments:
                    # 分配
                    count = await self.assign_domains_to_node(
                        node.id,
                        domain_assignments,
                        method=method
                    )
                    assigned_nodes += 1
                    total_mappings += count

                if idx % 100 == 0:
                    logger.info(f"进度: {idx}/{total_nodes} 节点已处理")

            except Exception as e:
                logger.error(f"处理节点 {node.id} 时出错: {str(e)}")
                continue

        logger.info(f"批量分配完成: 总节点={total_nodes}, 已分配={assigned_nodes}, 总映射={total_mappings}")

        return {
            "total_nodes": total_nodes,
            "assigned_nodes": assigned_nodes,
            "total_mappings": total_mappings,
        }

    async def get_domain_statistics(self) -> Dict[str, Any]:
        """获取领域统计信息"""
        domains = await self.get_all_domains()

        stats = {
            "total_domains": len(domains),
            "active_domains": sum(1 for d in domains if d.is_active),
            "domains": []
        }

        for domain in domains:
            # 统计该领域的节点数
            result = await self.db.execute(
                select(func.count(NodeDomainMapping.id))
                .where(NodeDomainMapping.domain_id == domain.id)
            )
            node_count = result.scalar() or 0

            # 统计主领域节点数
            result = await self.db.execute(
                select(func.count(NodeDomainMapping.id))
                .where(
                    and_(
                        NodeDomainMapping.domain_id == domain.id,
                        NodeDomainMapping.is_primary == True
                    )
                )
            )
            primary_node_count = result.scalar() or 0

            stats["domains"].append({
                "domain_id": domain.id,
                "domain_code": domain.domain_code,
                "domain_name": domain.domain_name,
                "node_count": node_count,
                "primary_node_count": primary_node_count,
                "default_weight": domain.default_weight,
                "is_active": domain.is_active,
            })

        return stats


# 便捷函数
async def get_domain_service(db: AsyncSession) -> DomainService:
    """获取DomainService实例"""
    return DomainService(db)
