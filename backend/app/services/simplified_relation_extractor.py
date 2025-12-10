"""
简化的关系提取器
只提取明确的、高置信度的关系：属于、需要、受规范约束
"""
import re
from typing import List, Dict, Set, Tuple, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class Relation:
    """关系"""
    source: str
    target: str
    type: str
    confidence: float
    source_text: str


class SimplifiedRelationExtractor:
    """简化的关系提取器"""
    
    def __init__(self):
        """初始化关系提取器"""
        self._compile_templates()
        logger.info("SimplifiedRelationExtractor initialized")
    
    def _compile_templates(self):
        """编译关系提取模板"""
        # belongs_to（属于）关系模板
        self.belongs_to_templates = [
            (re.compile(r'(\S+)\s*属于\s*(\S+)'), 0.95, False),
            (re.compile(r'(\S+)\s*是\s*(\S+)\s*的一种'), 0.90, False),
            (re.compile(r'(\S+)\s*包括\s*(\S+)'), 0.85, True),  # 反向
            (re.compile(r'(\S+)\s*包含\s*(\S+)'), 0.85, True),  # 反向
            (re.compile(r'(\S+)\s*分为\s*(\S+)'), 0.80, True),  # 反向
            (re.compile(r'(\S+)\s*有\s*(\S+)'), 0.75, True),  # 反向
            (re.compile(r'(\S+)\s*及\s*(\S+)'), 0.70, False),  # 并列关系
            (re.compile(r'(\S+)\s*和\s*(\S+)'), 0.70, False),  # 并列关系
            (re.compile(r'(\S+)\s*、\s*(\S+)'), 0.70, False),  # 并列关系
        ]
        
        # requires（需要）关系模板
        self.requires_templates = [
            (re.compile(r'(\S+工程)\s*需要\s*(\S+)'), 0.90, False),
            (re.compile(r'(\S+工程)\s*使用\s*(\S+)'), 0.85, False),
            (re.compile(r'(\S+工程)\s*采用\s*(\S+)'), 0.85, False),
            (re.compile(r'(\S+工程)\s*选用\s*(\S+)'), 0.85, False),
            (re.compile(r'(\S+工程)\s*应用\s*(\S+)'), 0.80, False),
            (re.compile(r'(\S+)\s*用于\s*(\S+工程)'), 0.85, True),  # 反向
            (re.compile(r'(\S+)\s*应用于\s*(\S+工程)'), 0.80, True),  # 反向
            (re.compile(r'(\S+)\s*适用于\s*(\S+工程)'), 0.80, True),  # 反向
            # 新增：更灵活的模式
            (re.compile(r'(\S+工程)[^，。]{0,10}(\S+混凝土|\S+钢材|\S+玻璃|\S+型材)'), 0.75, False),
        ]
        
        # governed_by（受规范约束）关系模板
        self.governed_by_templates = [
            (re.compile(r'(\S+工程)\s*符合\s*([A-Z]{2,4}\s?\d{4,5}-\d{4})'), 0.95, False),
            (re.compile(r'(\S+工程)\s*应\s*符合\s*([A-Z]{2,4}\s?\d{4,5}-\d{4})'), 0.95, False),
            (re.compile(r'(\S+工程)\s*执行\s*([A-Z]{2,4}\s?\d{4,5}-\d{4})'), 0.90, False),
            (re.compile(r'(\S+工程)\s*依据\s*([A-Z]{2,4}\s?\d{4,5}-\d{4})'), 0.90, False),
            (re.compile(r'(\S+工程)\s*按照\s*([A-Z]{2,4}\s?\d{4,5}-\d{4})'), 0.85, False),
            (re.compile(r'(\S+工程)\s*遵循\s*([A-Z]{2,4}\s?\d{4,5}-\d{4})'), 0.85, False),
            (re.compile(r'([A-Z]{2,4}\s?\d{4,5}-\d{4})\s*适用于\s*(\S+工程)'), 0.85, True),  # 反向
            (re.compile(r'([A-Z]{2,4}\s?\d{4,5}-\d{4})\s*规定\s*(\S+工程)'), 0.80, True),  # 反向
        ]
        
        logger.info(f"Compiled {len(self.belongs_to_templates)} belongs_to templates, "
                   f"{len(self.requires_templates)} requires templates, "
                   f"{len(self.governed_by_templates)} governed_by templates")
    
    def extract_relations(
        self,
        text: str,
        entities: List,
        max_relations: int = 15,  # 增加到15个
        min_confidence: float = 0.70  # 降低到70%
    ) -> List[Relation]:
        """
        提取关系
        
        Args:
            text: 输入文本
            entities: 已提取的实体列表
            max_relations: 最大关系数量
            min_confidence: 最小置信度阈值
            
        Returns:
            关系列表
        """
        if not text or not entities:
            return []
        
        relations = []
        entity_names = {e.name for e in entities}
        entity_by_name = {e.name: e for e in entities}
        
        # 辅助函数：查找匹配的实体（支持部分匹配）
        def find_matching_entity(text_fragment: str) -> Optional[str]:
            """查找文本片段对应的实体名称"""
            text_fragment = text_fragment.strip()
            # 1. 精确匹配
            if text_fragment in entity_names:
                return text_fragment
            # 2. 包含匹配（文本片段包含实体名）
            for entity_name in entity_names:
                if entity_name in text_fragment:
                    return entity_name
            # 3. 被包含匹配（实体名包含文本片段）
            for entity_name in entity_names:
                if text_fragment in entity_name:
                    return entity_name
            return None
        
        # 1. 提取 belongs_to 关系
        for pattern, confidence, is_reverse in self.belongs_to_templates:
            for match in pattern.finditer(text):
                groups = match.groups()
                if len(groups) >= 2:
                    if is_reverse:
                        source, target = groups[1], groups[0]
                    else:
                        source, target = groups[0], groups[1]
                    
                    # 查找匹配的实体
                    source_entity = find_matching_entity(source)
                    target_entity = find_matching_entity(target)
                    
                    # 验证实体存在
                    if source_entity and target_entity:
                        # 验证类型合理性
                        if self._is_valid_belongs_to(entity_by_name[source_entity], entity_by_name[target_entity]):
                            relations.append(Relation(
                                source=source_entity,
                                target=target_entity,
                                type='belongs_to',
                                confidence=confidence,
                                source_text=match.group(0)
                            ))
        
        # 2. 提取 requires 关系
        for pattern, confidence, is_reverse in self.requires_templates:
            for match in pattern.finditer(text):
                groups = match.groups()
                if len(groups) >= 2:
                    if is_reverse:
                        source, target = groups[1], groups[0]
                    else:
                        source, target = groups[0], groups[1]
                    
                    # 查找匹配的实体
                    source_entity = find_matching_entity(source)
                    target_entity = find_matching_entity(target)
                    
                    # 验证实体存在
                    if source_entity and target_entity:
                        # 验证类型合理性
                        if self._is_valid_requires(entity_by_name[source_entity], entity_by_name[target_entity]):
                            relations.append(Relation(
                                source=source_entity,
                                target=target_entity,
                                type='requires',
                                confidence=confidence,
                                source_text=match.group(0)
                            ))
        
        # 3. 提取 governed_by 关系
        for pattern, confidence, is_reverse in self.governed_by_templates:
            for match in pattern.finditer(text):
                groups = match.groups()
                if len(groups) >= 2:
                    if is_reverse:
                        source, target = groups[1], groups[0]
                    else:
                        source, target = groups[0], groups[1]
                    
                    # 查找匹配的实体
                    source_entity = find_matching_entity(source)
                    # 标准化标准编号后再匹配
                    target_normalized = re.sub(r'\s+', '', target).upper()
                    target_entity = find_matching_entity(target_normalized) or find_matching_entity(target)
                    
                    # 验证实体存在
                    if source_entity and target_entity:
                        # 验证类型合理性
                        if self._is_valid_governed_by(entity_by_name[source_entity], entity_by_name[target_entity]):
                            relations.append(Relation(
                                source=source_entity,
                                target=target_entity,
                                type='governed_by',
                                confidence=confidence,
                                source_text=match.group(0)
                            ))
        
        # 过滤低置信度关系
        relations = [r for r in relations if r.confidence >= min_confidence]
        
        # 去重：使用 (source, target, type) 作为唯一键
        unique_relations = {}
        for rel in relations:
            key = (rel.source, rel.target, rel.type)
            if key not in unique_relations or rel.confidence > unique_relations[key].confidence:
                unique_relations[key] = rel
        
        # 转换为列表并按置信度排序
        result = list(unique_relations.values())
        result.sort(key=lambda r: r.confidence, reverse=True)
        
        # 限制数量
        result = result[:max_relations]
        
        logger.info(f"Extracted {len(result)} relations from text")
        logger.debug(f"Relation types: {self._count_by_type(result)}")
        
        return result
    
    def _is_valid_belongs_to(self, source_entity, target_entity) -> bool:
        """
        验证 belongs_to 关系的合理性
        
        规则：
        - project_type -> project_type (如：玻璃幕墙 属于 幕墙工程)
        - material -> material (如：C30混凝土 属于 混凝土)
        """
        valid_combinations = [
            ('project_type', 'project_type'),
            ('material', 'material'),
        ]
        return (source_entity.type, target_entity.type) in valid_combinations
    
    def _is_valid_requires(self, source_entity, target_entity) -> bool:
        """
        验证 requires 关系的合理性
        
        规则：
        - project_type -> material (如：幕墙工程 需要 钢化玻璃)
        """
        valid_combinations = [
            ('project_type', 'material'),
        ]
        return (source_entity.type, target_entity.type) in valid_combinations
    
    def _is_valid_governed_by(self, source_entity, target_entity) -> bool:
        """
        验证 governed_by 关系的合理性
        
        规则：
        - project_type -> standard (如：幕墙工程 符合 JGJ102-2003)
        """
        valid_combinations = [
            ('project_type', 'standard'),
        ]
        return (source_entity.type, target_entity.type) in valid_combinations
    
    def _count_by_type(self, relations: List[Relation]) -> Dict[str, int]:
        """统计各类型关系数量"""
        counts = {}
        for relation in relations:
            counts[relation.type] = counts.get(relation.type, 0) + 1
        return counts
    
    def get_statistics(self) -> Dict[str, int]:
        """获取模板统计信息"""
        return {
            'belongs_to_template_count': len(self.belongs_to_templates),
            'requires_template_count': len(self.requires_templates),
            'governed_by_template_count': len(self.governed_by_templates),
        }
