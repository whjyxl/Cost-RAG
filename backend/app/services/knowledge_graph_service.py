"""
知识图谱服务模块 - 实体识别、关系抽取和图谱构建
"""
import asyncio
import json
import re
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from collections import defaultdict, Counter

# 基础导入
import jieba
import jieba.posseg as pseg

# 可选导入 - 优雅降级
try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False

try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False

try:
    from py2neo import Graph, Node, Relationship
    PY2NEO_AVAILABLE = True
except ImportError:
    PY2NEO_AVAILABLE = False

from app.models.knowledge import KnowledgeNode, KnowledgeRelation, KnowledgePath
from app.models.document import Document, DocumentChunk
from app.schemas.knowledge import (
    EntityCreate, RelationCreate, PathCreate, EntityExtractionRequest,
    RelationExtractionRequest, GraphQueryRequest
)
from app.core.config import settings
from app.core.logging import logger
from app.services.domain_service import DomainService


class KnowledgeGraphService:
    """知识图谱服务类"""

    def __init__(self, simplified_mode: bool = True):
        """
        初始化知识图谱服务
        
        Args:
            simplified_mode: 是否使用简化模式（只提取高价值实体和关系）
        """
        self.simplified_mode = simplified_mode
        self.neo4j_driver = None
        self.graph = None
        self.neo4j_available = NEO4J_AVAILABLE
        self.networkx_available = NETWORKX_AVAILABLE
        self.py2neo_available = PY2NEO_AVAILABLE

        # 记录可用性状态
        if NEO4J_AVAILABLE:
            logger.info("✅ Neo4j 驱动可用")
        else:
            logger.warning("⚠️ Neo4j 驱动不可用，图数据库功能将受限")

        if NETWORKX_AVAILABLE:
            logger.info("✅ NetworkX 可用")
        else:
            logger.warning("⚠️ NetworkX 不可用，图分析功能将受限")

        if PY2NEO_AVAILABLE:
            logger.info("✅ py2neo 可用")
        else:
            logger.warning("⚠️ py2neo 不可用，部分Neo4j功能将受限")
        
        # 简化模式：使用精简的提取器
        if self.simplified_mode:
            logger.info("🎯 使用简化模式：只提取高价值实体和关系")
            from app.services.simplified_kg_extractor import SimplifiedKGExtractor
            from app.services.simplified_relation_extractor import SimplifiedRelationExtractor
            self.entity_extractor = SimplifiedKGExtractor()
            self.relation_extractor = SimplifiedRelationExtractor()
        else:
            logger.info("📊 使用完整模式：提取所有实体和关系")
            # 加载领域词典
            self._load_domain_dictionary()

            # 配置停用词
            self.stopwords = self._load_stopwords()

            # 加载黑名单（无意义词组）
            self.blacklist = self._load_blacklist()

            # 加载白名单（专业术语优先保留）
            self.whitelist = self._load_whitelist()
        
        self.entity_patterns = {
            # ❗优化：更精准的组织识别（捕获"西安混凝土公司"等）
            'organization': r'([\u4e00-\u9fa5]{2,10}(?:公司|企业|集团|机构|单位|部门))',
            'person': r'([\u4e00-\u9fa5]{2,4})(?:先生|女士|总经理|总监|工程师|专家)',
            'location': r'([\u4e00-\u9fa5]+(?:省|市|县|区|路|号))',
            'technology': r'(Python|Java|React|Vue|Angular|Spring|Django|Flask)',
            'cost': r'(?:成本|费用|预算|报价)(?:[\d,，、]+)(?:元|万元|千元)',
            'time': r'(\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{1,2}-\d{1,2})',
            'project': r'([\u4e00-\u9fa5]{2,10}(?:工程|项目|任务))',
            # ❗优化：更全面的材料识别（捕获"C30混凝土"、"玻璃幕墙"等）
            'material': r'([A-Z]\d+[\u4e00-\u9fa5]{1,6}|[\u4e00-\u9fa5]{2,8}(?:混凝土|钢筋|砂浆|水泥|砖|幕墙|门窗))',
            # ❗新增：设备识别（捕获"塔吊"、"混凝土泵车"等）
            'equipment': r'([\u4e00-\u9fa5]{2,10}(?:泵车|电梯|吊|机|车辆|设备))',
            'standard': r'(GB|ISO|ASTM|JIS|DIN)(?:-\d+)+',
            'metric': r'([\d,，、]+)(?:mm|cm|m|kg|t|㎡|㎡|ℏ|kWh|MPa)'
        }
        self.relation_patterns = {
            'belong_to': r'(?:属于|隶属|归)',
            'contain': r'(?:包含|含有|包括)',
            'located_in': r'(?:位于|坐落|在)',
            'cost_of': r'(?:成本为|费用是|报价)',
            'implement': r'(?:实施|执行|建设)',
            'use': r'(?:使用|采用|应用)',
            'produce': r'(?:生产|制造|产出)',
            'require': r'(?:需要|要求|依赖)',
            'connect': r'(?:连接|关联|联系)',
            'manage': r'(?:管理|负责|主管)',
            'collaborate': r'(?:合作|协作|配合)',
            'before': r'(?:之前|早于|先于)',
            'after': r'(?:之后|晚于|后于)'
        }

    async def connect_neo4j(self) -> bool:
        """连接到Neo4j数据库"""
        if not self.neo4j_available:
            logger.warning("⚠️ Neo4j 驱动不可用，跳过连接")
            return False

        try:
            self.neo4j_driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )

            # 测试连接
            with self.neo4j_driver.session() as session:
                session.run("RETURN 1")

            # 初始化py2neo图对象（如果可用）
            if self.py2neo_available:
                self.graph = Graph(
                    settings.NEO4J_URI,
                    auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
                )
                logger.info("✅ 成功连接到Neo4j数据库 (包含py2neo支持)")
            else:
                logger.info("✅ 成功连接到Neo4j数据库 (基础驱动)")

            return True

        except Exception as e:
            logger.error(f"❌ 连接Neo4j失败: {str(e)}")
            self.neo4j_driver = None
            self.graph = None
            return False

    async def disconnect_neo4j(self):
        """断开Neo4j连接"""
        if self.neo4j_driver:
            self.neo4j_driver.close()
            logger.info("Neo4j连接已关闭")
    
    def _load_domain_dictionary(self):
        """加载工程造价领域词典"""
        domain_words = [
            # 材料类
            '混凝土', '钢筋混凝土', '预应力混凝土', '商品混凝土',
            '钢筋', '螺纹钢', '圆钢', '型钢', 'H型钢', 'I型钢',
            '水泥', '硅酸盐水泥', '普通硅酸盐水泥', '矿渣水泥',
            '砂浆', '水泥砂浆', '混合砂浆', '干混砂浆',
            '砖', '红砖', '空心砖', '加气块',
            '钢材', '钢板', '钢管', '钢丝',
            # 工艺类
            '浇筑', '振捣', '养护', '抹灰', '砌筑',
            '焊接', '绑扎', '安装', '吊装', '运输',
            '开挖', '回填', '夯实', '碾压',
            # 规范类
            '建筑工程施工质量验收规范',
            '混凝土结构工程施工质量验收规范',
            '钢结构工程施工质量验收规范',
            '建筑地基基础工程施工质量验收规范',
            # 项目类
            '基础工程', '主体工程', '装饰装修工程',
            '屋面工程', '防水工程', '保温工程',
            '给排水工程', '电气工程', '暖通工程',
            # 成本类
            '人工费', '材料费', '机械费', '管理费', '利润',
            '单位工程', '分部工程', '分项工程',
            '工程量', '工程量清单', '定额',
            # 设备类
            '塔吊', '施工电梯', '混凝土泵车', '挖掘机',
            '装载机', '推土机', '压路机', '搅拌机'
        ]
        
        for word in domain_words:
            jieba.add_word(word, freq=10000, tag='n')
        
        logger.info(f"已加载 {len(domain_words)} 个领域专业词汇")
    
    def _load_stopwords(self) -> set:
        """加载停用词表"""
        return {
            '的', '了', '在', '是', '我', '有', '和', '就',
            '不', '人', '都', '一', '一个', '上', '也', '很',
            '到', '说', '要', '去', '你', '会', '着', '没有',
            '看', '好', '自己', '这', '那', '里', '为', '与',
            '把', '被', '从', '向', '以', '对', '等', '但',
            '而', '或', '及', '且', '则', '又', '再', '还'
        }

    def _load_blacklist(self) -> set:
        """加载黑名单（无意义词组）- 增强版"""
        return {
            # 单字/双字无意义词
            '计量', '变更', '清单', '工程', '项目', '施工', '建设', '设计',
            '材料', '设备', '费用', '成本', '造价', '管理', '质量', '标准',
            '规范', '要求', '合同', '文件', '资料', '档案', '措施', '方法',
            '技术', '工艺', '流程', '过程', '阶段', '期间', '时间', '地点',
            '单位', '部门', '人员', '专业', '内容', '范围', '条件', '情况',
            '费', '无', '照管', '变更',  # 单字词

            # 截断词组（从实际数据提取）
            '量清单', '量偏差', '理或造价', '师暂定', '应予计', '价款调整',
            '及消防', '及园林', '红线内', '施工发', '价款调',
            '及消防报警及联动工程', '及园林绿化', '及智能化系统工程',
            '红线内小市', '公共区', '和税金', '设备费', '或工作',
            '进度的措施', '理或', '工或',

            # 无意义片段
            '等专门性规定外的其他规定', '中暂定并包括在', '以及发生的',
            '所需的', '必然发生但', '暂时不能', '根据省级政府或省',
            '施工技术和管理水平而', '必须缴纳的', '缩短产生的',

            # 过于泛化的词
            '相关', '其他', '各种', '所有', '任何', '特殊', '一般', '特定',
            '某些', '多个', '若干', '部分', '全部', '整个', '主要', '基本',
            '商业', '市政',  # 过于宽泛

            # 不完整的地点/区域描述
            '公共区', '红线内', '小市', '商业区',

            # 以连接词开头（明确的截断标志）
            '及', '和', '与', '或', '为', '的', '了', '等',
            '并', '但', '而', '则', '且', '又', '再', '还'
        }

    def _load_whitelist(self) -> set:
        """加载白名单（专业术语优先保留）"""
        return {
            # 工程材料
            '混凝土', '钢筋混凝土', '预应力混凝土', '商品混凝土', '自密实混凝土',
            '钢筋', '螺纹钢', '圆钢', '型钢', 'H型钢', 'I型钢', '槽钢', '角钢',
            '水泥', '硅酸盐水泥', '普通硅酸盐水泥', '矿渣水泥', '粉煤灰水泥',
            '砂浆', '水泥砂浆', '混合砂浆', '干混砂浆', '聚合物砂浆',
            '砖', '红砖', '空心砖', '加气块', '多孔砖', '页岩砖',
            '钢材', '钢板', '钢管', '钢丝', '钢绞线', '钢结构',

            # 工程工艺
            '浇筑', '振捣', '养护', '抹灰', '砌筑', '粉刷', '喷涂',
            '焊接', '绑扎', '安装', '吊装', '运输', '拆除', '修复',
            '开挖', '回填', '夯实', '碾压', '灌注', '压实', '找平',

            # 工程项目
            '基础工程', '主体工程', '装饰装修工程', '屋面工程',
            '防水工程', '保温工程', '给排水工程', '电气工程',
            '暖通工程', '消防工程', '智能化工程', '景观工程',
            '桩基工程', '土石方工程', '钢结构工程', '幕墙工程',

            # 工程规范
            '建筑工程施工质量验收规范', '混凝土结构工程施工质量验收规范',
            '钢结构工程施工质量验收规范', '建筑地基基础工程施工质量验收规范',
            '砌体工程施工质量验收规范', '屋面工程质量验收规范',

            # 工程设备
            '塔吊', '施工升降机', '混凝土泵车', '挖掘机', '装载机',
            '推土机', '压路机', '摊铺机', '搅拌站', '布料机',

            # 工程成本术语
            '工程量清单', '清单计价', '定额计价', '综合单价', '措施费',
            '规费', '税金', '人工费', '材料费', '机械费', '管理费',
            '利润', '暂估价', '暂列金额', '计日工', '总承包服务费',

            # 工程管理
            '项目管理', '施工组织设计', '专项施工方案', '施工进度计划',
            '质量控制', '安全管理', '文明施工', '环境保护', '成本控制'
        }

    async def extract_entities(
        self,
        text: str,
        extraction_method: str = "rule_based"
    ) -> List[Dict[str, Any]]:
        """
        从文本中提取实体

        Args:
            text: 输入文本
            extraction_method: 提取方法 (rule_based, jieba, hybrid, simplified)

        Returns:
            提取的实体列表
        """
        try:
            entities = []

            # 简化模式：使用精简提取器
            if self.simplified_mode:
                logger.info("使用简化模式提取实体")
                extracted = self.entity_extractor.extract_entities(text, max_entities=15)
                # 转换为统一格式
                entities = [
                    {
                        'text': e.name,
                        'type': e.type,
                        'start': e.position[0],
                        'end': e.position[1],
                        'confidence': e.confidence,
                        'method': 'simplified',
                        'source_text': e.source_text
                    }
                    for e in extracted
                ]
            else:
                # 完整模式：使用原有方法
                if extraction_method == "rule_based":
                    entities = await self._extract_entities_by_rules(text)
                elif extraction_method == "jieba":
                    entities = await self._extract_entities_by_jieba(text)
                elif extraction_method == "hybrid":
                    # 混合方法：先规则提取，再用jieba补充
                    rule_entities = await self._extract_entities_by_rules(text)
                    jieba_entities = await self._extract_entities_by_jieba(text)
                    entities = await self._merge_entities(rule_entities, jieba_entities)

                # 去重和评分
                entities = await self._deduplicate_entities(entities)

            logger.info(f"从文本中提取了 {len(entities)} 个实体")
            return entities

        except Exception as e:
            logger.error(f"实体提取失败: {str(e)}")
            return []

    async def _extract_entities_by_rules(self, text: str) -> List[Dict[str, Any]]:
        """基于规则提取实体（改进版 - 添加过滤）"""
        entities = []

        for entity_type, pattern in self.entity_patterns.items():
            matches = re.finditer(pattern, text)
            for match in matches:
                entity_text = match.group(1) if match.groups() else match.group(0)

                # 应用相同的过滤规则
                # 1. 长度检查
                if len(entity_text) < 3:
                    continue

                # 2. 黑名单检查
                if entity_text in self.blacklist:
                    continue

                # 3. 质量检查
                if not self._is_valid_entity(entity_text):
                    continue

                # 4. 白名单优先
                if entity_text in self.whitelist:
                    confidence = 0.9
                else:
                    confidence = 0.7  # 规则提取的置信度略低于jieba

                entity = {
                    'text': entity_text,
                    'type': entity_type,
                    'start': match.start(),
                    'end': match.end(),
                    'confidence': confidence,
                    'method': 'rule_based'
                }
                entities.append(entity)

        return entities

    async def _extract_entities_by_jieba(self, text: str) -> List[Dict[str, Any]]:
        """使用jieba提取实体（增强版 - 严格过滤 + 正确位置追踪）"""
        entities = []

        # 词性标注（转为列表以便追踪位置）
        words = list(pseg.cut(text))
        current_pos = 0  # ❗修复：追踪当前位置指针

        for word, flag in words:
            # ❗修复：从current_pos开始查找word的实际位置
            start_pos = text.find(word, current_pos)
            if start_pos == -1:
                # 找不到就跳过（可能是分词错误）
                continue

            end_pos = start_pos + len(word)
            current_pos = end_pos  # 更新位置指针

            # 优先检查：如果在白名单中，直接保留（跳过其他检查）
            if word in self.whitelist:
                entity_type = self._map_pos_to_entity_type(flag) or 'concept'
                entity = {
                    'text': word,
                    'type': entity_type,
                    'start': start_pos,  # ✅ 使用正确位置
                    'end': end_pos,      # ✅ 使用正确位置
                    'confidence': 0.95,  # 白名单词组高置信度（提升）
                    'method': 'jieba_whitelist',
                    'pos': flag
                }
                entities.append(entity)
                continue

            # 1. 长度过滤：至少3个字符（优化：放宽要求以捕获"塔吊"、"钢筋"等）
            if len(word) < 3:
                continue

            # 2. 停用词过滤
            if word in self.stopwords:
                continue

            # 3. 黑名单过滤
            if word in self.blacklist:
                continue

            # 4. ❗改进：词性过滤 - 移除动词(v)和形容词(a)，只保留名词和专名
            # 移除 'v', 'vn', 'a', 'an'
            if flag not in ['n', 'nr', 'ns', 'nt', 'nz', 'eng']:
                continue

            # 5. 质量检查：过滤纯数字、纯标点、截断词组（增强版验证）
            if not self._is_valid_entity(word):
                continue

            # 6. ❗新增：上下文严格验证
            if not self._validate_entity_context_strict(word, text):
                continue

            entity_type = self._map_pos_to_entity_type(flag)
            if entity_type:
                entity = {
                    'text': word,
                    'type': entity_type,
                    'start': start_pos,  # ✅ 使用正确位置
                    'end': end_pos,      # ✅ 使用正确位置
                    'confidence': self._calculate_entity_confidence(word, flag, text),
                    'method': 'jieba_enhanced',
                    'pos': flag
                }
                entities.append(entity)

        return entities
    
    def _validate_entity_context(self, entity: str, text: str) -> bool:
        """验证实体是否在有意义的上下文中"""
        # 获取实体前后各10个字符的上下文
        pos = text.find(entity)
        if pos == -1:
            return False

        start = max(0, pos - 10)
        end = min(len(text), pos + len(entity) + 10)
        context = text[start:end]

        # 检查上下文是否包含关键词
        context_keywords = [
            '采用', '使用', '施工', '工程', '项目', '材料',
            '设备', '规范', '标准', '要求', '质量', '成本',
            '建筑', '结构', '基础', '混凝土', '钢筋', '砂浆',
            '浇筑', '振捣', '养护', '安装', '吊装'
        ]

        return any(keyword in context for keyword in context_keywords)

    def _validate_entity_context_strict(self, entity: str, text: str) -> bool:
        """严格的上下文验证 - 要求更高门槛"""
        pos = text.find(entity)
        if pos == -1:
            return False

        # 扩大上下文窗口（从10→20字符）
        start = max(0, pos - 20)
        end = min(len(text), pos + len(entity) + 20)
        context = text[start:end]

        # ❗优化：要求至少包含1个领域关键词（从2降低到1，提高召回率）
        domain_keywords = [
            '工程', '施工', '建筑', '结构', '基础', '主体',
            '混凝土', '钢筋', '砂浆', '材料', '设备',
            '规范', '标准', '质量', '验收', '成本',
            '造价', '清单', '定额', '计价', '估算',
            '项目', '设计', '图纸', '方案', '技术',
            '施工图', '工程量', '单价', '合价', '措施费',
            '安全', '文明施工', '临时设施', '脚手架',
            '模板', '支撑', '钢筋工程', '混凝土工程',
            # 新增：数量、单位、供应商等相关词（提高实体识别率）
            '平方米', '立方米', '吨', '米', '元',
            '供应商', '租赁', '费用', '公司', '集团', '总价'
        ]

        keyword_count = sum(1 for kw in domain_keywords if kw in context)

        # ❗优化：至少包含1个关键词即可（从2降低到1）
        if keyword_count < 1:
            return False

        # ❗新增：检查实体是否在句子开头/结尾（可能是截断）
        import re
        # 检查实体前后是否紧邻其他汉字（无空格/标点）
        if pos > 0:
            prev_char = context[context.find(entity) - 1] if context.find(entity) > 0 else ''
            # 如果前面是汉字/字母/数字，可能被截断
            if prev_char and prev_char.isalnum():
                return False

        if pos + len(entity) < len(text):
            next_pos = context.find(entity) + len(entity)
            next_char = context[next_pos] if next_pos < len(context) else ''
            # 如果后面是汉字/字母/数字，可能被截断
            if next_char and next_char.isalnum():
                return False

        return True

    def _is_valid_entity(self, entity: str) -> bool:
        """质量检查：判断实体是否有效 - 优化：放宽长度要求"""
        import re

        # 1. 基本长度检查（优化：降低到3字符以捕获"塔吊"、"钢筋"等）
        if len(entity) < 3 or len(entity) > 50:
            return False

        # 2. 过滤纯数字
        if entity.isdigit():
            return False

        # 3. 过滤纯标点符号
        if all(not c.isalnum() for c in entity):
            return False

        # 4. 黑名单检查（已在外层检查，这里作为二次保险）
        if entity in self.blacklist:
            return False

        # 5. ❗新增：开头截断检测（以连接词开头的词组通常被截断）
        truncation_starts = ['及', '和', '与', '或', '为', '的', '了', '等', '并', '但', '而']
        if entity[0] in truncation_starts:
            return False

        # 6. 结尾截断检测（加强：提高长度阈值）
        truncation_ends = ['或', '和', '及', '与', '的', '了', '为', '等', '并', '但', '而']
        if entity[-1] in truncation_ends and len(entity) <= 6:
            return False

        # 7. ❗新增：关键词不完整检测
        incomplete_patterns = [
            ('量', ['工程量', '数量', '计量']),  # "量清单" → 应该是"工程量清单"
            ('理', ['监理', '管理', '处理']),    # "理或造价" → 应该是"监理或造价"
            ('师', ['工程师', '建造师', '设计师']),  # "师暂定" → 应该是"工程师暂定"
            ('区', ['区域', '地区', '小区']),    # "公共区" → 应该是"公共区域"
            ('费', ['费用', '造价']),           # 单字"费" → 应该是"费用"
        ]
        for short, full_list in incomplete_patterns:
            if entity.startswith(short):
                # 检查是否是完整词
                is_complete = any(entity.startswith(full) for full in full_list)
                if not is_complete and len(entity) - len(short) < 3:
                    return False  # 后缀太短，可能是截断

        # 8. ❗新增：包含过多连接词（可能是短语而非实体）
        connectors = ['及', '和', '与', '或', '的']
        connector_count = sum(entity.count(c) for c in connectors)
        if connector_count >= 2:  # 包含2个以上连接词
            return False

        # 9. 过滤包含过多标点的词组
        punct_count = sum(1 for c in entity if not c.isalnum())
        if punct_count > len(entity) / 3:  # 标点超过1/3
            return False

        # 10. 检测无意义的模式（如"的的"、"等等"）
        if re.search(r'(.)\1{2,}', entity):  # 3个以上重复字符
            return False

        # 11. ❗新增：数字占比过高（如"73号楼"中"73"占比高）
        digit_count = sum(c.isdigit() for c in entity)
        if digit_count > len(entity) / 2:  # 数字超过一半
            return False

        return True
    
    def _calculate_entity_confidence(self, word: str, pos: str, text: str = None) -> float:
        """计算实体置信度（改进版 - 多因素动态评分）"""
        confidence = 0.5  # 基础置信度

        # 1. 长度因素（更细粒度）
        word_len = len(word)
        if word_len >= 6:
            confidence += 0.25  # 长词组通常更有意义
        elif word_len >= 4:
            confidence += 0.15
        elif word_len == 3:
            confidence += 0.05

        # 2. 词性因素
        if pos in ['nr', 'ns', 'nt', 'nz']:  # 专名（人名、地名、机构名）
            confidence += 0.2
        elif pos in ['n', 'vn']:  # 普通名词
            confidence += 0.1
        elif pos in ['v']:  # 动词
            confidence += 0.05

        # 3. 白名单加成（如果在白名单中，给予高分）
        if word in self.whitelist:
            confidence += 0.3

        # 4. 文档频率因素（频繁出现的词可能更重要）
        if text:
            word_freq = text.count(word)
            if word_freq >= 5:
                confidence += 0.1
            elif word_freq >= 3:
                confidence += 0.05

        # 5. 专业性检测（包含专业术语片段）
        professional_patterns = [
            '混凝土', '钢筋', '水泥', '砂浆', '工程', '施工',
            '浇筑', '振捣', '养护', '规范', '标准', '验收',
            '质量', '成本', '造价', '清单', '定额', '计价'
        ]
        if any(pattern in word for pattern in professional_patterns):
            confidence += 0.1

        # 6. 惩罚因素：包含泛化词会降低置信度
        generic_words = ['一般', '特殊', '其他', '相关', '所有', '任何']
        if any(generic in word for generic in generic_words):
            confidence -= 0.15

        # 确保置信度在0.3-0.95之间
        return max(0.3, min(confidence, 0.95))

    def _map_pos_to_entity_type(self, pos_flag: str) -> Optional[str]:
        """将词性映射到实体类型"""
        pos_mapping = {
            'nr': 'person',       # 人名
            'ns': 'location',     # 地名
            'nt': 'organization', # 机构名
            'nz': 'product',      # 其他专名
            'm': 'metric',        # 数词
            't': 'time',          # 时间词
            'eng': 'technology',  # 英文词
            'n': 'generic',       # 普通名词
        }
        return pos_mapping.get(pos_flag)

    async def _merge_entities(
        self,
        rule_entities: List[Dict],
        jieba_entities: List[Dict]
    ) -> List[Dict]:
        """合并不同方法提取的实体"""
        merged = defaultdict(list)

        # 按实体文本分组
        for entity in rule_entities + jieba_entities:
            key = (entity['text'].lower(), entity['type'])
            merged[key].append(entity)

        # 合并重复实体，选择最高置信度
        result = []
        for (text, entity_type), entity_list in merged.items():
            best_entity = max(entity_list, key=lambda x: x['confidence'])

            # 如果有多个方法都提取到了，提高置信度
            if len(entity_list) > 1:
                best_entity['confidence'] = min(0.95, best_entity['confidence'] + 0.1)
                best_entity['method'] = 'hybrid'

            result.append(best_entity)

        return result

    async def _deduplicate_entities(self, entities: List[Dict]) -> List[Dict]:
        """去重实体"""
        seen = set()
        deduplicated = []

        for entity in entities:
            key = (entity['text'].lower(), entity['type'], entity['start'])
            if key not in seen:
                seen.add(key)
                deduplicated.append(entity)

        return deduplicated

    async def extract_relations(
        self,
        text: str,
        entities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        从文本中提取关系

        Args:
            text: 输入文本
            entities: 已识别的实体列表

        Returns:
            提取的关系列表
        """
        try:
            relations = []

            # 简化模式：使用精简关系提取器
            if self.simplified_mode:
                logger.info("使用简化模式提取关系")
                # 转换实体格式
                from app.services.simplified_kg_extractor import Entity
                entity_objects = [
                    Entity(
                        name=e['text'],
                        type=e['type'],
                        confidence=e['confidence'],
                        source_text=e.get('source_text', ''),
                        position=(e['start'], e['end'])
                    )
                    for e in entities
                ]
                
                extracted = self.relation_extractor.extract_relations(
                    text, entity_objects, max_relations=8
                )
                
                # 转换为统一格式
                relations = [
                    {
                        'source': {'text': r.source, 'type': 'unknown'},
                        'target': {'text': r.target, 'type': 'unknown'},
                        'type': r.type,
                        'confidence': r.confidence,
                        'context': r.source_text,
                        'method': 'simplified'
                    }
                    for r in extracted
                ]
            else:
                # 完整模式：使用原有方法
                # 基于规则的关系抽取
                rule_relations = await self._extract_relations_by_rules(text, entities)
                relations.extend(rule_relations)

                # 基于共现的关系抽取
                cooccurrence_relations = await self._extract_relations_by_cooccurrence(text, entities)
                relations.extend(cooccurrence_relations)

                # 去重关系
                relations = await self._deduplicate_relations(relations)

            logger.info(f"从文本中提取了 {len(relations)} 个关系")
            return relations

        except Exception as e:
            logger.error(f"关系提取失败: {str(e)}")
            return []

    async def _extract_relations_by_rules(
        self,
        text: str,
        entities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """基于规则提取关系"""
        relations = []

        for relation_type, pattern in self.relation_patterns.items():
            matches = re.finditer(pattern, text)

            for match in matches:
                # 查找关系词附近的关键词
                start_pos = max(0, match.start() - 50)
                end_pos = min(len(text), match.end() + 50)
                context = text[start_pos:end_pos]

                # 在上下文中查找实体
                related_entities = []
                for entity in entities:
                    if start_pos <= entity['start'] <= end_pos:
                        related_entities.append(entity)

                # 如果找到至少两个实体，创建关系
                if len(related_entities) >= 2:
                    relation = {
                        'source': related_entities[0],
                        'target': related_entities[1],
                        'type': relation_type,
                        'confidence': 0.7,
                        'context': context,
                        'method': 'rule_based'
                    }
                    relations.append(relation)

        return relations

    async def _extract_relations_by_cooccurrence(
        self,
        text: str,
        entities: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """基于共现提取关系（修复版 - 正确的句子定位）"""
        relations = []

        # 在同一句话中共现的实体
        sentences = re.split(r'[。！？\n]', text)

        # ❗修复：记录每个句子在原文中的位置
        sentence_positions = []
        current_offset = 0
        for sentence in sentences:
            if sentence.strip():  # 跳过空句子
                start_pos = text.find(sentence, current_offset)
                if start_pos != -1:
                    end_pos = start_pos + len(sentence)
                    sentence_positions.append({
                        'text': sentence,
                        'start': start_pos,
                        'end': end_pos
                    })
                    current_offset = end_pos

        # 为每个句子查找包含的实体
        for sent_info in sentence_positions:
            sentence_entities = []
            for entity in entities:
                # ✅ 修复：使用正确的位置判断实体是否在句子中
                if sent_info['start'] <= entity['start'] and \
                   entity['end'] <= sent_info['end']:
                    sentence_entities.append(entity)

            # 为共现实体的每对创建关系
            for i in range(len(sentence_entities)):
                for j in range(i + 1, len(sentence_entities)):
                    entity1, entity2 = sentence_entities[i], sentence_entities[j]

                    # 根据实体类型推断关系
                    relation_type = self._infer_relation_type(entity1, entity2)

                    relation = {
                        'source': entity1,
                        'target': entity2,
                        'type': relation_type,
                        'confidence': 0.5,
                        'context': sent_info['text'],
                        'method': 'cooccurrence'
                    }
                    relations.append(relation)

        return relations

    def _infer_relation_type(self, entity1: Dict, entity2: Dict) -> str:
        """根据实体类型推断关系类型（同步方法，不需要异步）"""
        type1, type2 = entity1['type'], entity2['type']

        # 定义实体类型之间的关系映射
        relation_map = {
            ('person', 'organization'): 'work_for',
            ('organization', 'person'): 'employ',
            ('person', 'location'): 'located_in',
            ('organization', 'location'): 'located_in',
            ('project', 'organization'): 'owned_by',
            ('organization', 'project'): 'own',
            ('material', 'project'): 'used_in',
            ('project', 'material'): 'use',
            ('technology', 'project'): 'implement_in',
            ('project', 'technology'): 'implement',
            ('cost', 'project'): 'cost_of',
            ('project', 'cost'): 'have_cost',
        }

        return relation_map.get((type1, type2), 'related_to')

    async def _deduplicate_relations(self, relations: List[Dict]) -> List[Dict]:
        """去重关系"""
        seen = set()
        deduplicated = []

        for relation in relations:
            # 创建关系的唯一标识
            source_text = relation['source']['text'].lower()
            target_text = relation['target']['text'].lower()
            relation_type = relation['type']

            key = (source_text, target_text, relation_type)
            reverse_key = (target_text, source_text, relation_type)

            if key not in seen and reverse_key not in seen:
                seen.add(key)
                deduplicated.append(relation)

        return deduplicated

    async def create_knowledge_node(
        self,
        entity_data: EntityCreate,
        user_id: int,
        db: AsyncSession
    ) -> KnowledgeNode:
        """
        创建知识节点

        Args:
            entity_data: 实体数据
            user_id: 用户ID (保留参数但不使用，因为表结构不包含user_id字段)
            db: 数据库会话

        Returns:
            创建的知识节点
        """
        try:
            # 检查节点是否已存在（不检查user_id，因为表中没有此字段）
            existing = await db.execute(
                select(KnowledgeNode).where(
                    and_(
                        KnowledgeNode.name == entity_data.name,
                        KnowledgeNode.node_type == entity_data.type
                    )
                )
            )
            existing_node = existing.scalar_one_or_none()

            if existing_node:
                # 节点已存在，直接返回
                return existing_node

            node_properties = dict(entity_data.properties or {})
            if getattr(entity_data, "metadata", None):
                node_properties["metadata"] = entity_data.metadata

            # 创建新节点（不包含user_id，因为表中没有此字段）
            node = KnowledgeNode(
                name=entity_data.name,
                node_type=entity_data.type,
                properties=node_properties,
                confidence=entity_data.confidence,
                source_type=getattr(entity_data, "source", None)
            )

            db.add(node)
            await db.commit()
            await db.refresh(node)

            # 在Neo4j中创建节点
            await self._create_neo4j_node(node)

            logger.info(f"创建知识节点: {node.name} ({node.node_type})")
            return node

        except Exception as e:
            logger.error(f"创建知识节点失败: {str(e)}")
            await db.rollback()
            raise

    async def _create_neo4j_node(self, node: KnowledgeNode):
        """在Neo4j中创建节点"""
        try:
            if not self.neo4j_driver:
                await self.connect_neo4j()

            with self.neo4j_driver.session() as session:
                query = """
                CREATE (n:Entity {
                    id: $id,
                    name: $name,
                    type: $type,
                    properties: $properties,
                    confidence: $confidence,
                    source: $source,
                    created_at: $created_at
                })
                """

                session.run(query, {
                    'id': node.id,
                    'name': node.name,
                    'type': node.node_type,
                    'properties': json.dumps(node.properties or {}),
                    'confidence': node.confidence,
                    'source': getattr(node, "source_type", None),
                    'created_at': (node.created_at or datetime.utcnow()).isoformat()
                })

        except Exception as e:
            logger.error(f"在Neo4j中创建节点失败: {str(e)}")

    async def create_knowledge_relation(
        self,
        relation_data: RelationCreate,
        user_id: int,
        db: AsyncSession
    ) -> KnowledgeRelation:
        """
        创建知识关系

        Args:
            relation_data: 关系数据
            user_id: 用户ID (保留参数但不使用，因为表结构不包含user_id字段)
            db: 数据库会话

        Returns:
            创建的知识关系
        """
        try:
            # 检查源节点和目标节点是否存在（不检查user_id）
            source_result = await db.execute(
                select(KnowledgeNode).where(
                    KnowledgeNode.id == relation_data.source_node_id
                )
            )
            source_node = source_result.scalar_one_or_none()

            target_result = await db.execute(
                select(KnowledgeNode).where(
                    KnowledgeNode.id == relation_data.target_node_id
                )
            )
            target_node = target_result.scalar_one_or_none()

            if not source_node or not target_node:
                raise ValueError("源节点或目标节点不存在")

            # 检查关系是否已存在（不检查user_id）
            existing = await db.execute(
                select(KnowledgeRelation).where(
                    and_(
                        KnowledgeRelation.source_node_id == relation_data.source_node_id,
                        KnowledgeRelation.target_node_id == relation_data.target_node_id,
                        KnowledgeRelation.relation_type == relation_data.type
                    )
                )
            )
            existing_relation = existing.scalar_one_or_none()

            if existing_relation:
                # 关系已存在，直接返回
                return existing_relation

            relation_properties = dict(relation_data.properties or {})
            if relation_data.metadata:
                relation_properties["metadata"] = relation_data.metadata

            # 创建新关系（不包含user_id）
            relation = KnowledgeRelation(
                source_node_id=relation_data.source_node_id,
                target_node_id=relation_data.target_node_id,
                relation_type=relation_data.type,
                properties=relation_properties,
                confidence=relation_data.confidence,
                source_type=relation_data.source,
                context=relation_data.context
            )

            db.add(relation)
            await db.commit()
            await db.refresh(relation)

            # 在Neo4j中创建关系
            await self._create_neo4j_relation(relation, source_node, target_node)

            logger.info(f"创建知识关系: {source_node.name} -> {target_node.name} ({relation.relation_type})")
            return relation

        except Exception as e:
            logger.error(f"创建知识关系失败: {str(e)}")
            await db.rollback()
            raise

    async def _create_neo4j_relation(
        self,
        relation: KnowledgeRelation,
        source_node: KnowledgeNode,
        target_node: KnowledgeNode
    ):
        """在Neo4j中创建关系（不使用user_id，因为表中没有此字段）"""
        try:
            if not self.neo4j_driver:
                await self.connect_neo4j()

            with self.neo4j_driver.session() as session:
                query = """
                MATCH (source:Entity {id: $source_id}), (target:Entity {id: $target_id})
                CREATE (source)-[r:RELATION {
                    id: $id,
                    type: $type,
                    properties: $properties,
                    confidence: $confidence,
                    source: $source,
                    context: $context,
                    created_at: $created_at
                }]->(target)
                """

                session.run(query, {
                    'source_id': source_node.id,
                    'target_id': target_node.id,
                    'id': relation.id,
                    'type': relation.relation_type,
                    'properties': json.dumps(relation.properties or {}),
                    'confidence': relation.confidence,
                    'source': relation.source_type,
                    'context': relation.context,
                    'created_at': (relation.created_at or datetime.utcnow()).isoformat()
                })

        except Exception as e:
            logger.error(f"在Neo4j中创建关系失败: {str(e)}")

    def _match_entity_for_relation(
        self,
        relation_entity_text: str,
        node_name_to_id: Dict[str, int],
        all_node_names: List[str]
    ) -> Optional[int]:
        """
        改进的实体匹配算法（支持模糊匹配）

        Args:
            relation_entity_text: 关系中的实体文本
            node_name_to_id: 节点名称到ID的映射
            all_node_names: 所有节点名称列表

        Returns:
            匹配到的节点ID，如果未匹配返回None
        """
        from difflib import SequenceMatcher

        # 1. 精确匹配
        if relation_entity_text in node_name_to_id:
            return node_name_to_id[relation_entity_text]

        # 2. 包含匹配（互相包含）
        for node_name, node_id in node_name_to_id.items():
            if relation_entity_text in node_name or node_name in relation_entity_text:
                # 计算相似度
                similarity = SequenceMatcher(None, node_name, relation_entity_text).ratio()
                if similarity >= 0.75:  # 75%以上相似度
                    logger.debug(f"包含匹配成功: '{relation_entity_text}' → '{node_name}' (相似度: {similarity:.2f})")
                    return node_id

        # 3. 去除停用词后匹配
        def remove_stopwords(text):
            for stopword in self.stopwords:
                text = text.replace(stopword, '')
            return text

        normalized_target = remove_stopwords(relation_entity_text)
        for node_name, node_id in node_name_to_id.items():
            normalized_node = remove_stopwords(node_name)
            if normalized_target == normalized_node:
                logger.debug(f"去停用词匹配成功: '{relation_entity_text}' → '{node_name}'")
                return node_id

        # 4. 编辑距离匹配（针对相似但不完全相同的实体）
        best_match = None
        best_similarity = 0.7  # 最低阈值

        for node_name in all_node_names:
            similarity = SequenceMatcher(None, node_name, relation_entity_text).ratio()
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = node_name

        if best_match:
            logger.debug(f"编辑距离匹配成功: '{relation_entity_text}' → '{best_match}' (相似度: {best_similarity:.2f})")
            return node_name_to_id[best_match]

        # 5. 未匹配到
        logger.debug(f"实体匹配失败: '{relation_entity_text}' (尝试了4种匹配策略)")
        return None

    async def process_document_knowledge(
        self,
        document_id: int,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        处理文档，提取知识并构建图谱（增强版 - 全局节点映射 + 模糊匹配）

        Args:
            document_id: 文档ID
            user_id: 用户ID
            db: 数据库会话

        Returns:
            处理结果统计
        """
        try:
            # 获取文档内容
            document_result = await db.execute(
                select(Document).where(
                    and_(
                        Document.id == document_id,
                        Document.uploaded_by == user_id
                    )
                )
            )
            document = document_result.scalar_one_or_none()

            if not document:
                raise ValueError("文档不存在")

            # 获取文档分块
            chunks_result = await db.execute(
                select(DocumentChunk).where(DocumentChunk.document_id == document_id)
            )
            chunks = chunks_result.scalars().all()

            if not chunks:
                raise ValueError("文档没有分块内容")

            # 统计结果
            total_entities = 0
            total_relations = 0
            total_nodes = 0
            total_edges = 0
            match_failed_count = 0  # 匹配失败计数

            # ❗新增：全局节点映射（解决跨chunk匹配问题）
            global_node_map = {}  # {entity_text: node_id}

            logger.info(f"开始处理文档 {document_id}，共 {len(chunks)} 个分块")

            # ❗第一遍：提取并创建所有节点
            for idx, chunk in enumerate(chunks, 1):
                logger.debug(f"处理分块 {idx}/{len(chunks)}")

                # 提取实体
                entities = await self.extract_entities(chunk.content)
                logger.debug(f"分块 {idx} 提取到 {len(entities)} 个实体")

                # 创建节点
                for entity_data in entities:
                    entity_create = EntityCreate(
                        name=entity_data['text'],
                        type=entity_data['type'],
                        properties={'method': entity_data['method']},
                        confidence=entity_data['confidence'],
                        source=f"document_{document_id}_chunk_{chunk.id}"
                    )

                    try:
                        node = await self.create_knowledge_node(entity_create, user_id, db)
                        global_node_map[entity_data['text']] = node.id
                        total_nodes += 1
                    except Exception as e:
                        logger.warning(f"创建节点失败 '{entity_data['text']}': {str(e)}")

                total_entities += len(entities)

            logger.info(f"第一遍完成：创建了 {total_nodes} 个节点")

            # ❗新增：为所有节点自动分配领域
            domain_service = DomainService(db)
            classified_count = 0
            total_domain_mappings = 0

            logger.info(f"开始为 {total_nodes} 个节点分配领域...")
            for entity_text, node_id in global_node_map.items():
                try:
                    # 获取节点
                    node_result = await db.execute(
                        select(KnowledgeNode).where(KnowledgeNode.id == node_id)
                    )
                    node = node_result.scalar_one_or_none()

                    if node:
                        # 分类
                        domain_assignments = await domain_service.classify_node_by_rules(node)

                        if domain_assignments:
                            # 分配领域
                            count = await domain_service.assign_domains_to_node(
                                node.id,
                                domain_assignments,
                                method="rule"
                            )
                            classified_count += 1
                            total_domain_mappings += count

                except Exception as e:
                    logger.warning(f"节点 {node_id} 领域分类失败: {str(e)}")

            logger.info(
                f"领域分类完成：{classified_count}/{total_nodes} 个节点已分类，"
                f"共创建 {total_domain_mappings} 个领域映射"
            )

            # ❗第二遍：提取并创建关系（使用全局节点映射 + 模糊匹配）
            all_node_names = list(global_node_map.keys())

            for idx, chunk in enumerate(chunks, 1):
                # 重新提取实体（用于关系提取）
                entities = await self.extract_entities(chunk.content)

                # 提取关系
                relations = await self.extract_relations(chunk.content, entities)
                logger.debug(f"分块 {idx} 提取到 {len(relations)} 个关系")

                # 创建关系
                for relation_data in relations:
                    source_text = relation_data['source']['text']
                    target_text = relation_data['target']['text']

                    # ❗使用改进的匹配算法（模糊匹配）
                    source_node_id = self._match_entity_for_relation(
                        source_text,
                        global_node_map,
                        all_node_names
                    )
                    target_node_id = self._match_entity_for_relation(
                        target_text,
                        global_node_map,
                        all_node_names
                    )

                    # 如果找到了两个节点，创建关系
                    if source_node_id and target_node_id:
                        # 跳过自环关系
                        if source_node_id == target_node_id:
                            logger.debug(f"跳过自环关系: {source_text}")
                            continue

                        relation_create = RelationCreate(
                            source_node_id=source_node_id,
                            target_node_id=target_node_id,
                            type=relation_data['type'],
                            properties={'method': relation_data['method']},
                            confidence=relation_data['confidence'],
                            source=f"document_{document_id}_chunk_{chunk.id}",
                            context=relation_data.get('context', '')
                        )

                        try:
                            await self.create_knowledge_relation(relation_create, user_id, db)
                            total_edges += 1
                        except Exception as e:
                            logger.warning(f"创建关系失败 {source_text}→{target_text}: {str(e)}")
                    else:
                        match_failed_count += 1
                        logger.debug(
                            f"关系匹配失败: {source_text} → {target_text} "
                            f"(source_found={source_node_id is not None}, "
                            f"target_found={target_node_id is not None})"
                        )

                total_relations += len(relations)

            # 计算匹配成功率
            match_rate = total_edges / total_relations if total_relations > 0 else 0

            result = {
                'document_id': document_id,
                'chunks_processed': len(chunks),
                'entities_extracted': total_entities,
                'relations_extracted': total_relations,
                'nodes_created': total_nodes,
                'edges_created': total_edges,
                'match_rate': f"{match_rate:.1%}",  # 匹配成功率
                'match_failed_count': match_failed_count,
                'classified_nodes': classified_count,  # 已分类节点数
                'domain_mappings': total_domain_mappings,  # 领域映射数
                'processing_time': datetime.utcnow().isoformat()
            }

            logger.info(
                f"文档 {document_id} 知识处理完成: "
                f"节点 {total_nodes}, 关系 {total_edges}/{total_relations} (成功率: {match_rate:.1%})"
            )
            return result

        except Exception as e:
            logger.error(f"处理文档知识失败: {str(e)}")
            raise

    async def search_knowledge(
        self,
        query: str,
        max_results: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        expand_relations: bool = True,
        db: Optional[AsyncSession] = None
    ) -> Dict[str, Any]:
        """
        基础语义搜索知识图谱（用于智能问答RAG检索）

        Args:
            query: 搜索查询字符串
            max_results: 返回的最大结果数
            filters: 过滤条件（node_type, min_confidence等）
            expand_relations: 是否扩展关系（1跳查询）
            db: 数据库会话

        Returns:
            {
                "results": [
                    {
                        "node_id": int,
                        "name": str,
                        "type": str,
                        "properties": dict,
                        "relationships": list,  # 如果expand_relations=True
                        "score": float,  # 相关性分数
                        "explanation": str  # 匹配说明
                    }
                ],
                "total": int
            }
        """
        try:
            if not db:
                # 如果没有传入db会话，使用自己的会话（需要导入）
                from app.db.session import AsyncSessionLocal
                async with AsyncSessionLocal() as db:
                    return await self._search_knowledge_impl(query, max_results, filters, expand_relations, db)
            else:
                return await self._search_knowledge_impl(query, max_results, filters, expand_relations, db)
        except Exception as e:
            logger.error(f"知识图谱搜索失败: {str(e)}")
            return {"results": [], "total": 0}

    async def _search_knowledge_impl(
        self,
        query: str,
        max_results: int,
        filters: Optional[Dict[str, Any]],
        expand_relations: bool,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """实现知识搜索逻辑"""
        from sqlalchemy.orm import selectinload

        # 1. 构建基础查询（节点名称模糊匹配）
        search_query = select(KnowledgeNode)

        # 关键词分词（提取查询中的关键实体）
        keywords = self._extract_query_keywords(query)

        # 构建OR条件（匹配任意关键词）
        if keywords:
            name_conditions = [
                KnowledgeNode.name.ilike(f"%{keyword}%")
                for keyword in keywords
            ]
            search_query = search_query.where(or_(*name_conditions))
        else:
            # 如果没有关键词，使用原始查询
            search_query = search_query.where(
                KnowledgeNode.name.ilike(f"%{query}%")
            )

        # 2. 应用过滤条件
        if filters:
            if 'node_type' in filters:
                node_types = filters['node_type'] if isinstance(filters['node_type'], list) else [filters['node_type']]
                search_query = search_query.where(KnowledgeNode.node_type.in_(node_types))

            if 'min_confidence' in filters:
                search_query = search_query.where(
                    KnowledgeNode.confidence >= filters['min_confidence']
                )

            if 'min_quality_score' in filters and filters['min_quality_score'] is not None:
                search_query = search_query.where(
                    KnowledgeNode.quality_score >= filters['min_quality_score']
                )

            # ❗新增：领域过滤
            if 'domain_code' in filters or 'domain_codes' in filters:
                from app.models.domain import NodeDomainMapping, KnowledgeDomain

                domain_codes = filters.get('domain_codes') or [filters.get('domain_code')]
                domain_codes = [code for code in domain_codes if code]  # 过滤None

                if domain_codes:
                    # 子查询：查找属于指定领域的节点ID
                    domain_subquery = (
                        select(NodeDomainMapping.node_id)
                        .join(KnowledgeDomain)
                        .where(KnowledgeDomain.domain_code.in_(domain_codes))
                    )
                    search_query = search_query.where(
                        KnowledgeNode.id.in_(domain_subquery)
                    )

        # 3. 执行查询并限制结果数
        search_query = search_query.limit(max_results * 2)  # 先查询更多，后面过滤
        result = await db.execute(search_query)
        nodes = result.scalars().all()

        # 4. 计算相关性分数并排序
        scored_nodes = []
        for node in nodes:
            score = self._calculate_relevance_score(query, keywords, node)
            scored_nodes.append((node, score))

        # 按分数降序排序
        scored_nodes.sort(key=lambda x: x[1], reverse=True)
        scored_nodes = scored_nodes[:max_results]

        # 5. 构建结果（可选：扩展关系和领域信息）
        results = []
        for node, score in scored_nodes:
            node_data = {
                "node_id": node.id,
                "name": node.name,
                "type": node.node_type,
                "properties": node.properties or {},
                "score": score,
                "explanation": self._generate_match_explanation(query, keywords, node)
            }

            # 扩展关系（1跳查询）
            if expand_relations:
                relations = await self._get_node_relations(node.id, db)
                node_data["relationships"] = relations
            else:
                node_data["relationships"] = []

            # ❗新增：添加领域信息
            try:
                domain_service = DomainService(db)
                domains = await domain_service.get_node_domains(node.id)
                node_data["domains"] = domains
            except Exception as e:
                logger.warning(f"获取节点 {node.id} 的领域信息失败: {str(e)}")
                node_data["domains"] = []

            results.append(node_data)

        return {
            "results": results,
            "total": len(results)
        }

    def _extract_query_keywords(self, query: str) -> List[str]:
        """从查询中提取关键词"""
        # 使用jieba分词
        words = list(jieba.cut(query))

        # 过滤停用词和短词
        keywords = [
            word for word in words
            if len(word) >= 2 and word not in self.stopwords
        ]

        # 限制关键词数量（最多5个）
        return keywords[:5]

    def _calculate_relevance_score(
        self,
        query: str,
        keywords: List[str],
        node: KnowledgeNode
    ) -> float:
        """计算节点与查询的相关性分数（0-1）"""
        score = 0.0
        node_name = node.name.lower()
        query_lower = query.lower()

        # 1. 完全匹配得分（最高）
        if query_lower == node_name:
            score += 1.0
        elif query_lower in node_name or node_name in query_lower:
            # 包含关系
            score += 0.7

        # 2. 关键词匹配得分
        if keywords:
            matched_keywords = sum(1 for kw in keywords if kw.lower() in node_name)
            keyword_score = matched_keywords / len(keywords)
            score += keyword_score * 0.5

        # 3. 节点类型加权（某些类型更重要）
        type_weights = {
            'project': 1.2,
            'material': 1.1,
            'equipment': 1.1,
            'cost': 1.15,
            'standard': 1.0,
            'concept': 0.9,
            'entity': 0.8
        }
        type_weight = type_weights.get(node.node_type, 1.0)
        score *= type_weight

        # 4. 节点质量分数加权
        if node.quality_score and node.quality_score > 0:
            score *= (0.8 + 0.2 * node.quality_score)  # 质量分数影响20%

        # 5. 节点置信度加权
        if node.confidence and node.confidence > 0:
            score *= (0.9 + 0.1 * node.confidence)  # 置信度影响10%

        # 归一化到0-1
        return min(score, 1.0)

    def _generate_match_explanation(
        self,
        query: str,
        keywords: List[str],
        node: KnowledgeNode
    ) -> str:
        """生成匹配说明"""
        explanations = []

        node_name = node.name.lower()
        query_lower = query.lower()

        if query_lower == node_name:
            explanations.append(f"完全匹配查询'{query}'")
        elif query_lower in node_name:
            explanations.append(f"节点名称包含'{query}'")
        elif node_name in query_lower:
            explanations.append(f"查询包含节点名称'{node.name}'")

        if keywords:
            matched_keywords = [kw for kw in keywords if kw.lower() in node_name]
            if matched_keywords:
                explanations.append(f"匹配关键词: {', '.join(matched_keywords)}")

        if not explanations:
            explanations.append("模糊匹配")

        return " | ".join(explanations)

    async def _get_node_relations(
        self,
        node_id: int,
        db: AsyncSession,
        max_relations: int = 5
    ) -> List[Dict[str, Any]]:
        """获取节点的关系（1跳查询）"""
        from sqlalchemy.orm import selectinload

        # 查询出边（该节点作为source）
        outgoing_query = select(KnowledgeRelation).options(
            selectinload(KnowledgeRelation.target_node)
        ).where(
            KnowledgeRelation.source_node_id == node_id
        ).limit(max_relations)

        # 查询入边（该节点作为target）
        incoming_query = select(KnowledgeRelation).options(
            selectinload(KnowledgeRelation.source_node)
        ).where(
            KnowledgeRelation.target_node_id == node_id
        ).limit(max_relations)

        outgoing_result = await db.execute(outgoing_query)
        incoming_result = await db.execute(incoming_query)

        outgoing_relations = outgoing_result.scalars().all()
        incoming_relations = incoming_result.scalars().all()

        relations = []

        # 处理出边
        for rel in outgoing_relations:
            if rel.target_node:
                relations.append({
                    "direction": "outgoing",
                    "relation_type": rel.relation_type,
                    "related_node": {
                        "id": rel.target_node.id,
                        "name": rel.target_node.name,
                        "type": rel.target_node.node_type
                    }
                })

        # 处理入边
        for rel in incoming_relations:
            if rel.source_node:
                relations.append({
                    "direction": "incoming",
                    "relation_type": rel.relation_type,
                    "related_node": {
                        "id": rel.source_node.id,
                        "name": rel.source_node.name,
                        "type": rel.source_node.node_type
                    }
                })

        return relations[:max_relations]

    async def query_knowledge_graph(
        self,
        query_request: GraphQueryRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        查询知识图谱

        Args:
            query_request: 查询请求
            user_id: 用户ID
            db: 数据库会话

        Returns:
            查询结果
        """
        try:
            if query_request.query_type == "node_search":
                return await self._search_nodes(query_request, user_id, db)
            elif query_request.query_type == "relation_search":
                return await self._search_relations(query_request, user_id, db)
            elif query_request.query_type == "path_search":
                return await self._search_paths(query_request, user_id, db)
            elif query_request.query_type == "cypher":
                return await self._execute_cypher_query(query_request, user_id)
            else:
                raise ValueError(f"不支持的查询类型: {query_request.query_type}")

        except Exception as e:
            logger.error(f"查询知识图谱失败: {str(e)}")
            raise

    async def _search_nodes(
        self,
        query_request: GraphQueryRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """搜索节点"""
        # 注意：知识节点的user_id字段可能不存在（旧表结构）
        # 暂时不过滤user_id，显示所有用户的知识节点
        query = select(KnowledgeNode)

        # 添加过滤条件
        if query_request.node_type:
            query = query.where(KnowledgeNode.node_type == query_request.node_type)

        if query_request.search_term:
            search_pattern = f"%{query_request.search_term}%"
            query = query.where(KnowledgeNode.name.ilike(search_pattern))

        if query_request.min_confidence:
            query = query.where(KnowledgeNode.confidence >= query_request.min_confidence)

        # 执行查询
        result = await db.execute(query)
        nodes = result.scalars().all()

        return {
            'nodes': [
                {
                    'id': node.id,
                    'name': node.name,
                    'type': node.node_type,  # 使用node_type而不是type别名
                    'properties': node.properties,
                    'confidence': node.confidence,
                    'source': node.source_type,  # 使用source_type而不是source别名
                    'created_at': node.created_at
                }
                for node in nodes
            ],
            'total': len(nodes)
        }

    async def _search_relations(
        self,
        query_request: GraphQueryRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """搜索关系（改进版 - 使用eager loading）"""
        from sqlalchemy.orm import selectinload

        # 注意：知识关系的user_id字段可能不存在（旧表结构）
        # 暂时不过滤user_id，显示所有用户的知识关系
        query = select(KnowledgeRelation).options(
            selectinload(KnowledgeRelation.source_node),
            selectinload(KnowledgeRelation.target_node)
        )

        # 添加过滤条件
        if query_request.relation_type:
            query = query.where(KnowledgeRelation.relation_type == query_request.relation_type)

        if query_request.source_node_id:
            query = query.where(KnowledgeRelation.source_node_id == query_request.source_node_id)

        if query_request.target_node_id:
            query = query.where(KnowledgeRelation.target_node_id == query_request.target_node_id)

        # 添加limit
        if query_request.limit:
            query = query.limit(query_request.limit)

        # 执行查询
        result = await db.execute(query)
        relations = result.scalars().all()

        # 构建返回结果（使用eager loaded的关联对象）
        relation_list = []
        for relation in relations:
            # 检查关联节点是否存在
            if relation.source_node and relation.target_node:
                relation_list.append({
                    'id': relation.id,
                    'source_node': {
                        'id': relation.source_node.id,
                        'name': relation.source_node.name,
                        'type': relation.source_node.node_type
                    },
                    'target_node': {
                        'id': relation.target_node.id,
                        'name': relation.target_node.name,
                        'type': relation.target_node.node_type
                    },
                    'type': relation.relation_type,
                    'properties': relation.properties,
                    'confidence': relation.confidence,
                    'context': relation.context,
                    'created_at': relation.created_at
                })
            else:
                # 记录缺失节点的关系（用于调试）
                logger.warning(
                    f"关系 {relation.id} 的节点缺失: "
                    f"source={relation.source_node_id}, target={relation.target_node_id}"
                )

        return {
            'relations': relation_list,
            'total': len(relation_list)
        }

    async def _search_paths(
        self,
        query_request: GraphQueryRequest,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """搜索路径"""
        if not query_request.source_node_id or not query_request.target_node_id:
            raise ValueError("路径搜索需要指定源节点和目标节点")

        try:
            if not self.neo4j_driver:
                await self.connect_neo4j()

            with self.neo4j_driver.session() as session:
                # 使用Neo4j图算法查找最短路径
                cypher_query = """
                MATCH (start:Entity {id: $source_id, user_id: $user_id}),
                      (end:Entity {id: $target_id, user_id: $user_id})
                MATCH path = shortestPath((start)-[*1..6]-(end))
                RETURN path, length(path) as path_length
                ORDER BY path_length
                LIMIT $limit
                """

                result = session.run(cypher_query, {
                    'source_id': query_request.source_node_id,
                    'target_id': query_request.target_node_id,
                    'user_id': user_id,
                    'limit': query_request.limit or 10
                })

                paths = []
                for record in result:
                    path = record['path']
                    path_length = record['path_length']

                    # 提取路径中的节点和关系
                    nodes = []
                    relations = []

                    for node in path.nodes:
                        nodes.append({
                            'id': node['id'],
                            'name': node['name'],
                            'type': node['type']
                        })

                    for rel in path.relationships:
                        relations.append({
                            'type': rel['type'],
                            'properties': json.loads(rel.get('properties', '{}')),
                            'confidence': rel['confidence']
                        })

                    paths.append({
                        'nodes': nodes,
                        'relations': relations,
                        'length': path_length
                    })

                return {
                    'paths': paths,
                    'total': len(paths)
                }

        except Exception as e:
            logger.error(f"搜索路径失败: {str(e)}")
            return {'paths': [], 'total': 0}

    async def _execute_cypher_query(
        self,
        query_request: GraphQueryRequest,
        user_id: int
    ) -> Dict[str, Any]:
        """执行Cypher查询"""
        try:
            if not self.neo4j_driver:
                await self.connect_neo4j()

            with self.neo4j_driver.session() as session:
                # 在查询中添加用户ID过滤，确保数据安全
                modified_query = query_request.cypher_query.replace(
                    "MATCH (",
                    f"MATCH (n:Entity {{user_id: {user_id}}})"
                )

                result = session.run(modified_query)

                records = []
                for record in result:
                    records.append(dict(record))

                return {
                    'records': records,
                    'total': len(records)
                }

        except Exception as e:
            logger.error(f"执行Cypher查询失败: {str(e)}")
            raise

    async def get_knowledge_statistics(
        self,
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """获取知识图谱统计信息"""
        try:
            # 节点统计（不过滤user_id，因为旧表结构可能没有此字段）
            node_count_query = select(func.count(KnowledgeNode.id))
            node_count_result = await db.execute(node_count_query)
            total_nodes = node_count_result.scalar() or 0

            # 关系统计（不过滤user_id，因为旧表结构可能没有此字段）
            relation_count_query = select(func.count(KnowledgeRelation.id))
            relation_count_result = await db.execute(relation_count_query)
            total_relations = relation_count_result.scalar() or 0

            # 按类型统计节点
            node_type_query = select(
                KnowledgeNode.type,
                func.count().label('count')
            ).group_by(KnowledgeNode.type)

            node_type_result = await db.execute(node_type_query)
            node_types = {row.type: row.count for row in node_type_result}

            # 按类型统计关系
            relation_type_query = select(
                KnowledgeRelation.relation_type,
                func.count().label('count')
            ).group_by(KnowledgeRelation.relation_type)

            relation_type_result = await db.execute(relation_type_query)
            relation_types = {row.relation_type: row.count for row in relation_type_result}

            return {
                'total_nodes': total_nodes,
                'total_relations': total_relations,
                'node_types': node_types,
                'relation_types': relation_types,
                'graph_density': (2 * total_relations) / (total_nodes * (total_nodes - 1)) if total_nodes > 1 else 0,
                'updated_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"获取知识图谱统计失败: {str(e)}")
            return {
                'total_nodes': 0,
                'total_relations': 0,
                'node_types': {},
                'relation_types': {}
            }

    async def update_node_in_neo4j(self, node_id: int, update_dict: dict):
        """在Neo4j中更新节点"""
        try:
            if not self.neo4j_driver:
                logger.warning("Neo4j驱动不可用，跳过节点更新")
                return

            with self.neo4j_driver.session() as session:
                # 构建SET子句
                set_clauses = []
                params = {'node_id': node_id}
                
                if 'name' in update_dict:
                    set_clauses.append("n.name = $name")
                    params['name'] = update_dict['name']
                
                if 'node_type' in update_dict:
                    set_clauses.append("n.type = $type")
                    params['type'] = str(update_dict['node_type'])
                
                if 'description' in update_dict:
                    set_clauses.append("n.description = $description")
                    params['description'] = update_dict['description']
                
                if 'properties' in update_dict:
                    set_clauses.append("n.properties = $properties")
                    params['properties'] = update_dict['properties']
                
                if set_clauses:
                    query = f"""
                    MATCH (n:Entity {{id: $node_id}})
                    SET {', '.join(set_clauses)}
                    RETURN n
                    """
                    session.run(query, params)
                    logger.info(f"Neo4j节点 {node_id} 更新成功")

        except Exception as e:
            logger.error(f"Neo4j节点更新失败: {str(e)}")
            raise

    async def delete_node_from_neo4j(self, node_id: int):
        """从Neo4j中删除节点"""
        try:
            if not self.neo4j_driver:
                logger.warning("Neo4j驱动不可用，跳过节点删除")
                return

            with self.neo4j_driver.session() as session:
                # 删除节点及其所有关系
                query = """
                MATCH (n:Entity {id: $node_id})
                DETACH DELETE n
                """
                session.run(query, {'node_id': node_id})
                logger.info(f"Neo4j节点 {node_id} 删除成功")

        except Exception as e:
            logger.error(f"Neo4j节点删除失败: {str(e)}")
            raise

    async def update_relation_in_neo4j(self, relation_id: int, update_dict: dict):
        """在Neo4j中更新关系"""
        try:
            if not self.neo4j_driver:
                logger.warning("Neo4j驱动不可用，跳过关系更新")
                return

            with self.neo4j_driver.session() as session:
                # 构建SET子句
                set_clauses = []
                params = {'relation_id': relation_id}
                
                if 'properties' in update_dict:
                    set_clauses.append("r.properties = $properties")
                    params['properties'] = update_dict['properties']
                
                if set_clauses:
                    query = f"""
                    MATCH ()-[r]->()
                    WHERE id(r) = $relation_id
                    SET {', '.join(set_clauses)}
                    RETURN r
                    """
                    session.run(query, params)
                    logger.info(f"Neo4j关系 {relation_id} 更新成功")

        except Exception as e:
            logger.error(f"Neo4j关系更新失败: {str(e)}")
            raise

    async def delete_relation_from_neo4j(self, relation_id: int):
        """从Neo4j中删除关系"""
        try:
            if not self.neo4j_driver:
                logger.warning("Neo4j驱动不可用，跳过关系删除")
                return

            with self.neo4j_driver.session() as session:
                # 删除关系
                query = """
                MATCH ()-[r]->()
                WHERE id(r) = $relation_id
                DELETE r
                """
                session.run(query, {'relation_id': relation_id})
                logger.info(f"Neo4j关系 {relation_id} 删除成功")

        except Exception as e:
            logger.error(f"Neo4j关系删除失败: {str(e)}")
            raise


# 全局知识图谱服务实例
knowledge_graph_service = KnowledgeGraphService()