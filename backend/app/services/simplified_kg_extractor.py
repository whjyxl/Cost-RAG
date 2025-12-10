"""
简化的知识图谱实体提取器
只提取高价值、高准确度的实体：标准规范、材料、工程类型
"""
import re
from typing import List, Dict, Set, Tuple, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class Entity:
    """实体"""
    name: str
    type: str
    confidence: float
    source_text: str
    position: Tuple[int, int]  # (start, end)


class SimplifiedKGExtractor:
    """简化的知识图谱提取器"""
    
    def __init__(self):
        """初始化提取器"""
        self._load_whitelists()
        self._compile_patterns()
        logger.info("SimplifiedKGExtractor initialized")
    
    def _load_whitelists(self):
        """加载白名单"""
        # 材料白名单
        self.material_whitelist = {
            # 混凝土类
            'C15混凝土', 'C20混凝土', 'C25混凝土', 'C30混凝土',
            'C35混凝土', 'C40混凝土', 'C50混凝土', 'C60混凝土',
            'C80混凝土', '商品混凝土', '现浇混凝土', '预制混凝土',
            
            # 钢材类
            'Q235钢材', 'Q345钢材', 'Q390钢材', 'Q420钢材',
            'HPB300钢筋', 'HRB400钢筋', 'HRB500钢筋', 'HRBF400钢筋',
            '螺纹钢', '圆钢', '型钢', 'H型钢', '工字钢', '槽钢', '角钢',
            
            # 玻璃类
            '钢化玻璃', '夹胶玻璃', '中空玻璃', 'LOW-E玻璃',
            '防火玻璃', '单层玻璃', '双层玻璃', '三层玻璃',
            
            # 型材类
            '铝合金型材', '钢型材', '塑钢型材', 'PVC型材',
            
            # 防水材料
            'SBS防水卷材', 'APP防水卷材', '聚氨酯防水涂料',
            '丙烯酸防水涂料', 'JS防水涂料', '防水卷材', '防水涂料',
            
            # 保温材料
            '岩棉板', '挤塑板', '聚苯板', '玻璃棉', '保温板',
            'XPS板', 'EPS板', '酚醛板', '聚氨酯板',
            
            # 砌筑材料
            '红砖', '空心砖', '加气块', '混凝土砌块', '砌块',
            
            # 装饰材料
            '瓷砖', '石材', '大理石', '花岗岩', '涂料', '乳胶漆',
            '壁纸', '木地板', '复合地板', '地砖', '墙砖',
            
            # 门窗材料
            '铝合金门窗', '塑钢门窗', '木门', '防火门', '钢质门',
        }
        
        # 工程类型白名单
        self.project_type_whitelist = {
            # 主要工程类型
            '基础工程', '地基工程', '桩基工程', '土方工程',
            '主体结构工程', '主体工程', '结构工程',
            '砌筑工程', '砌体工程',
            '屋面工程', '防水工程', '保温工程',
            '装饰装修工程', '装修工程', '装饰工程',
            '幕墙工程', '门窗工程',
            
            # 安装工程
            '给排水工程', '给水工程', '排水工程',
            '电气工程', '照明工程', '配电工程',
            '暖通工程', '通风工程', '空调工程',
            '消防工程', '消防报警工程', '消防喷淋工程',
            '智能化工程', '弱电工程',
            '电梯工程', '扶梯工程',
            
            # 细分类型
            '玻璃幕墙', '石材幕墙', '金属幕墙', '铝板幕墙',
            '外墙保温', '内墙装饰', '外墙装饰',
            '地面工程', '楼地面工程', '吊顶工程',
            '抹灰工程', '涂饰工程', '裱糊工程',
            
            # 专项工程
            '钢结构工程', '混凝土工程', '模板工程', '脚手架工程',
            '园林绿化工程', '景观工程', '道路工程', '管网工程',
        }
        
        logger.info(f"Loaded {len(self.material_whitelist)} materials, "
                   f"{len(self.project_type_whitelist)} project types")
    
    def _compile_patterns(self):
        """编译正则表达式"""
        # 标准规范模式
        self.standard_patterns = [
            re.compile(r'GB\s?/?\s?T?\s?\d{4,5}-\d{4}', re.IGNORECASE),
            re.compile(r'JGJ\s?/?\s?T?\s?\d{2,4}-\d{4}', re.IGNORECASE),
            re.compile(r'CJJ\s?/?\s?T?\s?\d{2,4}-\d{4}', re.IGNORECASE),
            re.compile(r'DBJ\s?\d{2}-\d{2,4}-\d{4}', re.IGNORECASE),
            re.compile(r'JTG\s?/?\s?T?\s?\d{2,4}-\d{4}', re.IGNORECASE),
            re.compile(r'TB\s?\d{4,5}-\d{4}', re.IGNORECASE),
        ]
        
        # 材料模式
        self.material_patterns = [
            re.compile(r'C\d{2}混凝土'),
            re.compile(r'Q\d{3}钢材'),
            re.compile(r'[HQ][RPB]{2,3}\d{3}钢筋'),
        ]
        
        logger.info("Compiled regex patterns")
    
    def extract_entities(
        self, 
        text: str, 
        max_entities: int = 15,
        min_confidence: float = 0.85
    ) -> List[Entity]:
        """
        提取实体
        
        Args:
            text: 输入文本
            max_entities: 最大实体数量
            min_confidence: 最小置信度阈值
            
        Returns:
            实体列表
        """
        if not text or len(text.strip()) == 0:
            return []
        
        entities = []
        seen_names = set()  # 去重
        
        # 1. 提取标准规范（正则匹配）
        for pattern in self.standard_patterns:
            for match in pattern.finditer(text):
                name = match.group(0).strip()
                # 标准化格式：移除多余空格
                name = re.sub(r'\s+', '', name)
                # 统一大小写
                name = name.upper()
                
                if name not in seen_names:
                    entities.append(Entity(
                        name=name,
                        type='standard',
                        confidence=1.0,  # 正则匹配，100%准确
                        source_text=self._get_context(text, match.start(), match.end()),
                        position=(match.start(), match.end())
                    ))
                    seen_names.add(name)
        
        # 2. 提取材料
        # 2.1 白名单匹配
        for material in self.material_whitelist:
            if material in text and material not in seen_names:
                pos = text.find(material)
                entities.append(Entity(
                    name=material,
                    type='material',
                    confidence=1.0,  # 白名单，100%准确
                    source_text=self._get_context(text, pos, pos + len(material)),
                    position=(pos, pos + len(material))
                ))
                seen_names.add(material)
        
        # 2.2 正则匹配
        for pattern in self.material_patterns:
            for match in pattern.finditer(text):
                name = match.group(0).strip()
                if name not in seen_names:
                    entities.append(Entity(
                        name=name,
                        type='material',
                        confidence=0.95,  # 正则匹配，95%准确
                        source_text=self._get_context(text, match.start(), match.end()),
                        position=(match.start(), match.end())
                    ))
                    seen_names.add(name)
        
        # 3. 提取工程类型（白名单）
        for project_type in self.project_type_whitelist:
            if project_type in text and project_type not in seen_names:
                pos = text.find(project_type)
                entities.append(Entity(
                    name=project_type,
                    type='project_type',
                    confidence=1.0,  # 白名单，100%准确
                    source_text=self._get_context(text, pos, pos + len(project_type)),
                    position=(pos, pos + len(project_type))
                ))
                seen_names.add(project_type)
        
        # 过滤低置信度实体
        entities = [e for e in entities if e.confidence >= min_confidence]
        
        # 按位置排序
        entities.sort(key=lambda e: e.position[0])
        
        # 限制数量
        result = entities[:max_entities]
        
        logger.info(f"Extracted {len(result)} entities from text (length={len(text)})")
        logger.debug(f"Entity types: {self._count_by_type(result)}")
        
        return result
    
    def _get_context(self, text: str, start: int, end: int, context_size: int = 30) -> str:
        """获取实体的上下文"""
        context_start = max(0, start - context_size)
        context_end = min(len(text), end + context_size)
        return text[context_start:context_end].strip()
    
    def _count_by_type(self, entities: List[Entity]) -> Dict[str, int]:
        """统计各类型实体数量"""
        counts = {}
        for entity in entities:
            counts[entity.type] = counts.get(entity.type, 0) + 1
        return counts
    
    def get_statistics(self) -> Dict[str, int]:
        """获取白名单统计信息"""
        return {
            'material_count': len(self.material_whitelist),
            'project_type_count': len(self.project_type_whitelist),
            'standard_pattern_count': len(self.standard_patterns),
            'material_pattern_count': len(self.material_patterns),
        }
