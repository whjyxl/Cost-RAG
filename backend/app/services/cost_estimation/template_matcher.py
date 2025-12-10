"""
模板匹配服务

根据新建项目参数智能匹配相似的项目模板
"""
from typing import List, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
import math
import logging

from app.models.project_template import ProjectTemplate

logger = logging.getLogger(__name__)


class TemplateMatcher:
    """模板匹配器"""
    
    # 匹配权重配置
    WEIGHTS = {
        'area': 0.4,           # 建筑面积权重40%
        'floors': 0.3,         # 层数权重30%
        'project_type': 0.2,   # 项目类型权重20%
        'other': 0.1           # 其他参数权重10%
    }
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
    
    async def match_templates(
        self,
        area: float,
        underground_floors: Optional[int] = None,
        aboveground_floors: Optional[int] = None,
        project_type: Optional[str] = None,
        top_n: int = 5,
        db: AsyncSession = None
    ) -> List[Dict]:
        """
        匹配相似的项目模板
        
        Args:
            area: 建筑面积
            underground_floors: 地下层数
            aboveground_floors: 地上层数
            project_type: 项目类型
            top_n: 返回Top N个结果
            db: 数据库会话
            
        Returns:
            匹配的模板列表，包含相似度分数
        """
        try:
            # 获取所有启用的模板
            query = select(ProjectTemplate).where(
                ProjectTemplate.is_enabled == True
            )
            
            result = await db.execute(query)
            templates = result.scalars().all()
            
            if not templates:
                return []
            
            # 计算每个模板的相似度
            scored_templates = []
            for template in templates:
                score = self._calculate_similarity(
                    template=template,
                    target_area=area,
                    target_underground_floors=underground_floors,
                    target_aboveground_floors=aboveground_floors,
                    target_project_type=project_type
                )
                
                scored_templates.append({
                    'template': template,
                    'similarity_score': score
                })
            
            # 按相似度排序
            scored_templates.sort(key=lambda x: x['similarity_score'], reverse=True)
            
            # 返回Top N
            return scored_templates[:top_n]
            
        except Exception as e:
            self.logger.error(f"模板匹配失败: {str(e)}")
            raise
    
    def _calculate_similarity(
        self,
        template: ProjectTemplate,
        target_area: float,
        target_underground_floors: Optional[int],
        target_aboveground_floors: Optional[int],
        target_project_type: Optional[str]
    ) -> float:
        """
        计算模板与目标项目的相似度
        
        返回0-1之间的分数，1表示完全匹配
        """
        scores = {}
        
        # 1. 建筑面积相似度（使用对数尺度，因为面积差异可能很大）
        if template.area > 0 and target_area > 0:
            area_ratio = min(target_area, template.area) / max(target_area, template.area)
            scores['area'] = area_ratio
        else:
            scores['area'] = 0.0
        
        # 2. 层数相似度
        floor_score = 0.0
        if target_underground_floors is not None and template.underground_floors is not None:
            if target_underground_floors == template.underground_floors:
                floor_score += 0.5
            elif abs(target_underground_floors - template.underground_floors) <= 1:
                floor_score += 0.3
        
        if target_aboveground_floors is not None and template.aboveground_floors is not None:
            if target_aboveground_floors == template.aboveground_floors:
                floor_score += 0.5
            elif abs(target_aboveground_floors - template.aboveground_floors) <= 2:
                floor_score += 0.3
        
        scores['floors'] = min(floor_score, 1.0)
        
        # 3. 项目类型相似度
        if target_project_type and template.project_type:
            if target_project_type == template.project_type.value:
                scores['project_type'] = 1.0
            else:
                scores['project_type'] = 0.5  # 部分匹配
        else:
            scores['project_type'] = 0.5  # 未知类型，给中等分数
        
        # 4. 其他参数（暂时给默认分数）
        scores['other'] = 0.5
        
        # 加权求和
        total_score = (
            scores['area'] * self.WEIGHTS['area'] +
            scores['floors'] * self.WEIGHTS['floors'] +
            scores['project_type'] * self.WEIGHTS['project_type'] +
            scores['other'] * self.WEIGHTS['other']
        )
        
        return round(total_score, 4)


# 全局匹配器实例
template_matcher = TemplateMatcher()

