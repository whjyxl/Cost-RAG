"""
Excel解析结果存储服务

将解析后的ProjectComparisonData保存到数据库作为项目模板
"""
from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models.project_template import ProjectTemplate, ProjectTemplateCostItem
from app.services.excel_parser.models import (
    ProjectComparisonData,
    ProjectCostData,
    CostItem,
    ItemType,
)

logger = logging.getLogger(__name__)


class ExcelParserStorageService:
    """Excel解析结果存储服务"""
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
    
    async def save_parsed_data(
        self,
        parsed_data: ProjectComparisonData,
        source_file: str,
        user_id: Optional[int] = None,
        db: AsyncSession = None
    ) -> List[int]:
        """
        保存解析结果到数据库
        
        Args:
            parsed_data: 解析后的项目对比数据
            source_file: 源文件路径
            user_id: 用户ID（可选）
            db: 数据库会话
            
        Returns:
            创建的模板ID列表
        """
        template_ids = []
        
        try:
            for project_data in parsed_data.projects:
                # 检查是否已存在同名模板
                existing_template = await self._find_existing_template(
                    project_data.basic_info.name,
                    db
                )
                
                if existing_template:
                    self.logger.warning(
                        f"模板已存在: {project_data.basic_info.name}, "
                        f"跳过创建（ID: {existing_template.id}）"
                    )
                    template_ids.append(existing_template.id)
                    continue
                
                # 创建项目模板
                template = await self._create_template(
                    project_data=project_data,
                    source_file=source_file,
                    user_id=user_id,
                    db=db
                )
                
                # 保存成本项明细
                await self._save_cost_items(
                    template_id=template.id,
                    cost_items=project_data.cost_items,
                    project_name=project_data.basic_info.name,
                    db=db
                )
                
                template_ids.append(template.id)
                self.logger.info(
                    f"成功创建模板: {template.name} (ID: {template.id})"
                )
            
            await db.commit()
            self.logger.info(f"成功保存 {len(template_ids)} 个模板")
            
            return template_ids
            
        except Exception as e:
            await db.rollback()
            self.logger.error(f"保存解析结果失败: {str(e)}")
            raise
    
    async def _find_existing_template(
        self,
        template_name: str,
        db: AsyncSession
    ) -> Optional[ProjectTemplate]:
        """查找已存在的模板"""
        result = await db.execute(
            select(ProjectTemplate).where(
                ProjectTemplate.name == template_name
            )
        )
        return result.scalar_one_or_none()
    
    async def _create_template(
        self,
        project_data: ProjectCostData,
        source_file: str,
        user_id: Optional[int],
        db: AsyncSession
    ) -> ProjectTemplate:
        """创建项目模板"""
        basic_info = project_data.basic_info
        
        # 解析层数信息
        underground_floors, aboveground_floors = self._parse_floors(
            basic_info.floors
        )
        
        # 解析时间信息
        start_date_parsed, completion_date_parsed = self._parse_dates(
            basic_info.start_date,
            basic_info.completion_date
        )
        
        template = ProjectTemplate(
            name=basic_info.name,
            area=basic_info.area,
            floors=basic_info.floors,
            underground_floors=underground_floors,
            aboveground_floors=aboveground_floors,
            start_date=basic_info.start_date,
            completion_date=basic_info.completion_date,
            start_date_parsed=start_date_parsed,
            completion_date_parsed=completion_date_parsed,
            total_cost=project_data.total_cost,
            unit_cost=project_data.unit_cost,
            source_file=source_file,
            created_by=user_id,
            is_enabled=True
        )
        
        db.add(template)
        await db.flush()  # 获取ID但不提交
        
        return template
    
    async def _save_cost_items(
        self,
        template_id: int,
        cost_items: List[CostItem],
        project_name: str,
        db: AsyncSession
    ):
        """保存成本项明细"""
        for cost_item in cost_items:
            # 获取该项目的成本值
            item_value = cost_item.project_values.get(project_name)
            
            if not item_value:
                continue
            
            # 判断层级关系
            is_primary = cost_item.is_primary_section()
            is_secondary = cost_item.is_secondary_section()
            primary_code = cost_item.get_primary_section_code()
            
            template_cost_item = ProjectTemplateCostItem(
                template_id=template_id,
                item_code=cost_item.item_code,
                item_name=cost_item.item_name,
                item_type=cost_item.item_type.value,
                total_price=item_value.value if item_value.value is not None else 0.0,
                unit_price=float(item_value.unit) if item_value.unit and self._is_numeric(item_value.unit) else None,
                notes=item_value.notes,
                is_primary_section=is_primary,
                is_secondary_section=is_secondary,
                primary_section_code=primary_code,
                row_number=cost_item.row_number
            )
            
            db.add(template_cost_item)
    
    def _parse_floors(self, floors_str: Optional[str]) -> tuple[Optional[int], Optional[int]]:
        """解析层数字符串，提取地下和地上层数"""
        if not floors_str:
            return None, None
        
        underground = None
        aboveground = None
        
        # 尝试匹配常见格式：地下X层/地上Y层
        import re
        
        # 匹配地下层数
        underground_match = re.search(r'地下[（(]?(\d+)[）)]?层', floors_str)
        if underground_match:
            underground = int(underground_match.group(1))
        
        # 匹配地上层数
        aboveground_match = re.search(r'地上[（(]?(\d+)[）)]?层', floors_str)
        if aboveground_match:
            aboveground = int(aboveground_match.group(1))
        
        return underground, aboveground
    
    def _parse_dates(
        self,
        start_date_str: Optional[str],
        completion_date_str: Optional[str]
    ) -> tuple[Optional[datetime], Optional[datetime]]:
        """解析时间字符串"""
        start_parsed = None
        completion_parsed = None
        
        if start_date_str:
            start_parsed = self._parse_date_string(start_date_str)
        
        if completion_date_str:
            completion_parsed = self._parse_date_string(completion_date_str)
        
        return start_parsed, completion_parsed
    
    def _parse_date_string(self, date_str: str) -> Optional[datetime]:
        """解析单个时间字符串"""
        import re
        
        # 匹配年份：2011年12月
        year_match = re.search(r'(\d{4})年', date_str)
        month_match = re.search(r'(\d{1,2})月', date_str)
        
        if year_match:
            year = int(year_match.group(1))
            month = int(month_match.group(1)) if month_match else 1
            day = 1  # 默认1号
            
            try:
                return datetime(year, month, day)
            except ValueError:
                pass
        
        return None
    
    def _is_numeric(self, value: str) -> bool:
        """判断字符串是否为数字"""
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False


# 全局服务实例
storage_service = ExcelParserStorageService()

